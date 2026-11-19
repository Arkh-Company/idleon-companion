// The first level of a tree built from a recording of the invented game is the game's pools (spec 009, FR-001, FR-005,
// FR-008): a root that sums is one Additive pool, a root with a max at the top keeps its rows (all of them in
// "🔹 Other": the invented blocks have no system), and every pool closes to the root.
import { afterEach, beforeAll, expect, test } from "vitest";
import { checkTree } from "../main/tree-check.ts";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { buildTree } from "./tree-build.ts";
import { bootRecorder } from "./tree-record.ts";
import { golden, TABLES } from "./tree/gold-food-fixture.ts";
import { useGameTables } from "./tree/table-names.ts";
import { kidsIn } from "./tree/tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
afterEach(() => {
  useGameTables(new Map());
});

const NONE = { recompute: [], builders: [] };
const treeOf = (block: string) =>
  buildTree(
    recorder.record(mosaicOf(), [[block, [0, 0, 0]]], NONE),
    0,
    recorder.ops,
  ).root;

test("a root that sums is one Additive pool, with no piece, holding its rows", () => {
  const root = treeOf("TreeTwice");
  const [pool, ...rest] = kidsIn(root);
  expect(rest).toEqual([]);
  expect(pool).toMatchObject({
    id: "root/Additive pool",
    name: "Additive pool",
    role: "pool",
    poolKind: "additive",
    combine: "sum",
    pieceKey: null,
    code: null,
    value: 16,
  });
  expect(kidsIn(pool).map((k) => [k.id, k.code, k.value])).toEqual([
    ["root/Additive pool/Game value", "TreeReads()", 8],
    ["root/Additive pool/Game value#2", "TreeReads()", 8],
  ]);
});

test("a root with a max at the top has no pool: its rows, all in Other, stay as they are", () => {
  const root = treeOf("TreeMaxOf");
  expect(kidsIn(root).map((k) => [k.role, k.code, k.value])).toEqual([
    ["piece", "TreeReads()", 8],
    ["piece", "TreeLoop()", 6],
    ["piece", "TreeBase", 4],
  ]);
});

test("every pool closes to the root, and only pools and groups have no piece key", () => {
  for (const block of ["TreeTwice", "TreeSources", "TreeCacheRead"]) {
    const root = treeOf(block);
    const pools = kidsIn(root).filter((k) => k.role === "pool");
    expect(pools.length).toBeGreaterThan(0);
    const [first] = pools;
    const total =
      first?.combine === "sum"
        ? pools.reduce((s, p) => s + Number(p.value), 0)
        : pools.reduce((s, p) => s * Number(p.value), 1);
    expect(total).toBeCloseTo(Number(root.value));
    for (const p of pools) {
      expect(p.pieceKey).toBeNull();
      expect(Object.hasOwn(kidsIn(p)[0] ?? {}, "combine")).toBe(
        kidsIn(p)[0]?.role === "system",
      );
    }
  }
});

// The shape of the Drop Rate's chain (fake-game.js TreeChain): 37 → + 2 (when a flag is on) → × 6 → + 0.5 →
// × (1 + (3 + 80) ÷ 100) → × 3 × 2, each step on the running total (FR-005, rule Y of 17/11); the first sum is the
// working value the root wrote and reads back, a link of the chain: its sources are the first pool's.
test("a root that is a chain of steps gets a pool per run, in the game's order, each closing, and the main takes it", () => {
  const build = buildTree(
    recorder.record(mosaicOf(), [["TreeChain", [0, 0, 0]]], NONE),
    0,
    recorder.ops,
  );
  const root = build.root;
  const level = kidsIn(root);
  expect(
    level.map((k) => [k.name, k.role, k.poolKind, k.combine, k.value]),
  ).toEqual([
    ["Additive pool", "pool", "additive", "sum", 39],
    // the single multiplier alone in its pool is its own × N row, no pool (answer 2 of 19/11)
    ["Game value", "piece", undefined, undefined, 6],
    // the lone + 0.5 between the products is its own row, no pool (decision of 19/11)
    ["Fixed +0.5", "piece", undefined, undefined, 0.5],
    ["Multi pool 1", "pool", "multi", "onePlusPercent", 1.83],
    ["Multi pool 2", "pool", "multi", "product", 6],
    // the check that guards the + 2 stays, after the pools: no source leaves (FR-008)
    ["Game value", "piece", undefined, undefined, 1],
  ]);
  expect(level.map((k) => kidsIn(k).map((r) => [r.code, r.value]))).toEqual([
    [
      ["TreeReads()", 8],
      ["TreeBase", 4],
      ["TreeLevel", 25],
      [null, 2],
    ],
    [],
    [],
    [
      ["TreeStats.a", 3],
      ["TreeCapped", 80],
    ],
    [
      ["TreeTwins[0]", 3],
      ["TreeList[1]", 2],
    ],
    [],
  ]);
  expect(root.formula).toEqual([
    [
      "(",
      "Additive pool",
      "×",
      "TreeLoop()",
      "+",
      "Fixed +0.5",
      ")",
      "×",
      "Multi pool 1",
      "×",
      "Multi pool 2",
    ],
    [39, 6, 0.5, 1.83, 6, 2574.81],
  ]);
  // a call of the sum still opens inside its pool
  // the single multiplier is the source itself, shown as × N
  expect([level[1]?.code, level[1]?.fmt]).toEqual(["TreeLoop()", "x"]);
  const [reads] = kidsIn(level[0]);
  expect(
    kidsIn(reads?.kids === "lazy" ? build.expand(reads.id) : reads).map((r) => [
      r.code,
      r.value,
    ]),
  ).toEqual([
    ["TreeStats.a", 3],
    ["TreeStats.b", 5],
  ]);
  expect(checkTree(root, 100)).not.toBeNull();
});

