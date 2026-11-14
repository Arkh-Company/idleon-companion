// The branches of pieces.cjs rowOfTerm, exprRow, stepRef and tidy, over written steps: a stand-in context builds each
// read and call as a plain row, so only the term's own rule is under test.
import { expect, test } from "vitest";
import type { RecNode } from "../recording.ts";
import { callText, row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import { makeTerms } from "./terms.ts";

const nodes: RecNode[] = [
  { id: 0, b: "Top", a: [], c: [1, 2], p: null, pxi: 0, v: 9 },
  { id: 1, b: "B", a: [], c: [], p: 0, pxi: 0, v: 3 },
  { id: 2, b: "C", a: [], c: [], p: 0, pxi: 0, v: 2 },
  { id: 3, b: "ArbitraryCode5Inputs", a: [], c: [], p: 0, pxi: 0, v: 8 },
];
const finished: boolean[] = [];
const terms = makeTerms({
  nodes,
  // a read of a cache "DNSM.W…" has a writer to open into; any other read has none
  read: (p, v) => ({
    node: row({
      pieceKey: p,
      value: valueOf(v ?? null),
      code: p,
      kids: p.startsWith("DNSM.W") ? "lazy" : [],
    }),
    open: p.startsWith("DNSM.W") ? 9 : null,
  }),
  call: (k, v) => ({
    node: row({ pieceKey: k.b, value: valueOf(v ?? null), code: callText(k) }),
    open: null,
  }),
  finish: (_v, rows, ones) => {
    finished.push(ones);
    return rows;
  },
});
const num = (v: number): Expr => ({ t: "num", v });
const val = (v: number): Expr => ({ t: "val", v });
const read = (p: string, v: number): Expr => ({ t: "read", p, v });
const call = (id: number, v: number): Expr => ({ t: "call", id, v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
/** The rows of the last step, a sum, with the reads given. */
function rowsOf(
  steps: Step[],
  reads: [string, number | string][] = [],
  args: number[] = [],
): Row[] {
  return terms.stepTerms(
    { args, steps, at: steps.length - 1 },
    "+",
    new Map(reads),
  );
}
const brief = (r: Row): unknown[] => [
  r.node.name,
  r.node.code,
  r.node.value,
  (r.group ?? []).map(brief),
];

test("a number of an expression is named by its role: the cap of a min", () => {
  const min: Expr = {
    t: "fn",
    name: "min",
    args: [read("A", 80), num(50)],
    v: 50,
  };
  const [cap] = rowsOf([{ v: 51, e: op("+", min, num(1), 51) }]);
  expect(cap && brief(cap)).toEqual([
    "Game value",
    null,
    50,
    [
      ["Game value", "A", 80, []],
      ["Cap 50", null, 50, []],
    ],
  ]);
});

test("a variable that changed a call's value is a branch over the call", () => {
  const def: Expr = { t: "def", e: call(1, 3), v: 6 };
  const [branch] = rowsOf([{ v: 7, e: op("+", def, num(1), 7) }]);
  expect(branch && brief(branch)).toEqual([
    "Game value",
    null,
    6,
    [["Game value", "B()", 3, []]],
  ]);
});

test("around a cache read with a writer, the read's row with the expression's value; with none, the parts", () => {
  // (1 + x ÷ 100) × 2, one term of a sum
  const around = (p: string) =>
    op(
      "*",
      op("+", num(1), op("/", read(p, 50), num(100), 0.5), 1.5),
      num(2),
      3,
    );
  const [open] = rowsOf([{ v: 4, e: op("+", around("DNSM.W.x"), num(1), 4) }]);
  expect(open && brief(open)).toEqual(["Game value", "DNSM.W.x", 3, []]);
  const [parts] = rowsOf([{ v: 4, e: op("+", around("DNSM.N.x"), num(1), 4) }]);
  expect(parts?.group?.map((r) => r.node.name)).toEqual([
    "Base 1",
    "Game value",
    "Percent to number (÷ 100)",
    "× 2",
  ]);
});

test("the parts of an expression that adds are no group at ×1; a product's are", () => {
  finished.length = 0;
  const sum = op("+", call(1, 3), call(2, 2), 5);
  rowsOf([{ v: 6, e: op("+", op("*", sum, num(1), 5), num(1), 6) }]);
  const product = op("*", call(1, 3), call(2, 2), 6);
  rowsOf([{ v: 7, e: op("+", product, num(1), 7) }]);
  expect(finished).toEqual([false, true]);
});

test("a number cut out of a text the block read is a fixed value", () => {
  const [fixed] = rowsOf(
    [{ v: 26, e: op("+", val(25), num(1), 26) }],
    [["T", "10|25"]],
  );
  expect(fixed?.node).toMatchObject({
    value: 25,
    leaf: "fixedValue",
    why: null,
  });
});

test("a value an earlier step gave as one term is that term", () => {
  const [term] = rowsOf([
    { v: 4, e: read("A", 4) },
    { v: 5, e: op("+", val(4), num(1), 5) },
  ]);
  expect(term && brief(term)).toEqual(["Game value", "A", 4, []]);
});

test("tidy: an earlier value another row shows, or a 0 outside a product, leaves; so does a bare cache beside its value", () => {
  const rows = rowsOf(
    [{ v: 7, e: op("+", op("+", val(3), read("A", 3), 6), val(0), 6) }],
    [["B", 9]],
  );
  expect(terms.tidy(rows, "+", []).map(brief)).toEqual([
    ["Game value", "A", 3, []],
  ]);
  const cache = rowsOf([
    { v: 4, e: op("+", read("DNSM.N.x", 2), read("B", 2), 4) },
  ]);
  expect(terms.tidy(cache, "+", []).map((r) => r.node.code)).toEqual(["B"]);
});

test("a value a read of the block holds is that read", () => {
  const [term] = rowsOf(
    [{ v: 10, e: op("+", val(9), num(1), 10) }],
    [["X", 9]],
  );
  expect(term && brief(term)).toEqual(["Game value", "X", 9, []]);
});

test("a variable set by an expression is the branch of its parts, with the variable's value", () => {
  const def: Expr = { t: "def", e: op("*", read("A", 2), num(3), 6), v: 6 };
  const [branch] = rowsOf([{ v: 7, e: op("+", def, num(1), 7) }]);
  expect(branch && brief(branch)).toEqual([
    "Game value",
    null,
    6,
    [
      ["Game value", "A", 2, []],
      ["× 3", null, 3, []],
    ],
  ]);
});

test("a curve with its own value is the curve's row, even beside another source", () => {
  const curve = op("*", call(3, 8), call(1, 1), 8);
  const [row0] = rowsOf([{ v: 9, e: op("+", curve, num(1), 9) }]);
  expect(row0 && brief(row0)).toEqual([
    "Game value",
    "ArbitraryCode5Inputs()",
    8,
    [],
  ]);
});
