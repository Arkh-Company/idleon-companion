// The full build-up of a bonus (spec 009, FR-018, decision of 18/11): the level that enters the math is a row with the ⓘ
// of its sum, the curve is in the ⓘ with its constants named by their role, a constant is a row only when it is the
// bonus the game's screen shows, branch checks are never rows, and each multiplier is its own × row. Rows written by
// hand, with the shapes the recording gives (pesquisa-contas.md: Haungry For Gold, Midusian Appetite, Shimmeron,
// Emoji Veggie, Domeo Magmus), each call by its number among `nodes`.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { RecNode } from "../recording.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { check, fixed, kidsIn, leaf, placed, recNode } from "./tree-fixture.ts";

const lazy = (name: string, open: number, value: number, code: string) => ({
  node: row({ pieceKey: code, value, code, name, kids: "lazy" as const }),
  open,
});
const branch = (name: string, value: number, group: Row[]): Row => ({
  node: row({ pieceKey: null, value, code: null, name }),
  open: null,
  group,
});
const brief = (kids: readonly CalcTreeNode[]) =>
  kids.map((k) => [k.name, k.value, k.leaf]);
const lines = (n: CalcTreeNode | null | undefined) =>
  n?.formula ? formulaLines(n.formula) : null;

/** The row `top` placed and opened, over `nodes` and the calls' `levels`. */
function opened(
  nodes: RecNode[],
  levels: Record<number, Row[]>,
  top: Row,
): CalcTreeNode | null {
  const { rows, expand } = placed(levels, [top], nodes);
  return expand(rows[0]?.id ?? "");
}

const TALENT = [
  recNode(0, "GetTalentNumber", {
    a: [1, 99],
    v: 49.187582562747686,
    c: [1, 2],
  }),
  recNode(1, "ArbitraryCode5Inputs", {
    a: ["decay", 55, 80, 677, 0, 0],
    v: 49.187582562747686,
  }),
  recNode(2, "RunCodeOfTypeXforThingY", { a: ["AllTalentLV", "99"], v: 268 }),
];
const ALL_TAL = 'RunCodeOfTypeXforThingY("AllTalentLV", "99")';
const talentLevel = [
  lazy("All-talent levels", 2, 268, ALL_TAL),
  leaf("Level", 409, "SkillLevels[99]", "investedPoints"),
  check("Level ≤ 0", false),
  check("Dungeon map > 0", false),
];

test("[FR-018] a talent: its Talent level (Points invested + All-talent levels) and the curve's two constants, the curve in the ⓘ", () => {
  const n = opened(
    TALENT,
    { 0: talentLevel, 2: [leaf("Rift Slug", 268, "Companions(1)", null)] },
    lazy("Haungry For Gold", 0, 49.187582562747686, "GetTalentNumber(1, 99)"),
  );
  expect(brief(kidsIn(n))).toEqual([
    ["Talent level", 677, null],
    ["Max bonus", 55, "fixedValue"],
    ["Level at half", 80, "fixedValue"],
  ]);
  expect(lines(n)).toMatchObject({
    names: "Max bonus × Talent level ÷ (Talent level + Level at half)",
    numbers: "55 × 677 ÷ (677 + 80) = 49.2",
  });
  const [level] = kidsIn(n);
  expect(brief(kidsIn(level))).toEqual([
    ["Points invested", 409, "investedPoints"],
    ["All-talent levels", 268, null],
  ]);
  expect(lines(level)).toMatchObject({
    names: "Points invested + All-talent levels",
    numbers: "409 + 268 = 677",
  });
  expect(n && checkTree(n, 10)).not.toBeNull();
});

test("[FR-018] a talent in a dungeon: its Talent level is the dungeon's 50, with no All-talent levels", () => {
  const n = opened(
    [
      recNode(0, "GetTalentNumber", { a: [1, 5], v: 5, c: [1] }),
      recNode(1, "ArbitraryCode5Inputs", { a: ["bigBase", 0, 0.1, 50], v: 5 }),
    ],
    {
      0: [
        leaf("Level", 3, "SkillLevels[5]", "investedPoints"),
        check("Dungeon map > 0", true),
      ],
    },
    lazy("Some Talent", 0, 5, "GetTalentNumber(1, 5)"),
  );
  expect(brief(kidsIn(n))).toEqual([
    ["Talent level (in a dungeon)", 50, "fixedValue"],
    ["Start value", 0, "fixedValue"],
    ["Bonus per level", 0.1, "fixedValue"],
  ]);
  expect(lines(n)).toMatchObject({
    names: "Start value + Bonus per level × Talent level (in a dungeon)",
  });
});

test("[FR-018] a talent whose curve does not take its points and All-talent levels keeps its rows", () => {
  const n = opened(
    TALENT,
    {
      0: [
        talentLevel[0] as Row,
        leaf("Level", 400, "SkillLevels[99]", "investedPoints"),
      ],
    },
    lazy("Haungry For Gold", 0, 49.187582562747686, "GetTalentNumber(1, 99)"),
  );
  expect(kidsIn(n).map((k) => k.name)).toEqual(["All-talent levels", "Level"]);
});

