// An inactive character (spec 008 US11, research R5): the bench's reference rebuild (inactive.cjs `buildInactive`) over
// the invented game. The active one is written back to PlayerDATABASE first, the game's own swap loads the other, and
// the scene caches are rebuilt with the TotalStats memory cleared before each step; the active one keeps the running
// game's caches. Every name and number is invented; in titles a character is "Character N".
import { expect, test, vi } from "vitest";
import { anchored, bootContext, lazyDnsmKeys } from "./boot.ts";
import { LIMITS } from "./engine.ts";
import {
  activeAs,
  CHARACTERS,
  GAME,
  mosaicOf,
  PAK,
  SAVED,
} from "./fixtures/fake-mosaic.ts";
import { handleMessage } from "./index.ts";
import { buildInactive, inactiveMosaic, rebuildScene } from "./inactive.ts";
import { createTreeEngine } from "./tree-engine.ts";

type Attrs = Record<string, unknown> & {
  PlayerDATABASE: { $m: Record<string, { $m: Record<string, unknown> }> };
};
const [FIRST, SECOND] = CHARACTERS;
const attrsOf = (over: object = {}) =>
  (JSON.parse(mosaicOf(over)) as { attrs: Attrs }).attrs;
const saved = (a: Attrs, name: string) => a.PlayerDATABASE.$m[name]?.$m;

test("the active character is written back to PlayerDATABASE first, with its other-name keys", () => {
  // The running game moved on since its copy in PlayerDATABASE was written.
  const a = attrsOf({
    CurrentMap: 5,
    PrayersActive: [9],
    Cards: [[], [], ["cardZ"], ["setZ"]],
  });
  buildInactive(a, SECOND);
  expect(saved(a, FIRST)).toMatchObject({
    CurrentMap: 5,
    SkillLevels: SAVED[0].$m.SkillLevels,
    ObolEquippedOrder: SAVED[0].$m.ObolEquippedOrder,
    ObolEquippedMap: SAVED[0].$m.ObolEquippedMap,
    PostOfficeInfo: SAVED[0].$m.PostOfficeInfo,
    CardEquip: ["cardZ"],
    CSetEq: ["setZ"],
    Prayers: [9],
    PldTraps: SAVED[0].$m.PldTraps,
    PlayerAwayTime: SAVED[0].$m.PlayerAwayTime,
  });
});

test("the swap moves the same-name keys and numbers, one place of the account's lists, and the other-name keys", () => {
  const a = attrsOf();
  buildInactive(a, SECOND);
  // The scene caches are the context's, after the load: the mosaic keeps the active one's.
  expect(a).toMatchObject({ ...activeAs(1), DNSM: activeAs(0).DNSM });
  // Only the character's place: the family's and the bench's stay.
  expect(a.ObolEquippedOrder).toEqual([
    ["obol7"],
    ["family"],
    ["family"],
    ["bench"],
  ]);
  expect(a.PostOfficeInfo).toEqual([["asked"], ["given"], ["sent"], [[7, 0]]]);
});

test("numbers are read as numbers, a number JSON cannot hold stays as it travels, and MP below 0 is 5", () => {
  const a = attrsOf();
  Object.assign(saved(a, SECOND) ?? {}, {
    CurrentMap: "7",
    Money: { $n: "1e400" },
    PlayerMP: -1,
  });
  buildInactive(a, SECOND);
  expect(a).toMatchObject({
    CurrentMap: 7,
    Money: { $n: "1e400" },
    PlayerMP: 5,
  });
});

test("the options the game fills when missing get its defaults", () => {
  const a = attrsOf();
  Object.assign(saved(a, SECOND) ?? {}, { OptionsList: [7] });
  buildInactive(a, SECOND);
  const options = a.OptionsList as unknown[];
  expect(options[11]).toEqual([710, 10]);
  expect(options[13]).toBe(undefined); // as the saved character has it
});

const badLists: [string, (a: Attrs) => void][] = [
  [
    "ObolEquippedOrder",
    (a) => {
      a.ObolEquippedOrder = [["obol3"]];
    },
  ],
  [
    "ObolEquippedMap",
    (a) => {
      a.ObolEquippedMap = {};
    },
  ],
  [
    "PostOfficeInfo",
    (a) => {
      a.PostOfficeInfo = [[], [], []];
    },
  ],
  [
    "Cards",
    (a) => {
      a.Cards = [[], []];
    },
  ],
  [
    "TimeAway",
    (a) => {
      a.TimeAway = [103];
    },
  ],
  [
    "OptionsList",
    (a) => {
      Object.assign(saved(a, SECOND) ?? {}, { OptionsList: null });
    },
  ],
  [
    "ObolEquippedOrder",
    (a) => {
      Object.assign(saved(a, SECOND) ?? {}, { ObolEquippedOrder: "obol7" });
    },
  ],
];
test.each(badLists)(
  "a list with an unexpected shape (%s) stops with a warning that names the list, never a character",
  (list, spoil) => {
    const a = attrsOf();
    spoil(a);
    let message = "";
    try {
      buildInactive(a, SECOND);
    } catch (e) {
      message = String(e);
    }
    expect(message).toContain(`unexpected shape: ${list}`);
    for (const name of CHARACTERS) expect(message).not.toContain(name);
  },
);

test("a character missing from PlayerDATABASE stops too", () => {
  expect(() => {
    buildInactive(attrsOf(), "Nobody");
  }).toThrow(/unexpected shape/);
});

test("the active character keeps the mosaic as it is: no rebuild", () => {
  expect(inactiveMosaic(mosaicOf(), 0)).toBe(null);
});

