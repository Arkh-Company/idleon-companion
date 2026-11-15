// The names in a block's checks (pieces.cjs condText and mergeTests [H1-MERGE] at BASELINE-4): a side of a comparison is
// its read's or its call's name, else its path or its call as it is (FR-012a); a yes/no read merged into its test "= 1"
// is said by its name alone, and the ban flag tested for 0 says what it means. A name from the names table is taken
// from the table itself, so this file holds no game text.
import { expect, test } from "vitest";
import type { RecNode } from "../recording.ts";
import { makeConditions } from "./conditions.ts";
import { classify } from "./kinds.ts";
import { nameOf } from "./names.ts";
import { STATIC_NAMES } from "./names-table.ts";
import { callText, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Check, Expr } from "./steps.ts";

const node = (id: number, b: string, a: RecNode["a"] = [], v = 1): RecNode => ({
  id,
  b,
  a,
  c: [],
  p: null,
  pxi: 0,
  v,
});
const BAN = node(3, "RunCodeOfTypeXforThingY", ["TalentBannedforAllLV", 5], 0);
const NODES = [
  node(0, "Top"),
  node(1, "Invented", ["SomeMode", 0, 0], 3),
  node(2, "Invented", [2], 3),
  BAN,
];
const { condRows, mergeTests } = makeConditions(NODES);
const own = (checks: Check[]) => ({ steps: [], checks });
const num = (v: number): Expr => ({ t: "num", v });
const read = (p: string, v: number): Expr => ({ t: "read", p, v });
const call = (id: number, v: number): Expr => ({ t: "call", id, v });
const cmp = (o: string, l: Expr, r: Expr): Check => ({
  v: true,
  e: { t: "op", o, l, r, v: true },
});
const testOf = (c: Check) => condRows(node(0, "Top"), own([c]))[0]?.test;

/** A state read the names table names, whose type is a yes/no for the merge (no level, count or choice). */
const NOT_FLAG = [
  "level",
  "investedPoints",
  "quantity",
  "choice",
  "tier",
  "record",
  "fixedValue",
];
const FLAG =
  [...STATIC_NAMES.keys()].find(
    (k) =>
      !k.startsWith("DNSM.") &&
      !k.includes("(") &&
      !NOT_FLAG.includes(classify({ name: nameOf(k) ?? "", code: k }).leaf),
  ) ?? "";
const named = nameOf(FLAG) ?? "";

test.each<[string, Expr, string]>([
  ["a named read", read(FLAG, 3), `${named} > 0`],
  ["a read with no name", read("Stats.q", 3), "Stats.q > 0"],
  ["the game's working value", read("DNSM.SomeCache", 3), "DNSM.SomeCache > 0"],
  ["a named call", call(1, 3), "Some Mode > 0"],
  ["a call with no name", call(2, 3), "Invented(2) > 0"],
  [
    "an expression around a named read",
    { t: "op", o: "*", l: read(FLAG, 3), r: num(2), v: 6 },
    `${named} > 0`,
  ],
  [
    "an expression around a named call",
    { t: "fn", name: "floor", args: [call(1, 3)], v: 3 },
    "Some Mode > 0",
  ],
])(
  "a check on %s is written with its name, else as it is",
  (_name, side, text) => {
    expect(FLAG).not.toBe("");
    expect(testOf(cmp(">", side, num(0)))).toBe(text);
  },
);

const rowOf = (code: string, value: number): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
});
const merged = (c: Check, r: Row) => {
  const conds = condRows(node(0, "Top"), own([c]));
  return mergeTests(node(0, "Top"), [rowOf("Stats.a", 4)], [r], conds, own([]))
    .filter((x) => x.node.leaf === "condition")
    .map((x) => [x.test, x.node.code]);
};

test("a yes/no read tested for 1 and merged into its test is said by its name alone", () => {
  expect(merged(cmp("==", read(FLAG, 1), num(1)), rowOf(FLAG, 1))).toEqual([
    [named, FLAG],
  ]);
  // tested for 0, the test keeps its comparison
  expect(merged(cmp("==", read(FLAG, 0), num(0)), rowOf(FLAG, 0))).toEqual([
    // (the check passed: 1, the read 0, so the test keeps no code)
    [`${named} = 0`, null],
  ]);
});

test("[H1-MERGE] the ban flag of a talent tested for 0 is the talent counting for the All-talent levels", () => {
  const ban = rowOf(callText(BAN), 0);
  expect(merged(cmp("==", call(3, 0), num(0)), ban)).toEqual([
    ["Counts for All-talent levels", null],
  ]);
  // another read tested for 0 keeps its comparison
  expect(
    merged(cmp("==", call(1, 0), num(0)), rowOf(callText(NODES[1] ?? BAN), 0)),
  ).toEqual([["Some Mode = 0", null]]);
});

test("a read of -1 tested for 1 keeps its comparison: only a 0 or a 1 is said by its name", () => {
  expect(merged(cmp("==", read(FLAG, -1), num(1)), rowOf(FLAG, -1))).toEqual([
    [`${named} = 1`, null],
  ]);
});
