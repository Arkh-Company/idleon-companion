// The engine over an invented game: isolation, the long-lived context and every way a number or the start can fail (FR-008, FR-011, FR-012).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { createEngine } from "./engine.ts";
import { handleMessage } from "./index.ts";
import type { CalcNumbers } from "./targets.ts";

const GAME = readFileSync(
  join(import.meta.dirname, "fixtures", "fake-game.js"),
  "utf8",
);
const ANCHOR = 'A["com.stencyl.Engine"]=a,';
const PAK = new Uint8Array([7, 8, 9]);

const BASE = {
  AFKtarget: "mushA",
  Base: { $m: { hp: 500, acc: 7 }, $c: "haxe.ds.StringMap" },
  Damage: [120, 80],
  Stats: { STR: 11, AGI: 12, WIS: 13, LUK: 14, Drop_Rarity: 2.5 },
  AfkRate: 1.5,
  DNSM: {
    $m: { CompanionBon: { $m: { b1: 3 } }, ShinyBonusS: { $m: { s1: 4 } } },
  },
};

let engine: ReturnType<typeof createEngine>;
beforeAll(() => {
  engine = createEngine(GAME, PAK);
});

const mosaicOf = (attrs: object = {}, vars: object = {}): string =>
  JSON.stringify({ attrs: { ...BASE, ...attrs }, vars, skipped: [] });
const calc = (attrs: object = {}, vars: object = {}): CalcNumbers =>
  engine.calculate(mosaicOf(attrs, vars));
/** The game of a patch that moved this class: only its definition is renamed. */
const moved = (name: string): string =>
  GAME.replace(`A["${name}"] =`, `A["moved.${name}"] =`);
const scenario = (Scenario: string, attrs: object = {}, vars: object = {}) =>
  calc({ ...attrs, Scenario }, vars);
const newEngine = (): ReturnType<typeof createEngine> =>
  createEngine(GAME, PAK);

describe("numbers", () => {
  test("come from the mosaic, by id", () => {
    expect(calc()).toEqual({
      damageMax: 120,
      damageMin: 80,
      hp: 500,
      mp: 0,
      accuracy: 7,
      str: 11,
      agi: 12,
      wis: 13,
      luk: 14,
      dropRate: 2.5,
      afkGains: 1.5,
    });
  });

  test("a value the slice could not copy reads as nothing", () => {
    expect(calc({ Stats: { ...BASE.Stats, LUK: { $x: 1 } } }).luk).toBeNull();
  });

  test("the shapes of the slices are put back in the game's own types", () => {
    const n = scenario("restored", {
      Base: { $m: { hp: { $x: 1 }, acc: { $n: "Infinity" } } },
      Typed: { $m: { k: 9 }, $c: "haxe.ds.IntMap" },
    });
    expect(n.accuracy).toBe(1);
  });

  test("a block that throws gives null for that number alone", () => {
    const n = scenario("throw");
    expect(n.hp).toBeNull();
    expect(n.str).toBe(11);
  });

  test("a block that throws is answered inside the context: no error reaches the host", () => {
    const n = scenario("throwWatched");
    expect(n.hp).toBeNull();
    expect(n.accuracy).toBe(0); // how many times something outside the game read the error's stack
  });

  test("NaN gives null", () => {
    expect(scenario("notFinite").hp).toBeNull();
  });

  test("Infinity gives null", () => {
    const n = calc({ Base: { $m: { hp: 1, acc: { $n: "Infinity" } } } });
    expect(n.accuracy).toBeNull();
  });

  test("an AFKtarget outside the monster table gives null for the damage only", () => {
    const n = calc({ AFKtarget: "not in the table" });
    expect(n.damageMax).toBeNull();
    expect(n.damageMin).toBeNull();
    expect(n.hp).toBe(500);
  });

  test("a block in an endless loop gives null within its 2 s", () => {
    const started = performance.now();
    const n = scenario("endless");
    expect(n.hp).toBeNull();
    expect(n.str).toBe(11);
    expect(performance.now() - started).toBeLessThan(4000);
  }, 10_000);

  test("a helper in an endless loop makes that calculation null within 8 s, and the next one works", () => {
    const port = { postMessage: vi.fn() };
    const code = new TextEncoder().encode(GAME);
    handleMessage({ type: "init", code, pak: PAK }, port);
    const started = performance.now();
    handleMessage(
      { type: "calc", mosaic: mosaicOf({ Scenario: "endlessInit" }) },
      port,
    );
    expect(performance.now() - started).toBeLessThan(12_000);
    handleMessage({ type: "calc", mosaic: mosaicOf() }, port);
    const [, stuck, next] = port.postMessage.mock.calls.map(
      (c) => c[0] as { numbers: CalcNumbers },
    );
    expect(Object.values(stuck?.numbers ?? {}).length).toBe(11);
    expect(Object.values(stuck?.numbers ?? {}).every((v) => v === null)).toBe(
      true,
    );
    expect(next?.numbers.hp).toBe(500);
  }, 20_000);

  test("finishing the helpers in an endless loop fails the calculation within 8 s", () => {
    const started = performance.now();
    expect(() => scenario("endlessFinish")).toThrow();
    expect(performance.now() - started).toBeLessThan(12_000);
  }, 20_000);
});

