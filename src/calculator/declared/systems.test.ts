// The systems table of the declared trees (spec 010, FR-006; data-model "Tabela de sistemas"): one entry per system of
// the game, with its English name, its emoji and a proof by reference; no "Other". Seeded by spec 009's table (the V1's
// order and emojis first), which this file writes out, as declared/ never reads tree/ (`declared-not-guessed`).
import { expect, test } from "vitest";
import { isNameText } from "../names/name-text.ts";
import { SYSTEMS, systemById, systemLabel } from "./systems.ts";

/** The V1's systems, in its order, with its emojis (spec 009 tree/systems.ts `V1_SYSTEMS`, without "Other"). */
const V1: readonly [string, string][] = [
  ["LUK / Stats", "🍀"],
  ["Talents", "🎯"],
  ["Cards", "🃏"],
  ["Star Signs", "⭐"],
  ["Achievements", "🏆"],
  ["Companions", "🐾"],
  ["Friends", "🤝"],
  ["Stamps", "📜"],
  ["Alchemy", "⚗️"],
  ["Sigils", "🔮"],
  ["Prayers", "🙏"],
  ["Shrines", "⛩️"],
  ["Guild", "🛡️"],
  ["Arcade", "🕹️"],
  ["Voting", "🗳️"],
  ["Post Office", "📮"],
  ["Shiny Pets", "🐉"],
  ["Tome", "📖"],
  ["Researching", "🔬"],
  ["Chips", "🧩"],
  ["Dreams", "💭"],
  ["Cloud Bonus", "☁️"],
  ["Owl", "🦉"],
  ["Grimoire", "📕"],
  ["Vault", "🏦"],
  ["Farming", "🌾"],
  ["Holes", "🕳️"],
  ["Emperor", "👑"],
  ["Legend Talents", "⚔️"],
  ["Spelunk Shop", "🪨"],
  ["Sushi", "🍣"],
  ["Minehead", "⛏️"],
  ["Menagerie", "🪼"],
  ["Arcane Map", "🗺️"],
  ["Glimbo", "🎲"],
  ["Equipment", "🎽"],
  ["Obols", "🪙"],
  ["Gallery", "🖼️"],
  ["Hatrack", "🎩"],
  ["Cape Vine", "🧣"],
  ["Golden Food", "🍔"],
  ["Set Bonuses", "🧰"],
  ["Bundles", "🎁"],
  ["Pristine Charms", "🌟"],
  ["Sneaking Mastery", "🥷"],
  ["Summoning", "🐲"],
  ["Royal Guardian", "🏰"],
];

/** no-game-text.test.ts `QUOTE_OR_CODE`: a quote, or code ("; " only joins references). */
const QUOTE_OR_CODE = /["'`“”‘’]|[{}]|;(?!\s)|=>/;

test("every id is a unique slug, and every emoji is unique", () => {
  const ids = SYSTEMS.map((s) => s.id);
  for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(SYSTEMS.map((s) => s.emoji)).size).toBe(SYSTEMS.length);
});

test("every name is one the host takes, in English", () => {
  for (const s of SYSTEMS)
    expect([
      s.name,
      isNameText(s.name),
      /^[A-Za-z][A-Za-z /]*$/.test(s.name),
    ]).toEqual([s.name, true, true]);
});

test("every proof is a reference, with no quote and no code", () => {
  for (const s of SYSTEMS)
    expect([
      s.id,
      s.proof.trim().length > 0,
      QUOTE_OR_CODE.test(s.proof),
    ]).toEqual([s.id, true, false]);
});

test("no entry is Other", () => {
  expect(
    SYSTEMS.filter((s) => /^other$/i.test(s.name) || s.id === "other"),
  ).toEqual([]);
});

test("the V1's systems come first, in its order and with its emojis", () => {
  expect(SYSTEMS.slice(0, V1.length).map((s) => [s.name, s.emoji])).toEqual(V1);
});

test("the 17 systems the root probe found come after Weekly Boss, in this order (spec, Open Questions 21/11)", () => {
  const at = SYSTEMS.findIndex((s) => s.id === "weekly-boss");
  expect(SYSTEMS.slice(at + 1).map((s) => [s.id, s.name, s.emoji])).toEqual([
    ["event-shop", "Event Shop", "🎟️"],
    ["salt-lick", "Salt Lick", "🧂"],
    ["dungeons", "Dungeons", "🏯"],
    ["tasks", "Tasks", "📋"],
    ["islands", "Islands", "🏝️"],
    ["jade-emporium", "Jade Emporium", "💠"],
    ["construction", "Construction", "🏗️"],
    ["fishing", "Fishing", "🎣"],
    ["worship", "Worship", "🛐"],
    ["cooking", "Cooking", "🍳"],
    ["zenith-market", "Zenith Market", "🏪"],
    ["food", "Food", "🍖"],
    ["smithing", "Smithing", "🔨"],
    ["catching", "Catching", "🦋"],
    ["death-note", "Death Note", "📓"],
    ["breeding", "Breeding", "🏟️"],
    ["minigames", "Minigames", "🎪"],
  ]);
});

test("a system by its id: its name and its emoji; an unknown id is none", () => {
  const talents = systemById("talents");
  expect(
    talents && [talents.name, talents.emoji, systemLabel(talents)],
  ).toEqual(["Talents", "🎯", "🎯 Talents"]);
  expect(systemById("invented-system")).toBeNull();
  expect(systemById("other")).toBeNull();
});
