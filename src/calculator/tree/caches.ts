// A cache read opens into what its writer computed for it (spec 008, T022): the port of pieces.cjs `cacheRows`,
// `entryRows`, `stepRows`, `stepRowsAt` and `cacheStepRows` from the bench at BASELINE-4. A cache the writer filled in a
// loop opens into its turns (tree/entries.ts): one part per turn that added to it, a factor for a turn that multiplied
// it; a cache written once opens into the writer's step that gave the value, or into the whole writer when the writer
// returned it. The bench builds the whole tree at once; here a cache read is a lazy row whose rows are built when the
// player opens it, with the loop entry and the bubble entries open when the row was made (ENTRY_P, OPUS4_OPEN). The
// tests that only read the recording (which writes, which turn, which side of a step) are in cache-picks.ts.
// Left out until their own phase: the names of the parts (US1c: a part has the generic name, and the filters that
// compare names wait for them) and the cache's ⓘ (LAST_WRITER_FORMULA, US1b-3).
import type { RecNode } from "../recording.ts";
import {
  addedSide,
  bubbleWrites,
  factorTurn,
  filledHere,
  readsPath,
  turnRead,
} from "./cache-picks.ts";
import type { Entries, Entry, TurnRead } from "./entries.ts";
import { near } from "./math.ts";
import { MAX_DEPTH } from "./pieces.ts";
import { callText, row } from "./rows.ts";
import type { CacheOpen, Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import { flat } from "./expr.ts";
import {
  LOOP_ENTRY_CACHES,
  partsOf,
  RUN_TOTALS,
  skillRankRows,
  TURN_KINDS,
} from "./loop-parts.ts";
import { hasKids } from "./terms.ts";
import type { Terms } from "./terms.ts";
import { any } from "./val-path.ts";

export interface CacheContext {
  nodes: readonly RecNode[];
  entries: Entries;
  writerByValue(p: string, value: unknown): RecNode | null;
  /** The steps of call `id`. */
  steps(id: number): readonly Step[];
  /** The rows of call `id`, or null when the depth limit or a cycle cuts it. */
  explain(id: number, depth: number, seen: ReadonlySet<number>): Row[] | null;
  /** The writers of a call's cache reads, by path. */
  linksOf(n: RecNode): ReadonlyMap<string, number>;
  /** The terms of writer `w`'s steps, with its own links: the rows they make open under `seen`. */
  terms(w: RecNode, seen: readonly number[]): Terms;
  finish(v: unknown, rows: Row[], ones: boolean): Row[];
}

const stamp = (rows: Row[], seen: readonly number[]) =>
  rows.map((r) => (r.seen ? r : { ...r, seen }));

export function makeCaches(ctx: CacheContext) {
  const { nodes, entries } = ctx;
  let entryP: string | null = null;
  let opening = new Set<string>();
  const writerOf = (
    links: ReadonlyMap<string, number>,
    p: string,
    v: unknown,
  ) => nodes[links.get(p) ?? -1] ?? ctx.writerByValue(p, v);
  /** The rows of call `id` under `seen`, placed as that call's own. */
  const explained = (id: number, depth: number, seen: ReadonlySet<number>) => {
    const rows = ctx.explain(id, depth, seen);
    return rows && stamp(rows, [...seen, id]);
  };

  /** pieces.cjs stepRowsAt: step `at` of writer `w` (its expression `e`), with the turn's own reads first. */
  function stepRowsAt(
    w: RecNode,
    steps: readonly Step[],
    at: number,
    e: Expr,
    seen: ReadonlySet<number>,
    turnReads: readonly TurnRead[],
  ): Row[] {
    // a turn read of 0 names nothing: 0 is every unset index and total
    const reads = new Map([
      ...(w.r ?? []).map(([p, v]) => [p, v] as const),
      ...turnReads.filter((x) => x[1] !== 0).map(([p, v]) => [p, v] as const),
    ]);
    const terms = ctx.terms(w, [...seen, w.id]);
    const { rows, op } = terms.rowsAt({ args: w.a, steps, at }, e, reads);
    return ctx.finish(e.v, rows, op === "*");
  }
  const stepRows = (
    w: RecNode,
    steps: readonly Step[],
    value: unknown,
    seen: ReadonlySet<number>,
    turnReads: readonly TurnRead[],
  ) => {
    const at = steps.findIndex((x) => near(x.v, value));
    const st = steps[at];
    return st ? stepRowsAt(w, steps, at, st.e, seen, turnReads) : null;
  };

  function entryRows(
    w: RecNode,
    p: string,
    value: number,
    depth: number,
    seen: ReadonlySet<number>,
    only?: readonly Entry[],
  ): Row[] | null {
    const L = only ?? entries.get(`${String(w.id)}|${p}`);
    if (!L) return null;
    const next = new Set(seen).add(w.id);
    // a turn's rows open where the bench built their kids: one level down, under the writer
    const kids = (x: Row) => opens(x, depth + 1, next);
    const trivial = (rows: Row[]) =>
      !rows.length ||
      (rows.every(
        (x) =>
          x.node.name.startsWith("Fixed") ||
          !!x.earlier ||
          near(x.node.value, 1) ||
          near(x.node.value, 0),
      ) &&
        !rows.some(kids));
    const inEntry = <T>(fn: () => T): T => {
      const before = entryP;
      entryP = p;
      try {
        return fn();
      } finally {
        entryP = before;
      }
    };
    // a turn's own rows: its steps, else the call it made that has the turn's value, else the cache it read
    const turnRows = (q: Entry, target: number) => {
      const r = inEntry(() => stepRows(w, q.s, target, seen, q.r));
      let rows = r ?? [];
      const call = q.k
        .map((id) => nodes[id])
        .find((k) => k && near(k.v, target));
      if (trivial(rows) && call)
        rows = explained(call.id, depth + 1, next) ?? [];
      const read = call ? undefined : turnRead(q, p, target);
      const turnLinks = new Map([
        ...ctx.linksOf(w),
        ...q.r.flatMap(([rp, , wid]) =>
          wid === undefined ? [] : [[rp, wid] as const],
        ),
      ]);
      if (read && !rows.some(kids))
        rows =
          cache(
            read[0],
            target,
            writerOf(turnLinks, read[0], target),
            depth + 1,
            next,
          ) ?? [];
      if (!rows.length && !r) {
        // a turn that adds a function of its own to the running total: that function's rows
        const at = q.s.findIndex((x) => near(x.v, q.v));
        const side = addedSide(q.s[at]?.e, p, Number(q.v) - target);
        if (side?.t === "fn" && near(side.v, target))
          rows = inEntry(() => stepRowsAt(w, q.s, at, side, seen, q.r));
      }
      return { rows, call, read };
    };

    const parts = partsOf(L);
    // OPUS4-10: every write is 0: the last write's own turn, never the writer's value
    if (!parts.length) {
      const q0 = L.filter((q) => near(q.v, value) && q.s.length).pop();
      return q0 ? turnRows(q0, value).rows : [];
    }
    // one turn made the value
    const [one] = parts;
    if (one && parts.length === 1) return turnRows(one.q, value).rows;
    const out = parts.map((pt): Row => {
      if (pt.kind === "x" && pt.st) {
        const terms = flat(pt.st.e, "*").filter(
          (t) =>
            !(
              (t.t === "val" || t.t === "read") &&
              near(t.v, Number(pt.q.v) / pt.d)
            ),
        );
        const reads = new Map((w.r ?? []).map(([rp, rv]) => [rp, rv]));
        const at = ctx.terms(w, [...next]);
        const rows = terms.flatMap((t) => at.term(t, "*", reads) ?? []);
        return {
          node: row({
            pieceKey: null,
            value: pt.d,
            code: null,
            name: "Multiplier",
            fmt: "x",
            flags: {},
          }),
          open: null,
          group: ctx.finish(pt.d, at.tidy(rows, "*", w.a), true),
        };
      }
      const { rows, call, read } = turnRows(pt.q, pt.d);
      const kind = TURN_KINDS.find((k) =>
        pt.q.r.some(
          ([rp, rv]) =>
            k.test.test(rp) && (!k.found || (rv === true && near(pt.d, 1))),
        ),
      );
      return {
        node: row({
          pieceKey: null,
          value: pt.d,
          code: read ? read[0] : call ? callText(call) : null,
          fmt: "+",
          ...(kind?.found ? { condition: "owned" as const } : {}),
          ...(kind ? { leaf: kind.leaf } : {}),
        }),
        open: null,
        // OPUS3-F3c: a found item is a yes/no with nothing under it
        group: kind?.found ? [] : rows,
      };
    });
    return ctx.finish(value, out, false);
  }

  /** pieces.cjs cacheRows, with writer `w` found for it; null when the depth limit or a cycle cuts it. */
  function cache(
    p: string,
    value: number,
    w: RecNode | null,
    depth: number,
    seen: ReadonlySet<number>,
  ): Row[] | null {
    const key = w && `${String(w.id)}|${p}`;
    const LL = (key ? entries.get(key) : undefined) ?? [];
    const last = LL.at(-1);
    const deep = !!w && seen.has(w.id) && depth <= MAX_DEPTH;
    const k4 = w && `${String(w.id)}|${p}|${String(p === entryP)}`;
    // OPUS4-4: another bubble of the same loop opens into its own entry
    if (w && deep && any(LOOP_ENTRY_CACHES, p) && k4 && !opening.has(k4)) {
      const only = bubbleWrites(LL, value, p === entryP, any(RUN_TOTALS, p));
      if (LL.length && (only || (only === undefined && near(last?.v, value)))) {
        opening.add(k4);
        try {
          const s2 = new Set(seen);
          s2.delete(w.id);
          const fe = entryRows(w, p, value, depth, s2, only ?? undefined);
          if (fe?.length) return fe;
        } finally {
          opening.delete(k4);
        }
      }
    }
    // deep-2: a skill's rank opens into the levels the builder pass recorded in the entry of this path
    const ranks = skillRankRows(p, w, LL[0]);
    if (ranks) return ctx.finish(value, ranks, false);
    const wsteps = w ? ctx.steps(w.id) : [];
    // a cache the call being built computed in one of its own steps, not one that reads the cache itself: that step
    if (w && deep && p.startsWith("DNSM.")) {
      const at = wsteps.findIndex(
        (x) => near(x.v, value) && !readsPath(x.e, p),
      );
      const st0 = wsteps[at];
      if (st0 && !near(w.v, value))
        return stepRowsAt(w, wsteps, at, st0.e, seen, []);
    }
    // [T3] a cache the call changed once in a turn of its own loop: the turn whose step is a product of an earlier read
    // of the cache and a call
    if (w && deep && p.startsWith("DNSM.") && key && entries.has(key)) {
      const q = factorTurn(LL, p, value);
      if (q) {
        const fe = entryRows(w, p, value, depth, seen, [q]);
        if (fe?.length) return fe;
      }
    }
    // [DEEP-1, fix A] the call filled this cache (it tested the cache was empty first) and reads its final value back
    if (
      w &&
      deep &&
      p.startsWith("DNSM.") &&
      filledHere(w, p, seen, last, value)
    ) {
      const fe = entryRows(w, p, value, depth, seen);
      if (fe?.length) return fe;
    }
    if (!w) return [];
    if (seen.has(w.id) || depth > MAX_DEPTH) return null;
    const fromEntries = entryRows(w, p, value, depth, seen);
    if (fromEntries?.length) return fromEntries;
    // a cache the writer filled entry by entry never opens the whole writer because it returns the same number
    if (near(w.v, value) && !entries.has(`${String(w.id)}|${p}`))
      return explained(w.id, depth + 1, seen);
    // the step that makes the value, before one that only reads the cache back
    let at = wsteps.findIndex((x) => near(x.v, value) && !readsPath(x.e, p));
    if (at < 0) at = wsteps.findIndex((x) => near(x.v, value));
    const st = wsteps[at];
    return st ? stepRowsAt(w, wsteps, at, st.e, seen, []) : [];
  }

  /** The rows of an opened cache row, as they were when the row was made; null when cut. */
  function open(
    o: CacheOpen,
    depth: number,
    seen: ReadonlySet<number>,
  ): Row[] | null {
    const before = [entryP, opening] as const;
    entryP = o.entry;
    opening = new Set(o.opening);
    try {
      return cache(
        o.path,
        Number(o.value),
        nodes[o.writer] ?? null,
        depth,
        seen,
      );
    } finally {
      [entryP, opening] = before;
    }
  }
  /**
   * pieces.cjs `kids.length`: whether a row opens into rows. The bench builds a cache's rows at once, so a cache row is
   * opened now (under the calls above its own rows, else `seen`): one whose writer gives nothing, or that a cycle cuts,
   * opens into nothing.
   */
  function opens(r: Row, depth: number, seen: ReadonlySet<number>): boolean {
    return r.open !== null && typeof r.open === "object"
      ? !!open(r.open, depth, r.seen ? new Set(r.seen) : seen)?.length
      : hasKids(r);
  }

  return {
    /** The writer a cache read opens into: its linked writer, else the one whose loop wrote that very value. */
    writerOf,
    /** What the tree is walking now, kept on a cache row made now. */
    now: () => ({ entry: entryP, opening: [...opening] }),
    open,
    opens,
  };
}
