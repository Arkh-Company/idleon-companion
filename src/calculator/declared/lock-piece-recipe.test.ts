// A piece with the form of a recipe in the lock (spec 010, T173; spec, Open Questions 23/11): below the line that calls
// it, its pools (with weights and constants) and the layers above them are checked by the root's engine, over the
// answer key of the line's call or of its cache's author. A line may call another number's recipe as a piece. The
// invented game (fake-game.js, TreeRecipe*) counts floor((TreeBase + TreeLevel + 2) × (1 + TreeStats.b ÷ 100)).
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import { parseBlueprint } from "./blueprint.ts";
import { loadBlueprints } from "./blueprints.ts";
import { inventedRecorder, recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";

type Raw = Record<string, unknown>;
const leaf = (key: string, read: string, kind = "rawBonus"): Raw => ({
  key,
  name: `Invented ${key}`,
  ref: { read },
  leaf: kind,
});
const TWO = {
  key: "two",
  name: "Invented Two",
  constant: 2,
  leaf: "fixedValue",
};
/** The recipe's pools: TreeBase, TreeLevel and the constant 2 added (`two` false: left out), then TreeStats.b's multi. */
const pools = (two = true): Raw[] => [
  {
    kind: "additive",
    groups: [
      {
        system: "cards",
        sources: [leaf("base", "TreeBase", "level"), leaf("lv", "TreeLevel")],
      },
      ...(two ? [{ system: "bundles", sources: [TWO] }] : []),
    ],
  },
  {
    kind: "multi",
    groups: [{ system: "prayers", sources: [leaf("pct", "TreeStats.b")] }],
  },
];
const piece = (p: Raw[] = pools()): Raw => ({
  id: "invented-stat",
  params: [],
  pools: p,
});
const SYSTEMS = new Set(["cards", "stamps", "bundles", "prayers"]);
const LINE = "invented-recipe-number/0/cards/stat";

/** An invented blueprint over `root`: a line `line` that calls the piece, and TreeCapped. */
const raw = (line: Raw, root = "TreeRecipeRoot"): Raw => ({
  id: "invented-recipe-number",
  root: { name: "Invented", ref: { call: root, args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        {
          system: "cards",
          sources: [
            {
              key: "stat",
              name: "Invented Stat",
              piece: { name: "invented-stat", args: {} },
              ...line,
            },
          ],
        },
        { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
      ],
    },
  ],
});
function blueprint(line: Raw, p: Raw = piece(), root?: string) {
  const out = parseBlueprint(raw(line, root), {
    fileId: "invented-recipe-number",
    systemIds: SYSTEMS,
    pieces: new Map([["invented-stat", p]]),
  });
  if (!out.ok) throw new Error(out.reason);
  return out.blueprint;
}
const CALL = { ref: { call: "TreeRecipeLine", args: [] } };
const lock = (p?: Raw) =>
  lockBlueprint({
    blueprint: blueprint(CALL, p),
    ...recorded("TreeRecipeRoot"),
    character: 0,
    characterClass: 3,
  });

test("a piece with two pools, a constant and a floor closes below the line's call, by the root's engine", () => {
  const out = lock();
  expect(out.errors).toEqual([]);
  // the piece's two pools, the root's pool and the root; the base, the level, the 2, the multi and TreeCapped
  expect(out.counts).toEqual({
    closed: 4,
    closedByRecorded: 0,
    leaves: 5,
    branches: 1,
  });
});

test("a piece's pools that do not close are refused at their place, as the root's", () => {
  const errors = lock(piece(pools(false))).errors;
  expect(errors).toEqual([
    {
      kind: "missingSource",
      where: `${LINE}/pool:0`,
      pool: "additive",
      expected: "2",
    },
    {
      kind: "notClosing",
      where: `${LINE}/pool:0`,
      pool: "additive",
      expected: 31,
      got: 29,
    },
  ]);
  expect(errors.map(lockMessage).at(-1)).toBe(
    `nível não fecha: ${LINE} pool 1 Additive: as partes dão 29, o valor gravado é 31`,
  );
  // the pools in the wrong order: the line's place says so
  expect(lock(piece(pools().toReversed())).errors).toEqual([
    {
      kind: "poolOrder",
      where: LINE,
      expected: "Additive → Multi",
      got: "Multi → Additive",
    },
  ]);
});

test("a cache read's line with a recipe piece closes over the answer key of the cache's author", () => {
  const r = inventedRecorder();
  const DNSM = { ...activeAs(0).DNSM.$m, TreeRecipe: { $m: { v: 32 } } };
  const rec = r.record(
    mosaicOf({ DNSM: { $m: DNSM } }),
    [["TreeRecipeCached", [0, 0, 0]]],
    {
      recompute: [],
      builders: [
        { cache: "TreeRecipe", run: { block: "TreeRecipeBuild", args: [] } },
      ],
    },
  );
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  const out = lockBlueprint({
    blueprint: blueprint(
      { ref: { read: "DNSM.TreeRecipe.v" } },
      piece(),
      "TreeRecipeCached",
    ),
    key,
    rec,
    ops: r.ops,
    character: 0,
    characterClass: 3,
  });
  expect(out.errors).toEqual([]);
  expect(out.counts.closed).toBe(4);
});

/** The line reads `field` of a builder that writes four fields to 32 (fake-game.js TreeRecipeTwin), under `root`. */
function twin(field: string, root: string) {
  const r = inventedRecorder();
  const fields = ["A", "B", "C", "D"].map((k) => [
    `TreeTwin${k}`,
    { $m: { v: 32 } },
  ]);
  const DNSM = { ...activeAs(0).DNSM.$m, ...Object.fromEntries(fields) };
  const rec = r.record(
    mosaicOf({ DNSM: { $m: DNSM }, TreeTwinX: 10, TreeTwinY: 6, TreeTwinZ: 2 }),
    [[root, [0, 0, 0]]],
    {
      recompute: [],
      builders: [{ cache: field, run: { block: "TreeRecipeTwin", args: [] } }],
    },
  );
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  return lockBlueprint({
    blueprint: blueprint({ ref: { read: `DNSM.${field}.v` } }, piece(), root),
    key,
    rec,
    ops: r.ops,
    character: 0,
    characterClass: 3,
  });
}

test("a builder that writes two fields to the same value: the line closes over the write it read, never by value", () => {
  // TreeTwinB, a running total after TreeTwinA's with the same last write; TreeTwinC, one write before TreeTwinD's
  for (const [field, root] of [
    ["TreeTwinB", "TreeRecipeTwinB"],
    ["TreeTwinC", "TreeRecipeTwinC"],
  ] as const) {
    const out = twin(field, root);
    expect(out.errors).toEqual([]);
    expect(out.counts.closed).toBe(4);
  }
});

test("a read that is no cache gives a recipe piece no answer key: refused with the reason at the line", () => {
  const out = lockBlueprint({
    blueprint: blueprint({ ref: { read: "TreeCapped" } }),
    ...recorded("TreeRecipeRoot"),
    character: 0,
    characterClass: 3,
  });
  expect(out.errors.filter((e) => e.where === LINE)).toEqual([
    {
      kind: "rootForm",
      where: LINE,
      got: "o pedaço com pools explica uma chamada ou um cache",
    },
  ]);
  expect(lockMessage({ kind: "rootForm", where: LINE, got: "x" })).toBe(
    `${LINE}: x`,
  );
});

test("a line may call another number's recipe as a piece: its pools come in the line", () => {
  const stat = {
    id: "invented-stat",
    root: { name: "Invented Stat", ref: { call: "TreeRecipeLine", args: [] } },
    pools: pools(),
  };
  const out = loadBlueprints({
    "../blueprints/w1/invented-stat.blueprint.json": stat,
    "../blueprints/w1/invented-recipe-number.blueprint.json": raw(CALL),
  });
  expect(out.refused).toEqual([]);
  const line = out.complete.get("invented-recipe-number")?.pools[0]?.groups[0]
    ?.sources[0];
  expect(line?.pools).toEqual(out.complete.get("invented-stat")?.pools);
  // a piece and a recipe with the same id: a call would not say which
  expect(
    loadBlueprints({
      "../blueprints/pieces/invented-stat.piece.json": piece(),
      "../blueprints/w1/invented-stat.blueprint.json": stat,
    }).refused,
  ).toEqual([
    {
      file: "../blueprints/w1/invented-stat.blueprint.json",
      reason: "id repetido: invented-stat já tem pedaço",
    },
  ]);
});

test("pools only in a piece, in place of its count and its children; their sources are checked as a pool's", () => {
  const reason = (line: Raw, p: Raw = piece()) => {
    const out = parseBlueprint(raw(line), {
      fileId: "invented-recipe-number",
      systemIds: SYSTEMS,
      pieces: new Map([["invented-stat", p]]),
    });
    return out.ok ? "loaded" : out.reason;
  };
  expect(reason(CALL)).toBe("loaded");
  expect(
    reason({ ...CALL, piece: undefined, pools: pools(), name: "Invented" }),
  ).toMatch(/pools só em pedaço/);
  expect(reason(CALL, { ...piece(), combine: "sum", children: [] })).toMatch(
    /pools vai no lugar de children, leaf, combine e each/,
  );
  // a source of the piece's pools: its system from systems.json, as a root's
  const other = pools();
  (other[1] as { groups: Raw[] }).groups[0] = {
    system: "nowhere",
    sources: [leaf("pct", "TreeStats.b")],
  };
  expect(reason(CALL, piece(other))).toMatch(
    /pools\/1\/groups\/0.*system fora de systems.json/,
  );
});
