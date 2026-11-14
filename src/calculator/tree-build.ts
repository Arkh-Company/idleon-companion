// A tree from a recording, one level at a time (spec 008, T024, research R4): the root with its first level, and each
// "lazy" branch built when the player opens it, over the same recording. A call's rows follow pieces.cjs `explainRaw`
// when the block has no formula of its own: the calls it made (a call that only passes one value on is skipped down
// to what it passes; the curve block is a branch of its constants), then its state reads that are numbers or yes/no
// (`dataRows`); a cache read opens into the call that wrote it. A piece is built once (tree/pieces.ts). Names come
// with US1c: until then a row has the generic name and `unnamed` (FR-012a).
import type { RecNode, Recording } from "./recording.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { curveOf, inputRead } from "./tree/curves.ts";
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

/** The tree of the recording's first root call, for the character asked (its index, in every piece key). */
export function buildTree(rec: Recording, character: number): TreeBuild {
  const { nodes, writes } = rec;
  const { links } = linkReads(rec);
  const top = nodes[nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("the recording has no root call");
  const keyOf = (n: RecNode) => JSON.stringify([character, n.b, ...n.a]);
  const opens = (n: RecNode) =>
    n.c.length > 0 || (n.r?.length ?? 0) > 0 || links.has(n.id);

  /** A state read as a row: a cache with a writer opens into it; one the game had saved says so. */
  function readRow(path: string, value: number | boolean, link?: Link): Row {
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

  /** One call the block made, as a row (pieces.cjs explainRaw, its last case). */
  function callRow(kid: RecNode, caller: RecNode): Row {
    let k = kid;
    // A call that only passes one value on is skipped down to what it passes.
    for (
      let only = nodes[k.c[0] ?? -1];
      k.c.length === 1 && only;
      only = nodes[k.c[0] ?? -1]
    ) {
      if (Math.abs((Number(only.v) || 0) - (Number(k.v) || 0)) > 1e-9) break;
      k = only;
    }
    const value = valueOf(kid.v);
    const curve = curveOf(k.b, k.a);
    if (curve && typeof value === "number") {
      const own = new Set(
        writes.filter((w) => w.node === caller.id).map((w) => w.path),
      );
      const path = inputRead(curve[3], caller.r ?? [], own);
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
            why: `a constant of the game: ${k.b} returns this number for this case (no read, no step)`,
          }
        : {}),
    });
    return { node, open: lazy ? k.id : null };
  }

  function raw(id: number): Row[] {
    const n = nodes[id];
    if (!n) return [];
    const calls = n.c.flatMap((c) => {
      const kid = nodes[c];
      return kid ? [callRow(kid, n)] : [];
    });
    const linkOf = new Map<string, Link>(
      (links.get(n.id) ?? []).map((l) => [l[0], l]),
    );
    const reads = (n.r ?? []).flatMap(([path, v]): Row[] => {
      const value = valueOf(v);
      return value === null ? [] : [readRow(path, value, linkOf.get(path))];
    });
    // A leaf gets its type and the reason of a "?" (pieces.cjs classify); a branch or a typed leaf keeps its own.
    const typed = [...calls, ...reads].map((r) =>
      r.node.kids === "lazy" || r.node.leaf || r.group
        ? r
        : { ...r, node: { ...r.node, ...classify(r.node) } },
    );
    // The block has no formula of its own: its calls are its factors (op "*"), and its parts at ×1 are grouped.
    const { rows, mode } = withShares(
      { name: n.b, value: valueOf(n.v) },
      null,
      timesOne(typed),
    );
    return atZero(rows, mode);
  }
  const pieces = makePieces(rec, links, raw, keyOf, (rows) =>
    JSON.stringify(rows.map((r) => [r.node, r.group?.map((g) => g.node)])),
  );

  const places = new Map<string, Place>();
  /** Each row with its id (the path of names, `#n` on a repeat), its group placed under it. */
  function place(
    parentId: string,
    rows: Row[],
    depth: number,
    seen: readonly number[],
  ): CalcTreeNode[] {
    const count = new Map<string, number>();
    return rows.map(({ node, open, group }) => {
      const n = (count.get(node.name) ?? 0) + 1;
      count.set(node.name, n);
      const id = `${parentId}/${node.name}${n > 1 ? `#${String(n)}` : ""}`;
      const placed: CalcTreeNode = {
        id,
        ...node,
        ...(group ? { kids: place(id, group, depth, seen) } : {}),
      };
      if (open !== null) places.set(id, { node: placed, open, depth, seen });
      return placed;
    });
  }
  /** The rows under a place; null when the depth limit or a cycle cuts it. */
  function kidsAt(p: Place): CalcTreeNode[] | null {
    const rows = pieces.explain(p.open, p.depth, new Set(p.seen));
    return rows && place(p.node.id, rows, p.depth + 1, [...p.seen, p.open]);
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