test("[FR-018] a Legend Talent: its Points and its Bonus per point, the round in the ⓘ", () => {
  const n = opened(
    [
      recNode(0, "Thingies", {
        a: ["LegendPTS_bonus", 25, 0],
        v: 1500,
        r: [
          ["Spelunk[18][25]", 3],
          ["CustomLists.LegendTalents[25][2]", 500],
        ],
      }),
    ],
    { 0: [leaf("Level", 3, "Spelunk[18][25]", "level")] },
    lazy("Midusian Appetite", 0, 1500, 'Thingies("LegendPTS_bonus", 25, 0)'),
  );
  expect(brief(kidsIn(n))).toEqual([
    ["Points", 3, "level"],
    ["Bonus per point", 500, "fixedValue"],
  ]);
  expect(lines(n)).toMatchObject({
    names: "round(Points × Bonus per point)",
    numbers: "round(3 × 500) = 1,500",
  });
});

const CURVE = 'ArbitraryCode5Inputs("decay", 80, 40, 10058, 0, 0)';
const bubbleLevel = (prisma: boolean): Row[] => [
  ...(prisma
    ? [
        lazy(
          "Prisma Bubble bonus multi",
          5,
          4.10249739853905,
          'ArcaneType("PrismaBonusMult", 0, 0)',
        ),
      ]
    : []),
  {
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
      leaf("SHIMMERON bubble level", 10058, "CauldronInfo[0][18]", "level"),
    ],
  },
  leaf("Level", 10058, "CauldronInfo[0][18]", "level"),
  check(`SHIMMERON is Prisma = ${prisma ? "1" : "0"}`, prisma),
];
const BUBBLE = 'CauldronStats("BubbleBonus", 0, 18, 0)';
const bubbleNodes = Array.from({ length: 6 }, (_, i) =>
  recNode(i, `Call${String(i)}`),
);

test("[FR-018] a bubble: its level, the curve's constants and the Prisma multi, the curve in the ⓘ with no Curve row", () => {
  const n = opened(
    bubbleNodes,
    {
      0: bubbleLevel(true),
      5: [leaf("Pinnacle of Prisma", 12, "Arcane[45]", "level")],
    },
    lazy("SHIMMERON bubble", 0, 326.899733289806, BUBBLE),
  );
  expect(brief(kidsIn(n))).toEqual([
    ["Bubble level", 10058, "level"],
    ["Max bonus", 80, "fixedValue"],
    ["Level at half", 40, "fixedValue"],
    ["Prisma Bubble bonus multi", 4.10249739853905, null],
  ]);
  expect(lines(n)).toMatchObject({
    // the curve alone reached 79.68 of its max 80 (decision of 18/11): said in the ⓘ, which is then a rule
    names:
      "Max bonus × Bubble level ÷ (Bubble level + Level at half) × Prisma Bubble bonus multi (the curve is at 99.6% of its max 80)",
    numbers: "80 × 10058 ÷ (10058 + 40) × 4.102 = 326.9",
  });
});

test("[FR-018] a bubble that is no Prisma: its level and the curve's constants, and no check", () => {
  const n = opened(
    bubbleNodes,
    { 0: bubbleLevel(false) },
    lazy("SHIMMERON bubble", 0, 79.6831055654585, BUBBLE),
  );
  expect(kidsIn(n).map((k) => k.name)).toEqual([
    "Bubble level",
    "Max bonus",
    "Level at half",
  ]);
  expect(lines(n)?.names).toBe(
    "Max bonus × Bubble level ÷ (Bubble level + Level at half)",
  );
});

test("[FR-018] a bubble times its class's bubble: Bubble bonus × the class multi", () => {
  const n = opened(
    bubbleNodes,
    {
      1: [
        lazy("SHIMMERON bubble", 2, 326.899733289806, BUBBLE),
        // the cache's step wraps the class's bubble in a branch of its one row, as the recording gives it
        branch("Multiplier", 12.288666491695809, [
          lazy(
            "Warriors Rule bubble",
            3,
            12.288666491695809,
            "DNSM.AlchBubbles.Opassz",
          ),
        ]),
      ],
    },
    lazy("Shimmeron bubble", 1, 4017.161798622736, "DNSM.AlchBubbles.GFoodz"),
  );
  expect(kidsIn(n).map((k) => k.name)).toEqual([
    "Bubble bonus",
    "Warriors Rule multi",
  ]);
  expect(lines(n)).toMatchObject({
    names: "Bubble bonus × Warriors Rule multi",
    numbers: "327 × 12.3 = 4,017",
  });
});

