// A tree from a recording, one level at a time (spec 008, T024, research R4): the root with its first level, and each
// "lazy" branch built when the player opens it, over the same recording. A call's rows follow pieces.cjs
// `explainOnce0` and `explainRaw`: the terms of the block's last step when it is a sum or a product (tree/terms.ts),
// else the calls it made (a call that only passes one value on is skipped down to what it passes; the curve block is a
// branch of its constants); then the state reads its steps do not show (tree/data-rows.ts) and its checks, a yes/no read
// merged into its test (tree/conditions.ts), with the passes of `explainOnce0` (tree/once.ts and [F2-TOP]). A cache read
// opens into what its writer computed for it (tree/caches.ts, over the loop entries of tree/entries.ts). A piece is
// built once (tree/pieces.ts). Names come with US1c: until then a row has the generic name and `unnamed` (FR-012a).
import type { Op } from "./instrument.ts";
import type { RecNode, Recording, RecValue } from "./recording.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { curveOf, inputRead } from "./tree/curves.ts";
import { makeCaches } from "./tree/caches.ts";
import { makeConditions } from "./tree/conditions.ts";
import { entriesOf, makeWriters } from "./tree/entries.ts";
import { GAME_BUGS, gameBugOf } from "./tree/game-bugs.ts";
import type { GameBugRule } from "./tree/game-bugs.ts";
import { classify } from "./tree/kinds.ts";
import { linkReads } from "./tree/links.ts";
import type { Link } from "./tree/links.ts";
import { makePieces } from "./tree/pieces.ts";
import { callText, curveRow, finish, row, valueOf } from "./tree/rows.ts";
import type { CacheOpen, Row } from "./tree/rows.ts";
import { makeSteps } from "./tree/steps.ts";
import { near } from "./tree/math.ts";
import { firstSrc, noSource, topOp } from "./tree/expr.ts";
import { withFormula } from "./tree/formulas.ts";
import { makeCodeFormulas } from "./tree/code-formulas.ts";
import { checkOutcome, onlyCache } from "./tree/once.ts";
import { dataRows } from "./tree/data-rows.ts";
import { rawPasses } from "./tree/raw-passes.ts";
import { makeTerms } from "./tree/terms.ts";
import type { Terms } from "./tree/terms.ts";
import type { Reads } from "./tree/val-path.ts";

export { GENERIC_NAME } from "./tree/rows.ts";

export interface TreeBuild {
  root: CalcTreeNode;
  /** The lazy branch `nodeId` with its rows built, or null when no lazy branch has that id. */
  expand(nodeId: string): CalcTreeNode | null;
  readonly conflicts: readonly string[];
}

interface Place {
  node: CalcTreeNode;
  /** The row as it was built, with the game's expressions around it for its ⓘ (tree/formulas.ts). */
  row: Row;
  open: number | CacheOpen;
  depth: number;
  seen: readonly number[];
}

/**
 * The tree of the recording's first root call, for the character asked (its index, in every piece key); `ops` are
 * the instrumentation's steps the recording's `x` refers to; `bugs` are the game's known bugs (FR-016).
 */
