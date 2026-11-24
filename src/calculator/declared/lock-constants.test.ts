// A constant with its conditions inside a call (spec 010, T209 form 3; data-model "Constante com condição dentro de uma
// chamada"; FR-018 of 009): the block writes a variable of its own with a number of the code and multiplies it under
// conditions; each multiplier is a line with the conditions that apply it, and one whose condition did not apply shows
// its neutral value. The invented game's TreeDoubled(e) doubles DNSM.TreeDbl when TreeUpg[e] is 101 and when
// TreeOwnedFlag() is 1, then multiplies it by TreeLevel.
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { parseBlueprint } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const level = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const times = (
  key: string,
  constant: number,
  condition: BlueprintNode,
): BlueprintNode => ({ key, name: key, constant, children: [condition] });
const source = (max = 2): BlueprintNode => ({
  key: "doubled",
  name: "Doubled",
  ref: { call: "TreeDoubled", args: [0] },
  children: [
    times("at-max", max, {
      key: "upg",
      name: "Upg",
      ref: { read: "TreeUpg[0]" },
      leaf: "condition",
      conditionKind: "max",
    }),
    times("owned", 2, {
      key: "flag",
      name: "Flag",
      ref: { call: "TreeOwnedFlag", args: [] },
      leaf: "condition",
      conditionKind: "owned",
    }),
    level("level", "TreeLevel"),
  ],
});
const blueprint = (s: BlueprintNode): Blueprint => ({
  id: "invented-constants",
  root: { name: "Invented", ref: { call: "TreeDoubledPool", args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        { system: "cards", sources: [s] },
        { system: "stamps", sources: [level("capped", "TreeCapped")] },
      ],
    },
  ],
});
const lock = (s: BlueprintNode, attrs: object) =>
  lockBlueprint({
    ...recorded("TreeDoubledPool", { TreeUpg: [101], ...attrs }),
    blueprint: blueprint(s),
    character: 0,
    characterClass: 3,
  }).errors;

test("each multiplier the block applied is its constant, by the condition that applied it, and the level closes (form 3)", () => {
  expect(lock(source(), {})).toEqual([]);
});

test("a multiplier whose condition did not apply shows its neutral value: the level still closes (form 3)", () => {
  expect(lock(source(), { TreeFlagOn: 0 })).toEqual([]);
  expect(lock(source(), { TreeUpg: [5], TreeFlagOn: 0 })).toEqual([]);
});

test("a constant the code does not have at its condition's place is refused (form 3)", () => {
  expect(lock(source(3), {})).toContainEqual(
    expect.objectContaining({
      kind: "notClosing",
      where: "invented-constants/0/cards/doubled/at-max",
    }),
  );
});

test("the load takes a constant in a call's level only with its conditions as children (form 3)", () => {
  const parse = (s: BlueprintNode) =>
    parseBlueprint(blueprint(s), {
      fileId: "invented-constants",
      systemIds: new Set(["cards", "stamps"]),
    }).ok;
  expect(parse(source())).toBe(true);
  const bare = source();
  const kids = [...(bare.children ?? [])];
  kids[0] = { key: "at-max", name: "At max", constant: 2, leaf: "fixedValue" };
  expect(parse({ ...bare, children: kids })).toBe(false);
});
