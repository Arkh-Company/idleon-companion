// The terms of the answer key (spec 010, research R9; the prototype's gabarito.ts): a step of the root opened by its
// pool's operator, crossing the passage values the root wrote and read back and a whole sum divided by 100. It only
// reads the recording, and counts each kind of noise of the trace it had to skip or cross.
import type { RecNode } from "../recording.ts";
import type { Expr, Step } from "../recorded/steps.ts";
import { relDiff } from "./answer-key-pool.ts";
import type { RawTerm } from "./answer-key-pool.ts";
import { callKey } from "./refs.ts";

export {
  atCap,
  joinPools,
  KIND,
  OP,
  readBack,
  relDiff,
  strip,
} from "./answer-key-pool.ts";
export type {
  AnswerTerm,
  Part,
  PoolKind,
  RawPool,
  RawTerm,
} from "./answer-key-pool.ts";

export const near = (a: unknown, b: unknown): boolean =>
  typeof a === "number" && typeof b === "number" && relDiff(a, b) < 1e-9;
export const callRef = (n: Pick<RecNode, "b" | "a">): string =>
  callKey(n.b, n.a);
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

export interface TermContext {
  nodes: readonly RecNode[];
  steps: readonly Step[];
  /** The root's child calls. */
  kids: readonly RecNode[];
  /** Paths the root wrote and may read back, with each write's value and place in the root's step log. */
  passage: ReadonlyMap<string, readonly { v: number; xi: number }[]>;
  /** Where each step was last recorded in the root's step log (BlockSteps.stepAt), to tell which step gave a write. */
  stepAt: readonly number[];
  accumulator: string | null;
  /** The paths that ran of the root's conditions outside its `return` (answer-key-top.ts, branchesOf). */
  branches?: readonly { value: number; e: Expr }[];
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
  /** The branches crossed, by index: each one is a ❓ layer of the root. */
  const crossed = new Set<number>();
  const branches = ctx.branches ?? [];

