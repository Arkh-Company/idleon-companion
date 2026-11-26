// The equipment's items in a recipe (spec 010, T179; the LUK's base): a pool's source with `each` over a list with two
// indices (`as` names one per `[*]`) repeats its model once per slot; a model with no ref is the item the save put in
// the slot, a "choice" leaf with the game table's value, tied to its term by the slot (answer-key-item.ts tableItem);
// the slot's upgrade, a model with a ref, by the ref filled with both indices. The invented game (fake-game.js,
// TreeGearTable) puts itemA in two slots.
import { expect, test } from "vitest";
import { GEAR } from "./answer-key-table-item.test.ts";
import { parseBlueprint } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

type Raw = Record<string, unknown>;
const ID = "invented-gear-number";
const ITEMS: Raw = {
  key: "items",
  name: "Invented Equipment",
  each: { list: "TreeGearOrder[*][*]", as: ["r", "s"] },
  children: [{ key: "item", name: "Invented Item", leaf: "choice" }],
};
const UPGRADES: Raw = {
  key: "upgrades",
  name: "Invented Upgrades",
  each: { list: "TreeGearMap[*][*].v", as: ["r", "s"] },
  children: [
    {
      key: "upgrade",
      name: "Invented Upgrade",
      ref: { read: "TreeGearMap[{r}][{s}].v" },
      leaf: "rawBonus",
    },
  ],
};
const LEVEL = {
  key: "level",
  name: "Invented Level",
  ref: { read: "TreeLevel" },
  leaf: "level",
};
const raw = (items: Raw): Raw => ({
  id: ID,
  root: { name: "Invented", ref: { call: "TreeGearTable", args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        { system: "cards", sources: [LEVEL] },
        { system: "stamps", sources: [items] },
        { system: "gear", sources: [UPGRADES] },
      ],
    },
  ],
});
const parse = (items: Raw) =>
  parseBlueprint(raw(items), {
    fileId: ID,
    systemIds: new Set(["cards", "stamps", "gear"]),
  });

test("an each over two indices repeats its model per slot: the item by the slot that gave its key, the upgrade by its ref", () => {
  const out = parse(ITEMS);
  if (!out.ok) throw new Error(out.reason);
  const lock = lockBlueprint({
    blueprint: out.blueprint,
    ...recorded("TreeGearTable", GEAR),
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors).toEqual([]);
  // the pool closed (the floor above it is no blueprint field); the level, the 3 items and the 2 upgrades; the two each
  // sources
  expect(lock.counts).toEqual({
    closed: 1,
    closedByRecorded: 0,
    leaves: 6,
    branches: 2,
  });
});

test("a model with no ref whose leaf is not the term's kind ties nothing: a fixed value is no table's value", () => {
  const out = parse({
    ...ITEMS,
    children: [{ key: "item", name: "Invented Item", leaf: "fixedValue" }],
  });
  if (!out.ok) throw new Error(out.reason);
  const lock = lockBlueprint({
    blueprint: out.blueprint,
    ...recorded("TreeGearTable", GEAR),
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors).toContainEqual(
    expect.objectContaining({
      kind: "rootForm",
      got: "o filho-modelo fixedValue não casa com o termo source",
    }),
  );
});

test("an each's names are one per [*] of its list", () => {
  const reason = (items: Raw) => {
    const out = parse(items);
    return out.ok ? "loaded" : out.reason;
  };
  expect(
    reason({ ...ITEMS, each: { list: "TreeGearOrder[*][*]", as: ["r"] } }),
  ).toMatch(/each.as tem um nome por \[\*\] de each.list/);
  expect(
    reason({ ...ITEMS, each: { list: "TreeGearOrder[*][*]", as: "r" } }),
  ).toMatch(/each.as tem um nome por \[\*\] de each.list/);
});
