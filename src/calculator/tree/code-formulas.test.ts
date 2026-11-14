// The ⓘ the game's code gives a row (spec 008, T017: pieces.cjs exprFormula, callFormula and familyFormula), over
// expressions and calls written by hand with invented blocks and paths. A part is a token until the row's parts exist.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { node as windowNode } from "../../renderer/formula-fixture.ts";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { RecNode } from "../recording.ts";
import { makeCodeFormulas } from "./code-formulas.ts";
import { formulaFor, token, withFormula } from "./formulas.ts";
import type { Pair } from "./formulas.ts";
import type { Expr, Step } from "./steps.ts";
import { at, read as readRow } from "./tree-fixture.ts";

const num = (v: number): Expr => ({ t: "num", v });
const val = (v: number): Expr => ({ t: "val", v });
const read = (p: string, v: number | boolean): Expr => ({ t: "read", p, v });
const call = (id: number, v: number): Expr => ({ t: "call", id, v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
const fn = (name: string, args: Expr[], v: number): Expr => ({
  t: "fn",
  name,
  args,
  v,
});
const node = (id: number, b: string, more: Partial<RecNode> = {}): RecNode => ({
  id,
  b,
  a: [],
  c: [],
  p: null,
  pxi: 0,
  ...more,
});
const { expr } = makeCodeFormulas([node(0, "Talk", { v: 4 })], () => []);
const reads = new Map();

/** A row's ⓘ from the code on its way to the window (its parts found, the main's check, "How it adds up"): its two lines. */
function expectShown(pair: Pair | null): void {
  if (!pair) return;
  const r = at(1, { xf: pair });
  const kids = [readRow("Stats.other", 123456)];
  const fm = formulaFor(r, kids);
  const tree = checkTree(
    windowNode({ formula: withFormula(r, kids).formula }),
    1,
  );
  const f = tree?.formula;
  expect(f ? formulaLines(f) : null).toEqual({
    names: fm?.[0],
    numbers: fm?.[1],
    result: expect.not.stringContaining("NaN") as unknown,
  });
}

test.each<[string, Expr, number, [string, string] | null]>([
  [
    "a read and a constant",
    op("/", read("Stats.a", 8), num(4), 2),
    2,
    [`${token("c:Stats.a@8", "Stats.a")} ÷ 4`, "8 ÷ 4 = 2"],
  ],
  [
    "a bare value and a call",
    op("*", val(3), call(0, 4), 12),
    12,
    [`${token("v:3", "3")} × ${token("c:Talk()", "Talk()")}`, "3 × 4 = 12"],
  ],
  [
    "a sum inside a product, in brackets, through a def",
    op(
      "*",
      { t: "def", e: op("+", read("Stats.a", 1), num(2), 3), v: 3 },
      num(5),
      15,
    ),
    15,
    [`(${token("c:Stats.a@1", "Stats.a")} + 2) × 5`, "(1 + 2) × 5 = 15"],
  ],
  [
    "a cap",
    fn("min", [read("Stats.a", 9), num(5)], 5),
    5,
    [`min(${token("c:Stats.a@9", "Stats.a")}, 5)`, "min(9, 5) = 5"],
  ],
  [
    "0 + a part is the part",
    op("+", num(0), op("-", read("Stats.a", 9), num(1), 8), 8),
    8,
    [`${token("c:Stats.a@9", "Stats.a")} − 1`, "9 − 1 = 8"],
  ],
  ["0 + 0 stays", op("+", num(0), num(0), 0), 0, null],
  ["a value it does not give", op("/", read("Stats.a", 8), num(4), 2), 3, null],
  ["a read alone", read("Stats.a", 8), 8, null],
  ["only numbers of the code", op("+", num(1), num(2), 3), 3, null],
  ["a yes/no read", op("*", read("Stats.f", true), num(2), 2), 2, null],
  [
    "an operator it cannot write",
    op("%", read("Stats.a", 7), num(4), 3),
    3,
    null,
  ],
  ["a math name it cannot write", fn("sqrt", [read("Stats.a", 9)], 3), 3, null],
])("the expression of %s", (_name, e, v, formula) => {
  expect(expr(e, reads, v)).toEqual(formula);
  expectShown(formula);
});

test("an expression of one part is no ⓘ where two are asked", () => {
  const e = op("/", read("Stats.a", 8), num(4), 2);
  expect(expr(e, reads, 2, 2)).toBeNull();
  expect(
    expr(op("+", read("Stats.a", 8), read("Stats.b", 1), 9), reads, 9, 2)?.[1],
  ).toBe("8 + 1 = 9");
});

test("a talent inside a sum shows its own curve", () => {
  const nodes = [
    node(0, "GetTalentNumber", { a: [1, 7], v: 4, c: [1] }),
    node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 10], v: 4 }),
  ];
  const e = op("+", call(0, 4), read("Stats.b", 1), 5);
  expect(makeCodeFormulas(nodes, () => []).expr(e, reads, 5)).toEqual([
    `(4 + 0 × (Points in the talent + All-talent levels)) + ${token("c:Stats.b@1", "Stats.b")}`,
    "(4 + 0 × 10) + 1 = 5",
  ]);
  expectShown(makeCodeFormulas(nodes, () => []).expr(e, reads, 5));
});

