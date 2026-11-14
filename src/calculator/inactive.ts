// An inactive character's state (spec 008 US11, research R5), ported from the bench's reference (inactive.cjs
// `buildInactive`, agent I1, round 4: 0 differences on the 11 Stats numbers, both ways). Over the mosaic, before the
// context loads it, as the game does when it switches characters: the active one is written back to PlayerDATABASE
// (add_new_player_to_database), then the game's own swap loads the other (LoadPlayerInfo). After the helpers, inside
// the context, the scene caches the game rebuilds when the character's scene loads, with the TotalStats memory cleared
// before each step. The active character keeps the running game's caches (DNSM), with no rebuild. A list with an
// unexpected shape stops the calculation; its error names the list, never a character.

type Json = Record<string, unknown>;

/** Kept under the same name in PlayerDATABASE. */
// prettier-ignore
const SAME = ["AttackLoadout", "EquipmentMap", "EquipmentOrder", "EquipmentQuantity", "Exp0", "ExpReq0", "FoodCooldowns", "InventoryOrder", "ItemMap", "ItemQuantity", "Lv0", "KillsLeft2Advance", "OptionsList", "QuestHelperMenu", "SkillLevels", "SkillLevelsMAX", "MaxCarryCap", "QuestStatus", "QuestComplete", "NPCdialogue", "AttackCooldowns", "InvBagsUsed", "BuffsActive", "StatueLevels", "AnvilPA", "AnvilPAstats", "AnvilPAselect", "PersonalValuesMap", "PlayerStuff", "LockedSlots", "TalPresetLISTS", "TalPresetATTACKS", "CardPreset"];
/** Kept under the same name and read back as numbers. */
// prettier-ignore
const NUM = ["CharacterClass", "CurrentMap", "FoodSlotsOwned", "Money", "RespawnTime", "PlayerHP", "PlayerMP", "InventorySlotsOwned", "PlayerAutoMoveTOGGLE"];
/** The account's lists of 4 that hold one place per character: [list, the character's place, its key when saved]. */
const PLACES = [
  ["ObolEquippedOrder", 0, "ObolEquippedOrder"],
  ["ObolEquippedMap", 0, "ObolEquippedMap"],
  ["PostOfficeInfo", 3, "PostOfficeInfo"],
  ["Cards", 2, "CardEquip"],
  ["Cards", 3, "CSetEq"],
] as const;
/** Top keys saved under another name. */
const RENAMED = [
  ["PrayersActive", "Prayers"],
  ["PlacedTraps", "PldTraps"],
] as const;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function shape(ok: boolean, what: string): asserts ok {
  if (!ok) throw new Error(`unexpected shape: ${what}`);
}

/** A Haxe map as the mosaic carries it: its entries. */
function entriesOf(v: unknown, what: string): Json {
  shape(isObject(v) && isObject(v.$m), what);
  return v.$m;
}

function listOf(attrs: Json, key: string): unknown[] {
  const list = attrs[key];
  shape(Array.isArray(list) && list.length === 4, key);
  return list;
}

