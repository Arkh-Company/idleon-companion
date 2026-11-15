// The names the branches of a step take from their sources (pieces.cjs rowOfTerm [R1-PATCH], its read branch and its
// def branch, formulas.cjs `fallback` and `r1src`), over written steps: a part's name comes from the names table, so
// this file holds no game text.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { exprText, isFormulaName } from "./expr.ts";
import { nameOf } from "./names.ts";
import { STATIC_NAMES } from "./names-table.ts";
import { finish, GENERIC_NAME, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";
import { buildTree } from "../tree-build.ts";
import { branch, kidsOf, read as read2, recordingOf } from "./tree-fixture.ts";
import { loneCall } from "./tidy.ts";
import { call, fn, nodes, num, op, read, terms } from "./term-fixture.ts";

/** A state read the names table names (no game cache, no call). */
const NAMED =
  [...STATIC_NAMES.keys()].find(
    (k) => !k.startsWith("DNSM.") && !k.includes("("),
  ) ?? "";
const named = nameOf(NAMED) ?? "";
const term = (e: Expr) => terms.term(e, "+", new Map());
const shown = (r: Row | null) => r && [r.node.name, r.node.flags, r.r1src];
const passes = (r: Row | null) =>
  r !== null && checkTree({ id: "x", ...r.node, kids: [] }, 1) !== null;

test("exprText and isFormulaName (pieces.cjs text, formulas.cjs isFormulaName)", () => {
  const e = op("+", num(1), op("/", read("A", 50), num(100), 0.5), 1.5);
  expect(exprText(e)).toBe("1 + (50 ÷ 100)");
  expect(isFormulaName(exprText(e))).toBe(true);
  expect(exprText(fn("max", [read("A", 2), num(5)], 5))).toBe("max(2, 5)");
  expect(isFormulaName("max(2, 5)")).toBe(true);
  // a math name other than min, max, pow, floor and ceil, a word, or no operation is no formula name
  expect(isFormulaName("round(50 ÷ 100)")).toBe(false);
  expect(isFormulaName("floor(5)")).toBe(false);
  expect(isFormulaName("Some 2 + 3")).toBe(false);
  expect(isFormulaName("2 + x")).toBe(true);
  expect(isFormulaName("x + y")).toBe(false);
  // a def is the step under it: a sum under a product keeps its brackets
  const def: Expr = { t: "def", e: op("+", read("A", 1), num(2), 3), v: 3 };
  expect(exprText(def)).toBe("1 + 2");
  expect(exprText(op("*", def, num(5), 15))).toBe("(1 + 2) × 5");
});

test("a read with a name, around one source, is the read's row: with no name, the branch of its parts", () => {
  expect(NAMED).not.toBe("");
  const around = (p: string) => term(fn("max", [read(p, 5), num(0)], 5));
  expect(around(NAMED)?.node).toMatchObject({ code: NAMED, name: named });
  expect(around("Stats.q")?.node).toMatchObject({
    code: null,
    name: GENERIC_NAME,
  });
  // the scratch numbers have the game's generic name: a name for this choice (pieces.cjs readName)
  expect(around("DummyNumbersStatManager.x")?.node.code).toBe(
    "DummyNumbersStatManager.x",
  );
});

test("the branch of a named read's parts takes the read's name, unless a product's other part is no constant", () => {
  // formulas.cjs formulaOf (A): 1 + (x ÷ 100) is named by its shape before any source name, named read or not
  const pct = (p: string) =>
    term(op("+", num(1), op("/", read(p, 50), num(100), 0.5), 1.5));
  expect(shown(pct(NAMED))).toEqual(["Multiplier", {}, undefined]);
  expect(passes(pct(NAMED))).toBe(true);
  expect(shown(pct("Stats.q"))).toEqual(["Multiplier", {}, undefined]);
  // a sum of no shape keeps the read's name
  expect(
    shown(term(op("+", op("/", read(NAMED, 50), num(100), 0.5), num(2), 2.5))),
  ).toEqual([named, {}, undefined]);
  // a product of the read by another source is no part named for the read
  expect(
    term(op("*", read(NAMED, 5), read("Stats.b", 40), 200))?.node.name,
  ).toBe(GENERIC_NAME);
  expect(term(op("*", read(NAMED, 5), num(40), 200))?.node.name).toBe(named);
  // a sum of the read and another source is named for the read: only a product's other part counts
  expect(
    term(op("+", read(NAMED, 50), read("Stats.b", 3), 53))?.node.name,
  ).toBe(named);
  // a branch whose own text is no formula keeps the generic name (round is no formula name)
  expect(
    term(fn("round", [op("/", read(NAMED, 50), num(100), 0.5)], 1))?.node.name,
  ).toBe(GENERIC_NAME);
});

test.each<[string, Expr, [string, object, string | undefined]]>([
  [
    "one source with a name, in a shape: the shape's name, and its name as the source",
    op("+", num(1), op("/", call(4, 3), num(100), 0.03), 1.03),
    ["Multiplier", {}, "Some Mode"],
  ],
  [
    "one source with a name, in no shape: its name, and its name as the source",
    op("+", op("/", call(4, 3), num(100), 0.03), num(2), 2.03),
    ["Some Mode", {}, "Some Mode"],
  ],
  [
    "one source with no name, in a shape: the shape's name",
    op("+", num(1), op("/", call(1, 3), num(100), 0.03), 1.03),
    ["Multiplier", {}, undefined],
  ],
  [
    "one source with no name, in no shape: the generic name",
    op("+", op("/", call(1, 3), num(100), 0.03), num(2), 2.03),
    [GENERIC_NAME, { unnamed: true }, undefined],
  ],
  [
    "a percent of two sources",
    op(
      "+",
      num(1),
      op("/", op("+", call(4, 3), read("Stats.a", 2), 5), num(100), 0.05),
      1.05,
    ),
    ["Multiplier from 2 sources", {}, "Some Mode"],
  ],
  [
    "a sum of two sources after a number other than 1",
    op(
      "+",
      num(2),
      op("/", op("+", call(4, 3), read("Stats.a", 2), 5), num(100), 0.05),
      2.05,
    ),
    ["Sum of 2 sources", {}, "Some Mode"],
  ],
  [
    "a sum of two sources after 1, with no quotient",
    op("+", num(1), op("*", call(4, 3), read("Stats.a", 2), 6), 7),
    ["Sum of 2 sources", {}, "Some Mode"],
  ],
  [
    "a product of two sources",
    op("*", call(1, 3), read("Stats.a", 2), 6),
    ["Multiplier from 2 sources", {}, undefined],
  ],
  [
    "a quotient of two sources",
    op("/", call(1, 3), read("Stats.a", 2), 1.5),
    ["Multiplier from 2 sources", {}, undefined],
  ],
  [
    "a sum of two sources",
    op("+", call(4, 3), read("Stats.a", 2), 5),
    ["Sum of 2 sources", {}, "Some Mode"],
  ],
  [
    "a difference of two sources",
    op("-", call(4, 3), read("Stats.a", 2), 1),
    ["Formula of 2 sources", {}, "Some Mode"],
  ],
  [
    "a branch whose text is no formula",
    fn("round", [op("/", call(4, 3), num(100), 0.03)], 0),
    [GENERIC_NAME, { unnamed: true }, "Some Mode"],
  ],
])("[R1-PATCH] the branch around a call: %s", (_name, e, out) => {
  const r = term(e);
  expect(shown(r)).toEqual(out);
  expect(passes(r)).toBe(true);
});

test("a def of an expression is named by its first source; with no name, the generic one", () => {
  const def = (src: Expr): Expr => ({
    t: "def",
    e: op("*", src, num(3), 6),
    v: 6,
  });
  expect(shown(term(def(read(NAMED, 2))))).toEqual([named, {}, undefined]);
  expect(shown(term(def(call(4, 2))))).toEqual(["Some Mode", {}, undefined]);
  expect(shown(term(def(read("Stats.q", 2))))).toEqual([
    GENERIC_NAME,
    { unnamed: true },
    undefined,
  ]);
  // in a shape, a def with a source keeps its source's name (or none); with no source, its shape's
  const pct = (src: Expr): Expr => ({
    t: "def",
    e: op("+", num(1), op("/", src, num(100), 0.03), 1.03),
    v: 1.03,
  });
  expect(shown(term(pct(read("Stats.q", 3))))).toEqual([
    GENERIC_NAME,
    { unnamed: true },
    undefined,
  ]);
  expect(shown(term(pct(num(3))))).toEqual(["Multiplier", {}, undefined]);
});

test("formulas.cjs r1src: two branches of one shape name are told apart by their first source", () => {
  const pct = (id: number, v: number) =>
    term(op("+", num(1), op("/", call(id, v), num(100), v / 100), 1 + v / 100));
  const [a, b] = [pct(4, 3), pct(5, 2)];
  const rows = a && b ? finish(2, [a, b], false) : [];
  expect(rows.map((r) => r.node.name)).toEqual([
    "Multiplier (Some Mode)",
    "Multiplier",
  ]);
  expect(rows.every(passes)).toBe(true);
});

test("formulas.cjs r1src: a branch that shares its name with another part takes its source's name after it", () => {
  const r1 = (src: string): Row => {
    const b = branch(2, []);
    return {
      ...b,
      node: { ...b.node, name: "Sum of 2 sources", flags: {} },
      r1src: src,
    };
  };
  const names = (rows: Row[]) => finish(4, rows, false).map((r) => r.node.name);
  expect(names([r1("Some Mode"), r1("Other Mode")])).toEqual([
    "Sum of 2 sources (Some Mode)",
    "Sum of 2 sources",
  ]);
  // alone, or already with its source's name, it stays
  expect(names([r1("Some Mode")])).toEqual(["Sum of 2 sources"]);
  const both = { ...r1("Sum"), node: { ...r1("Sum").node } };
  expect(names([both, r1("Other Mode")])).toEqual([
    "Sum of 2 sources",
    "Sum of 2 sources (Other Mode)",
  ]);
});

test("pieces.cjs tidy: a row that only repeats its block (the block's name and value, nothing under it) leaves", () => {
  const block = nodes[4] ?? nodes[0];
  const own = (v: number, open: Row["open"] = null): Row => ({
    node: row({ pieceKey: null, value: v, code: null, name: "Some Mode" }),
    open,
  });
  const rows = [own(3), own(2), own(3, 7), read2("Stats.q", 3)];
  expect(
    block &&
      terms.tidy(rows, "+", [], block).map((r) => [r.node.name, r.node.value]),
  ).toEqual([
    ["Some Mode", 2],
    ["Some Mode", 3],
    [GENERIC_NAME, 3],
  ]);
  // a block with no name, or no block, has nothing to repeat
  expect(terms.tidy(rows, "+", [], nodes[1])).toHaveLength(4);
  expect(terms.tidy(rows, "+", [])).toHaveLength(4);
});

test("pieces.cjs cacheStepRows: a cache's one row with no name, nothing under it and the cache's value, in a step that is no sum nor product, says nothing", () => {
  const lone = (e: Expr, r: Row, v = 3) => loneCall(e, [r], v, () => false);
  const unnamed: Row = read2("B()", 3);
  expect(lone(call(1, 3), unnamed)).toEqual([]);
  expect(lone({ t: "def", e: call(1, 3), v: 3 }, unnamed)).toEqual([]);
  // any step that is no sum nor product, as the bench's `!op`: min, max, pow, a difference, a quotient, a read
  for (const e of [
    fn("max", [call(1, 3), num(0)], 3),
    fn("pow", [call(1, 3), num(1)], 3),
    op("-", call(1, 3), num(0), 3),
    op("/", call(1, 3), num(1), 3),
    read("A", 3),
  ])
    expect(lone(e, unnamed)).toEqual([]);
  // with a name, another value, something under it, or a sum or a product, it stays
  const withName: Row = { node: { ...unnamed.node, flags: {} }, open: null };
  expect(lone(call(4, 3), withName)).toHaveLength(1);
  expect(lone(call(1, 3), unnamed, 4)).toHaveLength(1);
  expect(loneCall(call(1, 3), [unnamed], 3, () => true)).toHaveLength(1);
  expect(lone(op("+", call(1, 3), num(0), 3), unnamed)).toHaveLength(1);
  expect(lone(op("*", call(1, 3), num(1), 3), unnamed)).toHaveLength(1);
});

test("in the tree, a block's row that only repeats the block leaves its rows", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Invented", a: ["SomeMode", 0, 0], v: 3, c: [2, 3] },
      { b: "Invented", a: ["SomeMode", 0, 0], v: 3 },
      { b: "Other", v: 0 },
    ],
    [],
    { root: 0 },
  );
  expect(kidsOf(buildTree(rec, 0).root).map((k) => k.code)).toEqual([
    "Other()",
  ]);
});
