// A piece is built once (spec 008, T017, FR-009, FR-015; bench pieces.cjs `explain` at BASELINE-4): the first call
// of a block and its arguments under the root gives the piece's rows everywhere, a place that would come out different
// is counted, and a call of the setup is never the piece. Over the hand-written recording of tree-fixture.ts.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { chainOf, PIECES, recordingOf, SAME_TWICE } from "./tree-fixture.ts";
import { MAX_DEPTH } from "./pieces.ts";

const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
const brief = (n: CalcTreeNode | null | undefined) =>
  kidsOf(n).map((k) => [k.code, k.value]);

function open(...codes: (string | null)[]) {
  const build = buildTree(PIECES, 0);
  let node: CalcTreeNode | null = build.root;
  for (const code of codes) {
    const id: string | undefined = kidsOf(node).find(
      (k) => k.code === code && k.kids === "lazy",
    )?.id;
    node = id === undefined ? null : build.expand(id);
  }
  return { build, node };
}

test("the root's rows are its calls, then its readings that are numbers", () => {
  expect(brief(buildTree(PIECES, 0).root)).toEqual([
    ["Part(1)", 3],
    ["Part(1)", 3],
    ["Wrap()", 6],
    ["Hit(2)", 5],
    ["Stats.base", 4],
    ["DNSM.Pool.total", 9],
    ["DNSM.Side.v", 99],
  ]);
});

test("a piece called twice opens with the first call's rows, and the other place is a conflict", () => {
  const build = buildTree(PIECES, 0);
  const [first, second] = kidsOf(build.root);
  // The second place first: the piece does not depend on which one the player opens first.
  expect(brief(build.expand(second?.id ?? ""))).toEqual([["Level", 3]]);
  expect(brief(build.expand(first?.id ?? ""))).toEqual([["Level", 3]]);
  build.expand(second?.id ?? "");
  expect(build.conflicts).toEqual(['[0,"Part",1]']);
});

test("a second place that gives the same rows is no conflict", () => {
  const build = buildTree(SAME_TWICE, 0);
  const second = kidsOf(build.root)[1];
  expect(second?.code).toBe("Part(1)");
  expect(brief(build.expand(second?.id ?? ""))).toEqual([["Level", 3]]);
  expect(build.conflicts).toEqual([]);
});

test("a call that only read the cache its twin filled opens as the twin, with no conflict (FR-015)", () => {
  const hit = open("Hit(2)");
  expect(brief(hit.node)).toEqual([["Level", 5]]);
  // the fixture's own conflict, counted when the root's level is placed (each row's level is built then)
  expect(hit.build.conflicts).toEqual(['[0,"Part",1]']);
  expect(brief(open("Wrap()", "Hit(2)").node)).toEqual([["Level", 5]]);
});

test("a call whose value is not the twin's within 1e-9 is no twin (pieces.cjs near)", () => {
  const rec = structuredClone(PIECES);
  const hit = rec.nodes[8];
  if (hit) hit.v = 5.0000005;
  const build = buildTree(rec, 0);
  const row = kidsOf(build.root).find((k) => k.code === "Hit(2)");
  build.expand(row?.id ?? "");
  // not the twin's piece: the place is compared with the first call's rows, and differs
  expect(build.conflicts).toEqual(['[0,"Part",1]', '[0,"Hit",2]']);
});

test("a cache read opens into the call that wrote it", () => {
  expect(brief(open("DNSM.Pool.total").node)).toEqual([["Stash", 9]]);
});

test("a setup call with a piece's key keeps its own rows and never becomes the piece", () => {
  const { build, node } = open("DNSM.Side.v");
  expect(brief(node)).toEqual([["Level", 99]]);
  expect(brief(build.expand(kidsOf(build.root)[0]?.id ?? ""))).toEqual([
    ["Level", 3],
  ]);
  // only the fixture's own conflict, counted when the root's level is placed
  expect(build.conflicts).toEqual(['[0,"Part",1]']);
});

