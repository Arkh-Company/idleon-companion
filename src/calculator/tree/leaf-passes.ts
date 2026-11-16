// The passes of pieces.cjs `finish` after the types (spec 008, T023), from the bench at BASELINE-4, over a level's rows in
// its `finish` (tree/rows.ts): dungeonGate (the dungeon the map is, a yes/no and never a source), oneOfEach's ban flag of a
// talent (a yes/no) and the leaves the N.js proves by their code, opus1Sailing's (forced, the Fractal Island's with its ⓘ;
// a class line is context), opus3More OPUS3-F7 and then the OPUS5 list, each only on a leaf still with no type ("?")
// but the ones the bench forces. opus1Sailing's types by the code of a leaf still "?" (and the boats' names they
// give) are the classify rules every leaf already passed (tree/kinds.ts, names-sailing.cjs KINDS). Left out, each
// needing what a level does not have: F7a (a count whose rows are all leaves: the app opens a row later), F7c (the obols'
// stat, read across the recording), F7f (the friend score, by the calls above), and OPUS5's rules on a name the bench's
// earlier passes gave (stamps, signs, statues, the Tome bubbles' "5,000"). structurePass's "Multi" is a name the app never
// gives. oneOfEach's one leaf for the same code and value twice is out too: it would hide a source the game counts twice
// (FR-016, game-bugs.test.ts).
import type {
  CALC_CONDITION_KINDS,
  CALC_LEAF_KINDS,
} from "../tree-contract.ts";
import { near } from "./math.ts";
import { isLeaf } from "./rows.ts";
import type { Row } from "./rows.ts";
import { tableText } from "./table-names.ts";

type Leaf = (typeof CALC_LEAF_KINDS)[number];
type Condition = (typeof CALC_CONDITION_KINDS)[number];

/** DEEP10: Dungon(), the dungeon the current map is (-1 outside one); its ⓘ with no ";" (the host refuses one). */
export const DUNGEON_GATE = {
  test: "Dungon()",
  name: "In a dungeon (dungeon number, −1 = no)",
  rule: "If the current map is a dungeon (maps 39, 70, 118 are 0, 40 is 1, 71 is 2, 119 is 3): its number, else −1",
  why: "the game gates its dungeon-only bonuses on Dungon() = -1 (N.js Dungon)",
  proof: "bench pieces.cjs dungeonGate DEEP10; N.js Dungon",
};
/** NR-C B2-R4: the talent's ban flag, a leaf. */
export const BANNED = {
  test: 'RunCodeOfTypeXforThingY("TalentBannedforAllLV"',
  name: "Banned from All-talent levels",
  proof: "bench pieces.cjs oneOfEach NR-C B2-R4; N.js RunCodeOfTypeXforThingY",
};

interface LeafRule {
  test: RegExp;
  /** The leaf's name from the match; null keeps the one it has. */
  name: ((m: RegExpExecArray) => string | null) | null;
  leaf: Leaf;
  condition?: Condition;
  /** The value the rule needs (a start value). */
  value?: number;
  why?: string;
  /** OPUS5's `force`: a leaf already typed takes the rule too. */
  force?: boolean;
  /** The ⓘ of a rule (its two lines) and its why, from the match and the leaf's value. */
  rule?: (m: RegExpExecArray, v: Row["node"]["value"]) => [string, string];
  ruleWhy?: (m: RegExpExecArray) => string;
  proof: string;
}
const F7 = (where: string, block: string) =>
  `bench pieces.cjs opus3More OPUS3-F7${where}; N.js ${block}`;
const O5 = (block: string) => `bench pieces.cjs opus5 OPUS5; N.js ${block}`;
const ACTOR = (actor: number, cell: string) =>
  new RegExp(
    `^PixelHelperActor\\[\\d+\\]\\.behaviors\\.getBehavior\\(ActorEvents_${String(actor)}\\)\\._GenINFO\\[${cell}\\]$`,
  );

/** opus1Sailing OPUS1-P3b: the hours on Fractal Island each of its 8 bonuses needs. */
export const FRACTAL_HOURS = [24, 200, 750, 2500, 1e4, 2e4, 4e4, 6e4];
const P3B = (block: string) =>
  `bench pieces.cjs opus1Sailing OPUS1-P3b; N.js ${block}`;

