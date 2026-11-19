// Family 4 of the audit of 19/11: one cleaner for every game text that becomes a name, static or a table's. The game
// swaps its markers for a number or an icon before it shows the text ("<x", "}x", "{", "$", "#", "~R" the class's
// colour), so a name has none of them, and no orphan "x" or "%" either. A map is named by the game's display list,
// never by its id. Invented texts in the game's forms; no text of the game is in this file.
import { expect, test } from "vitest";
import { NAME_RECIPES } from "./names-table.ts";
import { clean, nameOf, tidy, transformText } from "./names.ts";
import { STATIC_NAMES } from "./names-table.ts";

test.each([
  ["INVENTED_TALENT_~R", "Invented Talent (Warrior)"],
  ["INVENTED_TALENT_~G", "Invented Talent (Archer)"],
  ["INVENTED_TALENT_~P", "Invented Talent (Mage)"],
  ["<x_Invented_Bonuses", "Invented Bonuses"],
  [
    "All your Inventions give }x higher bonuses",
    "All your Inventions give higher bonuses",
  ],
  ["}x Invented Winner Bonuses", "Invented Winner Bonuses"],
  ["Boosts Inventions by }x", "Boosts Inventions"],
  ["Hat Rack: % Invented Multi", "Hat Rack: Invented Multi"],
  ["Knockout!_(#)_製", "Knockout!"],
  ["$% cheaper Invented Upgrades", "cheaper Invented Upgrades"],
  ["Invented_Damage_製_(Tap_for_more_info)", "Invented Damage"],
])("clean %s", (raw, name) => {
  expect(clean(raw)).toBe(name);
});

test("the cleaner keeps the case of a text it does not title-case, and a name with no marker as it is", () => {
  expect(transformText("clean-keep-case", "INVENTED_~R <x")).toBe(
    "INVENTED (Warrior)",
  );
  expect(tidy("Invented Bonus × 2 (talent 3)")).toBe(
    "Invented Bonus × 2 (talent 3)",
  );
  expect(tidy("Max HP working value")).toBe("Max HP working value");
  // a "+" between numbers is math, no marker; a bundle's id "bon x" is no orphan x
  expect(tidy("Invented charge (up to 20 + 20 × rarity)")).toBe(
    "Invented charge (up to 20 + 20 × rarity)",
  );
  expect(tidy("Gem shop pack bon x received")).toBe(
    "Gem shop pack bon x received",
  );
});

test("a static name passes the same cleaner: none keeps a marker of the game's text", () => {
  const marked = [...STATIC_NAMES.keys()]
    .map((k) => nameOf(k) ?? "")
    .filter((n) => /~[A-Z]|<x|\(#\)|_|(^| )x (higher|more|[A-Z])/.test(n));
  expect(marked).toEqual([]);
});

test("a map's kills are named by the game's display list of the maps, never by the map's id", () => {
  const kills = NAME_RECIPES.filter((r) =>
    /KillsLeft2Advance\[\d+\]\[0\]$/.test(r.key),
  );
  expect(kills.length).toBeGreaterThan(0);
  expect([
    ...new Set(kills.flatMap((r) => r.parts.map((p) => p.table))),
  ]).toEqual(["CustomLists.MapDispName"]);
});