test("ids follow the path, with #n on a repeat, and every opened row can open again", () => {
  const build = buildTree(PIECES, 0);
  const ids = kidsOf(build.root).map((k) => k.id);
  expect(ids.slice(0, 2)).toEqual(["root/Game value", "root/Game value#2"]);
  const wrap = build.expand(ids[2] ?? "");
  expect(wrap?.id).toBe("root/Game value#3");
  const hit = kidsOf(wrap)[0];
  expect(hit?.id).toBe("root/Game value#3/Game value");
  expect(brief(build.expand(hit?.id ?? ""))).toEqual([["Level", 5]]);
});

test("an id that is not a lazy branch expands to nothing", () => {
  const build = buildTree(PIECES, 0);
  expect(build.expand("root")).toBeNull();
  expect(build.expand("root/nowhere")).toBeNull();
  expect(build.expand(kidsOf(build.root)[4]?.id ?? "")).toBeNull();
});

test(`a branch deeper than ${String(MAX_DEPTH)} levels stops there`, () => {
  const build = buildTree(chainOf(MAX_DEPTH + 2), 0);
  let node: CalcTreeNode | null = build.root;
  for (let depth = 1; depth <= MAX_DEPTH; depth++)
    node = build.expand(kidsOf(node)[0]?.id ?? "");
  expect(node?.code).toBe(`Step${String(MAX_DEPTH + 1)}()`);
  const cut = build.expand(kidsOf(node)[0]?.id ?? "");
  expect(cut).toMatchObject({ kids: [], flags: { truncated: true } });
});

test("every level's rows carry their share in the parent, the root none", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Sum", v: 9, c: [2, 3] },
      { b: "Lower", v: 3, r: [["Level", 3]] },
      {
        b: "Upper",
        v: 6,
        r: [
          ["Level", 2],
          ["Multi", 3],
        ],
      },
    ],
    [],
    { root: 0 },
  );
  const build = buildTree(rec, 0);
  const shareOf = (n: CalcTreeNode | null) =>
    kidsOf(n).map((k) => [k.share?.toFixed(4), k.shareMode]);
  expect([build.root.share, build.root.shareMode]).toEqual([null, null]);
  expect(shareOf(build.root)).toEqual([
    ["0.3333", "sum"],
    ["0.6667", "sum"],
  ]);
  const upper = build.expand(kidsOf(build.root)[1]?.id ?? "");
  expect(upper).toMatchObject({ share: 6 / 9, shareMode: "sum" });
  expect(shareOf(upper)).toEqual([
    ["0.3869", "product"],
    ["0.6131", "product"],
  ]);
});

test("every leaf gets its type and its reason; a branch has none", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "Total",
        v: 5,
        c: [2, 3, 4, 5, 6],
        r: [
          ["StampLevel[0][1]", 3],
          ["DNSM.Ready.v", 2],
        ],
      },
      { b: "Flat", a: [1], v: 4, x: [[0, 4]] },
      { b: "Const", a: [2], v: 9 },
      { b: "Label", v: "(text)" },
      { b: "Gate", v: 0, q: [["Invented.flag", true]] },
      { b: "Deep", v: 1, r: [["Level", 1]] },
    ],
    [],
    { root: 0, fromGame: ["Ready"] },
  );
  const kinds = kidsOf(buildTree(rec, 0).root).map((k) => [
    k.code,
    k.leaf,
    k.why,
  ]);
  expect(kinds).toEqual([
    ["Flat(1)", "rawBonus", null],
    [
      "Const(2)",
      "fixedValue",
      "a constant of the game for this case (no read, no step)",
    ],
    ["Label()", "rawBonus", null],
    ["Gate()", "rawBonus", null],
    ["Deep()", null, null],
    ["StampLevel[0][1]", "level", null],
    ["DNSM.Ready.v", "unknown", "a cache that comes ready from the game"],
  ]);
});

test("a call under the twin it read from opens as the piece, not cut", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Loop", a: [1], v: 2, c: [2] },
      { b: "Loop", a: [1], v: 2, r: [["DNSM.Loop.v", 2, 0]] },
    ],
    [{ path: "DNSM.Loop.v", node: 1, v: 2, seq: 0 }],
    { root: 0 },
  );
  const build = buildTree(rec, 0);
  const inner = build.expand(kidsOf(build.root)[0]?.id ?? "");
  expect(inner?.flags.truncated).toBeUndefined();
  expect(brief(inner)).toEqual([["Loop(1)", 2]]);
});
