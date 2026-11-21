// The merit shop's purchases by their short names (family 13 of the audit of 19/11, decision 6; the list the Vinicius
// approved on 19/11, .superpowers merit-shop-nomes.md): what the bonus raises, in the game's words. N.js counts the
// purchases of world w's item i in Tasks[2][w][i], and the shop's screen draws TaskShopDesc[w][i][0] and [1], its only
// text, which goes to the ⓘ (tree/name-descs.ts). A filler slot (IDK_YET) has no name.

const NAMES: readonly (readonly (string | null)[])[] = [
  [
    "Inventory Bag for everyone",
    "Blunder Hills Monsters respawn",
    "EXP Gain for the lowest leveled character",
    "Max Lv for 'Goblet of Hemoglobin' Talent",
    "Boss Keys drop chance",
    "Amarok recipe",
    "Star Talents from World 1 Minibosses",
    null,
  ],
  [
    "Obols drop rate",
    "Yum-Yum Desert Mobs respawn",
    "AFK Gains for your first characters",
    "Max Lv for 'Convert Better Darnit' Talent",
    "World boss gem drop rate",
    "Efaunt recipe",
    "Star Talents from World 2 Minibosses",
    "Arcade ball gain rate",
  ],
  [
    "Build Slot and Food Slot",
    "Frostbite Tundra Mobs respawn",
    "Max Lv of Talent books",
    "Max Lv for 'Telekinetic Storage' Talent",
    "Printer Sample Size",
    "Chizoar recipe",
    "Refinery Salt Costs",
    "Star Talents from World 3 Minibosses",
  ],
  [
    "Crystal monster spawns",
    "Hyperion Nebula Mobs respawn",
    "Nest egg capacity",
    "Max Lv for 'Spice Spillage' Talent",
    "Lab connection range",
    "Troll recipe",
    "'No Bubble Left Behind' Bubbles per day",
    null,
  ],
  [
    "Talent Pts for Tab 4",
    "Smolderin Plateau Mobs respawn",
    "Loot Pile Capacity",
    "Max Lv for 'Stat Overload' Talent",
    "EXP for Sailing, Divinity and Gaming",
    "Kattle recipe",
    "Atom Upgrade Costs",
    null,
  ],
  [
    "Talent Pts for the 5th tab",
    "Spirited Valley Mobs respawn",
    "Farming EXP and OG chance",
    "Jade Gain",
    "Winner's Bonuses from Summoning",
    "Emperor recipe",
    null,
    null,
  ],
  [
    "Spelunking POW",
    "Shimmerfin Deep Mobs respawn",
    "Spelunking max Stamina",
    "Research PTS",
    "Minehead Currency Gain",
    "Nautilus recipe",
    null,
    null,
  ],
];

/** The rule: Tasks[2][w][i], the purchases of world w's item i, by its short name. */
export const MERIT_SHOP = {
  test: /^Tasks\[2\]\[(\d+)\]\[(\d+)\]$/,
  proof:
    "N.js TaskShopDesc (the shop of world w draws the item i, TaskShopDesc w i)",
};

/** "Merit shop: <what it raises>" of world w's item i, or null. */
export function meritName(w: number, i: number): string | null {
  const name = NAMES[w]?.[i] ?? null;
  return name === null ? null : `Merit shop: ${name}`;
}
