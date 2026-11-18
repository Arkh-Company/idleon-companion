// How much of its maximum a curve reached (spec 008, FR-015a), once the full build-up takes the "Curve: …" row away (spec
// 009, FR-018): the row whose value is the curve's own keeps "x% reached · max …"; a curve times a multiplier says
// nothing (the Vinicius decides later). Rows written by hand, with the recording's shapes.
import { expect, test } from "vitest";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { cond, fixed, kidsOf, placed, recNode } from "./tree-fixture.ts";

const leaf = (name: string, value: number, code: string): Row => ({
  node: row({ pieceKey: code, value, code, name, leaf: "level" }),
  open: null,
});
const CURVE = 'ArbitraryCode5Inputs("decay", 80, 40, 10058, 0, 0)';
const curve = (): Row => ({
  node: row({
    pieceKey: CURVE,
    value: 79.6831055654585,
    code: CURVE,
    name: "Curve: 80 × 10058 ÷ (10058 + 40)",
  }),
  open: null,
  group: [
    fixed("Max bonus of the curve", 80),
    fixed("Level at half of the max", 40),
    leaf("SHIMMERON bubble level", 10058, "CauldronInfo[0][18]"),
  ],
});
const check = (name: string, yes: boolean): Row => {
  const c = cond(name, yes);
  return { ...c, node: { ...c.node, name } };
};
const NODES = Array.from({ length: 6 }, (_, i) =>
  recNode(i, `Call${String(i)}`),
);
const bubble = (value: number, rows: Row[]) => {
  const { rows: top, expand } = placed(
    { 0: rows, 5: [] },
    [
      {
        node: row({
          pieceKey: "b",
          value,
          code: 'CauldronStats("BubbleBonus", 0, 18, 0)',
          name: "SHIMMERON bubble",
          kids: "lazy",
        }),
        open: 0,
      },
    ],
    NODES,
  );
  return expand(top[0]?.id ?? "");
};

test("[FR-015a] a bubble that is no Prisma keeps how much of its max bonus it reached", () => {
  const n = bubble(79.6831055654585, [
    curve(),
    leaf("Level", 10058, "CauldronInfo[0][18]"),
    check("SHIMMERON is Prisma = 0", false),
  ]);
  expect(kidsOf(n).map((k) => k.name)).toContain("Bubble level");
  expect(n?.maxReached?.max).toBe(80);
  expect(n?.maxReached?.share).toBeCloseTo(79.6831055654585 / 80, 9);
});

test("[FR-015a] a bubble times its Prisma multi says no share of a max: its value is no curve's", () => {
  const n = bubble(326.899733289806, [
    {
      node: row({
        pieceKey: "p",
        value: 4.10249739853905,
        code: 'ArcaneType("PrismaBonusMult", 0, 0)',
        name: "Prisma Bubble bonus multi",
        kids: "lazy",
      }),
      open: 5,
    },
    curve(),
    leaf("Level", 10058, "CauldronInfo[0][18]"),
    check("SHIMMERON is Prisma = 1", true),
  ]);
  expect(kidsOf(n).map((k) => k.name)).toContain("Bubble level");
  expect(n?.maxReached).toBeUndefined();
});

test("[FR-015a] a family bonus that is one curve keeps how much of its max it reached", () => {
  const { rows } = placed({}, [
    {
      node: row({
        pieceKey: "f",
        value: 1.3800199800199802,
        code: "DNSM.FamBonusQTYs[66]",
        name: "HIGHER BONUSES FROM GOLDEN FOODS (family bonus)",
      }),
      open: null,
      group: [
        fixed("Max bonus of the curve", 0.4),
        fixed("Level at half of the max", 100),
        leaf("Level the curve uses", 1902, "x"),
      ],
    },
  ]);
  const [n] = rows;
  expect(kidsOf(n).map((k) => k.name)).toContain("Max bonus");
  expect(n?.maxReached?.max).toBeCloseTo(1.4, 9);
  expect(n?.maxReached?.share).toBeCloseTo(0.38001998 / 0.4, 6);
});
