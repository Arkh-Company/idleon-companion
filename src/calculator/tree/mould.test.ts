// The first level of a tree (spec 008, FR-006; T017 "a step never named fixed"): the game's steps in its order, each
// with its bonus's name; a step the assembly would name by its shape has no proven name: `no name yet`.
import { expect, test } from "vitest";
import { mould } from "./mould.ts";
import { GENERIC_NAME, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { branch, fixed, ones, read } from "./tree-fixture.ts";

const brief = (r: Row) => [r.node.name, r.node.value, r.node.flags];

test.each([
  "Fixed value 2",
  "Fixed +2",
  "Fixed ×1.5",
  "Base 10",
  "× 1.5",
  "Minus 3",
  "Divided by 4",
  "Percent to number (÷ 100)",
])("a step never named %s: no name yet", (name) => {
  expect(mould([fixed(name, 2)]).map(brief)).toEqual([
    [GENERIC_NAME, 2, { unnamed: true }],
  ]);
});

test.each<[string, Row]>([
  // a word that starts like a shape is not one
  ["Captain Boat Speed bonus", fixed("Captain Boat Speed bonus", 2)],
  // a proven name, on a read or on a fixed value of the game's tables
  [
    "Base damage",
    {
      node: row({
        pieceKey: "k",
        value: 2,
        code: "Stats.d",
        name: "Base damage",
      }),
      open: null,
    },
  ],
  [
    "Base damage",
    {
      node: row({
        pieceKey: "k",
        value: 2,
        code: "Table[1]",
        name: "Base damage",
        leaf: "fixedValue",
      }),
      open: null,
    },
  ],
])("a step named %s by its bonus keeps that name", (name, step) => {
  expect(mould([step]).map(brief)).toEqual([[name, 2, {}]]);
});

test("a step inside a group at 0 is a step too", () => {
  const zero: Row = {
    node: row({
      pieceKey: null,
      value: 0,
      code: null,
      name: "At 0 (1)",
      role: "atZero",
    }),
    open: null,
    group: [fixed("Fixed +2", 0)],
  };
  expect(mould([zero])[0]?.group?.map(brief)).toEqual([
    [GENERIC_NAME, 0, { unnamed: true }],
  ]);
});

test("a step keeps its bonus's name, and the game's order", () => {
  const rows = [read("DNSM.Invented", 3), fixed("Fixed +2", 2)];
  expect(mould(rows).map((r) => r.node.name)).toEqual([
    "Working value of the game (Invented)",
    GENERIC_NAME,
  ]);
});

test("a branch of the first level keeps its parts' names by shape, for its ⓘ", () => {
  const [step] = mould([branch(3, [fixed("Base 1", 1), read("Stats.x", 2)])]);
  expect(step?.group?.map((r) => r.node.name)).toEqual([
    "Base 1",
    GENERIC_NAME,
  ]);
});

test("a step inside a group of the first level is a step too", () => {
  const [group] = mould([ones(fixed("× 1", 1), read("Stats.x", 1))]);
  expect(group?.node.name).toBe("At ×1 (2)");
  expect(group?.group?.map(brief)).toEqual([
    [GENERIC_NAME, 1, { unnamed: true }],
    [GENERIC_NAME, 1, { unnamed: true }],
  ]);
});
