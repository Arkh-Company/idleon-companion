// A fixed base the game picks by a test (spec 010, T176; spec, Open Questions 23/11): a constant of the answer key takes
// the item of the test that guards its step (the literal the game compares, `contains(<list>, "2")`), and a pool's
// source with `each` over that list ties each such constant by its item, at the test's place, never by its value. The
// model child is a leaf `fixedValue` with no reference, its name proved at the item's row. The invented game
// (fake-game.js, TreeBaseSum) adds each item's base to its field where its test finds the item in TreeBaseOn, then
// multiplies each field in a loop over the fields.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

type Raw = Record<string, unknown>;
const ID = "invented-base-number";
const SOURCE = `${ID}/0/cards/bases`;
const MODEL: Raw = {
  key: "base",
  name: "Invented Base",
  nameProof: { table: "InventedLists.Bases", row: "{item}" },
  leaf: "fixedValue",
};
const EACH: Raw = {
  key: "bases",
  name: "Invented Bases",
  each: { list: "TreeBaseOn[*]", as: "item" },
  children: [MODEL],
};
const read = (key: string, path: string): Raw => ({
  key,
  name: `Invented ${key}`,
  ref: { read: path },
  leaf: "rawBonus",
});
const raw = (source: Raw): Raw => ({
  id: ID,
  root: { name: "Invented", ref: { call: "TreeBaseSum", args: [0, 0, 0] } },
  pools: [
    { kind: "additive", groups: [{ system: "cards", sources: [source] }] },
    {
      kind: "multi",
      groups: [
        {
          system: "stamps",
          sources: [
            read("multi", "TreeBaseMulti"),
            read("meritoc", "TreeBaseMeritoc"),
          ],
        },
      ],
    },
  ],
});
const parse = (source: Raw) =>
  parseBlueprint(raw(source), {
    fileId: ID,
    systemIds: new Set(["cards", "stamps"]),
  });
const reason = (source: Raw) => {
  const out = parse(source);
  return out.ok ? "loaded" : out.reason;
};
// items 0, 2 and 3 on: item 0 gives field a 5, the same value as item 2's first write to b (5, then 17, × 2 × 1.5)
const input = (passes = 1) =>
  recorded("TreeBaseSum", {
    TreeBaseOn: ["0", "2", "3", "4"],
    TreeBasePasses: passes,
    TreeBaseMulti: 2,
    TreeBaseMeritoc: 50,
  });
const lock = (passes = 1) => {
  const out = parse(EACH);
  if (!out.ok) throw new Error(out.reason);
  return lockBlueprint({
    blueprint: out.blueprint,
    ...input(passes),
    character: 0,
    characterClass: 3,
  });
};

test("a constant of the answer key takes the item of the test that guards its step, by its place", () => {
  const { key } = input();
  expect(key.final).toBe(51);
  // item 0's step gives 5 too, to field a: the write's own place decides, never the value
  expect(key.pools.map((p) => p.terms.map((t) => [t.ref, t.item]))).toEqual([
    [
      ["5", "TreeBaseOn[2]"],
      ["12", "TreeBaseOn[3]"],
    ],
    [
      ["TreeBaseMulti", undefined],
      ["TreeBaseMeritoc", undefined],
    ],
  ]);
});

test("a pool's each source with a model that has no ref ties each constant by its item, and closes", () => {
  const out = lock();
  expect(out.errors).toEqual([]);
  // the two pools and the root closed; the 2 bases and the 2 multis; the each source
  expect(out.counts).toEqual({
    closed: 3,
    closedByRecorded: 0,
    leaves: 4,
    branches: 1,
  });
});

test("an item added twice (the items' loop run twice) is refused with the reason, never forced", () => {
  const errors = lock(2).errors;
  expect(errors).toContainEqual({
    kind: "rootForm",
    where: SOURCE,
    got: "o item 3 de TreeBaseOn[*] está em mais de uma parcela do pool: a ligação seria pela ordem",
  });
  // its terms stay unexplained: the pool never closes by them
  expect(errors.map((e) => e.kind)).toContain("missingSource");
});

test("the load takes a model with no ref only as a fixed value, its name proved at the item's row", () => {
  expect(reason(EACH)).toBe("loaded");
  expect(
    reason({ ...EACH, children: [{ ...MODEL, leaf: "rawBonus" }] }),
  ).toMatch(/o filho-modelo sem ref é folha fixedValue/);
  // a node with no ref out of an each's model is still refused
  expect(
    reason({ key: "base", name: "Invented Base", leaf: "fixedValue" }),
  ).toMatch(/ref ou constant/);
});
