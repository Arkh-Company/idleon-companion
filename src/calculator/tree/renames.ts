// pieces.cjs `rename` NAMES from the bench at BASELINE-4 (spec 008, T023): the names proven in the before/after table of
// 10/11, by the row's code, over every other name (the bench renames the finished tree). The first rule that matches
// decides; a leaf takes the rule's type too. A name from a game table's text comes from the installed game's checked
// table (tree/table-names.ts), else the bench's words for a row with no text; an item with no text keeps the name it had
// (the bench writes the item's id). Left out: the two rules on a row's name with no code (the app names a row by its
// code) and a second rule of the minor link's top no row reaches (the first one matches the same codes).
import { FIXED_RENAMES, rule } from "./rename-list.ts";
import type { Condition, Leaf, Rename } from "./rename-list.ts";
import { KILLROY } from "./name-descs.ts";
import { tableText } from "./table-names.ts";

const n = (m: RegExpExecArray, k = 1) => Number(m[k]);
/** A table of three values per bonus, the bonus at 1 + 3t: its value, else another of its cells. */
const third = (
  m: RegExpExecArray,
  value: string,
  unit: string,
  cell: string,
) => {
  const v = n(m);
  return (v - 1) % 3 === 0
    ? `${value} (${unit} ${String((v - 1) / 3)})`
    : `${cell} ${String(v)}`;
};

/** "<the text><tail>", or null when the text does not resolve: a name never takes the list's index (family 2). */
const named = (text: string | null, tail: string) =>
  text === null ? null : `${text}${tail}`;
/**
 * The market row of FarmUpg[j] (N.js FarmingStuffs BasketUpgQTY and ExoticBonusQTY): MarketInfo[j − 2] for
 * 2 ≤ j ≤ 17, MarketExoticInfo[j − 20] for j ≥ 20; no row for any other j.
 */
const farmUpgrade = (j: number) =>
  j >= 20
    ? tableText("exotic", j - 20)
    : j >= 2 && j <= 17
      ? tableText("market", j - 2)
      : null;

