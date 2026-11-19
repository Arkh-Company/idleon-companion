// Family 13 of the audit of 19/11: a row named by a short name ("System: name") takes the game's whole text of its
// bonus as its ⓘ, a rule of two lines (the text, then its value). Invented texts in the game's forms.
import { afterEach, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { row } from "./rows.ts";
import { useGameTables } from "./table-names.ts";

afterEach(() => {
  useGameTables(new Map());
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
  ["CustomLists.DreamChallenge", at(3, ["Reach_an_invented_goal", "30"])],
  [
    "CustomLists.TaskShopDesc",
    at(5, at(4, ["+{%_Larger_invented_bonuses_to_all", "your_Invented_Wins"])),
  ],
]);

test.each<[string, string, string]>([
  [
    'RandomEvent("KillroyBonuses", 3, 0)',
    "Killroy: Gallery Grade chance",
    "5% Chance for +1 Grade for your Invented Gallery!",
  ],
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
  const r = row({ pieceKey: "k", value: 1, code });
  expect([r.name, r.formula]).toEqual([name, { rule: [text, "= 1"] }]);
  expect(checkTree({ id: "x", ...r }, 1)).not.toBeNull();
});

test("a row with no text of its bonus has no ⓘ of its own", () => {
  const r = row({ pieceKey: "k", value: 1, code: "WeeklyBoss.d_3" });
  expect(r.formula).toBeNull();
});
