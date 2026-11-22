// The terms of the answer key (spec 010, research R9; the prototype's gabarito.ts): a step of the root opened by its
// pool's operator, crossing the passage values the root wrote and read back and a whole sum divided by 100. It only
// reads the recording, and counts each kind of noise of the trace it had to skip or cross.
import type { RecNode } from "../recording.ts";
import type { Expr, Step } from "../recorded/steps.ts";

export const relDiff = (a: number, b: number): number =>
  a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);
export const near = (a: unknown, b: unknown): boolean =>
  typeof a === "number" && typeof b === "number" && relDiff(a, b) < 1e-9;
export const callRef = (n: Pick<RecNode, "b" | "a">): string =>
  `${n.b}(${n.a.map((x) => JSON.stringify(x)).join(",")})`;
/** A root whose shape is outside the pools' rule (research R1): the answer key refuses it with this reason. */
export class OutOfRule extends Error {}
export interface RootFormError {
  error: "rootForm";
  reason: string;
}
export const outOfRule = (why: string): RootFormError => ({
  error: "rootForm",
  reason: `forma de raiz fora da regra dos pools: ${why}`,
});
/** The game's loop counters of a block's preamble: noise, never a passage value. */
export const SCRATCH = "DummyNumbersStatManager.";

export interface AnswerTerm {
  kind: "source" | "constant";
  /** The main reference: `Block(args)` of a call or the path of a read; in a constant, its number. */
  ref: string;
  /** All the term's references, in the code's order (the first is `ref`). */
  refs: string[];
  /** The recorded node of each reference (null for a read), to go down to its children. */
  nodes: (number | null)[];
  /** The term's value as it enters the pool, before its weight. */
  value: number;
  /** 1, or 1/100 when the game divides the whole sum by 100; negative for a subtracted term. */
  weight: number;
  /** The passage values crossed to reach the term. */
  via: string[];
}
/** A term still with its expression and its own noise, before it is known whether it is the accumulator. */
export type RawTerm = AnswerTerm & { e: Expr; noise: Record<string, number> };

export interface TermContext {
  nodes: readonly RecNode[];
  steps: readonly Step[];
  /** The root's child calls. */
  kids: readonly RecNode[];
  /** Paths the root wrote and may read back, with the values written. */
  passage: ReadonlyMap<string, readonly number[]>;
  accumulator: string | null;
}

