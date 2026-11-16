// The passes of pieces.cjs `finish` after the types, at BASELINE-4 (tree/leaf-passes.ts): dungeonGate, the ban flag and the
// leaves the N.js proves by their code (opus3More OPUS3-F7, then the OPUS5 list), over a level's rows in its `finish`.
import { afterEach, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { buildTree } from "../tree-build.ts";
import { isNameText } from "./name-text.ts";
import { finish, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { useGameTables } from "./table-names.ts";
import { kidsOf, read, recordingOf } from "./tree-fixture.ts";

afterEach(() => {
  useGameTables(new Map());
});

/** The level's rows, its groups' rows in it. */
const level = (rows: Row[]) =>
  finish(9, rows, false).flatMap((r) =>
    r.group && r.node.role !== "piece" ? r.group : [r],
  );
/** One read's row after the passes, as [name, leaf, condition, why]. */
function one(code: string, value = 3, more: Row[] = []) {
  // a call's leaf with no type yet: one that passes its cache's "?" on (a read is typed by its path)
  const own = /^\w+\(/.test(code)
    ? {
        node: { ...read(code, value).node, leaf: "unknown" as const },
        open: null,
      }
    : read(code, value);
  const r = level([own, ...more]).find((x) => x.node.code === code);
  return [r?.node.name, r?.node.leaf, r?.node.condition, r?.node.why];
}
const call = (code: string, value = 2, lazy = true): Row => ({
  node: row({ pieceKey: code, value, code, kids: lazy ? "lazy" : [] }),
  open: lazy ? 1 : null,
});

const DUNGEON = "In a dungeon (dungeon number, −1 = no)";
const DUNGEON_WHY =
  "the game gates its dungeon-only bonuses on Dungon() = -1 (N.js Dungon)";
const DUNGEON_RULE =
  "If the current map is a dungeon (maps 39, 70, 118 are 0, 40 is 1, 71 is 2, 119 is 3): its number, else −1";
test.each([
  [-1, "outside a dungeon → -1"],
  [2, "in dungeon 2 → 2"],
])(
  "[DEEP10] Dungon() at %s is a yes/no of where the character stands, with no rows under it",
  (v, numbers) => {
    const [r] = level([call("Dungon()", v)]);
    expect(r && [r.node, r.open]).toEqual([
      expect.objectContaining({
        name: DUNGEON,
        leaf: "condition",
        condition: "equalsValue",
        why: DUNGEON_WHY,
        formula: { rule: [DUNGEON_RULE, numbers] },
        kids: [],
        flags: {},
      }),
      null,
    ]);
  },
);

test("[DEEP10] another call keeps its rows", () => {
  const [r] = level([call("Dungeon()", -1)]);
  expect([r?.node.name, r?.node.kids, r?.open]).toEqual([
    expect.any(String),
    "lazy",
    1,
  ]);
});

test("the same read twice with the same value stays twice: a source the game counts twice shows (FR-016)", () => {
  expect(level([read("Lv", 4), read("Lv", 4)])).toHaveLength(2);
});

test("[NR-C B2-R4] the talent's ban flag is a yes/no of the game", () => {
  const code = 'RunCodeOfTypeXforThingY("TalentBannedforAllLV", 5)';
  const [r] = level([call(code, 0, false)]);
  expect([
    r?.node.name,
    r?.node.leaf,
    r?.node.condition,
    r?.node.flags,
  ]).toEqual(["Banned from All-talent levels", "condition", "equalsValue", {}]);
  expect(level([call(code, 0)])[0]?.node.name).not.toBe(
    "Banned from All-talent levels",
  );
});

test.each([
  // OPUS3-F7
  // (with a last argument of 0, opus2Leaf names it first: arena.test.ts)
  ['WorkbenchStuff("OverkillQTY", 3, 1)', 7, null, "quantity", null],
  [
    "FamilyValuesMap.MinigameHiscores[2]",
    7,
    "Minigame 2 high score",
    "record",
    null,
  ],
  ["DNSM.TotalStatsDN2", 0, "Total of the earlier obols", "unknown", null],
  [
    "DummyNumbersStatManager.PlayerHPmaxDN",
    0,
    "Start value (PlayerHPmax sets 0 before adding)",
    "fixedValue",
    null,
  ],
  [
    "DummyNumbersStatManager.PlayerMPmaxLIST[2]",
    1,
    "Fixed ×1 (third factor of the MP list, a literal 1)",
    "fixedValue",
    null,
  ],
  [
    "PixelHelperActor[3].behaviors.getBehavior(ActorEvents_201)._GenINFO[58]",
    5,
    "World portals passed (2 to 7)",
    "tier",
    null,
  ],
  ['Summoning("VaultKillzTotal", 9, 0)', 7, null, "quantity", null],
  // OPUS5
  ['RandomEvent("FractalIslandBonus", 2, 0)', 1, null, "condition", "limit"],
  [
    "PixelHelperActor[8].behaviors.getBehavior(ActorEvents_481)._GenINFO[111]",
    70,
    "Total tower levels (Construct Mastery)",
    "level",
    null,
  ],
  [
    "PixelHelperActor[8].behaviors.getBehavior(ActorEvents_481)._GenINFO[112][2]",
    750,
    "Construct Mastery threshold 3 (total tower levels)",
    "fixedValue",
    null,
  ],
  [
    "DNSM.EclipseSk",
    4,
    "Death Note monsters at Eclipse rank",
    "quantity",
    null,
  ],
  [
    "DNSM.DungeonStatsB.QTYofItemRAR3",
    2,
    "Dungeon items of rarity 3 owned",
    "quantity",
    null,
  ],
  [
    "DNSM.GfoodMap.Amount",
    2,
    "Golden food base amount (item definition)",
    "fixedValue",
    null,
  ],
  [
    "DNSM.playHPbasePOT1.Amount",
    2,
    "Food base amount (item definition)",
    "fixedValue",
    null,
  ],
  ["Holes[12][3]", 9, "Amp stone 3 level", "level", null],
  ["OptionsListAccount[200]", 900, "Highest Drop Rate reached", "record", null],
  [
    "PixelHelperActor[8].behaviors.getBehavior(ActorEvents_481)._GenINFO[125]",
    3,
    "Kill stacks for talent 198 (live, reset on a new map)",
    "quantity",
    null,
  ],
  [
    "DNSM.StarSigns.RingDrop",
    1,
    "Blue Hedgehog (sign 8) equipped: ring drop",
    "condition",
    "active",
  ],
  [
    "DNSM.StarSigns.TotalHP",
    -80,
    "Star sign 28 health penalty (-80% when the Rift does not cover it)",
    "rawBonus",
    null,
  ],
])("the leaf %s is proved by its code", (code, v, name, leaf, condition) => {
  const [n, kind, cond] = one(code, v);
  expect([n, kind, cond]).toEqual([
    name ?? read(code, v).node.name,
    leaf,
    condition,
  ]);
});

test("a leaf already typed keeps its type and name; one forced keeps neither", () => {
  const typed = (code: string, v: number): Row => ({
    node: { ...read(code, v).node, leaf: "level" },
    open: null,
  });
  const [kept] = level([typed("DNSM.EclipseSk", 4)]);
  expect([kept?.node.name, kept?.node.leaf]).toEqual([
    read("DNSM.EclipseSk", 4).node.name,
    "level",
  ]);
  const code =
    "PixelHelperActor[8].behaviors.getBehavior(ActorEvents_481)._GenINFO[112][0]";
  const [forced] = level([typed(code, 250)]);
  expect([forced?.node.name, forced?.node.leaf]).toEqual([
    "Construct Mastery threshold 1 (total tower levels)",
    "fixedValue",
  ]);
  // the Fractal Island's bonus, typed a raw bonus by its call: opus1Sailing types it whatever its type
  const fractal = 'RandomEvent("FractalIslandBonus", 1, 0)';
  const [island] = level([typed(fractal, 1)]);
  expect([island?.node.leaf, island?.node.condition]).toEqual([
    "condition",
    "limit",
  ]);
  // a row with rows under it is no leaf
  expect(level([call("DNSM.EclipseSk", 4)])[0]?.node.name).not.toBe(
    "Death Note monsters at Eclipse rank",
  );
});

test("a rule that keeps the name keeps a row with no name unnamed", () => {
  const code = 'Summoning("VaultKillzTotal", 9, 0)';
  const unnamed: Row = {
    node: row({
      pieceKey: null,
      value: 7,
      code,
      name: "Game value",
      leaf: "unknown",
      flags: { unnamed: true },
    }),
    open: null,
  };
  const [r] = level([unnamed]);
  expect([r?.node.leaf, r?.node.flags]).toEqual([
    "quantity",
    { unnamed: true },
  ]);
});

test("[OPUS3-F7h] a start value is one only at its start: another value keeps its name", () => {
  expect(one("DNSM.TotalStatsDN2", 5)[0]).not.toBe(
    "Total of the earlier obols",
  );
  expect(one("DummyNumbersStatManager.PlayerHPmaxDN", 5)[0]).not.toBe(
    "Start value (PlayerHPmax sets 0 before adding)",
  );
  expect(one("DummyNumbersStatManager.PlayerMPmaxLIST[2]", 2)[0]).not.toBe(
    "Fixed ×1 (third factor of the MP list, a literal 1)",
  );
  expect(one("DNSM.TotalStatsDN2", 0)[3]).toBe(
    "progress of the loop in TotalStats: TotalStatsDN2 starts at 0 and each obol entry of the stat adds its value (N.js)",
  );
});

test("[OPUS3-F7e] a monster's column is named by the monster's text; with none, only its type", () => {
  const [name, leaf] = one("MonsterDefinitionsGET.mobX.Defence", 4);
  expect([name, leaf]).toEqual([
    read("MonsterDefinitionsGET.mobX.Defence", 4).node.name,
    "fixedValue",
  ]);
});

test.each([
  [
    "MonsterDefinitionsGET.mobX.Defence",
    "Invented Beast Defence (monster table)",
  ],
  [
    "MonsterDefinitionsGET.mobX.MonsterHPTotal",
    "Invented Beast HP (monster table)",
  ],
])(
  "[OPUS3-F7e] the monster's column %s is named by the monster's text",
  (code, name) => {
    useGameTables(
      new Map([["MonsterDefinitionsGET.mobX", { Name: "INVENTED_BEAST" }]]),
    );
    expect(one(code, 4).slice(0, 2)).toEqual([name, "fixedValue"]);
  },
);

test("[OPUS3-F7g] the fishing spot is context: it goes, unless it is the level's only row", () => {
  const spot = "PersonalValuesMap.FishingSpotIndex";
  expect(level([read(spot, 2), read("Q", 3)]).map((r) => r.node.code)).toEqual([
    "Q",
  ]);
  expect(level([read(spot, 2)]).map((r) => r.node.code)).toEqual([spot]);
  // with rows under it, or typed already, it is no context leaf
  expect(level([call(spot), read("Q", 3)]).map((r) => r.node.code)).toEqual([
    spot,
    "Q",
  ]);
  const typed: Row = {
    node: { ...read(spot, 2).node, leaf: "choice" },
    open: null,
  };
  expect(level([typed, read("Q", 3)]).map((r) => r.node.code)).toEqual([
    spot,
    "Q",
  ]);
});

test("in a tree, the dungeon gate is a leaf and a proved leaf is named; every new text passes the host", () => {
  const root = buildTree(
    recordingOf(
      [
        { b: "(root)", c: [1] },
        {
          b: "Block",
          v: 9,
          c: [2],
          r: [
            ["Lv", 4],
            ["Lv", 4],
            ["DNSM.EclipseSk", 2],
          ],
        },
        { b: "Dungon", v: -1, r: [["CurrentMap", 3]] },
      ],
      [],
      { root: 0 },
    ),
    0,
  ).root;
  expect(kidsOf(root).map((k) => [k.code, k.name, k.kids])).toEqual([
    ["Dungon()", DUNGEON, []],
    ["Lv", expect.any(String), []],
    ["DNSM.EclipseSk", "Death Note monsters at Eclipse rank", []],
  ]);
  expect(checkTree(root, 100)).not.toBeNull();
  expect(
    [
      DUNGEON,
      DUNGEON_WHY,
      DUNGEON_RULE,
      "Banned from All-talent levels",
      "Star sign 28 health penalty (-80% when the Rift does not cover it)",
      "Kill stacks for talent 198 (live, reset on a new map)",
    ].every(isNameText),
  ).toBe(true);
});
