// A tree from a recording, one level at a time (spec 008, T024, research R4): the root with its first level, and each
// "lazy" branch built when the player opens it, over the same recording. A call's rows are its own calls, in the order
// they ran, then its state reads that are numbers or yes/no; a cache read opens into the call that wrote it. A piece is
// built once (tree/pieces.ts). Names come with US1c: until then a row has the generic name and `unnamed` (FR-012a).
import type { RecNode, Recording, RecValue } from "./recording.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { linkReads } from "./tree/links.ts";
import type { Link } from "./tree/links.ts";
import { classify } from "./tree/kinds.ts";
import { makePieces } from "./tree/pieces.ts";
import { kidShares, shareNodeOf } from "./tree/share.ts";
import type { ShareNode } from "./tree/share.ts";

/** The generic name of a part with no proven name (design.md C7). */
export const GENERIC_NAME = "Game value";

export interface TreeBuild {
  root: CalcTreeNode;
  /** The lazy branch `nodeId` with its rows built, or null when no lazy branch has that id. */
  expand(nodeId: string): CalcTreeNode | null;
  readonly conflicts: readonly string[];
}

/** A row before it has its place: `open` is the call whose rows are its children. */
interface Row {
  node: Omit<CalcTreeNode, "id">;
  open: number | null;
}
interface Place {
  node: CalcTreeNode;
  open: number;
  depth: number;
  seen: readonly number[];
  /** The row's formula as the share reads it, and its siblings, which that formula may name. */
  formula: ShareNode["formula"];
  sibs: readonly ShareNode[];
}

const valueOf = (v: RecValue | undefined): number | boolean | null =>
  typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))
    ? v
    : null;

const callText = (n: RecNode) =>
  `${n.b}(${n.a.map((a) => JSON.stringify(a)).join(", ")})`;

function row(
  fields: Pick<CalcTreeNode, "pieceKey" | "value" | "code"> &
    Partial<CalcTreeNode>,
): Omit<CalcTreeNode, "id"> {
  return {
    name: GENERIC_NAME,
    fmt: null,
    leaf: null,
    condition: null,
    why: null,
    formula: null,
    role: "piece",
    share: null,
    shareMode: null,
    flags:
      fields.value === null
        ? { unnamed: true, unavailable: true }
        : { unnamed: true },
    kids: [],
    ...fields,
  };
}

/** The tree of the recording's first root call, for the character asked (its index, in every piece key). */
export function buildTree(rec: Recording, character: number): TreeBuild {
  const { nodes } = rec;
  const { links } = linkReads(rec);
  const top = nodes[nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("the recording has no root call");
  const keyOf = (n: RecNode) => JSON.stringify([character, n.b, ...n.a]);
  const opens = (n: RecNode) =>
    n.c.length > 0 || (n.r?.length ?? 0) > 0 || links.has(n.id);

  function raw(id: number): Row[] {
    const n = nodes[id];
    if (!n) return [];
    const calls = n.c.flatMap((c): Row[] => {
      const kid = nodes[c];
      if (!kid) return [];
      const lazy = opens(kid);
      const node = row({
        pieceKey: keyOf(kid),
        value: valueOf(kid.v),
        code: callText(kid),
        kids: lazy ? "lazy" : [],
      });
      return [{ node, open: lazy ? kid.id : null }];
    });
    const linkOf = new Map<string, Link>(
      (links.get(n.id) ?? []).map((l) => [l[0], l]),
    );
    const reads = (n.r ?? []).flatMap(([path, v]): Row[] => {
      const value = valueOf(v);
      if (value === null) return [];
      const link = linkOf.get(path);
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
      return [{ node, open: writer }];
    });
    // A leaf gets its type and the reason of a "?" (pieces.cjs classify); a branch has none.
    return [...calls, ...reads].map((r) =>
      r.node.kids === "lazy"
        ? r
        : { ...r, node: { ...r.node, ...classify(r.node) } },
    );
  }
  const pieces = makePieces(rec, links, raw, keyOf, (rows) =>
    JSON.stringify(rows.map((r) => r.node)),
  );

  const places = new Map<string, Place>();
  /** The rows under a place, each with its id (the path of names, `#n` on a repeat); null when the place is cut. */
  function kidsAt(place: Place): CalcTreeNode[] | null {
    const rows = pieces.explain(place.open, place.depth, new Set(place.seen));
    if (!rows) return null;
    const seen = [...place.seen, place.open];
    const count = new Map<string, number>();
    const kids = kidShares(
      place.node,
      place.formula,
      rows.map(({ node }) => {
        const n = (count.get(node.name) ?? 0) + 1;
        count.set(node.name, n);
        return {
          id: `${place.node.id}/${node.name}${n > 1 ? `#${String(n)}` : ""}`,
          ...node,
        };
      }),
      place.sibs,
    );
    const sibs = kids.map((k) => shareNodeOf(k));
    kids.forEach((node, i) => {
      const open = rows[i]?.open ?? null;
      if (open !== null)
        places.set(node.id, {
          node,
          open,
          depth: place.depth + 1,
          seen,
          formula: null,
          sibs,
        });
    });
    return kids;
  }

  const value = valueOf(top.v);
  const root = {
    id: "root",
    ...row({ pieceKey: keyOf(top), value, code: callText(top) }),
    name: "Total",
    role: "root" as const,
  };
  if (value !== null)
    root.kids =
      kidsAt({
        node: root,
        open: top.id,
        depth: 0,
        seen: [],
        formula: null,
        sibs: [],
      }) ?? [];

  return {
    root,
    expand(nodeId) {
      const place = places.get(nodeId);
      if (!place) return null;
      const kids = kidsAt(place);
      return kids
        ? { ...place.node, kids }
        : {
            ...place.node,
            flags: { ...place.node.flags, truncated: true },
            kids: [],
          };
    },
    conflicts: pieces.conflicts,
  };
}
