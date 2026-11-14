// The root and the first level of a tree from a recording (spec 008, T024, research R4). The first level is the root
// block's own calls, in the order they ran, then its state reads that are numbers or yes/no; a row with more under it
// is "lazy", built when the player opens it. Names, kinds and the math come with the assembly's port (US1b, US1c):
// until then each row shows the game's block or path and `unnamed`.
import type { RecNode, Recording, RecValue } from "./recording.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { linkReads } from "./tree/links.ts";
import type { Link } from "./tree/links.ts";

const valueOf = (v: RecValue | undefined): number | boolean | null =>
  typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))
    ? v
    : null;

const callText = (n: RecNode) =>
  `${n.b}(${n.a.map((a) => JSON.stringify(a)).join(", ")})`;

function row(
  fields: Pick<CalcTreeNode, "id" | "pieceKey" | "name" | "value" | "code"> &
    Partial<CalcTreeNode>,
): CalcTreeNode {
  return {
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
export function buildTree(rec: Recording, character: number): CalcTreeNode {
  const { links } = linkReads(rec);
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("the recording has no root call");
  const ids = new Map<string, number>();
  const idOf = (name: string) => {
    const n = (ids.get(name) ?? 0) + 1;
    ids.set(name, n);
    return `root/${name}${n > 1 ? `#${String(n)}` : ""}`;
  };
  const opens = (n: RecNode) =>
    n.c.length > 0 || (n.r?.length ?? 0) > 0 || links.has(n.id);

  const calls = top.c.flatMap((c) => {
    const n = rec.nodes[c];
    if (!n) return [];
    return [
      row({
        id: idOf(n.b),
        pieceKey: JSON.stringify([character, n.b, ...n.a]),
        name: n.b,
        value: valueOf(n.v),
        code: callText(n),
        kids: opens(n) ? "lazy" : [],
      }),
    ];
  });
  const linkOf = new Map<string, Link>(
    (links.get(top.id) ?? []).map((l) => [l[0], l]),
  );
  const reads = (top.r ?? []).flatMap(([path, v]) => {
    const value = valueOf(v);
    if (value === null) return [];
    const link = linkOf.get(path);
    const flags = link?.[2] === "game" ? { fromCache: true } : {};
    return [
      row({
        id: idOf(path),
        pieceKey: JSON.stringify([character, path]),
        name: path,
        value,
        code: path,
        leaf: "unknown",
        flags: { unnamed: true, ...flags },
        kids: link?.[1] != null ? "lazy" : [],
      }),
    ];
  });

  const value = valueOf(top.v);
  return row({
    id: "root",
    pieceKey: JSON.stringify([character, top.b, ...top.a]),
    name: "Total",
    value,
    code: callText(top),
    role: "root",
    kids: value === null ? [] : [...calls, ...reads],
  });
}