/** NAMES in the bench's order. */
export const RENAMES: readonly Rename[] = [
  rule(
    /^(?:CustomLists\.)?GodsInfo\[(\d+)\]\[14\]$/,
    (m) => named(tableText("god", n(m)), " blessing bonus per level"),
    "fixedValue",
    "AUDIT-E N; N.js Divinity",
  ),
  rule(
    /^(?:CustomLists\.)?GodsInfo\[(\d+)\]\[3\]$/,
    (m) => named(tableText("god", n(m)), " minor link bonus top"),
    "fixedValue",
    "AUDIT-E N; N.js Divinity",
  ),
  ...FIXED_RENAMES.first.slice(0, 1),
  rule(
    /^(?:CustomLists\.)?RANDOlist\[92\]\[(\d+)\]$/,
    (m) => {
      const t = tableText("shinyType", n(m));
      return t === null ? null : `Shiny bonus per level (${t})`;
    },
    "fixedValue",
    "AUDIT-E N; N.js Breeding",
  ),
  rule(
    /^Spelunk\[44\]\[(\d+)\]$/,
    (m) => `Grand Discoveries, cave ${String(n(m) + 1)}`,
    "quantity",
    "OPUS4-2; N.js ActorEvents_713",
  ),
  rule(
    /^Spelunk\[47\]\[(\d+)\]$/,
    (m) => `Manic depth, cave ${String(n(m) + 1)}`,
    "record",
    "OPUS4-2; N.js Spelunk",
  ),
  rule(
    /^Spelunk\[8\]\[(\d+)\]$/,
    (m) =>
      `Lore chapter ${String(Math.floor(n(m) / 4) + 1)} bonus ${String((n(m) % 4) + 1)} level`,
    "level",
    "OPUS4-2; N.js Spelunk",
  ),
  ...FIXED_RENAMES.first.slice(1),
  rule(
    /^DNSM\.skillLvRanks\[(\d+)\]$/,
    (m) => named(tableText("skill", n(m)), " mastery rank"),
    "tier",
    "deep-2; N.js RiftStuff",
  ),
  ...FIXED_RENAMES.cooking,
  rule(
    /^CookMaster\[2\]\[(\d+)\]$/,
    (m) => `Cooking mastery bonus ${String(n(m) + 1)} level`,
    "level",
    "PN3; N.js Summoning2",
  ),
  rule(
    /^CustomLists\.RandoListo2\[8\]\[(\d+)\]$/,
    (m) => `Cooking mastery bonus ${String(n(m) + 1)}: bonus per level`,
    "fixedValue",
    "PN3; N.js Summoning2",
  ),
  rule(
    /^Ribbon\[(\d+)\]$/,
    (m) => {
      const r = n(m) - 28;
      const meal = tableText("meal", r); // (a list has no row below 0)
      return meal !== null
        ? `Ribbon tier of ${meal}`
        : r >= 0
          ? null
          : `Ribbon shelf slot ${String(n(m))}`;
    },
    "tier",
    "OPUS4-3; N.js TalentCalc",
  ),
  ...FIXED_RENAMES.charges,
  rule(
    /^Holes\[22\]\[(\d+)\]$/,
    (m) => `Measurement ${String(n(m))} amount`,
    "quantity",
    "names",
  ),
  rule(
    /^Spelunk\[9\]\[(\d+)\]$/,
    (m) => named(tableText("colour", n(m)), " level"),
    "level",
    "names",
  ),
  rule(
    /^CustomLists\.NinjaInfo\[38\]\[(\d+)\]$/,
    (m) => third(m, "Ballot bonus value", "ballot", "Ballot table value"),
    "fixedValue",
    "names",
  ),
  rule(
    /^Summoning2?\("EventShopOwned", (\d+), 0\)$/,
    (m) => tableText("eventShop", n(m))?.replace(/_/g, " ") ?? null,
    "condition",
    "B2-5 rule 72; N.js Summoning2",
    "owned",
  ),
  rule(
    /^Summon\[0\]\[(\d+)\]$/,
    (m) => {
      const up = tableText("summonUpgrade", n(m));
      return up ? `${up.replace(/_/g, " ")} level` : null;
    },
    "level",
    "B2-4 rule 71; N.js Summoning",
  ),
  rule(
    /^CustomLists\.NinjaInfo\[41\]\[(\d+)\]$/,
    (m) =>
      third(m, "Meritocracy bonus value", "bonus", "Meritocracy table value"),
    "fixedValue",
    "B2-3 rule 70",
  ),
  ...(
    [
      [/^RoyalG\[0\]\[(\d+)\]$/, "Royal statue %", " level", "level"],
      [
        /^CustomLists\.Research\[41\]\[(\d+)\]$/,
        "Royal statue %",
        " base bonus",
        "fixedValue",
      ],
      [
        /^CustomLists\.Research\[42\]\[(\d+)\]$/,
        "Royal statue %",
        " bonus per level",
        "fixedValue",
      ],
      [/_GenInfo\[84\]$/, "Tome points", "", "quantity"],
      [
        /^CustomLists\.SummonEnemies\[7\]\[(\d+)\]$/,
        "Summoning win bonus of battle %",
        "",
        "fixedValue",
      ],
    ] as const
  ).map(([test, head, tail, leaf]) =>
    rule(test, (m) => head.replace("%", m[1] ?? "") + tail, leaf, "names"),
  ),
  // family 2 (audit of 19/11): the row of a game list by the name column of the same list, never by its index
  ...(
    [
      [/^Arcane\[(\d+)\]$/, (i) => tableText("arcane", i), " level", "level"],
      [/^FarmUpg\[(\d+)\]$/, farmUpgrade, " level", "level"],
      [/^Meals\[0\]\[(\d+)\]$/, (i) => tableText("meal", i), " level", "level"],
      [
        /^CustomLists\.TalentDescriptions\[(\d+)\]\[1\]\[\d+\]$/,
        (i) => tableText("talent", i),
        " curve constant",
        "fixedValue",
      ],
      [
        /^CustomLists\.GamingPalette\[(\d+)\]\[\d+\]$/,
        (i) => tableText("colour", i),
        " constant",
        "fixedValue",
      ],
      [
        /^CustomLists\.GodsInfo\[(\d+)\]\[\d+\]$/,
        (i) => tableText("god", i),
        " bonus constant",
        "fixedValue",
      ],
    ] satisfies [RegExp, (i: number) => string | null, string, Leaf][]
  ).map(([test, textOf, tail, leaf]) =>
    rule(test, (m) => named(textOf(n(m)), tail), leaf, "names"),
  ),
  ...FIXED_RENAMES.shrines,
  rule(
    /^Research\[12\]\[(\d+)\]$/,
    (m) => `Glimbo trades, type ${String(n(m))}`,
    "quantity",
    "names",
  ),
  ...FIXED_RENAMES.golem,
  rule(
    /^PrayersActive\[(\d+)\]$/,
    (m) => `Prayer in slot ${String(n(m) + 1)}`,
    "choice",
    "names",
  ),
  rule(
    /^Spelunk\[0\]\[(\d+)\]$/,
    (m) =>
      named(tableText("cave", n(m)), " found")?.replace(
        /^/,
        "Spelunking lore: ",
      ) ?? null,
    "condition",
    "names",
    "owned",
  ),
  // family 13 (audit of 19/11), the short name "System: name": the lore of cave c by the cave its screen draws it under
  // (Spelunk[0][c] ≥ 1 ⇒ the panel of cave c shows Spelunky[14][c]); the description stays the table's text
  rule(
    /^Spelunk\("DoWeHaveLoreN1", (\d+), 0\)$/,
    (m) =>
      named(tableText("cave", n(m)), "")?.replace(/^/, "Spelunking lore: ") ??
      null,
    null,
    "lore; N.js Spelunk",
  ),
  // the Equinox screen titles the dream of task t "Dream #(t + 1)", and "Nightmare (t − 35)" for t ≥ 36
  rule(
    /^WeeklyBoss\.d_(\d+)$/,
    (m) =>
      n(m) >= 36
        ? `Equinox: Nightmare ${String(n(m) - 35)}`
        : `Equinox: Dream #${String(n(m) + 1)}`,
    null,
    "dream; N.js Dreamstuff",
  ),
  // the Killroy shop's bonus t by what it raises (the Vinicius's names of 19/11), its text to the ⓘ (name-descs.ts)
  rule(
    /^RandomEvent\("KillroyBonuses", (\d+), 0\)$/,
    (m) => KILLROY[n(m)]?.name ?? null,
    null,
    "killroy; N.js RandomEvent KillroyBonuses",
  ),
  ...FIXED_RENAMES.caches,
  rule(
    /^ItemDefinitionsGET\.([^.]+)\.UQ(\d)val$/,
    (m) => {
      const item = tableText("item", m[1] ?? "");
      return item === null ? null : `${item} bonus value`;
    },
    "fixedValue",
    "11.11",
  ),
  ...FIXED_RENAMES.stamps,
];

const match = (code: string) => {
  for (const r of RENAMES) {
    const m = r.test.exec(code);
    if (m) return { r, m };
  }
  return null;
};

/** The name NAMES gives the row of `code`, or null (the row keeps the name it has). */
export function renameOf(code: string): string | null {
  const hit = match(code);
  return hit ? hit.r.name(hit.m) : null;
}

/** The type NAMES gives a leaf of `code`, or null. */
export function renameKind(
  code: string,
): { leaf: Leaf; condition: Condition | null } | null {
  const r = match(code)?.r;
  return r?.leaf ? { leaf: r.leaf, condition: r.condition ?? null } : null;
}
