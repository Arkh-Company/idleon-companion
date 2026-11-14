// A tree from a recording, one level at a time (spec 008, T024, research R4): the root with its first level, and each
// "lazy" branch built when the player opens it, over the same recording. A call's rows follow pieces.cjs
// `explainOnce0` and `explainRaw`: the terms of the block's last step when it is a sum or a product (tree/terms.ts),
// else the calls it made (a call that only passes one value on is skipped down to what it passes; the curve block is a
// branch of its constants); then the state reads its steps do not show (`dataRows`) and its checks, a yes/no read
// merged into its test (tree/conditions.ts). A cache read opens into the call that wrote it. A piece is built once
// (tree/pieces.ts). Names come with US1c: until then a row has the generic name and `unnamed` (FR-012a).
import type { Op } from "./instrument.ts";
import type { RecNode, Recording, RecValue } from "./recording.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { curveOf, inputRead } from "./tree/curves.ts";
import { makeConditions } from "./tree/conditions.ts";
import { GAME_BUGS, gameBugOf } from "./tree/game-bugs.ts";
import type { GameBugRule } from "./tree/game-bugs.ts";
import { classify } from "./tree/kinds.ts";
import { linkReads } from "./tree/links.ts";
import type { Link } from "./tree/links.ts";
import { makePieces } from "./tree/pieces.ts";
import {
  atZero,
  callText,
  curveRow,
  row,
  timesOne,
  valueOf,
  withShares,
} from "./tree/rows.ts";
import type { Row } from "./tree/rows.ts";
import { termOf } from "./tree/share.ts";
import { lastReads, makeSteps } from "./tree/steps.ts";
import type { Expr } from "./tree/steps.ts";
import { near } from "./tree/math.ts";
import { hasKids, makeTerms, topOp } from "./tree/terms.ts";
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
  open: number;
  depth: number;
  seen: readonly number[];
}

/** A step made of numbers only, none of them read (DEEP3-FIX-1, the index of a table cell). */
const noSource = (x: Expr): boolean =>
  x.t === "num" ||
  x.t === "val" ||
  (x.t === "op" && noSource(x.l) && noSource(x.r));