  interface Giver {
    e: Expr;
    step: number | null;
  }
  const callOf = (k: RecNode, v: number): Giver => ({
    e: { t: "call", id: k.id, v },
    step: null,
  });
  /** The child calls a step holds in its expression: their value went into that step, never straight to a write. */
  const callsIn = (e: Expr): number[] =>
    e.t === "call"
      ? [e.id]
      : e.t === "op"
        ? [...callsIn(e.l), ...callsIn(e.r)]
        : e.t === "fn"
          ? e.args.flatMap(callsIn)
          : e.t === "def"
            ? callsIn(e.e)
            : e.t === "not"
              ? callsIn(e.a)
              : [];
  const inSteps = new Set(ctx.steps.flatMap((s) => callsIn(s.e)));
  /**
   * What gave a write, by its place (like matchChain): the step with its value recorded last before it, and the child
   * call with its value outside any step (a call the root wrote with `=` makes no step) that started last after that
   * step and before the write. More than one of them: the place does not decide.
   */
  function giversOf(w: { v: number; xi: number }): Giver[] {
    const steps = ctx.steps.flatMap((s, j) => {
      const at = ctx.stepAt[j] ?? -1;
      return at < w.xi && near(s.v, w.v) ? [{ at, j, e: s.e }] : [];
    });
    const lastStep = Math.max(...steps.map((s) => s.at));
    const fits = (n: RecNode) =>
      n.pxi > lastStep && n.pxi <= w.xi && near(n.v, w.v);
    const kids = ctx.kids.filter((n) => !inSteps.has(n.id) && fits(n));
    // a call written with `=` and then used in a later step: it gave the write too
    if (steps.length + kids.length === 0 && ctx.kids.some(fits))
      throw new OutOfRule(
        `a passagem ${String(w.v)} vem de uma chamada filha que também entra num passo, e a posição não decide entre elas`,
      );
    const lastKid = Math.max(...kids.map((n) => n.pxi));
    return [
      ...steps
        .filter((s) => s.at === lastStep)
        .map((s) => ({ e: s.e, step: s.j })),
      ...kids.filter((n) => n.pxi === lastKid).map((n) => callOf(n, w.v)),
    ];
  }
  /**
   * The expression that gave a passage's value, with the path it crossed: what gave the passage's writes with that
   * value (the same one for all of them, or the place does not decide), null when it is a step already opened on this
   * way down.
   */
  function passageExpr(
    paths: readonly string[],
    v: number,
    seen: ReadonlySet<number>,
  ): (Giver & { path: string }) | null {
    const found = new Map<string, Giver & { path: string }>();
    for (const path of paths)
      for (const w of ctx.passage.get(path) ?? [])
        if (near(w.v, v))
          for (const g of giversOf(w))
            found.set(JSON.stringify([g.step, g.e]), { ...g, path });
    if (found.size > 1)
      throw new OutOfRule(
        `a passagem ${String(v)} sai de mais de uma escrita, e a posição não decide entre elas`,
      );
    const [g] = found.values();
    return g && (g.step === null || !seen.has(g.step)) ? g : null;
  }
  /** The passages that hold a value with no name: never 0 or 1, which any step may give. */
  const passagePathsOf = (v: unknown): string[] =>
    typeof v !== "number" || v === 0 || v === 1
      ? []
      : [...ctx.passage]
          .filter(([, ws]) => ws.some((w) => near(w.v, v)))
          .map(([p]) => p);

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
        const ps =
          e.t === "read"
            ? ctx.passage.has(e.p)
              ? [e.p]
              : []
            : passagePathsOf(e.v);
        const x =
          ps.length > 0 && typeof e.v === "number"
            ? passageExpr(ps, e.v, seen)
            : null;
        const step = x?.step ?? null;
        const p = x?.path ?? ps[0];
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
      // a value with no name that a condition's path gave: that path's expression (never twice on one way down)
      if (e.t === "val" && typeof e.v === "number") {
        const v = e.v;
        const bi = branches.findIndex((b) => near(b.value, v));
        const b = branches[bi];
        if (b && !seen.has(-1 - bi)) {
          count("conditionPath");
          seen.add(-1 - bi);
          crossed.add(bi);
          e = b.e;
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

  /**
   * Opens an expression by the pool's operation (+ or *), crossing passages and the "/ 100" of a whole sum. With a
   * `scale` (a ➗ line only), a constant times a sum opens the sum, each term scaled by the constant.
   */
  function flat(
    e: Expr,
    op: "+" | "*",
    weight: number,
    out: RawTerm[],
    via: string[],
    seen: ReadonlySet<number> = new Set(),
    scale?: number,
  ): void {
    const v0 = [...via];
    const s0 = new Set(seen);
    const u = unwrap(e, v0, false, s0);
    if (u.t === "op" && u.o === op) {
      flat(u.l, op, weight, out, v0, s0, scale);
      flat(u.r, op, weight, out, v0, s0, scale);
      return;
    }
    if (op === "+" && u.t === "op" && u.o === "-") {
      flat(u.l, op, weight, out, v0, s0, scale);
      flat(u.r, op, -weight, out, v0, s0, scale);
      return;
    }
    if (scale !== undefined && op === "+" && u.t === "op" && u.o === "*") {
      const [k, sum] = u.l.t === "num" ? [u.l.v, u.r] : [u.r.v, u.l];
      const inner = unwrap(sum, [...v0], true, new Set(s0));
      if (
        typeof k === "number" &&
        (u.l.t === "num" || u.r.t === "num") &&
        inner.t === "op" &&
        (inner.o === "+" || inner.o === "-")
      ) {
        flat(sum, op, weight * k, out, v0, s0, scale * k);
        return;
      }
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
        flat(u.l, op, weight / u.r.v, out, v0, s0, scale);
        return;
      }
    }
    if (typeof u.v !== "number") throw new OutOfRule("um termo sem número");
    const scaled = scale !== undefined && scale !== 1 ? { scale } : {};
    if (u.t === "num") {
      out.push({ ...constant(u, u.v, weight, v0, {}), ...scaled });
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
            ...scaled,
            via: tv,
            e: u,
            noise: local,
          }
        : { ...constant(u, u.v, weight, tv, local), ...scaled },
    );
  }

  return { pollution, bump, keep, usedSteps, crossed, unwrap, flat };
}
