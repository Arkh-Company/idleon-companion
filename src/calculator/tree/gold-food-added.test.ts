// A golden food's products named by what their logs measure, opened as a chain under TreeGoldOf (fake-game.js
// GoldFoodBonuses; the pools of its keys are in gold-food-branch.test.ts). The worn food's, whose log takes 1 + its
// quantity, is named as in the pass (tree/gold-food.ts), never the emporium's (009 T023 r3); the emporium's, whose log
// takes 1 + 1e3·10^level, is the emporium's even with the quantity factor N.js gives it too (009 T023 r4). Its own
// file: gold-food-branch.test.ts is at its size.
import { afterEach, beforeAll, expect, test } from "vitest";
import { GAME, PAK } from "../fixtures/fake-mosaic.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { golden, TABLES } from "./gold-food-fixture.ts";
import { useGameTables } from "./table-names.ts";
import { kidsIn, openPath } from "./tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
afterEach(() => {
  useGameTables(new Map());
});

/** The chain's pools of the golden food of `key`, at an emporium level `level`, and its build. */
function poolsOf(key: string, level: number) {
  const build = buildTree(
    recorder.record(golden(999, level, 2, 5), [["TreeGoldOf", [key]]], {
      recompute: [],
      builders: [],
    }),
    0,
    recorder.ops,
  );
  const food = openPath(build, `GoldFoodBonuses(${JSON.stringify(key)})`);
  const rows = kidsIn(food);
  return { build, rows, pools: rows.filter((k) => k.role === "pool") };
}

test("a worn food added to the bonus: the row inside its pool is Equipped: <the food>", () => {
  useGameTables(TABLES);
  const { build, pools } = poolsOf("added", 0);
  expect(pools.map((p) => p.name)).toEqual(["Additive pool"]);
  // the pool's rows by system: the bonus read back, at 0, is its system's group of one source (fix tree-shape-091, rule
  // 1), and the worn food's product, of no system, is the next row, in no group "🔹 Other" (Vinicius, 19/11)
  const [cached, worn] = kidsIn(pools[0]);
  expect([cached?.name, cached?.role, cached?.value]).toEqual([
    "🍔 Golden Food",
    "system",
    0,
  ]);
  expect([worn?.name, worn?.value]).toEqual([
    "Equipped: Invented Charm",
    expect.closeTo(7.212813084112149, 9),
  ]);
  // its quantity factor, 1 + log₁₀(1 + quantity) ÷ 2.14, is math in its ⓘ, no row (19/11): its leaf is the quantity
  const factor = worn?.kids === "lazy" ? build.expand(worn.id) : worn;
  expect(kidsIn(factor).map((k) => [k.name, k.value])).toContainEqual([
    "Quantity",
    999,
  ]);
  expect(kidsIn(factor).map((k) => k.name)).not.toContain(
    "Quantity multiplier",
  );
  expect(worn?.formula).toEqual([
    [
      "Amount of the golden food",
      "×",
      "GFood Multi",
      "×",
      "Base rate",
      "×",
      "log₁₀",
      "(",
      "1",
      "+",
      "Quantity",
      ")",
      "×",
      "(",
      "1",
      "+",
      "log₁₀",
      "(",
      "1",
      "+",
      "Quantity",
      ")",
      "÷",
      "2.14",
      ")",
    ],
    [7, 2.86, 0.05, 1, 999, 1, 1, 999, 2.14, 7.213],
  ]);
});

test("the emporium's product with the quantity factor of its own log, as N.js writes it: Emporium: <its food>", () => {
  useGameTables(TABLES);
  const { build, rows, pools } = poolsOf("njs", 3);
  // the worn food's step is its own × N row, no pool (the rule and answer 2 of 19/11)
  expect(pools.map((p) => p.name)).toEqual(["Multi pool", "Additive pool"]);
  expect(rows[2]?.name).toBe("Equipped: Invented Charm");
  // the emporium's lone + is its own row, no pool (decision of 19/11)
  // 7 × 2.86 × 0.05 × log₁₀(1 + 10^6) × (1 + log₁₀(1 + 10^6) ÷ 2.14)
  const emporium = rows[3];
  expect([emporium?.name, emporium?.value]).toEqual([
    "Beanstalk: Other Dish",
    expect.closeTo(22.845255208907478, 9),
  ]);
  // its factor measures the emporium's level, not a quantity: no Quantity multiplier
  const parts =
    emporium?.kids === "lazy"
      ? kidsIn(build.expand(emporium.id))
      : kidsIn(emporium);
  expect(parts.map((k) => k.name)).toEqual([
    "Amount of the golden food (item table)",
    "GFood Multi",
    "Base rate (× 0.05)",
    "Beanstalk level",
  ]);
});
