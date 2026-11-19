// Family 13 of the audit of 19/11: a row named by a short name ("System: name") takes the game's whole text of its
// bonus as its ⓘ, a rule of two lines (the text, then its value). Invented texts in the game's forms.
import { afterEach, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { withFormula } from "./formulas.ts";
import { row } from "./rows.ts";
import { read } from "./tree-fixture.ts";
import { useGameNames } from "./names.ts";
import { useGameTables } from "./table-names.ts";

afterEach(() => {
  useGameTables(new Map());
  useGameNames(new Map());
});

const at = (i: number, v: unknown) => {
  const list: unknown[] = [];
  list[i] = v;
  return list;
};
const TABLES = new Map<string, unknown>([
  [
    "CustomLists.SkullShopDesc",
    at(15, ["5%_Chance_for_+1_Grade_for|your_Invented_Gallery!"]),
  ],
  // row 6 the caves, row 14 the lore of each cave
  [
    "CustomLists.Spelunky",
    Object.assign(at(6, ["Invented_Cove"]), { 14: ["Invented_lore_text"] }),
  ],
]);

test.each<[string, string, string]>([
  [
    "OptionsListAccount[467]",
    "Killroy: Gallery Grade chance (times bought)",
    "5% Chance for +1 Grade for your Invented Gallery!",
  ],
  ["WeeklyBoss.d_3", "Equinox: Dream #4", "Reach an invented goal"],
  [
    "Tasks[2][5][4]",
    "Merit shop: Winner's Bonuses from Summoning",
    "Larger invented bonuses to all your Invented Wins",
  ],
  [
    'Spelunk("DoWeHaveLoreN1", 0, 0)',
    "Spelunking lore: Invented Cove",
    "Invented lore text",
  ],
])("%s is %s, with the game's whole text in its ⓘ", (code, name, text) => {
  useGameTables(TABLES);
  // the recipes' texts over the installed game (names-recipes.json): a dream's task, a merit purchase's two lines
  useGameNames(
    new Map([
      ["WeeklyBoss.d_3", "Reach an invented goal (dream progress)"],
      [
        "Tasks[2][5][4]",
        "World 6 merit purchases: Larger invented bonuses to all your Invented Wins",
      ],
    ]),
  );
  const r = row({ pieceKey: "k", value: 1, code });
  expect([r.name, r.formula]).toEqual([name, { rule: [text, "= 1"] }]);
  expect(checkTree({ id: "x", ...r }, 1)).not.toBeNull();
});

test("a value that is no number writes no number after the text", () => {
  useGameTables(TABLES);
  for (const value of [null, true])
    expect(
      row({ pieceKey: "k", value, code: "OptionsListAccount[467]" }).formula,
    ).toEqual({
      rule: ["5% Chance for +1 Grade for your Invented Gallery!", ""],
    });
});

// Review r1: a Killroy bonus is a call that opens into its reads (as an artifact's factor): its ⓘ is its own math with
// its parts' shares, never the shop's text; its short name stays
test("a Killroy bonus opened over its reads keeps the ⓘ of its math and its parts' shares, and its short name", () => {
  useGameTables(TABLES);
  const n = {
    node: row({
      pieceKey: "x",
      value: 12,
      code: 'RandomEvent("KillroyBonuses", 3, 0)',
    }),
  };
  const r = withFormula(n, [read("Stats.a", 3), read("Stats.b", 4)]);
  expect([n.node.name, r.formula]).toEqual([
    "Killroy: Gallery Grade chance",
    [
      ["Stats.a", "×", "Stats.b"],
      [3, 4, 12],
    ],
  ]);
  expect(r.rows.map((k) => k.node.share)).not.toContain(null);
});

test("a row with no text of its bonus has no ⓘ of its own", () => {
  const r = row({ pieceKey: "k", value: 1, code: "WeeklyBoss.d_3" });
  expect(r.formula).toBeNull();
});