/** opus1Sailing, OPUS3-F7 and then OPUS5, in the bench's order: the first rule whose code matches decides. */
export const CODE_LEAVES: readonly LeafRule[] = [
  // (opus1Sailing types them whatever their type: forced)
  {
    test: /^RandomEvent\("FractalIslandBonus", ([0-7]), -?\d+\)$/,
    name: null,
    leaf: "condition",
    condition: "limit",
    force: true,
    rule: (m, v) => {
      const h = String(FRACTAL_HOURS[Number(m[1])]);
      return [
        `If the hours on Fractal Island reach ${h}: 1, else 0`,
        v === 1 ? `reached ${h} hours → 1` : `below ${h} hours → 0`,
      ];
    },
    // the bench's why names the game's paths; here only what they hold
    ruleWhy: (m) =>
      `the game sets this bonus to 1 once the hours on Fractal Island reach ${String(FRACTAL_HOURS[Number(m[1])])}, else to 0 (N.js RandomEvent)`,
    proof: P3B("RandomEvent; N.js ActorEvents_623"),
  },
  {
    test: /^DNSM\.CalcTalentMAP\[620\]$/,
    name: () => "Highest class level among your characters",
    leaf: "level",
    force: true,
    proof: P3B("TalentCalc"),
  },
  {
    test: /^WorkbenchStuff\("OverkillQTY", \d+, /,
    name: null,
    leaf: "quantity",
    proof: F7("b", "WorkbenchStuff"),
  },
  {
    test: /^FamilyValuesMap\.MinigameHiscores\[(\d+)\]$/,
    name: (m) => `Minigame ${m[1] ?? ""} high score`,
    leaf: "record",
    proof: F7("d", "SkillStats"),
  },
  {
    test: /^MonsterDefinitionsGET\.([A-Za-z0-9_]+)\.(MonsterHPTotal|Defence)$/,
    name: (m) => {
      const mob = tableText("monster", m[1] ?? "");
      if (mob === null) return null;
      return `${mob}${m[2] === "Defence" ? " Defence" : " HP"} (monster table)`;
    },
    leaf: "fixedValue",
    proof: F7("e", "RunCodeOfTypeXforThingY"),
  },
  {
    test: /^DNSM\.TotalStatsDN2$/,
    value: 0,
    name: () => "Total of the earlier obols",
    leaf: "unknown",
    why: "progress of the loop in TotalStats: TotalStatsDN2 starts at 0 and each obol entry of the stat adds its value (N.js)",
    proof: F7("h", "TotalStats"),
  },
  {
    test: /^DummyNumbersStatManager\.PlayerHPmaxDN$/,
    value: 0,
    name: () => "Start value (PlayerHPmax sets 0 before adding)",
    leaf: "fixedValue",
    proof: F7("h", "PlayerHPmax"),
  },
  {
    test: /^DummyNumbersStatManager\.PlayerMPmaxLIST\[2\]$/,
    value: 1,
    name: () => "Fixed ×1 (third factor of the MP list, a literal 1)",
    leaf: "fixedValue",
    proof: F7("h", "PlayerMPmax"),
  },
  {
    test: ACTOR(201, "58"),
    name: () => "World portals passed (2 to 7)",
    leaf: "tier",
    proof: F7("i", "ActorEvents_201"),
  },
  {
    test: /^Summoning\("VaultKillzTotal", /,
    name: null,
    leaf: "quantity",
    proof: F7("j", "Summoning"),
  },
  {
    test: /^RandomEvent\("FractalIslandBonus", \d+/,
    name: null,
    leaf: "condition",
    condition: "limit",
    proof: O5("RandomEvent"),
  },
  {
    test: ACTOR(481, "111"),
    name: () => "Total tower levels (Construct Mastery)",
    leaf: "level",
    proof: O5("ActorEvents_481"),
  },
  {
    test: ACTOR(481, "112\\]\\[(\\d+)"),
    name: (m) =>
      `Construct Mastery threshold ${String(Number(m[1]) + 1)} (total tower levels)`,
    leaf: "fixedValue",
    force: true,
    proof: O5("ActorEvents_481"),
  },
  {
    test: /^DNSM\.EclipseSk$/,
    name: () => "Death Note monsters at Eclipse rank",
    leaf: "quantity",
    proof: O5("RiftStuff"),
  },
  {
    test: /^DNSM\.DungeonStatsB\.QTYofItemRAR(\d+)$/,
    name: (m) => `Dungeon items of rarity ${m[1] ?? ""} owned`,
    leaf: "quantity",
    proof: O5("DungeonCalc"),
  },
  {
    test: /^DNSM\.(playHPbasePOT1|GfoodMap)\.Amount$/,
    name: (m) =>
      `${m[1] === "GfoodMap" ? "Golden food" : "Food"} base amount (item definition)`,
    leaf: "fixedValue",
    proof: O5("TotalFoodBonuses; N.js GoldFoodBonuses"),
  },
  {
    test: /^Holes\[12\]\[(\d+)\]$/,
    name: (m) => `Amp stone ${m[1] ?? ""} level`,
    leaf: "level",
    proof: O5("ActorEvents_670"),
  },
  {
    test: /^OptionsListAccount\[200\]$/,
    name: () => "Highest Drop Rate reached",
    leaf: "record",
    proof: O5("ActorEvents_229"),
  },
  {
    test: ACTOR(481, "125"),
    name: () => "Kill stacks for talent 198 (live, reset on a new map)",
    leaf: "quantity",
    proof: O5("ActorEvents_1"),
  },
  {
    test: /^DNSM\.StarSigns\.RingDrop$/,
    name: () => "Blue Hedgehog (sign 8) equipped: ring drop",
    leaf: "condition",
    condition: "active",
    proof: O5("StarSigns"),
  },
  {
    test: /^DNSM\.StarSigns\.TotalHP$/,
    name: () =>
      "Star sign 28 health penalty (-80% when the Rift does not cover it)",
    leaf: "rawBonus",
    proof: O5("StarSigns"),
  },
];
/** OPUS1-P3b: a class's line of classes is context (the stat a portrait's class uses), never a source. */
export const CLASS_LINE = {
  test: "ReturnClasses(",
  proof: P3B("Sailing ArtifactBonus"),
};
/** OPUS3-F7g: the fishing spot the character stands at is context, like the current map. */
export const FISHING_SPOT = {
  test: "PersonalValuesMap.FishingSpotIndex",
  proof: F7("g", "FishingToolkit"),
};

/** A leaf `r` named `name` (or keeping its own), typed. */
function typed(
  r: Row,
  name: string | null,
  leaf: Leaf,
  condition: Condition | null,
  why: string | null,
): Row {
  const flags = { ...r.node.flags };
  if (name !== null) delete flags.unnamed;
  return {
    ...r,
    node: { ...r.node, name: name ?? r.node.name, leaf, condition, why, flags },
  };
}

/** One row after dungeonGate, the ban flag and the code rules. */
function pass(r: Row): Row {
  const code = r.node.code ?? "";
  if (code === DUNGEON_GATE.test) {
    const v = r.node.value;
    const g = typed(
      r,
      DUNGEON_GATE.name,
      "condition",
      "equalsValue",
      DUNGEON_GATE.why,
    );
    const at =
      v === -1
        ? "outside a dungeon → -1"
        : `in dungeon ${String(v)} → ${String(v)}`;
    return {
      ...g,
      open: null,
      node: { ...g.node, kids: [], formula: { rule: [DUNGEON_GATE.rule, at] } },
    };
  }
  if (!isLeaf(r)) return r;
  if (code.startsWith(BANNED.test))
    return typed(r, BANNED.name, "condition", "equalsValue", null);
  const open = r.node.leaf === null || r.node.leaf === "unknown";
  for (const x of CODE_LEAVES) {
    const m = x.test.exec(code);
    if (!m || (x.value !== undefined && !near(r.node.value, x.value))) continue;
    if (!open && !x.force) return r;
    const t = typed(
      r,
      x.name?.(m) ?? null,
      x.leaf,
      x.condition ?? null,
      x.ruleWhy?.(m) ?? x.why ?? null,
    );
    return x.rule
      ? {
          ...t,
          node: { ...t.node, formula: { rule: x.rule(m, r.node.value) } },
        }
      : t;
  }
  return r;
}

/** A level's rows after the passes that follow their types. */
export function leafPasses(rows: readonly Row[]): Row[] {
  // OPUS1-P3b: a class line is context, a leaf or not; OPUS3-F7g: the fishing spot is context, when the level has more
  // than it
  return rows
    .map(pass)
    .filter(
      (r) =>
        !r.node.code?.startsWith(CLASS_LINE.test) &&
        !(
          r.node.code === FISHING_SPOT.test &&
          isLeaf(r) &&
          (r.node.leaf === null || r.node.leaf === "unknown") &&
          rows.length > 1
        ),
    );
}
