// The branches of pieces.cjs rowOfTerm, exprRow, stepRef and tidy, over written steps: a stand-in context builds each
// read and call as a plain row, so only the term's own rule is under test.
import { expect, test } from "vitest";
import type { RecNode } from "../recording.ts";
import { callText, row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import { makeTerms } from "./terms.ts";
import { makeCodeFormulas } from "./code-formulas.ts";
import { token } from "./formulas.ts";

const nodes: RecNode[] = [
  { id: 0, b: "Top", a: [], c: [1, 2], p: null, pxi: 0, v: 9 },
  { id: 1, b: "B", a: [], c: [], p: 0, pxi: 0, v: 3 },
  { id: 2, b: "C", a: [], c: [], p: 0, pxi: 0, v: 2 },
  { id: 3, b: "ArbitraryCode5Inputs", a: [], c: [], p: 0, pxi: 0, v: 8 },
];
const finished: boolean[] = [];
/** The terms of `block`'s steps (the first node by default), in the loop entry `entry` gives. */
const termsOf = (block?: RecNode, entry: () => string | null = () => null) =>
  makeTerms({
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
      node: row({
        pieceKey: k.b,
        value: valueOf(v ?? null),
        code: callText(k),
      }),
      open: null,
    }),
    finish: (_v, rows, ones) => {
      finished.push(ones);
      return rows;
    },
    block: block ?? { id: 0, b: "Top", a: [], c: [], p: null, pxi: 0 },
    entry,
    formulas: makeCodeFormulas(nodes, () => []),
  });
