// A recording written by hand for the assembly's tests (spec 008, T017): the shape recorder.js gives, with invented
// blocks and paths. Each node's id is its place in `nodes`, and its children run in the order of `c`.
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import type { TreeBuild } from "../tree-build.ts";
import type { FormulaRow } from "./formulas.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";

type Spec = Partial<RecNode> & Pick<RecNode, "b">;

/** A recording from its nodes in id order; `p` and `pxi` are filled from the children lists. */
export function recordingOf(
  specs: Spec[],
  writes: (Omit<RecWrite, "xi"> & Partial<Pick<RecWrite, "xi">>)[] = [],
  roles: Partial<Pick<Recording, "setup" | "root" | "fromGame">> = {},
): Recording {
  const nodes: RecNode[] = specs.map((s, id) => ({
    id,
    a: [],
    c: [],
    p: null,
    pxi: 0,
    ...s,
  }));
  for (const n of nodes)
    for (const c of n.c) {
      const kid = nodes[c];
      if (kid) kid.p = n.id;
    }
  return {
    nodes,
    writes: writes.map((w) => ({ xi: 0, ...w })),
    spliced: [],
    bpStart: null,
    setup: roles.setup ?? null,
    root: roles.root ?? null,
    builders: null,
    fromGame: roles.fromGame ?? [],
  };
}

/**
 * The pieces case: `Part(1)` is called twice under the root with different rows (a conflict), `Hit(2)` reads the cache
 * its twin under `Wrap()` filled, and the setup's own `Part(1)` writes a cache the root reads.
 */
export const PIECES = recordingOf(
  [
    { b: "(setup: game helpers)", c: [1, 9] },
    { b: "FillPool", a: [-1], v: 9, r: [["Stash", 9]] },
    { b: "(root)", c: [3] },
    {
      b: "Total",
      v: 30,
      c: [4, 5, 6, 8],
      r: [
        ["Stats.base", 4],
        ["DNSM.Pool.total", 9, 0],
        ["DNSM.Side.v", 99, 2],
        ["Stats.label", "(text)"],
      ],
    },
    { b: "Part", a: [1], v: 3, r: [["Level", 3]] },
    {
      b: "Part",
      a: [1],
      v: 3,
      r: [
        ["Level", 3],
        ["Extra", 0],
      ],
    },
    { b: "Wrap", v: 6, c: [7] },
    { b: "Hit", a: [2], v: 5, r: [["Level", 5]] },
    { b: "Hit", a: [2], v: 5, r: [["DNSM.Twin.v", 5, 1]] },
    { b: "Part", a: [1], v: 99, r: [["Level", 99]] },
  ],
  [
    { path: "DNSM.Pool.total", node: 1, v: 9, seq: 0 },
    { path: "DNSM.Twin.v", node: 7, v: 5, seq: 1 },
    { path: "DNSM.Side.v", node: 9, v: 99, seq: 2 },
  ],
  { setup: 0, root: 2 },
);

/** `Part(1)` called twice under the root with the same reads: the second place gives the piece's rows. */
export const SAME_TWICE = recordingOf(
  [
    { b: "(root)", c: [1] },
    { b: "Total", v: 9, c: [2, 3] },
    { b: "Part", a: [1], v: 3, r: [["Level", 3]] },
    { b: "Part", a: [1], v: 3, r: [["Level", 3]] },
  ],
  [],
  { root: 0 },
);

/** A chain of `depth` calls under the root, each calling the next, with a read at the bottom. */
export function chainOf(depth: number): Recording {
  const specs: Spec[] = [{ b: "(root)", c: [1] }];
  for (let i = 1; i <= depth; i++)
    specs.push({
      b: `Step${String(i)}`,
      v: i,
      ...(i < depth ? { c: [i + 1] } : { r: [["Level", 1]] }),
    });
  return recordingOf(specs, [], { root: 0 });
}

export const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
/** Each row as [code, value]. */
export const brief = (n: CalcTreeNode | null | undefined) =>
  kidsOf(n).map((k) => [k.code, k.value]);
/** The row reached by opening, from the root, the row with each code in turn (a group opens as it is). */
export function openPath(build: TreeBuild, ...codes: (string | null)[]) {
  let node: CalcTreeNode | null = build.root;
  for (const code of codes) {
    const next: CalcTreeNode | undefined = kidsOf(node).find(
      (k) => k.code === code,
    );
    node = next?.kids === "lazy" ? build.expand(next.id) : (next ?? null);
  }
  return node;
}

// Rows written by hand, for the forms of a level: a read is unnamed and written by its path (FR-012a).
export const read = (code: string, value: number | null): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
});
export const fixed = (name: string, value: number): Row => ({
  node: row({
    pieceKey: null,
    value,
    code: null,
    name,
    leaf: "fixedValue",
    flags: {},
  }),
  open: null,
});
export const cond = (
  test: string,
  yes: boolean,
  code: string | null = null,
): Row => ({
  node: row({
    pieceKey: null,
    value: yes ? 1 : 0,
    code,
    leaf: "condition",
    condition: "owned",
  }),
  open: null,
  test,
});
/** A branch with no code of its own (the bench's branch of an expression's parts). */
export const branch = (value: number, group: Row[] = []): Row => ({
  node: row({ pieceKey: null, value, code: null }),
  open: null,
  group,
});
export const ones = (...rows: Row[]): Row => ({
  node: row({
    pieceKey: null,
    value: 1,
    code: null,
    name: `At ×1 (${String(rows.length)})`,
    role: "atOne",
    flags: { closed: true },
  }),
  open: null,
  group: rows,
});
/** The row whose ⓘ is asked: a call, with the game's expressions around it. */
export const at = (
  value: number,
  more: Partial<Pick<FormulaRow, "xf" | "xweak" | "f">> &
    Partial<Pick<CalcTreeNode, "code">> = {},
): FormulaRow => ({
  node: row({ pieceKey: "x", value, code: more.code ?? "Own()" }),
  ...more,
});