const SIGIL_NODES = [
  recNode(0, "Labb", { a: ["SigilBonus", "Blank", 14, 0], v: 640 }),
  recNode(1, "Sailing", { a: ["ArtifactBonus", 16, 0], v: 7 }),
  recNode(2, "Summoning2", { a: ["MeritocBonusz", 21, 0], v: 0 }),
];
const sigilLevel: Row[] = [
  leaf(
    "Sigil bonus at its current tier",
    80,
    "CustomLists.SigilDesc[14][12]",
    "fixedValue",
  ),
  branch("Chilled Yarn", 8, [
    fixed("Base 1", 1),
    lazy("Chilled Yarn", 1, 7, 'Sailing("ArtifactBonus", 16, 0)'),
  ]),
  branch("Multiplier", 1, [
    fixed("Base 1", 1),
    lazy(
      "All of your Sigils give x higher bonuses than normal",
      2,
      0,
      'Summoning2("MeritocBonusz", 21, 0)',
    ),
    fixed("Percent to number (÷ 100)", 100),
  ]),
  leaf("Sigil level", 4, "CauldronP2W[4][29]", "level"),
  ...[-0.1, 0.5, 1.5, 2.5, 3.5].map((x) =>
    check(`Sigil level < ${String(x)}`, false),
  ),
];

test("[FR-018] a sigil: its tier, the Bonus at tier and each multiplier as its own row, with no tier ladder", () => {
  const n = opened(
    SIGIL_NODES,
    {
      0: sigilLevel,
      1: [
        leaf("Artifact 16", 1, "CustomLists.ArtifactInfo[16][3]", null),
        branch("Multiplier", 7, [fixed("Fixed ×7", 7)]),
      ],
      2: [check("Meritocracy vote of the week = 21", false)],
    },
    lazy("Emoji Veggie", 0, 640, 'Labb("SigilBonus", "Blank", 14, 0)'),
  );
  expect(brief(kidsIn(n))).toEqual([
    ["Sigil tier", 4, "tier"],
    ["Bonus at tier", 80, "fixedValue"],
    ["Chilled Yarn multi", 8, null],
    ["Meritocracy multi", 1, null],
  ]);
  expect(lines(n)).toMatchObject({
    names: "Bonus at tier × Chilled Yarn multi × Meritocracy multi",
    numbers: "80 × 8 × 1 = 640",
  });
  const [, , yarn, merit] = kidsIn(n);
  expect(brief(kidsIn(yarn))).toEqual([
    ["Artifact base", 1, "fixedValue"],
    ["Rarity multiplier", 7, "tier"],
  ]);
  expect(lines(yarn)).toMatchObject({
    names: "1 + Artifact base × Rarity multiplier",
    numbers: "1 + 1 × 7 = 8",
  });
  // the code's "Base 1" and "÷ 100" are in the ⓘ only; the vote bonus opens into its own rows
  expect(kidsIn(merit).map((k) => k.name)).toEqual([
    "All of your Sigils give x higher bonuses than normal",
  ]);
  expect(lines(merit)?.numbers).toBe("1 + 0 ÷ 100 = 1");
});

const CARD = 'RunCodeOfTypeXforThingY("CardLv", "mini5a")';
const cardLevel = (v: number, cap: boolean): Row[] => [
  fixed("× 1.5", 1.5),
  lazy("Domeo Magmus", 1, v, CARD),
  ...(cap ? [fixed("Cap 10", 10)] : []),
];

test("[FR-018] a card with a cap: its Card level and its Bonus per level as rows, the cap in the ⓘ, which says it is capped", () => {
  const { rows } = placed(
    { 1: [leaf("Cards collected", 1729928, "Cards[0].mini5a", "quantity")] },
    [branch("Domeo Magmus", 10, cardLevel(7, true))],
  );
  const [n] = rows;
  expect(brief(kidsIn(n))).toEqual([
    ["Card level", 7, null],
    ["Bonus per level", 1.5, "fixedValue"],
  ]);
  expect(lines(n)).toMatchObject({
    names: "min(Bonus per level × Card level, Cap)",
    numbers: "min(1.5 × 7, 10) = 10 (capped)",
  });
});

test("[FR-018] a card under its cap: the ⓘ has no (capped)", () => {
  const { rows } = placed({}, [branch("Domeo Magmus", 6, cardLevel(4, true))]);
  expect(lines(rows[0])?.numbers).toBe("min(1.5 × 4, 10) = 6");
});

test("[FR-018] a check of a row beside it is in the ⓘ only, never a row; a constant of the code stays (decision pending)", () => {
  const { rows } = placed({}, [
    branch("Some bonus", 12, [
      fixed("× 2", 2),
      leaf("Bonus level", 6, "Stats.lv", "level"),
      check("Bonus level > 0", true),
    ]),
  ]);
  const [n] = rows;
  expect(kidsIn(n).map((k) => k.name)).toEqual(["× 2", "Bonus level"]);
  expect(lines(n)?.names).toContain("Bonus level > 0");
});

test("[FR-018] a check stays a row when the level has no ⓘ to say it", () => {
  const { rows } = placed({}, [
    branch("Some bonus", 99, [
      leaf("Bonus level", 6, "Stats.lv", "level"),
      leaf("Other level", 7, "Stats.other", "level"),
      check("Bonus level > 0", false),
    ]),
  ]);
  expect(rows[0]?.formula).toBeNull();
  expect(kidsIn(rows[0]).map((k) => k.name)).toEqual([
    "Bonus level",
    "Other level",
    "Bonus level > 0",
  ]);
});