/** The ⓘ of the first call, among `nodes`; `steps` gives each call's steps by id. */
const callOf = (nodes: RecNode[], steps: Record<number, Step[]> = {}) =>
  makeCodeFormulas(nodes, (id) => steps[id] ?? []).call(
    nodes[0] ?? node(0, "None"),
  );

test.each<[string, RecNode[], [string, string] | null]>([
  [
    "a talent's curve, in a dungeon",
    [
      node(0, "GetTalentNumber", { v: 5, c: [1] }),
      node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 0, 0.1, 50], v: 5 }),
    ],
    ["0 + 0.1 × 50 (in a dungeon)", "0 + 0.1 × 50 = 5"],
  ],
  [
    "a talent with no points",
    [node(0, "GetTalentNumber", { v: 0 })],
    ["0 while Points in the talent ≤ 0", "0 points → 0"],
  ],
  ["a talent with no curve kept", [node(0, "GetTalentNumber", { v: 3 })], null],
  [
    "a stamp type no stamp has",
    [node(0, "StampBonusOfTypeX", { a: ["Food"], v: 0 })],
    ["0: no stamp description has the type Food", "no stamp of this type → 0"],
  ],
  [
    "a stamp type with a stamp read",
    [
      node(0, "StampBonusOfTypeX", {
        a: ["Food"],
        v: 0,
        r: [["StampLevel[1][2]", 0]],
      }),
    ],
    null,
  ],
  [
    "the Rift's fifth star",
    [node(0, "RiftStuff", { a: ["5starCards"], v: 1, r: [["Rift[0]", 50]] })],
    ["1 when the Rift level ≥ 45, else 0", "Rift level 50 → 1"],
  ],
  [
    "the Rift's fifth star, no level read",
    [node(0, "RiftStuff", { a: ["5starCards"], v: 0 })],
    ["1 when the Rift level ≥ 45, else 0", "Rift level → 0"],
  ],
  [
    "a buff's talent",
    [
      node(0, "GetBuffBonuses", { a: [12, 3], v: 7, c: [1] }),
      node(1, "GetTalentNumber", { v: 7 }),
    ],
    [
      "The talent's value while buff 12 is on (0 when it is off)",
      "buff on → 7",
    ],
  ],
  [
    "a buff the game counts apart",
    [
      node(0, "GetBuffBonuses", { a: [615, 3], v: 7, c: [1] }),
      node(1, "GetTalentNumber", { v: 7 }),
    ],
    null,
  ],
  [
    "a talent banned from the all-talent levels",
    [
      node(0, "RunCodeOfTypeXforThingY", {
        a: ["AllTalentLV", 3],
        v: 0,
        c: [1],
      }),
      node(1, "RunCodeOfTypeXforThingY", {
        a: ["TalentBannedforAllLV", 3],
        v: 1,
      }),
    ],
    ["0: this talent is banned from the All-talent levels", "banned → 0"],
  ],
  [
    "a talent with no all-talent points",
    [node(0, "RunCodeOfTypeXforThingY", { a: ["AllTalentLVz", 3], v: 0 })],
    ["0 while Points in the talent ≤ 0.5", "0 points → 0"],
  ],
  [
    "a prayer in no slot",
    [
      node(0, "prayersReal", {
        a: [4, 0],
        v: 0,
        r: [
          ["PrayersActive[0]", 1],
          ["PrayersActive[1]", -1],
        ],
      }),
    ],
    ["0 while this prayer is in no prayer slot", "slots: 1 → 0"],
  ],
  [
    "a prayer in a slot",
    [node(0, "prayersReal", { a: [1, 0], v: 0, r: [["PrayersActive[0]", 1]] })],
    null,
  ],
  [
    "the best character's bonus",
    [
      node(0, "getbonus2", { v: 6, c: [1, 2] }),
      node(1, "ArbitraryCode5Inputs", { v: 6 }),
      node(2, "ArbitraryCode5Inputs", { v: 2 }),
    ],
    [
      "max(the bonus of each character: the talent's curve of its level)",
      "max(6, 2) = 6",
    ],
  ],
  [
    "one character's bonus",
    [
      node(0, "getbonus2", { v: 6, c: [1] }),
      node(1, "ArbitraryCode5Inputs", { v: 6 }),
    ],
    null,
  ],
  [
    "a card's level",
    [
      node(0, "RunCodeOfTypeXforThingY", {
        a: ["CardLv", "x"],
        v: 5,
        c: [1, 2],
      }),
      node(1, "RiftStuff", { v: 1 }),
      node(2, "Spelunk", { v: 0 }),
    ],
    [
      "1 + min(Stars passed, Base stars + Rift 5th star + Spelunking 6th star)",
      "1 + min(4, 4 + 1 + 0) = 5",
    ],
  ],
  [
    "a card not collected",
    [node(0, "RunCodeOfTypeXforThingY", { a: ["CardLv", "x"], v: 0 })],
    ["0 while no card is collected", "0 cards → 0"],
  ],
  [
    "a card forced by the account's list",
    [node(0, "RunCodeOfTypeXforThingY", { a: ["CardLv", "x"], v: 7 })],
    ["Forced to 7 by the card list of the account", "→ 7"],
  ],
])("the family of %s", (_name, nodes, formula) => {
  expect(callOf(nodes)).toEqual(formula);
  expectShown(formula);
});