describe("isolation (FR-008)", () => {
  test("nothing reached the network, code generation or the host", () => {
    expect(calc().mp).toBe(0);
  });

  test("no global and no prototype of globalThis generates code", () => {
    const n = scenario("globals");
    expect(n.mp).toBe(0);
    expect(n.accuracy).toBeGreaterThan(40);
  });

  test("the bytes of default.pak live in an array of the context", () => {
    expect(scenario("pak").accuracy).toBe(8);
  });

  test("the decompressors take and give arrays of the context, and fail with its errors", () => {
    const Packed = [...gzipSync(new Uint8Array([42]))];
    expect(scenario("decompress", { Packed }).accuracy).toBe(42);
  });

  test("the host copies bytes without the context's Uint8Array.prototype.set", () => {
    const Packed = [...gzipSync(new Uint8Array([42]))];
    expect(scenario("arraySet", { Packed }).accuracy).toBe(0);
  });

  test("assets the game does not have read as empty text", () => {
    expect(scenario("assets").accuracy).toBe(1);
  });
});

describe("state", () => {
  test("the numbers run in the order of TARGETS, on one state with no restore", () => {
    expect(scenario("order")).toEqual({
      damageMax: 1,
      damageMin: 2,
      hp: 3,
      mp: 4,
      accuracy: 5,
      str: 6,
      agi: 7,
      wis: 8,
      luk: 9,
      dropRate: 10,
      afkGains: 11,
    });
  });

  test("CloudSAVE and SaveGamee, called by a block, do nothing", () => {
    expect(scenario("save").accuracy).toBe(0);
  });

  test("the helpers ran, on stub actors and without drawing", () => {
    expect(scenario("helper").accuracy).toBe(2);
  });

  test("AFKtarget of the mosaic wins over the helper that rewrites it", () => {
    expect(calc().damageMax).toBe(120);
  });

  test("CompanionBon and ShinyBonusS of the mosaic win over the helper", () => {
    expect(scenario("bonus").accuracy).toBe(7);
  });

  test("the maps the game creates lazily exist, except those it fills itself", () => {
    expect(scenario("lazyDnsm").accuracy).toBe(1);
  });

  test("the tables come from the game's classes, with no save", () => {
    expect(scenario("tables").accuracy).toBe(511);
  });
});

