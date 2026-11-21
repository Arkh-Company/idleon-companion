// The checks of a block as Condition rows (pieces.cjs condRows, comparisons, condSub and mergeTests at BASELINE-4),
// over written checks.
import { expect, test } from "vitest";
import type { RecNode } from "../recording.ts";
import { makeConditions } from "./conditions.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { BlockSteps, Check, Expr } from "../recorded/steps.ts";

const node = (n: Partial<RecNode> = {}): RecNode => ({
  id: 0,
  b: "Top",
  a: [],
  c: [],
  p: null,
  pxi: 0,
  v: 1,
  ...n,
});
const { condRows, mergeTests } = makeConditions([node()]);
const num = (v: number): Expr => ({ t: "num", v });
const val = (v: number): Expr => ({ t: "val", v });
const read = (p: string, v: number): Expr => ({ t: "read", p, v });
const cmp = (o: string, l: Expr, r: Expr, v: boolean): Check => ({
  v,
  e: { t: "op", o, l, r, v },
});
const own = (checks: Check[], steps: BlockSteps["steps"] = []) => ({
  steps,
  checks,
});
const tests = (n: RecNode, checks: Check[], steps: BlockSteps["steps"] = []) =>
  condRows(n, own(checks, steps)).map((r) => [
    r.test,
    r.node.value,
    r.node.condition,
  ]);
const readRow = (code: string, value: number): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
});

test("a check is written with its named side first, and its answer is yes (1) or no (0)", () => {
  expect(tests(node(), [cmp("<", num(0), read("Lv", 3), true)])).toEqual([
    ["Lv > 0", 1, "limit"],
  ]);
});

test("a length tested against no literal is a guard, and two bare numbers select a member: neither is a check", () => {
  const len = read("List.length", 3);
  expect(
    tests(node(), [
      cmp(">", len, read("B", 2), true),
      cmp("==", num(3), val(3), true),
      cmp(">", len, num(1), true),
    ]),
  ).toEqual([["List.length > 1", 1, "limit"]]);
});

test("a lone check of a block with no step, made of numbers and the call's argument, is written by its number", () => {
  const sum = op("+", val(2), num(1), 3);
  expect(
    tests(node({ a: ["Mode", 2] }), [cmp("==", sum, read("A", 3), true)]),
  ).toEqual([["3 = A", 1, "equalsValue"]]);
});
function op(o: string, l: Expr, r: Expr, v: number): Expr {
  return { t: "op", o, l, r, v };
}

test("the subtype comes from what the check compares", () => {
  expect(
    tests(node(), [
      cmp("==", read("AchieveReg[3]", -1), num(-1), true),
      cmp(">", read("BoxOwned", 1), num(0), true),
      cmp("==", read("BubbleLevel", 50), num(50), true),
      cmp("==", read("PrayersActive[0]", 2), num(2), true),
      cmp("==", read("CurrentMap", 3), num(3), true),
    ]).map((t) => t[2]),
  ).toEqual(["done", "owned", "max", "active", "equalsValue"]);
});

test("a yes/no read tested for 1 is merged into its test, which takes its code", () => {
  const [c] = condRows(node(), own([cmp("==", read("Flag", 1), num(1), true)]));
  const rows = [readRow("A", 4), readRow("B", 5)];
  const out = mergeTests(
    node(),
    rows,
    [readRow("Flag", 1)],
    c ? [c] : [],
    own([]),
  );
  expect(out.map((r) => [r.node.code, r.node.leaf])).toEqual([
    ["A", null],
    ["B", null],
    ["Flag", "condition"],
  ]);
});

test("a level beside its limit stays a row of its own", () => {
  const [c] = condRows(node(), own([cmp(">", read("Lv", 1), num(0), true)]));
  const out = mergeTests(
    node(),
    [readRow("A", 4)],
    [readRow("Lv", 1)],
    c ? [c] : [],
    own([]),
  );
  expect(out.map((r) => r.node.code)).toEqual(["A", "Lv", null]);
});

test("a block left with one row keeps both the read and its test", () => {
  const [c] = condRows(node(), own([cmp("==", read("Flag", 1), num(1), true)]));
  const out = mergeTests(
    node(),
    [],
    [readRow("Flag", 1)],
    c ? [c] : [],
    own([]),
  );
  expect(out).toHaveLength(2);
});

test("a block with no step that returns a literal when its check passes gets that literal as a fixed value", () => {
  const [c] = condRows(node(), own([cmp(">", read("Lv", 3), num(0), true)]));
  const out = mergeTests(node({ v: 35 }), [], [], c ? [c] : [], own([]));
  expect(out[0]?.node).toMatchObject({
    name: "Fixed value",
    value: 35,
    leaf: "fixedValue",
  });
});

test("each side of a comparison: a negation, an or, the source of an expression; two comparisons of an and", () => {
  const fn: Expr = { t: "fn", name: "floor", args: [read("C", 7)], v: 3 };
  const both: Check = {
    v: true,
    e: {
      t: "op",
      o: "&&",
      l: cmp(">", read("A", 1), num(0), true).e,
      r: cmp("<", read("B", 2), num(5), true).e,
      v: true,
    },
  };
  expect(
    tests(node(), [
      cmp("==", { t: "not", a: read("F", 0), v: true }, num(1), true),
      cmp(
        "==",
        { t: "op", o: "||", l: read("G", 0), r: read("H", 1), v: 1 },
        num(1),
        true,
      ),
      cmp(">", fn, num(2), true),
      both,
      both,
      cmp("==", read("U", 1), { t: "val", v: undefined }, true),
    ]).map((t) => t[0]),
  ).toEqual(["not F = 1", "G or H = 1", "C > 2", "A > 0 and B < 5"]);
});

test("a level that happens to be 1, tested for 1, is no yes/no: it stays beside its test", () => {
  const lv = "Holes[11][3]"; // a level by kinds.ts RULES
  const [c] = condRows(node(), own([cmp("==", read(lv, 1), num(1), true)]));
  const out = mergeTests(
    node(),
    [readRow("A", 4)],
    [readRow(lv, 1)],
    c ? [c] : [],
    own([]),
  );
  expect(out.map((r) => r.node.code)).toEqual(["A", lv, null]);
});

test("a comparison with an unknown side is left out before the subtype is chosen; a value of the game is no maximum", () => {
  const and = (l: Check, r: Check): Check => ({
    v: true,
    e: { t: "op", o: "&&", l: l.e, r: r.e, v: true },
  });
  const unknown = cmp("==", read("U", 1), { t: "val", v: undefined }, true);
  expect(
    tests(node(), [
      and(unknown, cmp(">", read("A", 9), num(5), true)),
      cmp("!=", read("CurrentMapLv", 3), num(60), true),
    ]).map((t) => t[2]),
  ).toEqual(["limit", "equalsValue"]);
});

test("a read the kinds call a Condition merges into any test of it; a read that is no 0 or 1 never does", () => {
  const merge = (code: string, value: number, check: Check) => {
    const [c] = condRows(node(), own([check]));
    return mergeTests(
      node(),
      [readRow("A", 4)],
      [readRow(code, value)],
      c ? [c] : [],
      own([]),
    ).map((r) => r.node.code);
  };
  expect(
    merge("BoxUnlocked", 1, cmp(">", read("BoxUnlocked", 1), num(0), true)),
  ).toEqual(["A", "BoxUnlocked"]);
  expect(merge("Count", 5, cmp("==", read("Count", 5), num(1), false))).toEqual(
    ["A", "Count", null],
  );
});