test("a call's last step with its value, else the curve it returns", () => {
  const step: Step = { v: 2, e: op("/", read("Stats.a", 8), num(4), 2) };
  const other: Step = { v: 9, e: op("+", read("Stats.a", 8), num(1), 9) };
  expect(
    callOf([node(0, "Calc", { v: 2, r: [["Stats.a", 8]] })], {
      0: [step, other],
    }),
  ).toEqual([`${token("c:Stats.a@8", "Stats.a")} ÷ 4`, "8 ÷ 4 = 2"]);
  const curve = [
    node(0, "Box", { v: 4, c: [1], r: [["Stats.pts", 10]] }),
    node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 10], v: 4 }),
  ];
  expect(callOf(curve, { 0: [{ v: 1, e: read("Stats.x", 1) }] })).toEqual([
    "4 + 0 × Stats.pts",
    "4 + 0 × 10 = 4",
  ]);
  expect(
    callOf(
      [
        curve[0] ?? node(0, "Box"),
        node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 11], v: 4 }),
      ],
      { 0: [{ v: 1, e: read("Stats.x", 1) }] },
    )?.[0],
  ).toBe("4 + 0 × Level");
  expect(callOf([node(0, "Calc", { v: 2 })], { 0: [other] })).toBeNull();
});

test("a call kept from a cache takes its twin's ⓘ: the twin with calls, or the twin with steps", () => {
  const withCalls = [
    node(0, "RunCodeOfTypeXforThingY", { a: ["CardLv", "x"], v: 0 }),
    node(1, "RunCodeOfTypeXforThingY", { a: ["CardLv", "x"], v: 5, c: [2] }),
    node(2, "RiftStuff", { v: 0 }),
  ];
  // the first one is 0 by itself; the twin needs the same value
  expect(callOf(withCalls)).toEqual([
    "0 while no card is collected",
    "0 cards → 0",
  ]);
  const steps = { 1: [{ v: 2, e: op("/", read("Stats.a", 8), num(4), 2) }] };
  expect(
    callOf(
      [
        node(0, "Calc", { v: 2 }),
        node(1, "Calc", { v: 2, r: [["Stats.a", 8]] }),
      ],
      steps,
    )?.[1],
  ).toBe("8 ÷ 4 = 2");
  expect(
    callOf([node(0, "Calc", { v: 3 }), node(1, "Calc", { v: 2 })], steps),
  ).toBeNull();
  const twin = [
    node(0, "getbonus2", { v: 6 }),
    node(1, "getbonus2", { v: 6, c: [2, 3] }),
    node(2, "ArbitraryCode5Inputs", { v: 6 }),
    node(3, "ArbitraryCode5Inputs", { v: 1 }),
  ];
  expect(callOf(twin)?.[1]).toBe("max(6, 1) = 6");
});

