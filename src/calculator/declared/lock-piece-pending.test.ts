// A piece with pending places (spec 010, T216; data-model "Pendência num pedaço"): the same kinds and the same cover as a
// recipe's (T199); the recipe that calls such a piece is a draft. The invented game (fake-game.js, TreeRecipe*) counts
// floor((TreeBase + TreeLevel + 2) × (1 + TreeStats.b ÷ 100)) below the line TreeRecipeLine().
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

type Raw = Record<string, unknown>;
const leaf = (key: string, read: string, kind?: string): Raw => ({
  key,
  name: `Invented ${key}`,
  ref: { read },
  ...(kind && { leaf: kind }),
});
/** The invented piece, its multi's leaf with no kind: pending in the piece when `pending` is given. */
const piece = (pending?: Raw[]): Raw => ({
  id: "invented-stat",
  params: [],
  pools: [
    {
      kind: "additive",
      groups: [
        {
          system: "cards",
          sources: [
            leaf("base", "TreeBase", "level"),
            leaf("lv", "TreeLevel", "rawBonus"),
          ],
        },
        {
          system: "bundles",
          sources: [
            { key: "two", name: "Two", constant: 2, leaf: "fixedValue" },
          ],
        },
      ],
    },
    {
      kind: "multi",
      groups: [{ system: "prayers", sources: [leaf("pct", "TreeStats.b")] }],
    },
  ],
  ...(pending && { pending }),
});
const parse = (p: Raw) =>
  parseBlueprint(
    {
      id: "invented-recipe-number",
      root: {
        name: "Invented",
        ref: { call: "TreeRecipeRoot", args: [0, 0, 0] },
      },
      pools: [
        {
          kind: "additive",
          groups: [
            {
              system: "cards",
              sources: [
                {
                  key: "stat",
                  name: "Invented Stat",
                  ref: { call: "TreeRecipeLine", args: [] },
                  piece: { name: "invented-stat", args: {} },
                },
                leaf("capped", "TreeCapped", "rawBonus"),
              ],
            },
          ],
        },
      ],
    },
    {
      fileId: "invented-recipe-number",
      systemIds: new Set(["cards", "bundles", "prayers"]),
      pieces: new Map([["invented-stat", p]]),
    },
  );

test("a piece's pending leaf makes the recipe that calls it a draft, and the lock lists it as pending only (T216)", () => {
  const at = "pools/1/groups/0/sources/0";
  const out = parse(piece([{ where: at, kind: "leaf" }]));
  if (!out.ok) throw new Error(out.reason);
  expect(out.stage).toBe("draft");
  const lock = lockBlueprint({
    blueprint: out.blueprint,
    ...recorded("TreeRecipeRoot"),
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors.map((e) => e.kind)).toEqual(["pending"]);
});

test("with no pending, the piece's leaf with no kind is refused; a pending out of the piece is too (T216)", () => {
  expect(parse(piece())).toMatchObject({ ok: false });
  expect(
    parse(piece([{ where: "pools/1/groups/0/sources/7", kind: "leaf" }])),
  ).toMatchObject({ ok: false });
});