export function buildTree(
  rec: Recording,
  character: number,
  ops: readonly Op[] = [],
  bugs: readonly GameBugRule[] = GAME_BUGS,
): TreeBuild {
  const { nodes, writes } = rec;
  const linked = linkReads(rec);
  const { links } = linked;
  const steps = makeSteps(rec, ops);
  const entries = entriesOf(rec, linked, steps.turn);
  const writers = makeWriters(nodes, entries);
  const conditions = makeConditions(nodes);
  const codeFormulas = makeCodeFormulas(nodes, (id) => steps.of(id).steps);
  const top = nodes[nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("the recording has no root call");
  const keyOf = (n: RecNode) => JSON.stringify([character, n.b, ...n.a]);
  const opens = (n: RecNode) =>
    n.c.length > 0 || (n.r?.length ?? 0) > 0 || links.has(n.id);

  /**
   * A state read as a row: a cache with a writer (its linked one, else the one whose loop wrote that very value) opens
   * into what the writer computed for it (tree/caches.ts); one the game had saved says so.
   */
  function readRow(
    path: string,
    value: number | boolean | null,
    link?: Link,
  ): Row {
    const w = caches.writerOf(
      new Map(link?.[1] == null ? [] : [[path, link[1]]]),
      path,
      value,
    );
    const node = row({
      pieceKey: JSON.stringify([character, path]),
      value,
      code: path,
      flags:
        link?.[2] === "game"
          ? { unnamed: true, fromCache: true }
          : { unnamed: true },
      kids: w ? "lazy" : [],
    });
    return {
      node,
      open: w && { path, value, writer: w.id, ...caches.now() },
    };
  }

  /**
   * One call the block made, as a row (pieces.cjs explainRaw, its last case; or rowOfTerm, a call of a step, with the
   * value the step took and no skip). A curve finds its input among `reads`.
   */
  function callRow(
    kid: RecNode,
    caller: RecNode,
    v: RecValue | undefined = kid.v,
    reads: readonly (readonly [string, unknown, ...unknown[]])[] = caller.r ??
      [],
    skip = true,
  ): Row {
    let k = kid;
    // A call that only passes one value on is skipped down to what it passes.
    for (
      let only = nodes[k.c[0] ?? -1];
      skip && k.c.length === 1 && only;
      only = nodes[k.c[0] ?? -1]
    ) {
      if (Math.abs((Number(only.v) || 0) - (Number(k.v) || 0)) > 1e-9) break;
      k = only;
    }
    const value = valueOf(v);
    const curve = curveOf(k.b, k.a);
    if (curve && typeof value === "number") {
      const own = new Set(
        writes.filter((w) => w.node === caller.id).map((w) => w.path),
      );
      const path = inputRead(curve[3], reads, own);
      const input = path === null ? null : readRow(path, curve[3]);
      const typed = input && {
        ...input,
        node: { ...input.node, ...classify(input.node) },
      };
      return curveRow(
        curve,
        { pieceKey: keyOf(kid), code: callText(kid), value },
        typed,
      );
    }
    const lazy = opens(k);
    // [F1-RC3] a call with no step, no read, no child, no cache link and no check returns a literal of the game's code.
    const constant =
      skip &&
      !lazy &&
      !(k.x?.length ?? 0) &&
      !(k.q?.length ?? 0) &&
      typeof k.v === "number";
    const node = row({
      pieceKey: keyOf(kid),
      value,
      code: callText(kid),
      kids: lazy ? "lazy" : [],
      ...(constant
        ? {
            leaf: "fixedValue" as const,
            why: "a constant of the game for this case (no read, no step)",
          }
        : {}),
    });
    const xf = codeFormulas.call(k);
    return { node, open: lazy ? k.id : null, ...(xf ? { xf } : {}) };
  }

  const linksOf = (n: RecNode) =>
    new Map<string, Link>((links.get(n.id) ?? []).map((l) => [l[0], l]));
  /** The terms of call `n`'s steps; with `seen`, the rows they make open under those calls (a cache's writer). */
  function termsOf(n: RecNode, seen?: readonly number[]): Terms {
    const linkOf = linksOf(n);
    const at = (r: Row): Row => (seen ? { ...r, seen } : r);
    return makeTerms({
      nodes,
      block: n,
      entry: () => caches.now().entry,
      formulas: codeFormulas,
      read: (p, v) => at(readRow(p, valueOf(v), linkOf.get(p))),
      call: (k, v, rs) => at(callRow(k, n, v ?? null, [...rs], false)),
      finish,
    });
  }
  const caches = makeCaches({
    nodes,
    entries,
    writerByValue: (p, v) => writers.writerByValue(p, v),
    steps: (id) => steps.of(id).steps,
    explain: (id, depth, seen) => pieces.explain(id, depth, seen),
    linksOf: (n) =>
      new Map(
        (links.get(n.id) ?? []).flatMap(([p, w]) =>
          w === null ? [] : [[p, w] as const],
        ),
      ),
    terms: termsOf,
    finish,
  });

  function raw(id: number, depth: number, seen: ReadonlySet<number>): Row[] {
    const n = nodes[id];
    if (!n) return [];
    const own = steps.of(id);
    const linkOf = linksOf(n);
    const reads: Reads = new Map((n.r ?? []).map(([p, v]) => [p, v]));
    const terms = termsOf(n);
    const last = own.steps.at(-1);
    // DEEP3-FIX-1: the last step is the block's formula only when it is no index of a table cell the block read.
    const indexStep =
      !!last &&
      !near(last.v, n.v) &&
      Number.isInteger(last.v) &&
      noSource(last.e) &&
      (n.r ?? []).some(([p]) => p.endsWith(`[${String(last.v)}]`));
    // a block the game's own passes rewrite (tree/raw-passes.ts) has those rows, before its steps
    const special = rawPasses(n, nodes, reads);
    const op = indexStep || special ? null : topOp(last?.e);
    const rows =
      special ??
      (op
        ? terms.stepTerms(
            { args: n.a, steps: own.steps, at: own.steps.length - 1 },
            op,
            reads,
          )
        : n.c.flatMap((c) => {
            const kid = nodes[c];
            return kid ? [callRow(kid, n)] : [];
          }));
    const data = dataRows(
      n,
      rows,
      own.steps.map((s) => s.e),
      !op && !special && own.steps.length > 0,
      (p, v) => readRow(p, v, linkOf.get(p)),
      writers.writersOf,
      // the bench opens a data row's cache under this call, at its depth
      (r) => caches.opens(r, depth, new Set([...seen, id])),
    );
    // a block that only returns one cache: its rows are the cache's own computation
    const cached =
      rows.length === 0 &&
      onlyCache(n, data, (o) => caches.open(o, depth, new Set([...seen, id])));
    if (cached) return cached;
    const conds = conditions.condRows(n, own);
    // OPUS4-T2: a block with no step and one check returns a table cell or 0: the outcome is a row
    const outcome =
      conditions.t1.has(n.id) &&
      !own.steps.length &&
      own.checks.length === 1 &&
      conds.length === 1 &&
      !rows.length &&
      checkOutcome(n, conds);
    if (outcome) conds.push(outcome);
    // [F2-TOP] the root's own call that would open to nothing and calls nothing, whose last step gives its value from a
    // source with a top that is no × or +: that step's terms
    const st = own.steps.at(-1);
    if (
      depth === 0 &&
      !rows.length &&
      !data.length &&
      !conds.length &&
      !n.c.length &&
      st &&
      near(st.v, n.v) &&
      !topOp(st.e) &&
      firstSrc(st.e)
    ) {
      const parts = terms.branchOf(st.e, reads).group ?? [];
      if (parts.length) return terms.tidy(parts, null, n.a);
    }
    const all = conditions.mergeTests(n, rows, data, conds, own);
    return finish(n.v, terms.tidy(all, op ?? "*", n.a), true);
  }
  const pieces = makePieces(rec, links, raw, keyOf, (rows) =>
    JSON.stringify(rows.map((r) => [r.node, r.group?.map((g) => g.node)])),
  );

  const places = new Map<string, Place>();
  /** Each row with its id (the path of names, `#n` on a repeat), its group placed under it, a known game bug tagged. */
  function place(
    parent: Pick<CalcTreeNode, "id" | "code">,
    rows: Row[],
    depth: number,
    seen: readonly number[],
  ): CalcTreeNode[] {
    const count = new Map<string, number>();
    return rows.map((r) => {
      const { node, open, group, seen: own } = r;
      const above = own ?? seen;
      const n = (count.get(node.name) ?? 0) + 1;
      count.set(node.name, n);
      const id = `${parent.id}/${node.name}${n > 1 ? `#${String(n)}` : ""}`;
      const bug = gameBugOf(bugs, parent.code, node.code);
      // a branch built already has its ⓘ now; a group's rows are still the call's own
      const built = group && withFormula(r, group);
      const placed: CalcTreeNode = {
        id,
        ...node,
        ...(bug === null ? {} : { flags: { ...node.flags, gameBug: bug } }),
        ...(built
          ? {
              formula: built.formula,
              kids: place({ id, code: parent.code }, built.rows, depth, above),
            }
          : {}),
      };
      if (open !== null)
        places.set(id, { node: placed, row: r, open, depth, seen: above });
      return placed;
    });
  }
  /** The place's ⓘ and the rows under it; null when the depth limit or a cycle cuts it. */
  function kidsAt(
    p: Place,
  ): { formula: CalcTreeNode["formula"]; kids: CalcTreeNode[] } | null {
    // a cache's rows are its writer's, each with the calls above it; the depth is its reader's, as in the bench
    if (typeof p.open !== "number") {
      const rows = caches.open(p.open, p.depth - 1, new Set(p.seen));
      if (!rows) return null;
      const w = withFormula(p.row, rows);
      return {
        formula: w.formula,
        kids: place(p.node, w.rows, p.depth + 1, p.seen),
      };
    }
    const rows = pieces.explain(p.open, p.depth, new Set(p.seen));
    if (!rows) return null;
    const w = withFormula(p.row, rows);
    // The rows are the call `open`'s, not the row's: a call that passes its value on, or a cache, opens into another.
    const from = nodes[p.open];
    const parent = { id: p.node.id, code: from ? callText(from) : null };
    return {
      formula: w.formula,
      kids: place(parent, w.rows, p.depth + 1, [...p.seen, p.open]),
    };
  }

  const value = valueOf(top.v);
  const root: CalcTreeNode = {
    id: "root",
    ...row({ pieceKey: keyOf(top), value, code: callText(top) }),
    name: "Total",
    role: "root",
  };
  if (value !== null)
    root.kids =
      kidsAt({
        node: root,
        row: { node: root, open: null },
        open: top.id,
        depth: 0,
        seen: [],
      })?.kids ?? [];

  return {
    root,
    expand(nodeId) {
      const p = places.get(nodeId);
      if (!p) return null;
      const built = kidsAt(p);
      return built
        ? { ...p.node, ...built }
        : { ...p.node, flags: { ...p.node.flags, truncated: true }, kids: [] };
    },
    conflicts: pieces.conflicts,
  };
}
