// pieces.cjs `rename` at BASELINE-4, the rules that look at the rows above a row (tree/above-renames.ts): its parent's
// code, or the calls and caches above it in its piece. Over the invented game's recordings, each level renamed when it
// gets its place, before its ⓘ.
import { beforeAll, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { BASE, GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { aboveRenames } from "./above-renames.ts";
import type { Above } from "./above-renames.ts";
import { isNameText } from "./name-text.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { fixed, kidsOf, openPath, read } from "./tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
const NONE = { recompute: [], builders: [] };
const mosaic = mosaicOf({
  DNSM: { $m: { ...BASE.DNSM.$m, CalcTalentDN2: 3 } },
});
const gameOf = (block: string) =>
  buildTree(
    recorder.record(mosaic, [[block, [0, 0, 0]]], NONE),
    0,
    recorder.ops,
  );
/** Each row as [name, leaf, flags], a group's rows in it. */
const named = (n: CalcTreeNode | null | undefined): unknown[] =>
  kidsOf(n).flatMap((k) =>
    k.role === "piece" ? [[k.name, k.leaf, k.flags]] : named(k),
  );

test("a doubler of 2 under ArcadeBonus is the maxed doubler, at the level its call opens", () => {
  const build = gameOf("TreeArcade");
  expect(named(openPath(build, "ArcadeBonus(0)"))).toEqual([
    [expect.any(String), expect.any(String), expect.any(Object)],
    ["Maxed doubler ×2", "fixedValue", {}],
  ]);
});

test("a monument's cache opens into its parts, renamed by the cache: its fixed number, not the two at ×1 the bench keeps aside", () => {
  const build = gameOf("TreeMonument");
  const cache = openPath(build, "DNSM.MonumentROGbonuses.v");
  expect(named(cache)).toEqual([
    [expect.any(String), "unknown", expect.any(Object)],
    ["Bonus per monument level", "fixedValue", {}],
    ["Fixed ×1", "fixedValue", {}],
    ["Fixed ×1", "fixedValue", {}],
  ]);
  // its ⓘ is written with the new name
  expect(JSON.stringify(cache?.formula)).toContain("Bonus per monument level");
  expect(checkTree(build.root, 100)).not.toBeNull();
});

test("a bubble's scratch number is named by the bubble above: under its cache, under a call and in a branch below it", () => {
  const build = gameOf("TreeBubble");
  const bubble = openPath(build, "DNSM.AlchBubbles.W2");
  const scratch = kidsOf(bubble).find((k) => k.code === "DNSM.CalcTalentDN2");
  // OPUS3-F5: right under the bubble, its factor, with its ⓘ
  expect([scratch?.name, scratch?.leaf, scratch?.formula]).toEqual([
    "Items found in the Slab, in hundreds",
    "quantity",
    { rule: ["floor(Items found in the Slab ÷ 100)", "= 3"] },
  ]);
  // OPUS4-7: two levels below, in the branch of a call's step, and under a call of that branch
  const inner = openPath(build, "DNSM.AlchBubbles.W2", "TreeBubbleInner()");
  const [branch] = kidsOf(inner);
  const SLAB = "Slab items found ÷ 100 (rounded down)";
  // (the game's own value: the mosaic's)
  expect(named(branch)).toEqual([
    [SLAB, "quantity", { fromCache: true }],
    [expect.any(String), null, expect.any(Object)],
  ]);
  const call = kidsOf(branch).find((k) => k.code === "TreeBubbleLeaf()");
  expect(
    named(call?.kids === "lazy" ? build.expand(call.id) : null)[0],
  ).toEqual([SLAB, "quantity", { fromCache: true }]);
  expect(checkTree(build.root, 100)).not.toBeNull();
});

const leaf = (code: string, value = 3): Row => read(code, value);
const lazy = (code: string, name?: string): Row => ({
  node: row({
    pieceKey: code,
    value: 3,
    code,
    kids: "lazy",
    ...(name ? { name } : {}),
  }),
  open: 1,
});
const above = (...codes: (string | null)[]): Above[] =>
  codes.map((code) => ({ code, name: "Above" }));
/** The rows renamed under `up`, as [name, leaf, why, flags]. */
const renamed = (rows: Row[], up: Above[]) =>
  aboveRenames(rows, up).map((r) => [
    r.node.name,
    r.node.leaf,
    r.node.why,
    r.node.flags,
  ]);

const RIFT_WHY =
  "progress of the loop in RiftStuff(RiftSkillETC): 7 plus the bonus of the skills before this one, before this skill adds to it (N.js)";
test("[deep-2] the skills' total under RiftSkillETC is the total of the earlier skills, the loop's progress", () => {
  const rift = above('RiftStuff("RiftSkillETC", 0)');
  expect(renamed([leaf("DNSM.skillLvRanksDN2")], rift)).toEqual([
    ["Total of the earlier skills", "unknown", RIFT_WHY, {}],
  ]);
  // with rows under it, under another call, or with no call above
  for (const [r, up] of [
    [lazy("DNSM.skillLvRanksDN2"), rift],
    [leaf("DNSM.skillLvRanksDN2"), above('RiftStuff("Other", 0)')],
    [leaf("DNSM.skillLvRanksDN2"), above('XRiftStuff("RiftSkillETC", 0)')],
    [leaf("DNSM.skillLvRanksDN2"), []],
    [leaf("DNSM.skillLvRanksDN20"), rift],
  ] as const)
    expect(aboveRenames([r], up)[0]?.node.name).not.toBe(
      "Total of the earlier skills",
    );
});

test.each([
  ["ArcadeBonus(3)", 2, "Maxed doubler ×2", "fixedValue"],
  ['Holes("B_UPG", 46, 0)', 5, "Bonus per colony defeated", "fixedValue"],
  ["DNSM.MonumentROGbonuses[2]", 4, "Bonus per monument level", "fixedValue"],
  [
    'Holes("MonumentROGbonuses", 1)',
    4,
    "Bonus per monument level",
    "fixedValue",
  ],
])(
  "a fixed number under %s whose role the table proved",
  (parent, v, name, kind) => {
    const r = fixed(`Fixed ×${String(v)}`, v);
    expect(renamed([r], above("Top()", parent))).toEqual([
      [name, kind, null, {}],
    ]);
  },
);

test.each([
  ["a number that is no doubler", "ArcadeBonus(3)", "Fixed ×3", 3],
  ["another call", "Arcade(3)", "Fixed ×2", 2],
  ["a call that only holds the name", "MyArcadeBonus(3)", "Fixed ×2", 2],
  ["another building", 'Holes("B_UPG", 45, 0)', "Fixed ×2", 2],
  ["a number of a sum", "ArcadeBonus(3)", "Fixed +2", 2],
  ["a number with another name", "ArcadeBonus(3)", "Base 2", 2],
  ["a name that only holds the words", "ArcadeBonus(3)", "Not Fixed ×2", 2],
])("a fixed number keeps its name: %s", (_case, parent, name, v) => {
  expect(renamed([fixed(name, v)], above(parent))[0]?.[0]).toBe(name);
});

test("in a product, the fixed numbers at ×1 keep their names, and the one at 0 is named by the call above, all in their places (spec 009, FR-016)", () => {
  const inProduct = (r: Row): Row => ({
    ...r,
    node: { ...r.node, shareMode: "product" },
  });
  const out = aboveRenames(
    [fixed("Fixed ×1", 1), fixed("Fixed ×1", 1), fixed("Fixed ×0", 0)].map(
      inProduct,
    ),
    above("DNSM.MonumentROGbonuses[2]"),
  );
  expect(out.map((r) => [r.node.name, r.node.value])).toEqual([
    ["Fixed ×1", 1],
    ["Fixed ×1", 1],
    ["Bonus per monument level", 0],
  ]);
});

const earlier: Row = {
  node: row({ pieceKey: null, value: 3, code: null, leaf: "unknown" }),
  open: null,
  earlier: true,
};
test.each([
  ['FarmingStuffs("CropSCbonus", 0)', "Crop types found", "quantity"],
  ['Holes("MeasurementBaseBonus", 2)', "Measurement base bonus", "fixedValue"],
])(
  "a value from an earlier step under %s, at any level above",
  (call, name, kind) => {
    expect(renamed([earlier], above("Top()", call, null, "Other()"))).toEqual([
      [name, kind, null, {}],
    ]);
  },
);

test("[OPUS4-7] a value from an earlier step under the bubble Y6, at any level above, is the maps with every kill done", () => {
  expect(renamed([earlier], above("DNSM.AlchBubbles.Y6", "In()"))).toEqual([
    [
      "World 6 maps with every kill done (13 maps, each character)",
      "quantity",
      null,
      {},
    ],
  ]);
  // under another bubble, or the nearest bubble another one
  expect(renamed([earlier], above("DNSM.AlchBubbles.W2"))[0]?.[0]).toBe(
    "Game value",
  );
  expect(
    renamed(
      [earlier],
      above("DNSM.AlchBubbles.Y6", "DNSM.AlchBubbles.W2"),
    )[0]?.[0],
  ).toBe("Game value");
  // a read under Y6 is no value from an earlier step
  expect(renamed([leaf("Q")], above("DNSM.AlchBubbles.Y6"))[0]?.[0]).toBe(
    leaf("Q").node.name,
  );
  // a value from an earlier step with rows under it is no leaf
  const branch: Row = { ...earlier, node: { ...earlier.node, kids: "lazy" } };
  expect(
    aboveRenames([branch], above("DNSM.AlchBubbles.Y6"))[0]?.node.name,
  ).toBe("Game value");
});

test("a value from an earlier step under another call, or a row that is none, keeps its name", () => {
  expect(renamed([earlier], above('FarmingStuffs("Other", 0)'))[0]?.[0]).toBe(
    "Game value",
  );
  expect(
    renamed([leaf("Q")], above('FarmingStuffs("CropSCbonus", 0)'))[0]?.[0],
  ).toBe("Game value");
});

test.each([
  ["W2", "2", "Slab items found ÷ 100 (rounded down)", "quantity"],
  ["M4", "2", "Slab items found ÷ 100 (rounded down)", "quantity"],
  // (under A9, opus5's TOME_DN2 renames it last: tree/last-renames.ts)
  ["A9", "2", "Tome points above 5,000, per 2,000", "quantity"],
  [
    "M10AllCharz",
    "2",
    "Tome points above 5000, per 2000 (rounded down)",
    "quantity",
  ],
  ["A8", "2", "Class level above 500, per 10 (at least 1)", "level"],
  ["W9AllCharz", "1", "Total class level of the Warriors", "level"],
  ["A7AllCharz", "2", "Total class level of the Archers", "level"],
  ["M8AllCharz", "3", "Total class level of the Mages", "level"],
  ["MealSpdz", "2", "Meals at level 11 or more", "quantity"],
  [
    "Y6",
    "1",
    "World 6 maps with every kill done (13 maps, each character)",
    "quantity",
  ],
])(
  "[OPUS4-7] under the bubble %s, a level above, CalcTalentDN%s is named by it",
  (bubble, dn, name, kind) => {
    const up = above(`DNSM.AlchBubbles.${bubble}`, "Inner()");
    expect(renamed([leaf(`DNSM.CalcTalentDN${dn}`)], up)).toEqual([
      [name, kind, null, {}],
    ]);
  },
);

test.each([
  ["another scratch number of the bubble", "W2", "DNSM.CalcTalentDN1"],
  ["a bubble with no scratch number", "W3", "DNSM.CalcTalentDN2"],
  ["a bubble with a longer name", "W24", "DNSM.CalcTalentDN2"],
  ["another number", "W2", "DNSM.CalcTalentDN4"],
  ["a number with a longer name", "W2", "DNSM.CalcTalentDN2x"],
])("[OPUS4-7] the scratch number keeps its name: %s", (_case, bubble, code) => {
  const up = above(`DNSM.AlchBubbles.${bubble}`, "Inner()");
  expect(renamed([leaf(code)], up)[0]?.[0]).toBe(leaf(code).node.name);
});

test("[OPUS4-7] a scratch number typed a Condition is no Condition once named", () => {
  const typed: Row = {
    node: row({
      pieceKey: null,
      value: 1,
      code: "DNSM.CalcTalentDN2",
      leaf: "condition",
      condition: "owned",
    }),
    open: null,
  };
  const [r] = aboveRenames([typed], above("DNSM.AlchBubbles.MealSpdz", "In()"));
  expect([r?.node.leaf, r?.node.condition]).toEqual(["quantity", null]);
});

test("[OPUS4-7] the nearest bubble above decides; a scratch number with rows under it, or with no bubble above, keeps its name", () => {
  const up = above("DNSM.AlchBubbles.W2", "DNSM.AlchBubbles.MealSpdz", "In()");
  expect(renamed([leaf("DNSM.CalcTalentDN2")], up)[0]?.[0]).toBe(
    "Meals at level 11 or more",
  );
  expect(
    renamed(
      [leaf("DNSM.CalcTalentDN2")],
      above("DNSM.AlchBubbles.W2", "XDNSM.AlchBubbles.MealSpdz"),
    )[0]?.[0],
  ).toBe("Slab items found ÷ 100 (rounded down)");
  expect(
    aboveRenames([lazy("DNSM.CalcTalentDN2")], above("DNSM.AlchBubbles.W2"))[0]
      ?.node.name,
  ).not.toBe("Items found in the Slab, in hundreds");
  expect(renamed([leaf("DNSM.CalcTalentDN2")], above("In()"))[0]?.[0]).toBe(
    leaf("DNSM.CalcTalentDN2").node.name,
  );
});

test.each([
  [
    "W4",
    "Items found in the Slab, in hundreds",
    "quantity",
    "floor(Items found in the Slab ÷ 100)",
  ],
  [
    "M7",
    "Class level above 500, in tens",
    "level",
    "max(1, floor((Class level − 500) ÷ 10))",
  ],
  [
    "W10AllCharz",
    "Tome points above 5000, per 2000",
    "quantity",
    "floor(max(0, (Tome points − 5000) ÷ 2000))",
  ],
])(
  "[OPUS3-F5] right under the bubble %s, CalcTalentDN2 is its factor, with its ⓘ",
  (bubble, name, kind, formula) => {
    const [r] = aboveRenames(
      [leaf("DNSM.CalcTalentDN2", 2.34567)],
      above(`DNSM.AlchBubbles.${bubble}`),
    );
    expect([r?.node.name, r?.node.leaf, r?.node.why, r?.node.formula]).toEqual([
      name,
      kind,
      null,
      { rule: [formula, "= 2.346"] },
    ]);
  },
);

test("[OPUS3-F5] a bubble with no factor, a bubble a level above, or another scratch number: no factor", () => {
  const f = (code: string, ...up: string[]) =>
    aboveRenames([leaf(code)], above(...up))[0]?.node.formula;
  expect(f("DNSM.CalcTalentDN2", "DNSM.AlchBubbles.MealSpdz")).toBeNull();
  expect(f("DNSM.CalcTalentDN2", "DNSM.AlchBubbles.W2", "In()")).toBeNull();
  expect(f("DNSM.CalcTalentDN1", "DNSM.AlchBubbles.W9AllCharz")).toBeNull();
  expect(f("DNSM.CalcTalentDN1", "DNSM.AlchBubbles.W2")).toBeNull();
});

test.each([
  [0, "Total Spelunking level of all characters", "level"],
  [8, "Total Spelunking level of all characters", "level"],
  [2, "Best depths of every tunnel, added up", "record"],
  [9, "Best depths of every tunnel, added up", "record"],
  [3, "Digits of the biggest haul of every tunnel, added up", "record"],
  [54, "Manic depths of every tunnel, added up", "record"],
  [55, "Manic depths of every tunnel, added up", "record"],
  [56, "Manic depths of every tunnel, added up", "record"],
])(
  "the Spelunking total a level above upgrade %s is named by it",
  (u, name, kind) => {
    const up = above(`Spelunk("ShopUpgBonus", ${String(u)}, 1)`, "In()");
    expect(renamed([leaf("DNSM.SpelunkyUpgDN")], up)).toEqual([
      [name, kind, null, {}],
    ]);
  },
);

test("the Spelunking total with rows under it is only renamed; the nearest upgrade decides; another upgrade or name keeps it", () => {
  const up = above('Spelunk("ShopUpgBonus", 2, 1)');
  const [open] = aboveRenames([lazy("DNSM.SpelunkyUpgDN")], up);
  expect([open?.node.name, open?.node.leaf, open?.node.kids]).toEqual([
    "Best depths of every tunnel, added up",
    null,
    "lazy",
  ]);
  const two = above(
    'Spelunk("ShopUpgBonus", 2, 1)',
    'Spelunk("ShopUpgBonus", 3, 1)',
  );
  expect(renamed([leaf("DNSM.SpelunkyUpgDN")], two)[0]?.[0]).toBe(
    "Digits of the biggest haul of every tunnel, added up",
  );
  for (const [r, u] of [
    [leaf("DNSM.SpelunkyUpgDN"), above('Spelunk("ShopUpgBonus", 4, 1)')],
    [leaf("DNSM.SpelunkyUpgDN"), above('Spelunk("Other", 2, 1)')],
    [leaf("DNSM.SpelunkyUpgDN"), above('XSpelunk("ShopUpgBonus", 2, 1)')],
    [lazy("DNSM.SpelunkyUpgDN", "Total depth"), up],
  ] as const)
    expect(aboveRenames([r], u)[0]?.node.name).toMatch(
      /^(Working value of the game|Total depth)/,
    );
});

test("every new text passes the host's barrier", () => {
  const texts = [
    "Maxed doubler ×2",
    "Bonus per colony defeated",
    "Bonus per monument level",
    "Crop types found",
    "Measurement base bonus",
    "Total of the earlier skills",
    RIFT_WHY,
    "Slab items found ÷ 100 (rounded down)",
    "Tome points above 5000, per 2000 (rounded down)",
    "Class level above 500, per 10 (at least 1)",
    "Total class level of the Warriors",
    "Meals at level 11 or more",
    "World 6 maps with every kill done (13 maps, each character)",
    "Items found in the Slab, in hundreds",
    "max(1, floor((Class level − 500) ÷ 10))",
    "floor(max(0, (Tome points − 5000) ÷ 2000))",
    "Digits of the biggest haul of every tunnel, added up",
  ];
  expect(texts.filter((t) => !isNameText(t))).toEqual([]);
});
