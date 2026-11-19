// A row that is a curve itself (spec 009, FR-018, decision of 18/11: the curve's constants by their role), as the
// family bonus of FamBonusQTYs[66], and the Prisma multi with the weights of its sources (N.js ArcaneType
// "PrismaBonusMult": min(5, 2 + (… + 0.2 × purple sigils + … + 50 × Rift Hivemind) ÷ 100)). Rows written by hand.
import { expect, test } from "vitest";
import { makePlaces } from "./places.ts";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { fixed, placed, recNode } from "./tree-fixture.ts";

const leaf = (
  name: string,
  value: number,
  code: string | null,
  kind: Row["node"]["leaf"] = null,
): Row => ({
  node: row({ pieceKey: code, value, code, name, leaf: kind }),
  open: null,
});
const branch = (
  name: string,
  value: number,
  group: Row[],
  code: string | null = null,
): Row => ({
  node: row({ pieceKey: code, value, code, name }),
  open: null,
  group,
});
const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
const lines = (n: CalcTreeNode | null | undefined) =>
  n?.formula ? formulaLines(n.formula) : null;

test("[FR-018] a row that is a curve has the curve's constants by their role, and the curve in its ⓘ", () => {
  const { rows } = placed({}, [
    branch(
      "HIGHER BONUSES FROM GOLDEN FOODS (family bonus)",
      1.3800199800199802,
      [
        fixed("Max bonus of the curve", 0.4),
        fixed("Level at half of the max", 100),
        leaf("Level the curve uses", 1902, null, "level"),
      ],
      "DNSM.FamBonusQTYs[66]",
    ),
  ]);
  const [n] = rows;
  expect(kidsOf(n).map((k) => [k.name, k.value])).toEqual([
    ["Max bonus", 0.4],
    ["Level at half", 100],
    ["Level the curve uses", 1902],
  ]);
  expect(lines(n)?.names).toBe(
    "1 + Max bonus × Level the curve uses ÷ (Level the curve uses + Level at half)",
  );
});

const PRISMA = 'ArcaneType("PrismaBonusMult", 0, 0)';
const prismaRows = (hivemind: number): Row[] => [
  leaf("Pinnacle of Prisma", 12, 'ArcaneType("ArcaneUpgBonus", 45, 0)'),
  leaf("Arcade: Prisma Bonuses", 20.09950248756219, "ArcadeBonus(54)"),
  leaf("Tobo Tamago", 1, 'SushiStuff("RoG_BonusQTY", 23, 0)'),
  leaf("Bowling Pin", 1, 'JellyOperation("RoG_BonusQTY", 36, 0)'),
  leaf("Heroic Spirit owned", 10, 'Thingies("HaveW6Trophy", 0, 0)'),
  leaf("Violet", 60.54545454545455, 'GamingStatType("PaletteBonus", 28, 0)'),
  leaf("Sigils at purple tier", 24, 'Labb("TotalPurpleSigils", "0", 0, 0)'),
  leaf(
    "Prisma Petal",
    1.8047828208882382,
    'FarmingStuffs("ExoticBonusQTY", 48, 0)',
  ),
  leaf("Wowa Woowa", 24, 'Thingies("LegendPTS_bonus", 36, 0)'),
  leaf("Rift Hivemind", hivemind, "Companions(88)"),
];
/** 2 + (12 + 20.0995 + 1 + 1 + 10 + 60.545 + 0.2 × 24 + 1.8048 + 24 + 50 × 1.5) ÷ 100 */
const PRISMA_V =
  2 +
  (12 +
    20.09950248756219 +
    1 +
    1 +
    10 +
    60.54545454545455 +
    0.2 * 24 +
    1.8047828208882382 +
    24 +
    50 * 1.5) /
    100;

test("[FR-018] the Prisma multi: its sources with their weights in the ⓘ, and its cap of 5", () => {
  const { rows } = placed({}, [
    branch("Prisma Bubble bonus multi", PRISMA_V, prismaRows(1.5), PRISMA),
  ]);
  const [n] = rows;
  expect(kidsOf(n)).toHaveLength(10);
  expect(n?.formula && formulaLines(n.formula)).toMatchObject({
    names:
      "min(5, 2 + (Pinnacle of Prisma + Arcade: Prisma Bonuses + Tobo Tamago + Bowling Pin + Heroic Spirit owned + Violet + 0.2 × Sigils at purple tier + Prisma Petal + Wowa Woowa + 50 × Rift Hivemind) ÷ 100)",
  });
});

test("[FR-018] a Prisma multi at its cap of 5 keeps its ⓘ, the min giving the cap", () => {
  const { rows } = placed({}, [
    branch("Prisma Bubble bonus multi", 5, prismaRows(10), PRISMA),
  ]);
  expect(lines(rows[0])).toMatchObject({ result: "5" });
  expect(lines(rows[0])?.numbers).toMatch(/^min\(5, 2 \+ /);
});

test("[FR-018] a cache whose one row is the curve block keeps its own name, and the curve's constants by their role", () => {
  const curve = branch(
    "Curve: 1 + 0.4 × 1902 ÷ (1902 + 100)",
    1.3800199800199802,
    [
      fixed("Max bonus of the curve", 0.4),
      fixed("Level at half of the max", 100),
      leaf("Level the curve uses", 1902, null, "level"),
    ],
    'ArbitraryCode5Inputs("decayMulti", 0.4, 100, 1902, 0, 0)',
  );
  const { rows } = placed({ 1: [curve] }, [
    {
      node: row({
        pieceKey: "DNSM.FamBonusQTYs[66]",
        value: 1.3800199800199802,
        code: "DNSM.FamBonusQTYs[66]",
        name: "HIGHER BONUSES FROM GOLDEN FOODS (family bonus)",
        kids: "lazy",
      }),
      open: 1,
    },
  ]);
  expect(kidsOf(rows[0]).map((k) => k.name)).toEqual([
    "Max bonus",
    "Level at half",
    "Level the curve uses",
  ]);
});

test("[FR-018] a cache opened into its writer's curve has the curve's constants by role, the row placed by its own name", () => {
  // a game cache whose writer computed it as one curve (the family bonus TalentCalc fills): the cache opens into the
  // writer's rows, the curve block's branch, and its level's row is that branch, "Curve: …" (tree/places.ts `below`)
  const v = 1 + (0.4 * 1902) / (1902 + 100);
  const CODE = 'ArbitraryCode5Inputs("decayMulti", 0.4, 100, 1902, 0, 0)';
  const curve = branch(
    "Curve: 1 + 0.4 × 1902 ÷ (1902 + 100)",
    v,
    [
      fixed("Max bonus of the curve", 0.4),
      fixed("Level at half of the max", 100),
      leaf("Level the curve uses", 1902, null, "level"),
    ],
    CODE,
  );
  const places = makePlaces({
    nodes: [recNode(0, "TalentCalc", { a: [-3] })],
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: () => null,
    opened: () => ({ rows: [curve], f: null }),
  });
  const [fam] = places.place(
    { id: "root", code: "Root()" },
    [
      {
        node: row({
          pieceKey: "f",
          value: v,
          code: "DNSM.FamBonusQTYs[66]",
          name: "HIGHER BONUSES FROM GOLDEN FOODS (family bonus)",
          kids: "lazy",
        }),
        open: {
          path: "DNSM.FamBonusQTYs[66]",
          value: v,
          writer: 0,
          entry: null,
          opening: [],
        },
      },
    ],
    1,
    [],
  );
  expect(kidsOf(fam).map((k) => k.name)).toEqual([
    "Max bonus",
    "Level at half",
    "Level the curve uses",
  ]);
});