test("a talent at 0 inside a sum is its call, and an expression of more than 30 parts is no ⓘ", () => {
  const nodes = [node(0, "GetTalentNumber", { a: [1, 7], v: 0 })];
  const e = op("+", call(0, 0), read("Stats.b", 1), 1);
  expect(makeCodeFormulas(nodes, () => []).expr(e, reads, 1)?.[0]).toBe(
    `${token("c:GetTalentNumber(1, 7)", "GetTalentNumber(1, 7)")} + ${token("c:Stats.b@1", "Stats.b")}`,
  );
  const many = Array.from({ length: 31 }, (_, i) =>
    read(`Stats.p${String(i)}`, 1),
  );
  const sum = many.reduce((a, x, i) => (i ? op("+", a, x, i + 1) : x));
  expect(expr(sum, reads, 31)).toBeNull();
  expect(
    expr(
      many.slice(0, 30).reduce((a, x, i) => (i ? op("+", a, x, i + 1) : x)),
      reads,
      30,
    )?.[1],
  ).toMatch(/= 30$/);
});

test("a talent at 50 levels outside a dungeon, the buff the game counts apart, and a curve of another value", () => {
  const talent = [
    node(0, "GetTalentNumber", { v: 5, c: [1, 2] }),
    node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 0, 0.1, 50], v: 5 }),
    node(2, "RunCodeOfTypeXforThingY", { a: ["AllTalentLV", 3], v: 10 }),
  ];
  expect(callOf(talent)?.[0]).toBe(
    "0 + 0.1 × (Points in the talent + All-talent levels)",
  );
  const buff = [
    node(0, "GetBuffBonuses", { a: [46, 3], v: 7, c: [1] }),
    node(1, "GetTalentNumber", { v: 7 }),
  ];
  expect(callOf(buff)).toBeNull();
  const other = [
    node(0, "Box", { v: 4, c: [1, 2], r: [["Stats.pts", 10]] }),
    node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 9, 0, 10], v: 9 }),
    node(2, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 10], v: 4 }),
  ];
  expect(callOf(other, { 0: [{ v: 1, e: read("Stats.x", 1) }] })?.[1]).toBe(
    "4 + 0 × 10 = 4",
  );
});
