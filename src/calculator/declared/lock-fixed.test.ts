// The numbers with no source in a recorded count, tied by their place (spec 010, T209): (1) the block's own argument is
// a fixed value of its level, no child of the recipe. The invented game's TreeArg(t) is TreeBase × t.
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const pool = (root: string, source: BlueprintNode): Blueprint => ({
  id: "invented-fixed",
  root: { name: "Invented", ref: { call: root, args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        { system: "cards", sources: [source] },
        { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
      ],
    },
  ],
});
const lock = (root: string, source: BlueprintNode) =>
  lockBlueprint({
    ...recorded(root),
    blueprint: pool(root, source),
    character: 0,
    characterClass: 3,
  }).errors;

test("a block's own argument in its count is a fixed value: the level closes with its other parts only (form 1)", () => {
  const source: BlueprintNode = {
    key: "arg",
    name: "Arg",
    ref: { call: "TreeArg", args: [3] },
    children: [leaf("base", "TreeBase")],
  };
  expect(lock("TreeArgPool", source)).toEqual([]);
});

test("a number read from a game table's text is a fixed value of the table: its child is that read (form 2)", () => {
  const source: BlueprintNode = {
    key: "tot",
    name: "Tot",
    ref: { call: "TreeTextTot", args: [] },
    children: [
      {
        key: "cell",
        name: "Cell",
        nameProof: { table: "CustomLists.ListTot", row: 0 },
        ref: { read: "CustomLists.ListTot[0]" },
        leaf: "fixedValue",
      },
      leaf("base", "TreeBase"),
    ],
  };
  expect(lock("TreeTextPool", source)).toEqual([]);
});

test("a variable of the block's own, written step by step and read back, goes down through its writes (form 5)", () => {
  const source: BlueprintNode = {
    key: "chained",
    name: "Chained",
    ref: { call: "TreeChained", args: [] },
    children: [
      leaf("base", "TreeBase"),
      leaf("level", "TreeLevel"),
      leaf("capped", "TreeCapped"),
    ],
  };
  expect(lock("TreeChainedPool", source)).toEqual([]);
});

test("how many entries a map of the save holds is a quantity, by the path the code names (form 4)", () => {
  const source: BlueprintNode = {
    key: "count",
    name: "Count",
    ref: { call: "TreeCount", args: [] },
    children: [
      { key: "big", name: "Big", ref: { read: "TreeBig" }, leaf: "quantity" },
      leaf("level", "TreeLevel"),
    ],
  };
  expect(lock("TreeCountPool", source)).toEqual([]);
});

test("a variable of the game's other working map, DummyNumbersStatManager, goes down through its writes too (form 5)", () => {
  const source: BlueprintNode = {
    key: "chained",
    name: "Chained",
    ref: { call: "TreeChainedDummy", args: [] },
    children: [
      leaf("base", "TreeBase"),
      leaf("level", "TreeLevel"),
      leaf("capped", "TreeCapped"),
    ],
  };
  expect(lock("TreeChainedDummyPool", source)).toEqual([]);
});

test("a code's check (a length, an item's test) is no part, and a curve past a write takes its turn's parts only (FR-018 of 009)", () => {
  const source: BlueprintNode = {
    key: "curve-turn",
    name: "Curve turn",
    ref: { call: "TreeCurveTurn", args: [] },
    children: [leaf("level", "TreeLevel"), leaf("base", "TreeBase")],
  };
  expect(lock("TreeCurveTurnPool", source)).toEqual([]);
});