/** The read paths a block's steps show (pieces.cjs dataRows `used`). */
function readsIn(e: Expr | undefined, out: Set<string>): Set<string> {
  if (e?.t === "read") out.add(e.p);
  if (e?.t === "op") [e.l, e.r].forEach((x) => readsIn(x, out));
  if (e?.t === "fn") e.args.forEach((x) => readsIn(x, out));
  return out;
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
  const { links } = linkReads(rec);
  const steps = makeSteps(rec, ops);
  const conditions = makeConditions(nodes);
  const top = nodes[nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("the recording has no root call");
  const keyOf = (n: RecNode) => JSON.stringify([character, n.b, ...n.a]);
  const opens = (n: RecNode) =>
    n.c.length > 0 || (n.r?.length ?? 0) > 0 || links.has(n.id);

  /** A state read as a row: a cache with a writer opens into it; one the game had saved says so. */
  function readRow(
    path: string,
    value: number | boolean | null,
    link?: Link,
  ): Row {
    const writer = link?.[1] ?? null;
    const node = row({
      pieceKey: JSON.stringify([character, path]),
      value,
      code: path,
      flags:
        link?.[2] === "game"
          ? { unnamed: true, fromCache: true }
          : { unnamed: true },
      kids: writer === null ? [] : "lazy",
    });
    return { node, open: writer };
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
    return { node, open: lazy ? k.id : null };
  }

  /** A level's rows typed, with their shares; then a product's parts at ×1 (when `ones`) and a sum's parts at 0. */
  function finish(v: unknown, rows: Row[], ones: boolean): Row[] {
    // A leaf gets its type and the reason of a "?" (pieces.cjs classify); a branch or a typed leaf keeps its own.
    const typed = rows.map((r) =>
      r.node.kids === "lazy" || r.node.leaf || r.group
        ? r
        : { ...r, node: { ...r.node, ...classify(r.node) } },
    );
    const shared = withShares(
      { name: "", value: valueOf(v as RecValue) },
      null,
      typed,
    );
    return atZero(
      ones ? timesOne(shared.rows, shared.mode) : shared.rows,
      shared.mode,
    );
  }

  /** pieces.cjs `dataRows`: what the block read and did not already show (a table, a length or a text stays out). */
  function dataRows(
    n: RecNode,
    rows: Row[],
    own: Expr[],
    stepNotOpened: boolean,
    linkOf: ReadonlyMap<string, Link>,
  ): Row[] {
    const used = new Set<string>();
    own.forEach((e) => readsIn(e, used));
    const terms = new Set(rows.map((r) => termOf(r.node)));
    const last = lastReads(n);
    const out: Row[] = [];
    for (const [p, v0] of n.r ?? []) {
      // a path the call read with several values shows the last one, the state the call ended with
      const v = last.get(p) ?? v0;
      const cache = p.startsWith("DNSM.");
      // [F1-RC1] a state read of a step that did not open is a data row (a cache stays as it was)
      if (
        (used.has(p) && !(stepNotOpened && !cache)) ||
        typeof v !== "number" ||
        /^Custom(Lists|Maps).|.length$|^DummyNumbers/.test(p) ||
        rows.some((r) => r.node.code === p) ||
        terms.has(p)
      )
        continue;
      const r = readRow(p, v, linkOf.get(p));
      // the block's own result kept in a working value, with nothing under it: not a part of the block
      if (cache && near(v, n.v) && !hasKids(r) && rows.length) continue;
      terms.add(p);
      out.push(r);
    }
    return out;
  }

  function raw(id: number): Row[] {
    const n = nodes[id];
    if (!n) return [];
    const own = steps.of(id);
    const linkOf = new Map<string, Link>(
      (links.get(n.id) ?? []).map((l) => [l[0], l]),
    );
    const readRowOf = (p: string, v: unknown) =>
      readRow(p, valueOf(v as RecValue), linkOf.get(p));
    const reads: Reads = new Map((n.r ?? []).map(([p, v]) => [p, v]));
    const terms = makeTerms({
      nodes,
      read: readRowOf,
      call: (k, v, rs) => callRow(k, n, v ?? null, [...rs], false),
      finish,
    });
    const last = own.steps.at(-1);
    // DEEP3-FIX-1: the last step is the block's formula only when it is no index of a table cell the block read.
    const indexStep =
      !!last &&
      !near(last.v, n.v) &&
      Number.isInteger(last.v) &&
      noSource(last.e) &&
      (n.r ?? []).some(([p]) => p.endsWith(`[${String(last.v)}]`));
    const op = indexStep ? null : topOp(last?.e);
    const rows = op
      ? terms.stepTerms(
          { args: n.a, steps: own.steps, at: own.steps.length - 1 },
          op,
          reads,
        )
      : n.c.flatMap((c) => {
          const kid = nodes[c];
          return kid ? [callRow(kid, n)] : [];
        });
    const data = dataRows(
      n,
      rows,
      own.steps.map((s) => s.e),
      !op && own.steps.length > 0,
      linkOf,
    );
    const conds = conditions.condRows(n, own);
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
    return rows.map(({ node, open, group }) => {
      const n = (count.get(node.name) ?? 0) + 1;
      count.set(node.name, n);
      const id = `${parent.id}/${node.name}${n > 1 ? `#${String(n)}` : ""}`;
      const bug = gameBugOf(bugs, parent.code, node.code);
      const placed: CalcTreeNode = {
        id,
        ...node,
        ...(bug === null ? {} : { flags: { ...node.flags, gameBug: bug } }),
        // a group's rows are still the call's own
        ...(group
          ? { kids: place({ id, code: parent.code }, group, depth, seen) }
          : {}),
      };
      if (open !== null) places.set(id, { node: placed, open, depth, seen });
      return placed;
    });
  }
  /** The rows under a place; null when the depth limit or a cycle cuts it. */
  function kidsAt(p: Place): CalcTreeNode[] | null {
    const rows = pieces.explain(p.open, p.depth, new Set(p.seen));
    // The rows are the call `open`'s, not the row's: a call that passes its value on, or a cache, opens into another.
    const from = nodes[p.open];
    const parent = { id: p.node.id, code: from ? callText(from) : null };
    return rows && place(parent, rows, p.depth + 1, [...p.seen, p.open]);
  }

  const value = valueOf(top.v);
  const root: CalcTreeNode = {
    id: "root",
    ...row({ pieceKey: keyOf(top), value, code: callText(top) }),
    name: "Total",
    role: "root",
  };
  if (value !== null)
    root.kids = kidsAt({ node: root, open: top.id, depth: 0, seen: [] }) ?? [];

  return {
    root,
    expand(nodeId) {
      const p = places.get(nodeId);
      if (!p) return null;
      const kids = kidsAt(p);
      return kids
        ? { ...p.node, kids }
        : { ...p.node, flags: { ...p.node.flags, truncated: true }, kids: [] };
    },
    conflicts: pieces.conflicts,
  };
}