describe("the long-lived context", () => {
  const OTHER = {
    Base: { $m: { hp: 900, acc: 33 }, $c: "haxe.ds.StringMap" },
    Damage: [10, 5],
    Stats: { STR: 1, AGI: 2, WIS: 3, LUK: 4, Drop_Rarity: 9 },
    AfkRate: 0.25,
  };
  const OTHER_BONUS = {
    DNSM: {
      $m: { CompanionBon: { $m: { b1: 30 } }, ShinyBonusS: { $m: { s1: 40 } } },
    },
  };
  const VARS = { TomePct: 40, ArcadeBonuses: { $m: { x: 2 } } };

  const accuracies = (Scenario: string, times: number): (number | null)[] => {
    const long = newEngine();
    const json = mosaicOf({ Scenario });
    return Array.from({ length: times }, () => long.calculate(json).accuracy);
  };

  test("the game boots once for 3 calculations", () => {
    expect(accuracies("counter", 3)).toEqual([1, 2, 3]);
  });

  test("the actors are created again in each calculation", () => {
    expect(accuracies("actors", 3)).toEqual([1, 2, 3]);
  });

  test.each([
    ["every number changes", mosaicOf(), mosaicOf(OTHER)],
    [
      "a simple value that is gone is not put back",
      mosaicOf(),
      mosaicOf({ AFKtarget: undefined }),
    ],
    [
      "the bonuses are the newest mosaic's",
      mosaicOf({ Scenario: "bonus" }),
      mosaicOf({ Scenario: "bonus", ...OTHER_BONUS }),
    ],
    [
      "the _vars are the newest mosaic's",
      mosaicOf({ Scenario: "vars" }, VARS),
      mosaicOf({ Scenario: "vars" }),
    ],
    [
      "a constructor that fails does not bring back the last actors",
      mosaicOf({ Scenario: "helper" }),
      mosaicOf({ Scenario: "noActor" }),
    ],
  ])("A, B, A equal a fresh engine: %s", (_name, a, b) => {
    const long = newEngine();
    for (const mosaic of [a, b, a])
      expect(long.calculate(mosaic)).toEqual(newEngine().calculate(mosaic));
  });

  test("the host makes one call for all the helpers of a calculation", () => {
    expect(accuracies("helperCalls", 3)).toEqual([1, 2, 3]);
    expect(accuracies("initPasses", 3)).toEqual([2, 4, 6]);
  });

  test("a helper that throws does not stop the others", () => {
    expect(scenario("otherHelpers").accuracy).toBe(1);
  });

  test("a helper that throws fails only its numbers, and the next calculation works", () => {
    const long = newEngine();
    const n = long.calculate(mosaicOf({ Scenario: "helperThrows" }));
    expect(n.accuracy).toBeNull();
    expect(n.str).toBe(11);
    expect(long.calculate(mosaicOf({ Scenario: "helper" })).accuracy).toBe(2);
  });

  test("a number that throws does not reach the next calculation", () => {
    const long = newEngine();
    expect(long.calculate(mosaicOf({ Scenario: "throw" })).hp).toBeNull();
    expect(long.calculate(mosaicOf()).hp).toBe(500);
  });

  test("a mosaic that is not JSON leaves the next calculation working", () => {
    const long = newEngine();
    expect(() => long.calculate("not json")).toThrow();
    expect(long.calculate(mosaicOf()).hp).toBe(500);
  });
});

describe("the bridge", () => {
  test("a _vars key answers its restored value", () => {
    const vars = {
      TomePct: 40,
      ArcadeBonuses: { $m: { x: 2 }, $c: "haxe.ds.StringMap" },
    };
    expect(scenario("vars", {}, vars).accuracy).toBe(42);
  });

  test("other names answer as nothing loaded", () => {
    expect(scenario("nothingLoaded").accuracy).toBe(1);
  });
});

describe("a game that does not start", () => {
  test.each([
    ["has no anchor", GAME.replace(ANCHOR, "")],
    ["has two anchors", GAME.replace(ANCHOR, ANCHOR + ANCHOR)],
    [
      "throws in lime.$scripts.N",
      `${GAME};lime.$scripts.N = function () { throw new Error("broken"); };`,
    ],
    ["does not parse", `${GAME} )`],
    ...[
      "js.Boot",
      "lime.utils.Log",
      "scripts.CustomLists",
      "scripts.CustomLists2",
      "scripts.CustomLists3",
      "scripts.CustomMaps",
      "scripts.CustomMapsREAL",
    ].map((name) => [`moved ${name}`, moved(name)]),
    ...["Item", "Monster", "Dialogue"].map((kind) => [
      `moved every scripts.${kind}Definitions`,
      GAME.replaceAll(
        `A["scripts.${kind}Definitions`,
        `A["moved.${kind}Definitions`,
      ),
    ]),
    [
      "left only a scripts.MonsterDefinitions class not followed by digits",
      GAME.replace(
        'A["scripts.MonsterDefinitions"]',
        'A["scripts.MonsterDefinitionsOld"]',
      ),
    ],
  ])("%s", (_name, code) => {
    expect(() => createEngine(code, PAK)).toThrow();
  });

  test("a definitions class that comes numbered is enough", () => {
    const numbered = createEngine(
      GAME.replace(
        'A["scripts.ItemDefinitions"]',
        'A["scripts.ItemDefinitions7"]',
      ),
      PAK,
    );
    const n = numbered.calculate(mosaicOf({ Scenario: "tables" }));
    expect(n.accuracy).toBe(511);
  });

  test("a table that throws stays out, and only what reads it is unavailable", () => {
    const broken = createEngine(
      GAME.replace(
        "ListTwo: function () {",
        'ListTwo: function () {\nthrow new Error("broken table");',
      ),
      PAK,
    );
    const n = broken.calculate(mosaicOf({ Scenario: "tables" }));
    expect(n.accuracy).toBeNull();
    expect(n.str).toBe(11);
  });

  test("a mosaic that is not JSON makes the calculation fail", () => {
    expect(() => engine.calculate("not json")).toThrow();
  });
});
