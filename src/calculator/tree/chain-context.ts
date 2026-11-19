// What the pools of a call's chain of steps read (spec 009, rule Y, FR-017): its steps' terms as rows, a cache's writer,
// and the working values the call wrote and reads back, either as a link of its chain (the running total) or as its
// writer's rows, which a pool takes in its place when they only join sources (tree/flatten.ts `dissolve`).
import type { RecNode } from "../recording.ts";
import { aboveRenames } from "./above-renames.ts";
import type { Opened } from "./cache-formulas.ts";
import { readsPath } from "./cache-picks.ts";
import { isClamp, topOp } from "./expr.ts";
import { goldFoodTerm } from "./gold-food-chain.ts";
import { wornStep } from "./gold-food-step.ts";
import { near } from "./math.ts";
import type { FirstLevelContext } from "./mould.ts";
import type { TermAt } from "./pools.ts";
import { callText } from "./rows.ts";
import type { CacheOpen, Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import type { Terms } from "./terms.ts";
import type { Reads } from "./val-path.ts";

export interface ChainDeps {
  nodes: readonly RecNode[];
  steps: (id: number) => readonly Step[];
  terms: (n: RecNode) => Terms;
  /** The values a loop's working value took, by "writer|path" (tree/entries.ts). */
  turns: (key: string) => readonly { v: unknown }[];
  opened: (
    o: CacheOpen,
    depth: number,
    seen: ReadonlySet<number>,
  ) => Opened | null;
}

/** The context of call `n`'s chain, its working values opened at `depth` under the calls `seen`. */
export function chainContext(
  { nodes, steps, terms: termsOf, turns, opened }: ChainDeps,
  n: RecNode,
  depth: number,
  seen: ReadonlySet<number>,
): FirstLevelContext {
  const all = steps(n.id);
  const last = all.at(-1);
  const terms = termsOf(n);
  const reads: Reads = new Map((n.r ?? []).map(([p, v]) => [p, v]));
  // a golden food's terms named by their role (tree/gold-food-chain.ts); a clamp its own row, the clamp in its ⓘ and
  // its constants its rows, even when it leaves its source's value as it is (FR-008, answer B of 20/11); else the
  // assembly's
  const termAt: TermAt = (e, op, at) => {
    const turn = { args: n.a, steps: all, at };
    const term = (t: Expr, o: "*" | "+") => terms.term(t, o, reads, turn);
    return (
      goldFoodTerm(e, op, { block: n, nodes, steps: all, reads, term }) ??
      (isClamp(e) ? terms.clampAt(e, reads, turn) : term(e, op))
    );
  };
  // the worn food's step, one row (tree/gold-food-step.ts, the rule of 19/11)
  termAt.step = (ts, at) =>
    wornStep(ts, {
      block: n,
      nodes,
      reads,
      term: (t) => termAt(t, "*", at),
    });
  // a working value the call's own block wrote: its cache's writer is the call
  const own = (r: Row | null | undefined) =>
    r && typeof r.open === "object" && r.open?.writer === n.id ? r.open : null;
  return {
    expr: last && near(last.v, n.v) ? last.e : null,
    term: (e) => terms.term(e, "+", reads),
    steps: all,
    termAt,
    ownCache: (e, at) => {
      const o = own(termAt(e, "+", at));
      // out of a loop: a loop's step is recorded once, for its last turn, and its cache opens into its turns
      return (
        !!o &&
        turns(`${String(n.id)}|${o.path}`).every((t) =>
          all.some((st) => near(st.v, t.v)),
        )
      );
    },
    // its rows are the terms of the step that made its value, before one that only reads it back (tree/caches.ts);
    // they are renamed under it and open under it, as when it opened (tree/places.ts `below`)
    joins: (r) => {
      const o = own(r);
      const st =
        o && all.find((x) => near(x.v, o.value) && !readsPath(x.e, o.path));
      const op = topOp(st?.e);
      const got = o && op && opened(o, depth, new Set([...seen, n.id]));
      if (!op || !got) return null;
      const up = [...(r.up ?? []), { code: r.node.code, name: r.node.name }];
      return {
        op,
        rows: aboveRenames(got.rows, up).map((k) => ({ ...k, up })),
      };
    },
    writerOf: (r) => {
      const o = r.open;
      const w = o !== null && typeof o === "object" ? nodes[o.writer] : null;
      return w ? callText(w) : undefined;
    },
  };
}