/** An own key, even one named like the object's prototype. */
function put(o: Json, key: string, value: unknown): void {
  Object.defineProperty(o, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** A number of the mosaic: `{ $n }` (a number JSON cannot hold) stays as it travels. */
const num = (v: unknown) => (isObject(v) && "$n" in v ? v : Number(v));

/** The game's add_new_player_to_database: the active character's state, back in PlayerDATABASE. */
export function saveActivePlayer(attrs: Json): void {
  const players = entriesOf(attrs.PlayerDATABASE, "PlayerDATABASE");
  const me: unknown = Array.isArray(attrs.UserInfo)
    ? attrs.UserInfo[0]
    : undefined;
  const old =
    typeof me === "string" && Object.hasOwn(players, me)
      ? players[me]
      : undefined;
  shape(typeof me === "string" && isObject(old), "PlayerDATABASE");
  const m: Json = {};
  for (const k of [...SAME, ...NUM]) m[k] = structuredClone(attrs[k]);
  m.AFKtarget = attrs.AFKtarget;
  for (const [list, place, key] of PLACES)
    m[key] = structuredClone(listOf(attrs, list)[place]);
  m.PlayerAwayTime = structuredClone(
    entriesOf(attrs.TimeAway, "TimeAway").Player,
  );
  for (const [top, key] of RENAMED) m[key] = structuredClone(attrs[top]);
  put(players, me, { ...old, $m: m });
}

/** The game's LoadPlayerInfo: the character `name`'s state, from PlayerDATABASE to where the active one's lives. */
export function loadPlayerInfo(attrs: Json, name: string): void {
  const players = entriesOf(attrs.PlayerDATABASE, "PlayerDATABASE");
  const m = structuredClone(
    entriesOf(
      Object.hasOwn(players, name) ? players[name] : undefined,
      "PlayerDATABASE",
    ),
  );
  for (const k of SAME) attrs[k] = m[k];
  for (const k of NUM) attrs[k] = num(m[k]);
  if (!(Number(attrs.PlayerMP) >= 0)) attrs.PlayerMP = 5;
  attrs.AFKtarget = String(m.AFKtarget);
  // Only the character's place in each list: the others are the family's, the bench's and the account's.
  for (const [list, place, key] of PLACES) {
    const into = listOf(attrs, list);
    if (list !== "Cards") shape(Array.isArray(m[key]), key);
    into[place] = m[key];
  }
  entriesOf(attrs.TimeAway, "TimeAway").Player = m.PlayerAwayTime;
  for (const [top, key] of RENAMED) attrs[top] = m[key];
  // The default LoadPlayerInfo puts in when this one is missing.
  const options = attrs.OptionsList;
  shape(Array.isArray(options), "OptionsList");
  if (options[11] == null || options[11] === 0) options[11] = [710, 10];
  // ponytail: place 13 stays as it came from the saved character; the game's default there is game text (FR-032).
  shape(Array.isArray(attrs.UserInfo), "UserInfo");
  attrs.UserInfo[0] = name;
}

/** The state of a character that is not the active one, as the game builds it when it switches to it. */
export function buildInactive(attrs: Json, name: string): void {
  saveActivePlayer(attrs);
  loadPlayerInfo(attrs, name);
}

/**
 * The mosaic of the character in place `character` of the game's list; null for the active one, which keeps the running
 * game's caches. Throws on an unexpected shape.
 */
export function inactiveMosaic(
  mosaicJson: string,
  character: number,
): string | null {
  const mosaic: unknown = JSON.parse(mosaicJson);
  shape(isObject(mosaic) && isObject(mosaic.attrs), "attrs");
  const { attrs } = mosaic;
  const names = attrs.GetPlayersUsernames;
  const name: unknown = Array.isArray(names) ? names[character] : undefined;
  shape(typeof name === "string", "GetPlayersUsernames");
  if (Array.isArray(attrs.UserInfo) && attrs.UserInfo[0] === name) return null;
  buildInactive(attrs, name);
  // The target the keeper read is the active one's (state-slice.js); the map's actors are the same for anyone on it.
  if (isObject(mosaic.actors))
    for (const key of Object.keys(mosaic.actors))
      if (key.startsWith("target.")) Reflect.deleteProperty(mosaic.actors, key);
  return JSON.stringify(mosaic);
}

/** One step of the scene: a block of the game with its arguments, a new empty cache, or the Lab helper's event. */
type SceneStep = readonly [block: string, ...args: (string | number)[]];

/**
 * What the game runs when the character's scene loads (the Lab helper's init and EveryScene.init, its delayed calls in
 * their order), called by hand: the calculator runs no delayed call.
 */
const SCENE_STEPS: readonly SceneStep[] = [
  ["TalentCalc", -6],
  ["@Lab"],
  ["TalentCalc", -7],
  ["@Lab"],
  ["TalentCalc", -7],
  ["@NewMap", "StampBonuses_Map_Of_Val"],
  ["StampBonusOfTypeX", "Talent1"],
  ["ActionBlock", "RecalcChipBonuses", "0", 0],
  ["WorkbenchStuff", "OverkillQTY", -1, 0],
  ["TalentCalc", -2],
  ["TalentCalc", -3],
  ["TalentCalc", -9],
  ["TalentCalc", -6],
  ["TalentEnh", -1],
  ["TalentCalc", -2],
  ["TalentCalc", -3],
  ["TotalStats", "calcEtcBonuses"],
  ["TotalStats", "calcEtcBonuses"],
  ["TalentCalc", -9],
];

const STATE = '__hx["com.stencyl.Engine"].engine.gameAttributes.h';
const NEW_MAP = 'new __hx["haxe.ds.StringMap"]()';
/** Run in the context with its errors caught there: one crossing to the host would carry the game's 24 MB line. */
const quiet = (body: string) => `(function(){try{${body}}catch(e){}})()`;
/** The TotalStats memory, which the game empties every second and during the scene's start. */
const CLEAR_MEMO = quiet(
  `var d=${STATE}.DNSM.h;d.TotStatMAP=${NEW_MAP};d.TotStatSkMAP=${NEW_MAP};`,
);

function stepText([block, a = 0, b = 0, c = 0]: SceneStep): string {
  if (block === "@NewMap")
    return quiet(`${STATE}.DNSM.h[${JSON.stringify(a)}]=${NEW_MAP};`);
  if (block === "@Lab")
    // The Lab helper (slot 22 of the helper actors) remakes its connections, which no mosaic keeps.
    return quiet(
      `var lab=${STATE}.PixelHelperActor[22].behaviors.getBehavior("ActorEvents_548");lab._TRIGGEREDtext="d*";lab._customEvent_Lab();`,
    );
  return `__calc.call(${JSON.stringify(block)},${JSON.stringify([a, b, c])})`;
}

/** The scene caches of the loaded character, each step with the TotalStats memory cleared before it, and at the end. */
export function rebuildScene(run: (text: string) => unknown): void {
  for (const step of SCENE_STEPS) {
    run(CLEAR_MEMO);
    run(stepText(step));
  }
  run(CLEAR_MEMO);
}