const terms = termsOf();
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
/** The rows of the last step, a sum unless `op` says otherwise, with the reads given. */
function rowsOf(
  steps: Step[],
  reads: [string, number | string][] = [],
  args: number[] = [],
  top: "*" | "+" = "+",
): Row[] {
  return terms.stepTerms(
    { args, steps, at: steps.length - 1 },
    top,
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

const fn = (name: string, args: Expr[], v: number): Expr => ({
  t: "fn",
  name,
  args,
  v,
});
test.each<[string, Expr, string[]]>([
  [
    "the minimum of a max",
    fn("max", [read("A", 2), num(5)], 5),
    ["Game value", "Minimum 5"],
  ],
  [
    "the exponent of a pow",
    fn("pow", [read("A", 2), num(3)], 8),
    ["Game value", "Exponent 3"],
  ],
  [
    "the base of a pow",
    fn("pow", [num(2), read("A", 3)], 8),
    ["Base 2", "Game value"],
  ],
  [
    "a number under no operation",
    fn("round", [read("A", 2), num(7)], 2),
    ["Game value", "Fixed value 7"],
  ],
  [
    "what a difference takes away",
    op("-", read("A", 9), num(4), 5),
    ["Game value", "Minus 4"],
  ],
  [
    "what a difference starts from",
    op("-", num(10), read("A", 4), 6),
    ["Fixed value 10", "Game value"],
  ],
  [
    "a divisor that is no 100",
    op("/", read("A", 8), num(4), 2),
    ["Game value", "Divided by 4"],
  ],
  [
    "what a quotient divides",
    op("/", num(10), read("A", 5), 2),
    ["Fixed value 10", "Game value"],
  ],
])("a number of an expression is named by its role: %s", (_name, e, names) => {
  const [parts] = rowsOf([
    { v: Number(e.v) + 1, e: op("+", e, num(1), Number(e.v) + 1) },
  ]);
  expect(parts?.group?.map((r) => r.node.name)).toEqual(names);
});

test("a number that is a term of the step is fixed by the step's operation", () => {
  const [, plus] = rowsOf([{ v: 7, e: op("+", read("A", 4), num(3), 7) }]);
  const [, times] = rowsOf(
    [{ v: 12, e: op("*", read("A", 4), num(3), 12) }],
    [],
    [],
    "*",
  );
  // a step that is one number, reached from a later step: no operation around it
  const [alone] = rowsOf([
    { v: 7, e: num(7) },
    { v: 8, e: op("+", val(7), num(1), 8) },
  ]);
  expect([plus, times, alone].map((r) => r?.node.name)).toEqual([
    "Fixed +3",
    "Fixed ×3",
    "Fixed value 7",
  ]);
});

test("inside an earlier step, a value equal to the caller's argument stays a value from an earlier step", () => {
  const [ref] = rowsOf(
    [
      { v: 5, e: op("+", val(3), num(2), 5) },
      { v: 6, e: op("+", val(5), num(1), 6) },
    ],
    [],
    [3],
  );
  // (pieces.cjs stepRef tidies with no caller: only the block's own level turns it into the caller's argument)
  const [first] = ref?.group ?? [];
  expect(first?.earlier).toBe(true);
  expect(first?.node).toMatchObject({ value: 3, leaf: "unknown" });
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

test("[D9-7] the other loop's total read as 0 in a step of the worn items' loop is the stat's total", () => {
  const e = op(
    "+",
    read("DummyNumbersStatManager.TotalStatsDN", 0),
    read("DNSM.TotalStatsDM.UQ1val", 5),
    5,
  );
  const [total] = terms.stepTerms(
    { args: [], steps: [{ v: 5, e }], at: 0 },
    "+",
    new Map(),
  );
  expect(total?.node).toMatchObject({
    code: "DNSM.TotalStatsETCmap",
    value: 0,
    leaf: "unknown",
    why: "the total of the earlier turns of the game's loop, before this one adds to it",
  });
});

test("[W3] in a turn of a loop's entry, a bare 0 is the total of the earlier turns when other entries were undefined", () => {
  const reads = new Map<string, number | string>([
    ["Z", 0],
    ["DNSM.CardBonusS.b", "(undefined)"],
  ]);
  const inEntry = termsOf(undefined, () => "DNSM.CardBonusS.a");
  expect(inEntry.term(val(0), "+", reads)?.node).toMatchObject({
    code: "DNSM.CardBonusS.a",
    leaf: "unknown",
  });
  // outside the loop the same 0 is the read that holds it, and so it is when the other entries had a value
  expect(terms.term(val(0), "+", reads)?.node.code).toBe("Z");
  reads.set("DNSM.CardBonusS.b", 3);
  expect(inEntry.term(val(0), "+", reads)?.node.code).toBe("Z");
});

test.each<[string, [string, number][], string | null, string]>([
  [
    "one counted list",
    [["Research[11].length", 4]],
    "Research[11].length",
    "quantity",
  ],
  [
    "two counted lists with the value",
    [
      ["Research[11].length", 4],
      ["Spelunk[6].length", 4],
    ],
    null,
    "unknown",
  ],
  ["the items found", [["Cards[1].length", 4]], "Cards[1].length", "quantity"],
])(
  "[OPUS4-8, OPUS1-P5] a value that is the length of %s",
  (_name, reads, code, leaf) => {
    expect(terms.term(val(4), "+", new Map(reads))?.node).toMatchObject({
      code,
      leaf,
    });
  },
);

test("[FIX-4] a number of a block that writes its table in its own code is a fixed value", () => {
  const holes = {
    id: 9,
    b: "Holes",
    a: ["LampBonuses"],
    c: [],
    p: null,
    pxi: 0,
  };
  expect(termsOf(holes).term(val(7), "+", new Map())?.node).toMatchObject({
    code: null,
    leaf: "fixedValue",
  });
  expect(terms.term(val(7), "+", new Map())?.node.leaf).toBe("unknown");
});

test("the game's expression around a part goes with its row for its ⓘ", () => {
  const t = token;
  const [part] = rowsOf([
    { v: 2, e: op("/", op("+", read("Stats.a", 6), num(2), 8), num(4), 2) },
  ]);
  expect(part?.xf).toEqual([
    `(${t("c:Stats.a@6", "Stats.a")} + 2) ÷ 4`,
    "(6 + 2) ÷ 4 = 2",
  ]);
  const [two] = rowsOf([{ v: 3, e: fn("max", [call(1, 3), val(2)], 3) }]);
  expect([two?.xf, two?.xweak]).toEqual([
    [`max(${t("c:B()", "B()")}, ${t("v:2", "2")})`, "max(3, 2) = 3"],
    undefined,
  ]);
  const [one] = rowsOf([{ v: 3, e: fn("max", [call(1, 3), num(1)], 3) }]);
  expect([one?.xf, one?.xweak]).toEqual([
    undefined,
    [`max(${t("c:B()", "B()")}, 1)`, "max(3, 1) = 3"],
  ]);
});