test("a chain keeps after its pools the rows no step of it shows: the block's data rows, as any block's (FR-008)", () => {
  // (TreeBase + 1) × TreeArg(TreeLevel): the level the call took is a data row of the block
  const level = kidsIn(treeOf("TreeChainData"));
  expect(level.map((k) => [k.name, k.role, k.value])).toEqual([
    ["Additive pool", "pool", 5],
    // the single multiplier alone in its pool is its own × N row, no pool (answer 2 of 19/11): the call, with no name
    // of its own yet
    ["Game value", "piece", 100],
    [expect.any(String), "piece", 25],
  ]);
  expect([level[1]?.code, level[1]?.fmt]).toEqual(["TreeArg(25)", "x"]);
  expect(level[2]?.code).toBe("TreeLevel");
});

// The shape of the Drop Rate's first sum (fake-game.js TreeDrop, FR-017): TreeBase + a step kept in a variable, of
// ArcadeBonus(0), CardBonusREAL(3), CardBonusREAL(1) and a working value the block wrote, the golden food + TreeLevel;
// then × TreeLoop(). The golden food: its worn food 7.213 and its emporium's 6.006 (gold-food.test.ts).
test("a Drop-Rate-shaped chain: its Additive pool shows the system groups, the golden food among them, which opens as its own chain", () => {
  // the foods' invented texts, which name the golden food's rows (tree/gold-food.ts)
  useGameTables(TABLES);
  const build = buildTree(
    recorder.record(golden(999, 3, 2, 5), [["TreeDrop", [0, 0, 0]]], NONE),
    0,
    recorder.ops,
  );
  const [add, multi] = kidsIn(build.root);
  // the single multiplier alone in its pool is its own × N row, no pool (answer 2 of 19/11)
  expect([add?.name, multi?.role, multi?.code]).toEqual([
    "Additive pool",
    "piece",
    "TreeLoop()",
  ]);
  const groups = kidsIn(add);
  expect(
    groups.map((k) => [k.role === "system" ? k.name : k.code, k.value]),
  ).toEqual([
    ["🃏 Cards", 16],
    ["ArcadeBonus(0)", 8],
    ['GoldFoodBonuses("DropRatez")', expect.closeTo(13.218813518840708, 9)],
    ["🔹 Other", 29],
  ]);
  expect(groups.map((g) => kidsIn(g).map((k) => k.code))).toEqual([
    ["CardBonusREAL(3)", "CardBonusREAL(1)"],
    [],
    [],
    ["TreeBase", "TreeLevel"],
  ]);
  // every level closes: the groups to the pool, each group's sources to it (FR-008)
  const sum = (ns: readonly CalcTreeNode[]) =>
    ns.reduce((s, k) => s + Number(k.value), 0);
  expect(sum(groups)).toBeCloseTo(Number(add?.value), 9);
  for (const g of groups.filter((k) => k.role === "system"))
    expect(sum(kidsIn(g))).toBeCloseTo(Number(g.value), 9);
  // the golden food opens with its own chain's pools, its block's own rows after them
  const gold = groups[2];
  const opened = gold?.kids === "lazy" ? build.expand(gold.id) : gold;
  expect(
    kidsIn(opened)
      .slice(0, 4)
      .map((k) => [k.role, k.name, k.code, k.poolKind, k.value]),
  ).toEqual([
    ["pool", "Multi pool", null, "multi", expect.closeTo(1.3, 9)],
    ["pool", "Additive pool", null, "additive", expect.closeTo(2.2, 9)],
    // the worn food's step is one row, its own × N, no pool (the rule and answer 2 of 19/11)
    [
      "piece",
      "Equipped: Invented Charm",
      null,
      undefined,
      expect.closeTo(7.212813084112149 / 2.86, 9),
    ],
    // the emporium's lone + is its own row, no pool (decision of 19/11)
    [
      "piece",
      "Beanstalk: Other Dish",
      null,
      undefined,
      expect.closeTo(6.006000434728559, 9),
    ],
  ]);
  expect(checkTree(build.root, 100)).not.toBeNull();
  expect(checkTree(opened, 100)).not.toBeNull();
});

