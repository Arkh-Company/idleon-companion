// A cache read opens into what its writer computed for it (spec 008, T022): the port of pieces.cjs `cacheRows`,
// `entryRows`, `stepRows`, `stepRowsAt` and `cacheStepRows` from the bench at BASELINE-4. A cache the writer filled in a
// loop opens into its turns (tree/entries.ts): one part per turn that added to it, a factor for a turn that multiplied
// it; a cache written once opens into the writer's step that gave the value, or into the whole writer when the writer
// returned it. The bench builds the whole tree at once; here a cache read is a lazy row whose rows are built when the
// player opens it, with the loop entry and the bubble entries open when the row was made (ENTRY_P, OPUS4_OPEN). The
// tests that only read the recording (which writes, which turn, which side of a step) are in cache-picks.ts.
// Each opening gives the ⓘ the writer leaves for the cache (tree/cache-formulas.ts); each part is named by what its turn
// read or by its own rows (tree/turn-names.ts).
import type { RecNode } from "../recording.ts";
import {
  addedSide,
  bubbleWrites,
  factorTurn,
  filledHere,
  readsPath,
  turnRead,
  turnReads,
} from "./cache-picks.ts";
import { oneTurnFormula, turnFormula } from "./cache-formulas.ts";
import type { Opened } from "./cache-formulas.ts";
import type { CodeFormulas } from "./code-formulas.ts";
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
import { hasKids, loneCall } from "./tidy.ts";
import {
  arenaTurn,
  otherReads,
  ownName,
  sharedName,
  turnName,
  withoutRepeats,
} from "./turn-names.ts";
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
  /** The ⓘ the game's code gives (tree/code-formulas.ts). */
  formulas: CodeFormulas;
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
    own: readonly TurnRead[],
  ): Row[] {
    const reads = turnReads(w, own);
    const terms = ctx.terms(w, [...seen, w.id]);
    const { rows, op } = terms.rowsAt({ args: w.a, steps, at }, e, reads);
    return ctx.finish(e.v, rows, op === "*");
  }
  /** pieces.cjs cacheStepRows: the writer's step that made the cache's value, without a lone call that says nothing. */
  const cacheStep = (
    w: RecNode,
    steps: readonly Step[],
    at: number,
    e: Expr,
    value: number,
    depth: number,
    seen: ReadonlySet<number>,
  ) =>
    loneCall(e, stepRowsAt(w, steps, at, e, seen, []), value, (r) =>
      opens(r, depth + 1, new Set(seen).add(w.id)),
    );
  const stepRows = (
    w: RecNode,
    steps: readonly Step[],
    value: unknown,
    seen: ReadonlySet<number>,
    own: readonly TurnRead[],
  ) => {
    const at = steps.findIndex((x) => near(x.v, value));
    const st = steps[at];
    return st ? stepRowsAt(w, steps, at, st.e, seen, own) : null;
  };

  function entryRows(
    w: RecNode,
    p: string,
    value: number,
    depth: number,
    seen: ReadonlySet<number>,
    only?: readonly Entry[],
  ): Opened | null {
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
          )?.rows ?? [];
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
      return { rows: q0 ? turnRows(q0, value).rows : [], f: null };
    }
    // one turn made the value: the cache's ⓘ is that turn's step
    const [one] = parts;
    if (one && parts.length === 1)
      return {
        rows: turnRows(one.q, value).rows,
        f: oneTurnFormula(w, one.q, value, ctx.formulas, nodes),
      };
    // each turn's rows first: a part's name looks at the other parts' (pieces.cjs entryRows `built`)
    const built = parts.map((pt) =>
      pt.kind === "x"
        ? { pt, rows: [] as Row[], call: undefined, read: undefined }
        : { pt, ...turnRows(pt.q, pt.d) },
    );
    // (two parts or more here: one part is the one turn that made the value, above)
    const shared = sharedName(
      built.filter((b) => b.pt.kind === "+").map((b) => b.rows),
    );
    const out = built.map(({ pt, rows, call, read }): Row => {
      if (pt.kind === "x" && pt.st) {
        const terms = flat(pt.st.e, "*").filter(
          (t) =>
            !(
              (t.t === "val" || t.t === "read") &&
              near(t.v, Number(pt.q.v) / pt.d)
            ),
        );
        const at = ctx.terms(w, [...next]);
        const rows = terms.flatMap(
          (t) => at.term(t, "*", turnReads(w, [])) ?? [],
        );
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
          group: ctx.finish(pt.d, at.tidy(rows, "*", w.a, w), true),
        };
      }
      // the turn's ⓘ: the part its step adds to the total
      const xf = turnFormula(w, pt, ctx.formulas);
      const kind = TURN_KINDS.find((k) =>
        pt.q.r.some(
          ([rp, rv]) =>
            k.test.test(rp) && (!k.found || (rv === true && near(pt.d, 1))),
        ),
      );
      // the turn is known by what it read, else by its own rows; a turn of a read or a call is named by its code
      const others = otherReads(
        built.map((b) => b.pt.q),
        pt.q,
      );
      const name =
        arenaTurn(pt.q.r) ??
        turnName(pt.q.r, p) ??
        (read ? null : ownName(rows, shared, pt.q.r, others));
      const node = row({
        pieceKey: null,
        value: pt.d,
        code: read ? read[0] : call ? callText(call) : null,
        fmt: "+",
        ...(name === null ? {} : { name }),
        ...(kind?.found ? { condition: "owned" as const } : {}),
        ...(kind ? { leaf: kind.leaf } : {}),
      });
      return {
        node,
        open: null,
        // OPUS3-F3c: a found item is a yes/no with nothing under it
        group: kind?.found ? [] : withoutRepeats(rows, node, kids),
        ...(xf ? { xf } : {}),
      };
    });
    return { rows: ctx.finish(value, out, false), f: null };
  }

  /** pieces.cjs cacheRows, with writer `w` found for it; null when the depth limit or a cycle cuts it. */
  function cache(
    p: string,
    value: number,
    w: RecNode | null,
    depth: number,
    seen: ReadonlySet<number>,
  ): Opened | null {
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
          if (fe?.rows.length) return fe;
        } finally {
          opening.delete(k4);
        }
      }
    }
    // deep-2: a skill's rank opens into the levels the builder pass recorded in the entry of this path
    const ranks = skillRankRows(p, w, LL[0], value);
    if (ranks)
      return { rows: ctx.finish(value, ranks.rows, false), f: ranks.f };
    const wsteps = w ? ctx.steps(w.id) : [];
    // a cache the call being built computed in one of its own steps, not one that reads the cache itself: that step
    if (w && deep && p.startsWith("DNSM.")) {
      const at = wsteps.findIndex(
        (x) => near(x.v, value) && !readsPath(x.e, p),
      );
      const st0 = wsteps[at];
      if (st0 && !near(w.v, value))
        return {
          rows: cacheStep(w, wsteps, at, st0.e, value, depth, seen),
          f: ctx.formulas.expr(st0.e, turnReads(w, []), value),
        };
    }
    // [T3] a cache the call changed once in a turn of its own loop: the turn whose step is a product of an earlier read
    // of the cache and a call
    if (w && deep && p.startsWith("DNSM.") && key && entries.has(key)) {
      const q = factorTurn(LL, p, value);
      if (q) {
        const fe = entryRows(w, p, value, depth, seen, [q]);
        if (fe?.rows.length) return fe;
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
      if (fe?.rows.length) return fe;
    }
    if (!w) return { rows: [], f: null };
    if (seen.has(w.id) || depth > MAX_DEPTH) return null;
    const fromEntries = entryRows(w, p, value, depth, seen);
    if (fromEntries?.rows.length) return fromEntries;
    // a cache the writer filled entry by entry never opens the whole writer because it returns the same number
    if (near(w.v, value) && !entries.has(`${String(w.id)}|${p}`)) {
      const rows = explained(w.id, depth + 1, seen);
      return rows && { rows, f: ctx.formulas.call(w) };
    }
    // the step that makes the value, before one that only reads the cache back
    let at = wsteps.findIndex((x) => near(x.v, value) && !readsPath(x.e, p));
    if (at < 0) at = wsteps.findIndex((x) => near(x.v, value));
    const st = wsteps[at];
    if (!st) return { rows: [], f: null };
    return {
      rows: cacheStep(w, wsteps, at, st.e, value, depth, seen),
      f: readsPath(st.e, p)
        ? null
        : ctx.formulas.expr(st.e, turnReads(w, []), value),
    };
  }

  /** The rows of an opened cache row, as they were when the row was made, with its writer's ⓘ; null when cut. */
  function opened(
    o: CacheOpen,
    depth: number,
    seen: ReadonlySet<number>,
  ): Opened | null {
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
  const open = (o: CacheOpen, depth: number, seen: ReadonlySet<number>) =>
    opened(o, depth, seen)?.rows ?? null;
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
    opened,
    opens,
  };
}
