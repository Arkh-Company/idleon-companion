// The items of a list the game picks by a condition (spec 010, T174; spec, Open Questions 23/11): a pool's source with
// `each` repeats its model child once per term of the answer key its `[*]` matches, the item the term's place in the
// list; the tree shows the items that went into the count, never the condition. A tie a term's place does not decide
// is refused with the reason, never by value or order. The invented game (fake-game.js, TreeActiveSum) sums a table's
// bonuses only where TreeActiveOn is on, then multiplies them.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";

type Raw = Record<string, unknown>;
const ID = "invented-active-number";
const SOURCE = `${ID}/0/cards/active`;
const MODEL = {
  key: "item",
  name: "Invented Item",
  ref: { read: "TreeActiveBonus[{i}]" },
  leaf: "rawBonus",
};
const EACH: Raw = {
  key: "active",
  name: "Invented Active",
  each: { list: "TreeActiveBonus[*]", as: "i" },
  children: [MODEL],
};
const raw = (source: Raw): Raw => ({
  id: ID,
  root: { name: "Invented", ref: { call: "TreeActiveSum", args: [0, 0, 0] } },
  pools: [
    { kind: "additive", groups: [{ system: "cards", sources: [source] }] },
    {
      kind: "multi",
      groups: [
        {
          system: "stamps",
          sources: [
            {
              key: "multi",
              name: "Invented Multi",
              ref: { read: "TreeSignMulti" },
              leaf: "rawBonus",
            },
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
const input = (on: number[]) =>
  recorded("TreeActiveSum", {
    TreeActiveBonus: [5, 10, 20, 40],
    TreeActiveOn: on,
    TreeSignMulti: 2,
  });
const lock = (on: number[]) => {
  const out = parse(EACH);
  if (!out.ok) throw new Error(out.reason);
  return lockBlueprint({
    blueprint: out.blueprint,
    ...input(on),
    character: 0,
    characterClass: 3,
  });
};

test("a pool's each source has one model child per term its [*] matches: only the items the game summed", () => {
  const out = lock([1, 0, 1, 1]);
  expect(input([1, 0, 1, 1]).key.pools[0]?.terms.map((t) => t.ref)).toEqual([
    "TreeActiveBonus[0]",
    "TreeActiveBonus[2]",
    "TreeActiveBonus[3]",
  ]);
  expect(out.errors).toEqual([]);
  // the two pools and the root closed; the 3 items and the multi; the each source
  expect(out.counts).toEqual({
    closed: 3,
    closedByRecorded: 0,
    leaves: 4,
    branches: 1,
  });
  // the size comes from the answer key
  expect(lock([1, 1, 1, 1]).errors).toEqual([]);
  expect(lock([0, 0, 0, 1]).counts.leaves).toBe(2);
});

test("an item in more than one term of the pool is refused with the reason: the tie would be by order", () => {
  const errors = lock([2, 0, 1, 0]).errors;
  const refused = {
    kind: "rootForm",
    where: SOURCE,
    got: "o item 0 de TreeActiveBonus[*] está em mais de uma parcela do pool: a ligação seria pela ordem",
  };
  expect(errors).toContainEqual(refused);
  expect(lockMessage(refused as never)).toBe(`${SOURCE}: ${refused.got}`);
});

test("an each source goes in a pool with its model only, with no ref nor constant", () => {
  const reason = (source: Raw) => {
    const out = parse(source);
    return out.ok ? "loaded" : out.reason;
  };
  expect(reason(EACH)).toBe("loaded");
  expect(reason({ ...EACH, ref: { read: "TreeActiveBonus" } })).toMatch(
    /a fonte com each vai sem ref nem constant/,
  );
  expect(
    reason({ ...EACH, children: [MODEL, { ...MODEL, key: "b" }] }),
  ).toMatch(/each tem um filho-modelo só/);
  // the items come from the answer key, with no condition: a class or a condition there would go unread
  const ON = { key: "on", name: "On", ref: { read: "TreeFlagOn" } };
  for (const extra of [{ classes: [3] }, { condition: ON }])
    expect(reason({ ...EACH, ...extra })).toMatch(
      /a fonte com each vai sem classes nem condition/,
    );
});
