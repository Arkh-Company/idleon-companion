// The first level of a tree (spec 008, FR-006; T017 "a step never named fixed"): the game's steps in its order, each
// with its bonus's name; a step the assembly would name by its shape has no proven name: `no name yet`.
import { expect, test } from "vitest";
import { mould } from "./mould.ts";
import { GENERIC_NAME } from "./rows.ts";
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
