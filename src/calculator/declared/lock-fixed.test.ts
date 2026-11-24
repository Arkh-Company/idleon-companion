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