// The Drop Rate's first sum as the game writes it (fake-game.js TreeDropPercent, FR-017): TreeBase + (ArcadeBonus(0) +
// CardBonusREAL(3) + CardBonusREAL(1) + 5 × TreeLevel + a working value the block wrote, the golden food + TreeLevel)
// ÷ 100 + 2; then × TreeLoop(). The bonuses in % go by system in % groups, the golden food among them.
test("a Drop-Rate-shaped chain whose bonuses in % the game divides by 100: its Additive pool shows the systems in %, and every level closes", () => {
  // the foods' invented texts, which name the golden food's rows (tree/gold-food.ts)
  useGameTables(TABLES);
  const build = buildTree(
    recorder.record(
      golden(999, 3, 2, 5),
      [["TreeDropPercent", [0, 0, 0]]],
      NONE,
    ),
    0,
    recorder.ops,
  );
  const [add] = kidsIn(build.root);
  const groups = kidsIn(add);
  const gold = 13.218813518840708;
  expect(
    groups.map((k) => [k.name, k.role, k.combine, k.fmt, k.value]),
  ).toEqual([
    ["🃏 Cards", "system", "percent", "%", expect.closeTo(0.16, 9)],
    // a system of one source in % shows the source, +N% (FR-006, decision of 19/11), by its name
    ["Base Damage", "piece", undefined, "%", 8],
    [
      "Golden Food bonus (Drop Rate)",
      "piece",
      undefined,
      "%",
      expect.closeTo(gold, 9),
    ],
    // TreeBase, alone in Other once the constant left the group (T027)
    ["Game value", "piece", undefined, null, 4],
    ["🔹 Other", "system", "percent", "%", expect.closeTo(1.5, 9)],
    // the constant of the game's math, its own row after the groups (T027)
    ["Fixed +2", "piece", undefined, null, 2],
  ]);
  expect([groups[1]?.code, groups[2]?.code]).toEqual([
    "ArcadeBonus(0)",
    'GoldFoodBonuses("DropRatez")',
  ]);
  // every level closes with the game's value: the groups to the pool, each group's bonuses ÷ 100 or sum to it; a
  // source in % alone in the pool adds a hundredth of its value, as the pool's ⓘ says
  const sum = (ns: readonly CalcTreeNode[]) =>
    ns.reduce((s, k) => s + Number(k.value), 0);
  const added = (k: CalcTreeNode) =>
    Number(k.value) / (k.role === "piece" && k.fmt === "%" ? 100 : 1);
  expect(groups.reduce((s, k) => s + added(k), 0)).toBeCloseTo(
    Number(add?.value),
    9,
  );
  const f = add?.formula;
  const names = Array.isArray(f) ? f[0].join(" ") : (f?.rule[0] ?? "");
  // the two lone sources in % and the two groups in %, each in its row's unit with its ÷ 100
  expect(names.split("÷ 100").length - 1).toBe(4);
  expect(Number(add?.value)).toBeCloseTo(
    4 + (8 + 16 + 125 + gold + 25) / 100 + 2,
    9,
  );
  for (const g of groups.filter((k) => k.role === "system"))
    expect(sum(kidsIn(g)) / (g.combine === "percent" ? 100 : 1)).toBeCloseTo(
      Number(g.value),
      9,
    );
  // the golden food, its system's one source, opens as its own chain
  const food = groups[2];
  expect(food?.code).toBe('GoldFoodBonuses("DropRatez")');
  const opened = food?.kids === "lazy" ? build.expand(food.id) : food;
  expect(
    kidsIn(opened)
      .slice(0, 4)
      .map((k) => [k.role, k.name, k.code, k.fmt]),
  ).toEqual([
    ["pool", "Multi pool", null, "x"],
    ["pool", "Additive pool", null, null],
    // the worn food's step is its own × N row, no pool (the rule and answer 2 of 19/11)
    ["piece", "Equipped: Invented Charm", null, "x"],
    // the emporium's lone + is its own row, no pool (decision of 19/11)
    ["piece", "Beanstalk: Other Dish", null, "+"],
  ]);
  expect(checkTree(build.root, 200)).not.toBeNull();
  expect(checkTree(opened, 100)).not.toBeNull();
});

test("a chain a step of which neither adds nor multiplies is open: the build says so, for the log (NFR-005)", () => {
  const build = (block: string) =>
    buildTree(
      recorder.record(mosaicOf(), [[block, [0, 0, 0]]], NONE),
      0,
      recorder.ops,
    );
  const open = build("TreeChainOpen");
  expect([open.chainOpen, open.root.value]).toEqual([true, 9]);
  // the tree is still built, from the rows
  expect(kidsIn(open.root).length).toBeGreaterThan(0);
  expect(build("TreeChain").chainOpen).toBe(false);
});
