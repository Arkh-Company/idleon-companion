// pieces.cjs `rename` NAMES (the names proven in the before/after table of 10/11) from the bench at BASELINE-4, the
// rules whose name is the bench's own English, the same for every row they match (tree/renames.ts has the rest and the
// order). Each takes the leaf's type the bench gives it, and its proof by reference.
import type {
  CALC_CONDITION_KINDS,
  CALC_LEAF_KINDS,
} from "../tree-contract.ts";

export type Leaf = (typeof CALC_LEAF_KINDS)[number];
export type Condition = (typeof CALC_CONDITION_KINDS)[number];
export interface Rename {
  test: RegExp;
  /** The name from the code's match; null leaves the row with the name it had. */
  name: (m: RegExpExecArray) => string | null;
  leaf: Leaf | null;
  condition?: Condition;
  proof: string;
}

/** A rule of NAMES: its tag in the bench and the N.js block that proves it. */
export const rule = (
  test: RegExp,
  name: string | ((m: RegExpExecArray) => string | null),
  leaf: Leaf | null,
  where: string,
  condition?: Condition,
): Rename => ({
  test,
  name: typeof name === "string" ? () => name : name,
  leaf,
  ...(condition ? { condition } : {}),
  proof: "bench pieces.cjs rename NAMES " + where,
});

