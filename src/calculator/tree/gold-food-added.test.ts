// A worn food added to the bonus, opened as a chain under TreeGoldOf (fake-game.js GoldFoodBonuses, the key added; its
// pools are in gold-food-branch.test.ts): the row inside its one pool is the worn food's, named as in the pass
// (tree/gold-food.ts), never the emporium's (009 T023 r3). Its own file: gold-food-branch.test.ts is at its size.
import { afterEach, expect, test } from "vitest";
import { GAME, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { golden, TABLES } from "./gold-food-fixture.ts";
import { useGameTables } from "./table-names.ts";
import { openPath } from "./tree-fixture.ts";

afterEach(() => {
  useGameTables(new Map());
});

const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];

test("a worn food added to the bonus: the row inside its pool is Equipped: <the food>", () => {
  useGameTables(TABLES);
  const recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
  const build = buildTree(
    recorder.record(golden(999, 0, 2, 5), [["TreeGoldOf", ["added"]]], {
      recompute: [],
      builders: [],
    }),
    0,
    recorder.ops,
  );
  const food = openPath(build, `GoldFoodBonuses("added")`);
  const pools = kidsOf(food).filter((k) => k.role === "pool");
  expect(pools.map((p) => p.name)).toEqual(["Additive pool"]);
  // the pool's rows by system: the worn food's product is the first row of its group
  const [worn] = kidsOf(pools[0]).flatMap(kidsOf);
  expect([worn?.name, worn?.value]).toEqual([
    "Equipped: Invented Charm",
    expect.closeTo(7.212813084112149, 9),
  ]);
});
