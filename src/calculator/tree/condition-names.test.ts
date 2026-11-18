// The names in a block's checks (pieces.cjs condText and mergeTests [H1-MERGE] at BASELINE-4): a side of a comparison is
// its read's or its call's name, else its path or its call as it is (FR-012a); a yes/no read merged into its test "= 1"
// is said by its name alone, and the ban flag tested for 0 says what it means. A name from the names table is taken
// from the table itself, so this file holds no game text.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import type { RecNode } from "../recording.ts";
import { BAN_FLAG, makeConditions } from "./conditions.ts";
import { classify } from "./kinds.ts";
import { nameOf } from "./names.ts";
import { NAME_RECIPES, STATIC_NAMES, TABLE_HASHES } from "./names-table.ts";
import { TABLES } from "./gold-food-fixture.ts";
import { useGameTables } from "./table-names.ts";
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
/** A ban flag's call a recipe of the names table names (no game in this file: it keeps no name). */
const banKey =
  NAME_RECIPES.map((r) => r.key).find((k) => k.startsWith(BAN_FLAG.test)) ?? "";
const RECIPE_BAN = node(
  4,
  "RunCodeOfTypeXforThingY",
  JSON.parse(`[${/\((.*)\)$/.exec(banKey)?.[1] ?? ""}]`) as RecNode["a"],
  0,
);
const NODES = [
  node(0, "Top"),
  node(1, "Invented", ["SomeMode", 0, 0], 3),
  node(2, "Invented", [2], 3),
  BAN,
  RECIPE_BAN,
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

const shown = (r: Row | undefined) =>
  r && checkTree({ id: "x", ...r.node }, 1) !== null;
const nameOfCheck = (c: Check) => {
  const r = condRows(node(0, "Top"), own([c]))[0];
  return [r?.node.name, r?.node.flags, shown(r)];
};
const or = (l: Expr, r: Expr): Expr => ({ t: "op", o: "||", l, r, v: true });
const gt = (l: Expr, v: number): Expr => ({
  t: "op",
  o: ">",
  l,
  r: num(v),
  v: true,
});

test.each<[string, Check, string | null]>([
  ["a named read", cmp(">", read(FLAG, 3), num(0)), `${named} > 0`],
  ["a named call", cmp(">", call(1, 3), num(0)), "Some Mode > 0"],
  ["a read with no name", cmp(">", read("Stats.q", 3), num(0)), null],
  ["a call with no name", cmp(">", call(2, 3), num(0)), null],
  [
    "the game's working value",
    cmp(">", read("DNSM.SomeCache", 3), num(0)),
    null,
  ],
  [
    "two comparisons, both named",
    { v: true, e: or(gt(read(FLAG, 3), 0), gt(call(1, 3), 1)) },
    `${named} > 0 or Some Mode > 1`,
  ],
  [
    "two comparisons, one with no name",
    { v: true, e: or(gt(read(FLAG, 3), 0), gt(read("Stats.q", 3), 1)) },
    null,
  ],
  [
    "a side of two reads, one with no name",
    cmp(">", or(read(FLAG, 3), read("Stats.q", 3)), num(0)),
    null,
  ],
  [
    "a side of two reads, the first with no name",
    cmp(">", or(read("Stats.q", 3), read(FLAG, 3)), num(0)),
    null,
  ],
  [
    "a side that negates a read with no name",
    cmp("==", { t: "not", a: read("Stats.q", 0), v: true }, num(1)),
    null,
  ],
  [
    "a side that negates a named read",
    cmp("==", { t: "not", a: read(FLAG, 0), v: true }, num(1)),
    `not ${named} = 1`,
  ],
  [
    "a side that compares a read with no name",
    cmp("==", gt(read("Stats.q", 3), 0), num(1)),
    null,
  ],
  [
    "a side that compares a named read with one with no name",
    cmp(
      "==",
      { t: "op", o: ">", l: read(FLAG, 3), r: read("Stats.q", 1), v: true },
      num(1),
    ),
    null,
  ],
  [
    "a named read compared with one with no name",
    cmp(">", read(FLAG, 3), read("Stats.q", 1)),
    null,
  ],
  [
    "an expression around a read with no name",
    cmp(
      ">",
      { t: "fn", name: "floor", args: [read("Stats.q", 3)], v: 3 },
      num(0),
    ),
    null,
  ],
  [
    "a comparison too long to be a name",
    {
      v: true,
      e: Array.from({ length: 30 }, (_, i) => gt(read(FLAG, 30), i)).reduce(
        (a, b) => or(a, b),
      ),
    },
    null,
  ],
])(
  "[spec Open Questions] the row of a check on %s is its comparison only when every side has a name",
  (_name, c, name) => {
    expect(nameOfCheck(c)).toEqual(
      name === null
        ? ["Game value", { unnamed: true }, true]
        : [name, {}, true],
    );
  },
);

test("a yes/no read merged into its test is named by its name; the ban flag by what it means; else no name", () => {
  const rowsOf = (c: Check, r: Row) =>
    mergeTests(
      node(0, "Top"),
      [rowOf("Stats.a", 4)],
      [r],
      condRows(node(0, "Top"), own([c])),
      own([]),
    )
      .filter((x) => x.node.leaf === "condition")
      .map((x) => [x.node.name, x.node.flags]);
  expect(rowsOf(cmp("==", read(FLAG, 1), num(1)), rowOf(FLAG, 1))).toEqual([
    [named, {}],
  ]);
  const ban = rowOf(callText(BAN), 0);
  expect(rowsOf(cmp("==", call(3, 0), num(0)), ban)).toEqual([
    ["Counts for All-talent levels", {}],
  ]);
  // a ban flag a recipe names, over a game whose table gave no name: its test still says what it means
  expect(rowOf(callText(RECIPE_BAN), 0).node.flags).toEqual({ unnamed: true });
  expect(
    rowsOf(cmp("==", call(4, 0), num(0)), rowOf(callText(RECIPE_BAN), 0)),
  ).toEqual([["Counts for All-talent levels", {}]]);
  expect(
    rowsOf(cmp("==", read("Stats.q", 1), num(1)), rowOf("Stats.q", 1)),
  ).toEqual([["Game value", { unnamed: true }]]);
});

test("a read of -1 tested for 1 keeps its comparison: only a 0 or a 1 is said by its name", () => {
  expect(merged(cmp("==", read(FLAG, -1), num(1)), rowOf(FLAG, -1))).toEqual([
    [`${named} = 1`, null],
  ]);
});

// spec 009 T030 (decision of 18/11): a condition says what it means, as the bench names it (pieces.cjs condRows), in
// every tree: the game marks a finished achievement or dream with -1, and a search is a yes/no
test("a finished achievement or dream (= -1) is said completed, and a count at its end (≤ 0) reached", () => {
  const done = condRows(
    node(0, "Top"),
    own([cmp("==", read("AchieveReg[9]", -1), num(-1))]),
  )[0];
  expect([done?.node.condition, done?.test]).toEqual([
    "done",
    "AchieveReg[9] completed",
  ]);
  const left = condRows(
    node(0, "Top"),
    own([cmp("<=", read("KillsLeft2Advance[3][0]", 0), num(0))]),
  )[0];
  expect([left?.node.condition, left?.test]).toEqual([
    "done",
    "KillsLeft2Advance[3][0] reached",
  ]);
});

test("a cache the block fills with its one search is said by what it found: Found <item>, Not found <item>", () => {
  useGameTables(TABLES);
  // the block's own cache of its search, written by the block (HaveW6Trophy: the cache = Cards[1] contains the trophy)
  const block: RecNode = {
    ...node(5, "InventedSearch", [], 1),
    r: [
      ["DNSM.InventedFound", 1],
      ["Cards[1] contains itemA", true],
    ],
  };
  const { condRows: rows } = makeConditions(
    [...NODES, block],
    new Map([["DNSM.InventedFound", [5]]]),
  );
  const yes = rows(
    block,
    own([cmp("==", read("DNSM.InventedFound", 1), num(1))]),
  )[0];
  expect(yes?.test).toBe("Found Invented Charm");
  const no: Check = {
    v: false,
    e: {
      t: "op",
      o: "==",
      l: read("DNSM.InventedFound", 1),
      r: num(0),
      v: false,
    },
  };
  expect(rows(block, own([no]))[0]?.test).toBe("Not found Invented Charm");
  // a cache another block writes says nothing of the search
  const { condRows: other } = makeConditions(
    [...NODES, block],
    new Map([["DNSM.InventedFound", [1]]]),
  );
  expect(
    other(block, own([cmp("==", read("DNSM.InventedFound", 1), num(1))]))[0]
      ?.test,
  ).toBe("DNSM.InventedFound = 1");
  useGameTables(new Map());
});

test("every item of the game has its entry checked, so a search says the item it found (009 T030)", () => {
  // the World 6 trophy a block searches for (Cards[1] contains Trophy23), and 2480 items at 0e47e87b
  expect(TABLE_HASHES.has("ItemDefinitionsGET.Trophy23")).toBe(true);
  expect(
    [...TABLE_HASHES.keys()].filter((t) => t.startsWith("ItemDefinitionsGET."))
      .length,
  ).toBeGreaterThanOrEqual(2480);
});

test("a block that reads back the cache an earlier call of the same block filled with its search says the item too (009 T030)", () => {
  useGameTables(TABLES);
  const first: RecNode = {
    ...node(5, "InventedSearch", [], 1),
    r: [["Cards[1] contains itemA", true]],
  };
  const later: RecNode = {
    ...node(6, "InventedSearch", [], 1),
    r: [["DNSM.InventedFound", 1]],
  };
  const { condRows: rows } = makeConditions(
    [...NODES, first, later],
    new Map([["DNSM.InventedFound", [5]]]),
  );
  expect(
    rows(later, own([cmp("==", read("DNSM.InventedFound", 1), num(1))]))[0]
      ?.test,
  ).toBe("Found Invented Charm");
  useGameTables(new Map());
});

test("with no writer of the cache in the recording, the block's own search right beside it says the item (009 T030)", () => {
  useGameTables(TABLES);
  const block: RecNode = {
    ...node(5, "InventedSearch", [], 1),
    r: [
      ["Cards[1] contains itemA", true],
      ["DNSM.InventedFound", 1],
    ],
  };
  const { condRows: rows } = makeConditions([...NODES, block], new Map());
  expect(
    rows(block, own([cmp("==", read("DNSM.InventedFound", 1), num(1))]))[0]
      ?.test,
  ).toBe("Found Invented Charm");
  useGameTables(new Map());
});