type Fixed = [RegExp, string, Leaf | null, string, Condition?];
const FIXED: readonly Fixed[] = [
  [/^Divinity\[25\]$/, "Gods unlocked", "quantity", "AUDIT-E N; N.js Divinity"],
  [
    /^OptionsListAccount\[628\]$/,
    "Best round defeated (mode 2)",
    "record",
    "Names 2; N.js ActorEvents_548",
  ],
  [
    /^DNSM\.AtomBonCalc1$/,
    "Tower levels above 50 (9 towers)",
    "level",
    "Names 2; N.js AtomCollider",
  ],
  [
    /^DNSM\.CkMst_AcLvT$/,
    "Total Cooking level of all characters",
    "level",
    "Names 2; N.js Summoning2",
  ],
  [
    /^DNSM\.CkMst_RbLvT$/,
    "Total ribbon tiers of the meals",
    "tier",
    "Names 2; N.js Summoning2",
  ],
  [
    /^Breeding\("TotPetsFound"/,
    "Pets found",
    "quantity",
    "Names 2; N.js Breeding",
  ],
  [
    /^PixelHelperActor\[22\]\.behaviors\.getBehavior\(ActorEvents_548\)\._GenINFO\[110\]$/,
    "Pets found",
    "quantity",
    "Names 2; N.js ActorEvents_548",
  ],
  [
    /^PixelHelperActor\[8\]\.behaviors\.getBehavior\(ActorEvents_481\)\._GenINFO\[114\]$/,
    "Total MSA waves (best wave of every totem)",
    "record",
    "Names 2; N.js ActorEvents_481",
  ],
];
const FIXED_2: readonly Fixed[] = [
  [
    /^CookMaster\[1\]\[0\]$/,
    "Cooking mastery rank",
    "level",
    "PN3; N.js Summoning2",
  ],
  [
    /^CookMaster\[1\]\[3\]$/,
    "Cooking mastery points collected",
    "quantity",
    "PN3; N.js Summoning2",
  ],
];
const FIXED_3: readonly Fixed[] = [
  [
    /^OptionsListAccount\[99\]$/,
    "Critter minigame best score",
    "record",
    "PN1; N.js TrappingStuffs",
  ],
  [
    /^OptionsListAccount\[125\]$/,
    "Gold Relic charge (+1 per second, up to 20 + 20 × rarity)",
    "quantity",
    "PN1; N.js WorkbenchStuff",
  ],
  [
    /^OptionsListAccount\[323\]$/,
    "Event Shop item 4 charge (+1 per second, up to 50)",
    "quantity",
    "PN1; N.js WorkbenchStuff",
  ],
  [
    /^OptionsListAccount\[354\]$/,
    "Companion 17 charge (+1 per second, up to 100)",
    "quantity",
    "PN1; N.js WorkbenchStuff",
  ],
  [
    /^OptionsListAccount\[364\]$/,
    "Compass bonus 43 charge (+1 per second)",
    "quantity",
    "PN1; N.js WorkbenchStuff",
  ],
  [
    /^OptionsListAccount\[479\]$/,
    "Legend Talent 17 charge (+1 per second)",
    "quantity",
    "PN1; N.js WorkbenchStuff",
  ],
  [
    /^OptionsListAccount\[262\]$/,
    "Megafeathers from Orion",
    "quantity",
    "B2-2 rule 69",
  ],
  [
    /^OptionsListAccount\[279\]$/,
    "Megafish from Poppy",
    "quantity",
    "B2-2 rule 69",
  ],
];
const BONUS_PER_LEVEL: readonly (readonly [string, string, string])[] = [
  ["GrimoireUpg", "5", "Bonus per level (Grimoire)"],
  ["ArcaneUpg", "5", "Bonus per level (Arcane)"],
  ["UpgradeVault", "5", "Bonus per level (Upgrade Vault)"],
  ["ArmoryUpg", "5", "Bonus per level (Royal Armory)"],
  ["SpelunkUpg", "4", "Bonus per level (Spelunking shop)"],
  ["ResGridSquares", "2", "Bonus per level (Research Grid)"],
  ["MarketExoticInfo", "3", "Max bonus of the exotic seed"],
  ["LabMainBonus", "5", "Lab bonus value"],
  ["JewelDesc", "12", "Jewel bonus value"],
  ["ChipDesc", "11", "Chip bonus value"],
  ["SigilDesc", "12", "Sigil bonus at its current tier"],
];
const FIXED_4: readonly Fixed[] = [
  [/^DNSM\.CardBonusSdl\[4\]$/, "Bonus per star (card)", "fixedValue", "names"],
  [/^ShrineInfo\[\d+\]\[3\]$/, "Shrine level", "level", "names"],
  [
    /^CustomLists\.ShrineInfo\[\d+\]\[3\]$/,
    "Bonus per level (shrine)",
    "fixedValue",
    "names",
  ],
  [
    /^CustomLists\.ShrineInfo\[\d+\]\[2\]$/,
    "Base bonus (shrine)",
    "fixedValue",
    "names",
  ],
  [/^DNSM\.cardLvCalco$/, "Card stars", "level", "names"],
  [
    /^(CustomLists\.)?NinjaInfo\[36\]\[\d+\]$/,
    "Bonus per rank level (Farming)",
    "fixedValue",
    "names",
  ],
];
const FIXED_5: readonly Fixed[] = [
  [/^Holes\[11\]\[63\]$/, "Ancient Golem kills (Caverns)", "quantity", "names"],
];
const FIXED_6: readonly Fixed[] = [
  [
    /^DNSM\.GurtBonuzzDN$/,
    "Best bonus of this talent among your characters",
    "record",
    "11.11; N.js getbonus2",
  ],
  [/^DNSM\.GurtBonuzzDN2$/, "Bonus of the character in turn", null, "11.11"],
  [/^DNSM\.ArcadBonDNz$/, "Arcade maxed doubler", "condition", "names", "max"],
  [
    /^DNSM\.BminorDivQdl\[\d+\]$/,
    "Minor bonus of the god",
    "fixedValue",
    "names",
  ],
  [
    /^DNSM\.GalleryDN2$/,
    "Trophy slot multiplier (podium level)",
    "rawBonus",
    "names",
  ],
  [/^DNSM\.OwlBonusAll$/, "Megafeathers total", "fixedValue", "names"],
  [
    /^DNSM\.ArcMultBon\[\d+\]$/,
    "Arcane multi of the current map (capped)",
    "rawBonus",
    "names",
  ],
  [/^DNSM\.PrayNonEq$/, "No prayer equipped", "condition", "names", "active"],
  [
    /^DNSM\.CauldStatDNzz$/,
    "Vial Mastery (Rift reward)",
    null,
    "11.11; N.js CauldronStats",
  ],
  [
    /^PixelHelperActor\[8\]\.behaviors\.getBehavior\(ActorEvents_481\)\._GenINFO\[108\]$/,
    "Vial Mastery count (kept by the alchemy helper)",
    "quantity",
    "11.11; N.js CauldronStats",
  ],
];
const FIXED_7: readonly Fixed[] = [
  [
    /^(DNSM|DummyNumbersStatManager)\.StampExalted_double$/,
    "Exalted stamp multiplier",
    null,
    "11.11; N.js StampBonusOfTypeX",
  ],
  [
    /^(DNSM|DummyNumbersStatManager)\.Stamp_TOTAL_bonus_of_type_X$/,
    "Stamp total so far",
    null,
    "11.11; N.js StampBonusOfTypeX",
  ],
  [
    /^DNSM\.FrendBonzStatz\[\d+\]$/,
    "Friend bonus for Drop Rate, before Mr Pig",
    "rawBonus",
    "names",
  ],
  [
    /^DNSM\.CalcTalentDN1$/,
    "Lowest skill level among the 9 skills",
    "level",
    "names",
  ],
];

const fixed = (list: readonly Fixed[]): Rename[] =>
  list.map(([test, name, leaf, where, condition]) =>
    rule(test, name, leaf, where, condition),
  );
/** The fixed names, by their place in NAMES (tree/renames.ts puts the others between them). */
export const FIXED_RENAMES = {
  first: fixed(FIXED),
  cooking: fixed(FIXED_2),
  charges: fixed(FIXED_3),
  shrines: [
    ...fixed(FIXED_4),
    ...BONUS_PER_LEVEL.map(([table, field, name]) =>
      rule(
        new RegExp(`^(CustomLists\\.)?${table}\\[\\d+\\]\\[${field}\\]$`),
        name,
        "fixedValue",
        "names",
      ),
    ),
  ],
  golem: fixed(FIXED_5),
  caches: fixed(FIXED_6),
  stamps: fixed(FIXED_7),
};
