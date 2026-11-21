// A recording written by hand for the assembly's tests (spec 008, T017): the shape recorder.js gives, with invented
// blocks and paths. Each node's id is its place in `nodes`, and its children run in the order of `c`.
import { recordingOf } from "../fixtures/recording-fixture.ts";
import type { NodeSpec as Spec } from "../fixtures/recording-fixture.ts";
import type { RecNode, Recording } from "../recording.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import type { TreeBuild } from "../tree-build.ts";
import { makeCodeFormulas } from "./code-formulas.ts";
import { makePlaces } from "./places.ts";
import type { FormulaRow } from "./formulas.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Step } from "../recorded/steps.ts";

// (moved out of tree/ by spec 010, so recorded/ and declared/ may use it)
export { recordingOf };

/**
 * The pieces case: `Part(1)` is called twice under the root with different rows (a conflict), `Hit(2)` reads the cache
 * its twin under `Wrap()` filled, and the setup's own `Part(1)` writes a cache the root reads. Each of them reads a
 * `Tier` too: a call whose one row has its value would be that row (pieces.cjs structurePass, tree/one-child.ts).
 */
export const PIECES = recordingOf(
  [
    { b: "(setup: game helpers)", c: [1, 9] },
    {
      b: "FillPool",
      a: [-1],
      v: 9,
      r: [
        ["Stash", 9],
        ["Tier", 1],
      ],
    },
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
    {
      b: "Part",
      a: [1],
      v: 3,
      r: [
        ["Level", 3],
        ["Tier", 1],
      ],
    },
    {
      b: "Part",
      a: [1],
      v: 3,
      r: [
        ["Level", 3],
        ["Tier", 1],
        ["Extra", 0],
      ],
    },
    { b: "Wrap", v: 6, c: [7] },
    {
      b: "Hit",
      a: [2],
      v: 5,
      r: [
        ["Level", 5],
        ["Tier", 1],
      ],
    },
    { b: "Hit", a: [2], v: 5, r: [["DNSM.Twin.v", 5, 1]] },
    {
      b: "Part",
      a: [1],
      v: 99,
      r: [
        ["Level", 99],
        ["Tier", 1],
      ],
    },
  ],
  [
    { path: "DNSM.Pool.total", node: 1, v: 9, seq: 0 },
    { path: "DNSM.Twin.v", node: 7, v: 5, seq: 1 },
    { path: "DNSM.Side.v", node: 9, v: 99, seq: 2 },
  ],
  { setup: 0, root: 2 },
);

/** `Part(1)` called twice under the root with the same reads (two, as in PIECES): the second place gives the piece's rows. */
const twoReads = {
  b: "Part",
  a: [1],
  v: 3,
  r: [
    ["Level", 3],
    ["Tier", 1],
  ] as [string, number][],
};
export const SAME_TWICE = recordingOf(
  [
    { b: "(root)", c: [1] },
    { b: "Total", v: 9, c: [2, 3] },
    twoReads,
    { ...twoReads, r: [...twoReads.r] },
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

/** A row's rows, through the pools and system groups of the first level (spec 009): the rows they hold, in order. */
export const kidsOf = (n: CalcTreeNode | null | undefined): CalcTreeNode[] =>
  n && Array.isArray(n.kids)
    ? n.kids.flatMap((k) =>
        k.role === "pool" || k.role === "system" ? kidsOf(k) : [k],
      )
    : [];
/** A row's own rows, as they are (a pool or a group is one of them). */
export const kidsIn = (n: CalcTreeNode | null | undefined): CalcTreeNode[] =>
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
/** A read with its name and its type of leaf. */
export const leaf = (
  name: string,
  value: number,
  code: string | null,
  kind: Row["node"]["leaf"],
): Row => ({
  node: row({ pieceKey: code, value, code, name, leaf: kind }),
  open: null,
});
/** A call's row with its name, that opens into the call `open`. */
export const lazy = (
  name: string,
  value: number,
  code: string,
  open = 9,
): Row => ({
  node: row({ pieceKey: code, value, code, name, kids: "lazy" }),
  open,
});
/** A Condition named as the comparison it is. */
export const check = (
  name: string,
  yes: boolean,
  code: string | null = null,
): Row => {
  const c = cond(name, yes, code);
  return { ...c, node: { ...c.node, name } };
};
/** A branch with no code of its own and a name. */
export const named = (name: string, value: number, group: Row[]): Row => ({
  node: row({ pieceKey: null, value, code: null, name }),
  open: null,
  group,
});
/** A branch with no code of its own (the bench's branch of an expression's parts). */
export const branch = (value: number, group: Row[] = []): Row => ({
  node: row({ pieceKey: null, value, code: null }),
  open: null,
  group,
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

/** One recorded call written by hand, with no parent. */
export const recNode = (
  id: number,
  b: string,
  more: Partial<RecNode> = {},
): RecNode => ({ id, b, a: [], c: [], p: null, pxi: 0, ...more });
/** The ⓘ of the first call, among `nodes` (code-formulas.ts `call`); `steps` gives each call's steps by id. */
export const callOf = (nodes: RecNode[], steps: Record<number, Step[]> = {}) =>
  makeCodeFormulas(nodes, (id) => steps[id] ?? []).call(
    nodes[0] ?? recNode(0, "None"),
  );

/** The rows `top` placed under a root, each call `id` opening into `levels[id]`, over 10 calls `Call0`…`Call9`. */
export function placed(
  levels: Record<number, Row[]>,
  top: Row[],
  nodes = Array.from({ length: 10 }, (_, i) => recNode(i, `Call${String(i)}`)),
) {
  const places = makePlaces({
    nodes,
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => levels[id] ?? null,
    opened: () => null,
  });
  return {
    rows: places.place({ id: "root", code: "Root()" }, top, 1, [0]),
    open: (id: string) => kidsOf(places.expand(id)),
    expand: (id: string) => places.expand(id),
  };
}