test.each([
  ["no list of characters", { GetPlayersUsernames: null }, 1],
  ["a character past the list", {}, 2],
])("%s stops", (_name, over, character) => {
  expect(() => inactiveMosaic(mosaicOf(over), character)).toThrow(
    /unexpected shape/,
  );
});

test("another character's mosaic is the swapped state, everything else kept", () => {
  const out = inactiveMosaic(mosaicOf(), 1);
  const a = attrsOf();
  buildInactive(a, SECOND);
  // As text: a key the character never had leaves the state, as in the game.
  expect(out).toBe(
    JSON.stringify({ ...(JSON.parse(mosaicOf()) as object), attrs: a }),
  );
});

test("the scene caches are rebuilt with the TotalStats memory cleared before each step and at the end", () => {
  const context = bootContext(anchored(GAME), PAK, LIMITS);
  context.load(inactiveMosaic(mosaicOf(), 1) ?? "", lazyDnsmKeys(GAME));
  const run = vi.fn((text: string) => context.run(text, LIMITS.startMs));
  rebuildScene(run);
  // The Lab's event, TalentCalc(-7) after it, and calcEtcBonuses without the working value TalentCalc left.
  expect(context.number("TreeScene", [0, 0, 0])).toBe(7 * 10 + 7 * 2);
  expect(context.number("TreeMemo", [0, 0, 0])).toBe(0);
  // Nothing of the game's text crosses back: each step answers in the context.
  for (const [text] of run.mock.calls) expect(text).not.toContain(SECOND);
});

test("the scene calls each block with the game's own arguments, never filled with zeros (spec 010, a cache's author)", () => {
  const run = vi.fn<(text: string) => unknown>();
  rebuildScene(run);
  const calls = run.mock.calls
    .map(([text]) => text)
    .filter((t) => t.startsWith("__calc.call"));
  // TalentCalc takes one argument: a recorded TalentCalc(-9,0,0) is no call of the game's
  expect(calls).toContain('__calc.call("TalentCalc",[-9])');
  expect(calls).not.toContain('__calc.call("TalentCalc",[-9,0,0])');
  expect(calls).toContain(
    '__calc.call("ActionBlock",["RecalcChipBonuses","0",0,0])',
  );
  // as the builders' pass calls it (tree-recipe.ts), so both writes of its cache have one key
  expect(calls).toContain('__calc.call("TotalStats",["calcEtcBonuses",0,0])');
});

test("on the active one's map, an inactive character has no target: the active one's is not its own (US12)", () => {
  const map = SAVED[1].$m.CurrentMap;
  const mosaic = mosaicOf(
    {
      CurrentMap: map,
      MapMonstersList: [{ $x: 1 }],
      OtherPlayers: { $m: { [FIRST]: { $x: 1 }, [SECOND]: { $x: 1 } } },
    },
    {},
    { map, "map0._MonsterHPtot": 4500, "target._MonsterType": "mobB" },
  );
  const context = bootContext(anchored(GAME), PAK, LIMITS);
  const number = (block: string, json: string) => {
    context.load(json, lazyDnsmKeys(GAME));
    return context.number(block, [0, 0, 0]);
  };
  expect(number("TreeTarget", mosaic)).toBe(40);
  const inactive = inactiveMosaic(mosaic, 1) ?? "";
  expect(number("TreeTarget", inactive)).toBeNull();
  // The map's first monster is the same for whoever stands on the map.
  expect(number("TreeMapMonster", inactive)).toBe(4500);
});

const ROOTS = {
  scene: ["TreeScene", [0, 0, 0]],
  character: ["TreeCharacter", [0, 0, 0]],
  player: ["TreePlayer", [0, 0, 0]],
} as const;

test.each([
  [1, 0],
  [0, 1],
])(
  "Character %i calculated while Character %i is active equals it made active, both ways",
  (target, from) => {
    const trees = createTreeEngine(GAME, PAK, ROOTS);
    const value = (id: string, mosaic: string) => {
      const root = trees.tree(
        { type: "number", id, character: target },
        mosaic,
      );
      return root === "unknownNumber" ? root : root.value;
    };
    const inactive = mosaicOf(activeAs(from as 0 | 1));
    const active = mosaicOf(activeAs(target as 0 | 1));
    for (const id of Object.keys(ROOTS))
      expect(value(id, inactive)).toBe(value(id, active));
    // The scene caches of each character (fake-mosaic.ts, activeAs): its map ×10 plus its map ×2.
    expect(value("scene", inactive)).toBe([36, 84][target]);
  },
);

test("the active character uses the running game's caches, even when a rebuild would change them", () => {
  const live = activeAs(0);
  live.DNSM.$m.TotalStatsETCmap = { $m: { drop: 31 } };
  const trees = createTreeEngine(GAME, PAK, ROOTS);
  const root = trees.tree(
    { type: "number", id: "scene", character: 0 },
    mosaicOf(live),
  );
  expect(root).toMatchObject({ value: 31 + 6 });
});

test("an inactive character's tree holds no character name either (CHK014)", () => {
  const port = { postMessage: vi.fn() };
  const init = {
    type: "init",
    mode: "tree",
    code: new TextEncoder().encode(GAME),
    pak: PAK,
  };
  handleMessage(init, port, undefined, (code, pak) =>
    createTreeEngine(code, pak, ROOTS),
  );
  for (const id of Object.keys(ROOTS)) {
    const request = { type: "number", id, character: 1 };
    handleMessage({ type: "tree", id: 1, request, mosaic: mosaicOf() }, port);
  }
  const all = JSON.stringify(port.postMessage.mock.calls.slice(1));
  expect(all).toContain('"value"');
  for (const name of CHARACTERS) expect(all).not.toContain(name);
});
