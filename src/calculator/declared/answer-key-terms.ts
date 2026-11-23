// The terms of the answer key (spec 010, research R9; the prototype's gabarito.ts): a step of the root opened by its
// pool's operator, crossing the passage values the root wrote and read back and a whole sum divided by 100. It only
// reads the recording, and counts each kind of noise of the trace it had to skip or cross.
import type { Expr } from "../recorded/steps.ts";
import { callRef, near, OutOfRule } from "./answer-key-pool.ts";
import type { RawPool, RawTerm } from "./answer-key-pool.ts";
import { onlyAdds } from "./answer-key-running.ts";
import { passageReader } from "./answer-key-passage.ts";
import type { PassageContext } from "./answer-key-passage.ts";
import { isCacheRead } from "./cache-author.ts";

export {
  callRef,
  joinPools,
  KIND,
  near,
  OP,
  OutOfRule,
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

export interface TermContext extends PassageContext {
  accumulator: string | null;
  /** The paths that ran of the root's conditions outside its `return` (answer-key-top.ts, branchesOf). */
  branches?: readonly { value: number; e: Expr }[];
  /** The pools a running total kept in a counter of the game opens into, for a term that reads it (T177). */
  running?: (e: Expr) => RawPool[] | null;
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
  /** What reading a chain changes here, to put back when the chain is not opened. */
  const snapshot = () => {
    const [u, c, at] = [[...usedSteps], [...crossed], sink];
    const counts = { ...at };
    return () => {
      usedSteps.clear();
      for (const x of u) usedSteps.add(x);
      crossed.clear();
      for (const x of c) crossed.add(x);
      for (const k of Object.keys(at)) Reflect.deleteProperty(at, k);
      Object.assign(at, counts);
    };
  };
  const branches = ctx.branches ?? [];
  const passageExpr = passageReader(ctx);
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
            ? passageExpr(ps, e.v, seen, e.t === "read")
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
        if (isCacheRead(u.p) && u.p !== ctx.accumulator)
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
    if (op === "+" && (u.t === "read" || u.t === "val") && ctx.running) {
      const undo = snapshot();
      const opened = ctx.running(u);
      if (opened && onlyAdds(opened)) {
        bump("runningTotal");
        for (const t of opened.flatMap((p) => p.terms as RawTerm[]))
          out.push({ ...t, weight: t.weight * weight });
        return;
      }
      // one that does more than add stays the value it holds, with nothing of its chain left behind (T177 r1)
      if (opened) undo();
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
