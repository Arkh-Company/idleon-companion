// The installed game's tables at 0e47e87b as the boot keeps them (game-names.ts), with only the cells the examples of
// state-names.test.ts read: game text, never a save or a character's name.
/** A list with only the cells given, as long as `length`. */
export function list(cells: Record<number, unknown>, length = 0): unknown[] {
  const a: unknown[] = new Array<unknown>(length);
  for (const [k, v] of Object.entries(cells)) a[Number(k)] = v;
  return a;
}
const item = (displayName: string, UQ1txt = "0", UQ2txt = "0") => ({
  displayName,
  UQ1txt,
  UQ2txt,
});

export const GAME = new Map<string, unknown>([
  [
    "CustomLists.StarSigns",
    list({ 69: ["Beanbie_Major", "+20%_Golden_Food", "bonuses", "_"] }),
  ],
  [
    "CustomLists.ClassFamilyBonuses",
    list({
      33: ["{千@HIGHER_BONUSES|FROM_GOLDEN_FOODS", "0.4", "100", "decayMulti"],
    }),
  ],
  [
    "CustomLists.CosmoUpgrades",
    [
      list({ 0: ["25", "0", "Monumental_Vibes"] }),
      list({ 3: ["25", "0", "Lengthmeister"] }),
      list({ 3: ["6", "0", "Voter_Integrity"] }),
    ],
  ],
  [
    "CustomLists.CompassUpg",
    list({
      39: ["Circle_Supremacy"],
      42: ["Critter_Culture"],
      80: ["Abomination_Slayer_XXI"],
    }),
  ],
  [
    "CustomLists.JellyUPG",
    list({ 0: ["Amoeba_Cell_Cultivation"], 38: ["Daily_Transfusion"] }),
  ],
  [
    "CustomLists.Tome",
    list({
      0: ["Stamp_Total_LV"],
      63: ["Highest_Immortal_Snail_LV"],
      71: ["Total_Career_Summoning_Wins_膛"],
      95: ["Spirited_Valley_Emperor_Boss_Kills_膛"],
      104: ["Total_Spelunk_Discoveries_made_膛"],
      109: ["Premium_Hats_Found_膛"],
      110: ["Minehead_Opponents_Defeated_膛"],
      111: ["Rat_King_Crowns_Reclaimed_膛"],
      117: ["Button_Presses_膛"],
      121: ["Successful_Jelly_Operations_膛"],
    }),
  ],
  [
    "CustomLists.DreamUpg",
    list({ 8: ["Faux_Jewels"], 10: ["Equinox_Symbols"], 11: ["Voter_Rights"] }),
  ],
  [
    "CustomLists.SummonEnemies",
    list({
      6: list({
        22: "+{%_Ballot_Bonus",
        26: "<x_Meal_Bonuses",
        31: "<x_Winner_Bonuses",
      }),
      9: list({ 2: "23", 5: "27", 15: "32" }),
    }),
  ],
  ["CustomLists.BubbaUpg", list({ 0: ["1st_Slice"], 13: ["Super_Chart"] })],
  [
    "CustomLists.AtomInfo",
    list({
      1: ["Helium_-_Talent_Power_Stacker"],
      11: ["Magnesium_-_Trap_Compounder"],
    }),
  ],
  [
    "CustomLists.Research",
    list({
      19: list({
        4: "}x_Total_Damage_and_}x_Drop_Rate!_@_(NOTE:All_Bonuses_earned_from_beating_Opponents_affect_the_rest_of_the_game)",
        5: "+{%_Damage_per_Weapon_POW._Based_on_your_current_weapon,_you're_getting_$%_Damage",
        21: "+{%_Hat_Rack_bonus_multi",
      }),
      23: list({ 5: "Glassical_Bananical_Sticker" }),
      57: list({
        16: "Orion's_first_upgrade_is_}x_cheaper",
        24: "}x_Drop_Rate",
      }),
    }),
  ],
  ["CustomLists.MealINFO", list({ 6: ["Corn"], 27: ["Riceball"] })],
  [
    "CustomLists.SummonUPG",
    list({ 24: list({ 3: "Re-Draw" }), 78: list({ 3: "Allstar" }) }),
  ],
  ["CustomLists.GamingPalette", list({ 28: list({ 3: "Violet" }) })],
  ["CustomLists.ArtifactInfo", list({ 40: ["Bloodclot"] }, 41)],
  [
    "CustomLists.SkillNames",
    list({ 8: "Worship", 14: "Gaming", 19: "Research" }),
  ],
  [
    "CustomLists.SkullShopDesc",
    list({
      15: ["5%_Chance_for_+1_Grade_for|your_Gallery_in_World_7!"],
      16: ["Permanently_boosts_the_drops|of_Masterclasses_by_{x"],
    }),
  ],
  [
    "CustomLists.FishToolkitInfo",
    [list({ 9: ["Valve_Circles"] }), list({ 9: ["Zeus_Gon_Fishin"] })],
  ],
  ["CustomLists.TalentIconNames", list({ 656: "DREAMER_DAMAGE" })],
  [
    "CustomMaps.NjEQ",
    {
      NjGem5: ["4", "230", "Moissanite"],
      NjTr18: ["2", "18", "Gold_Dagger"],
    },
  ],
  [
    "ItemDefinitionsGET.EquipmentNametag8",
    item("Summer_Shovel|Nametag", "%_XP_FROM_MONSTERS", "%_ALL_STATS"),
  ],
  [
    "ItemDefinitionsGET.EquipmentHats82",
    item("Ele_Sorcerer|Pointed_Hat", "%_ALL_STATS"),
  ],
  ["ItemDefinitionsGET.Trophy10", item("Critter_Baron", "%_AGI")],
  ["ItemDefinitionsGET.Quest83", item("Blue_Tome_Pages")],
  ["ItemDefinitionsGET.Quest84", item("Red_Tome_Pages")],
  ["ItemDefinitionsGET.Refinery1", item("Redox_Salts")],
  ["MonsterDefinitionsGET.stache", { Name: "Sir_Stache" }],
  ["MonsterDefinitionsGET.w4c1", { Name: "Clammie" }],
  // invented: the rows the recipes do not hold of two tables a recipe reads
  ["CustomLists.LabMainBonus", list({ 50: list({ 6: "Invented_Link" }) })],
  ["CustomLists.NinjaInfo", list({ 34: list({ 20: "Invented_Boost" }) })],
]);