export function termReader(ctx: TermContext) {
  const pollution: Record<string, number> = {};
  // The count goes to `sink`: in a term, to its own bucket, added only if the term stays (the accumulator leaves).
  let sink = pollution;
  const bump = (k: string, n = 1) => {
    if (n > 0) sink[k] = (sink[k] ?? 0) + n;
  };
  const keep = (from: Record<string, number>) => {
    for (const [k, n] of Object.entries(from))
      pollution[k] = (pollution[k] ?? 0) + n;
  };
  const usedSteps = new Set<number>();

  /**
   * The expression that gave a passage's value: a step of the root not crossed yet on this way down (with its index), or
   * else a child call with that value (a call the root wrote with `=` makes no step).
   */
  function passageExpr(
    v: number,
    seen: ReadonlySet<number>,
  ): { e: Expr; step: number | null } | null {
    const i = ctx.steps.findIndex((s, j) => !seen.has(j) && near(s.v, v));
    const s = ctx.steps[i];
    if (s) return { e: s.e, step: i };
    const k = ctx.kids.find((n) => near(n.v, v));
    return k ? { e: { t: "call", id: k.id, v }, step: null } : null;
  }
  const passagePathOf = (v: unknown): string | null => {
    if (typeof v !== "number" || v === 0 || v === 1) return null;
    for (const [p, vs] of ctx.passage) if (vs.some((x) => near(x, v))) return p;
    return null;
  };

  /**
   * Takes the wrappers off: a variable's definition and a passage read back. `seen` holds the steps already opened on
   * the way down (it grows here), the one the caller opens included: a passage never leads back to one of them, so a
   * step that holds the value it gave never loops, and one that copies a passage reaches where the value came from.
   */
  function unwrap(
    e: Expr,
    via: string[],
    quiet = false,
    seen = new Set<number>(),
  ): Expr {
    const count = (k: string) => {
      if (!quiet) bump(k);
    };
    for (;;) {
      if (e.t === "def") {
        count("def");
        e = e.e;
        continue;
      }
      if (e.t === "fn" && e.name === null && e.args.length === 1 && e.args[0]) {
        count("unnamedWrapper");
        e = e.args[0];
        continue;
      }
      if (e.t === "read" || e.t === "val") {
        // a read is a passage by its path; a value with no name, by the value the root wrote
        const p =
          e.t === "read"
            ? ctx.passage.has(e.p)
              ? e.p
              : null
            : passagePathOf(e.v);
        const x = p && typeof e.v === "number" ? passageExpr(e.v, seen) : null;
        const step = x?.step ?? null;
        if (p && !x) {
          // no step left on this way down and no child call: the passage stays its own value
          count("passageCycle");
          return e;
        }
        if (p && x) {
          count(e.t === "val" ? "passageVal" : "passageRead");
          if (step !== null) {
            seen.add(step);
            usedSteps.add(step);
          }
          via.push(p);
          e = x.e;
          continue;
        }
      }
      return e;
    }
  }

  function refsOf(
    e: Expr,
    via: string[],
    out: string[],
    nodes: (number | null)[],
    seen: ReadonlySet<number> = new Set(),
  ): void {
    const s = new Set(seen);
    const u = unwrap(e, via, false, s);
    const down = (x: Expr) => {
      refsOf(x, via, out, nodes, s);
    };
    switch (u.t) {
      case "call": {
        const n = ctx.nodes[u.id];
        if (n) {
          out.push(callRef(n));
          nodes.push(n.id);
        }
        return;
      }
      case "read":
        if (u.p.startsWith("DNSM.") && u.p !== ctx.accumulator)
          bump("dnsmCacheSource");
        out.push(u.p);
        nodes.push(null);
        return;
      case "val":
        bump("valueNoSource");
        return;
      case "op":
        down(u.l);
        down(u.r);
        return;
      case "fn":
        u.args.forEach(down);
        return;
      case "not":
        down(u.a);
        return;
      default:
        return;
    }
  }

  const constant = (
    u: Expr,
    value: number,
    weight: number,
    via: string[],
    noise: Record<string, number>,
  ): RawTerm => ({
    kind: "constant",
    ref: String(value),
    refs: [],
    nodes: [],
    value,
    weight,
    via,
    e: u,
    noise,
  });

  /** Opens an expression by the pool's operation (+ or *), crossing passages and the "/ 100" of a whole sum. */
  function flat(
    e: Expr,
    op: "+" | "*",
    weight: number,
    out: RawTerm[],
    via: string[],
    seen: ReadonlySet<number> = new Set(),
  ): void {
    const v0 = [...via];
    const s0 = new Set(seen);
    const u = unwrap(e, v0, false, s0);
    if (u.t === "op" && u.o === op) {
      flat(u.l, op, weight, out, v0, s0);
      flat(u.r, op, weight, out, v0, s0);
      return;
    }
    if (op === "+" && u.t === "op" && u.o === "-") {
      flat(u.l, op, weight, out, v0, s0);
      flat(u.r, op, -weight, out, v0, s0);
      return;
    }
    if (
      op === "+" &&
      u.t === "op" &&
      u.o === "/" &&
      u.r.t === "num" &&
      typeof u.r.v === "number"
    ) {
      const inner = unwrap(u.l, [...v0], true, new Set(s0));
      if (inner.t === "op" && inner.o === "+") {
        bump("divideBy100");
        flat(u.l, op, weight / u.r.v, out, v0, s0);
        return;
      }
    }
    if (typeof u.v !== "number") throw new OutOfRule("um termo sem número");
    if (u.t === "num") {
      out.push(constant(u, u.v, weight, v0, {}));
      return;
    }
    const refs: string[] = [];
    const nodes: (number | null)[] = [];
    const tv = [...v0];
    const saved = sink;
    const local: Record<string, number> = {};
    sink = local;
    refsOf(u, tv, refs, nodes, s0);
    const [ref] = refs;
    if (!ref) bump("termNoRef");
    sink = saved;
    out.push(
      ref
        ? {
            kind: "source",
            ref,
            refs,
            nodes,
            value: u.v,
            weight,
            via: tv,
            e: u,
            noise: local,
          }
        : constant(u, u.v, weight, tv, local),
    );
  }

  return { pollution, bump, keep, usedSteps, unwrap, flat };
}
