// No unnamed branch of the math (spec 009, T026, SC-001; FR-007): a branch with no proven name whose parts are one
// source and the game's constants or helpers (a log, a curve) is that source scaled, so it takes the source's proven
// name, as structurePass gives a vague row its one child's (tree/one-child.ts); through an unnamed branch of that same
// shape too. Two sources, or a source with a vague name, name nothing. Invented names and paths, apart from the game's
// own helper blocks.
import { expect, test } from "vitest";
import { GENERIC_NAME, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { branch, fixed, placed } from "./tree-fixture.ts";

const source = (name: string, value: number): Row => ({
  node: row({ pieceKey: `Stats.${name}`, value, code: `Stats.${name}`, name }),
  open: null,
});
const log = (value: number): Row => ({
  node: row({
    pieceKey: null,
    value,
    code: "getLOG(1000)",
    name: "log₁₀",
    leaf: "rawBonus",
  }),
  open: null,
});
const nameOf = (top: Row) => {
  const [n] = placed({}, [top]).rows;
  return [n?.name, !!n?.flags.unnamed];
};

test("a branch of one source and constants takes the source's name", () => {
  expect(nameOf(branch(6, [fixed("× 2", 2), source("Claws", 3)]))).toEqual([
    "Claws",
    false,
  ]);
  // a helper of the game's math (a log) is no source of its own
  expect(nameOf(branch(9, [source("Claws", 3), log(3)]))).toEqual([
    "Claws",
    false,
  ]);
  // nor a constant of a game table (a bonus per level)
  const perLevel: Row = {
    node: row({
      pieceKey: null,
      value: 2,
      code: "InventedTable[92][6]",
      name: "Bonus per level",
      leaf: "fixedValue",
    }),
    open: null,
  };
  expect(nameOf(branch(60, [source("Passives", 30), perLevel]))).toEqual([
    "Passives",
    false,
  ]);
});

test("through an unnamed branch of the same shape, the one source's name", () => {
  const inner = branch(6, [fixed("× 2", 2), source("Claws", 3)]);
  expect(nameOf(branch(12, [inner, fixed("× 2", 2)]))).toEqual([
    "Claws",
    false,
  ]);
});

test("a constant added to the source names nothing: part of the value is not the source's (009 r1)", () => {
  const inner = branch(6, [fixed("× 2", 2), source("Claws", 3)]);
  expect(nameOf(branch(10, [inner, fixed("Fixed +4", 4)]))).toEqual([
    GENERIC_NAME,
    true,
  ]);
  expect(
    nameOf(branch(13, [fixed("Base 10", 10), source("Claws", 3)])),
  ).toEqual([GENERIC_NAME, true]);
});

test("two sources, a count, or one with a vague name, name nothing", () => {
  const count: Row = {
    node: row({
      pieceKey: null,
      value: 3,
      code: null,
      name: "Log Factor",
      leaf: "quantity",
    }),
    open: null,
  };
  expect(nameOf(branch(21, [fixed("Base Amount", 7), count]))).toEqual([
    GENERIC_NAME,
    true,
  ]);
  expect(nameOf(branch(6, [source("Claws", 3), source("Fangs", 2)]))).toEqual([
    GENERIC_NAME,
    true,
  ]);
  expect(nameOf(branch(6, [fixed("× 2", 2), source("Multiplier", 3)]))).toEqual(
    [GENERIC_NAME, true],
  );
});
