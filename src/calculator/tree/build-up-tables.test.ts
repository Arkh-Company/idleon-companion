// The build-up's numbers read from a game table the boot checked by its hash (spec 009, FR-018; the mockup of 18/11):
// a sigil's tier says the bonus of each tier (N.js Labb "SigilBonus": the ladder picks the columns 3, 4, 8, 10 and 12 of
// SigilDesc), and a Legend Talent's Points say their max (LegendTalents[i][1]). The tables hold only the cells read,
// with the game's text.
import { afterEach, expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { list } from "./state-fixture.ts";
import { useGameTables } from "./table-names.ts";
import { kidsOf, placed, recNode } from "./tree-fixture.ts";

afterEach(() => {
  useGameTables(new Map());
});

const leaf = (
  name: string,
  value: number,
  code: string,
  kind: Row["node"]["leaf"],
): Row => ({
  node: row({ pieceKey: code, value, code, name, leaf: kind }),
  open: null,
});
const lazy = (name: string, value: number, code: string): Row => ({
  node: row({ pieceKey: code, value, code, name, kids: "lazy" }),
  open: 0,
});
const TABLES = new Map<string, unknown>([
  [
    "CustomLists.SigilDesc",
    list({
      14: [
        "EMOJI_VEGGIE",
        "",
        "",
        "10",
        "25",
        "filler",
        "",
        "",
        "40",
        "",
        "60",
        "",
        "80",
      ],
    }),
  ],
  [
    "CustomLists.LegendTalents",
    list({ 25: ["Midusian_Appetite", "3", "500"] }),
  ],
]);

test("[FR-018] a sigil's tier says the bonus of each tier, the ladder's columns of the table", () => {
  useGameTables(TABLES);
  const { rows, expand } = placed(
    {
      0: [
        leaf(
          "Sigil bonus at its current tier",
          80,
          "CustomLists.SigilDesc[14][12]",
          "fixedValue",
        ),
        leaf("Sigil level", 4, "CauldronP2W[4][29]", "level"),
      ],
    },
    [lazy("Emoji Veggie", 80, 'Labb("SigilBonus", "Blank", 14, 0)')],
    [recNode(0, "Labb", { a: ["SigilBonus", "Blank", 14, 0], v: 80 })],
  );
  const [tier] = kidsOf(expand(rows[0]?.id ?? ""));
  expect(tier?.name).toBe("Sigil tier");
  expect(tier?.formula && formulaLines(tier.formula)).toMatchObject({
    names: "tiers: 10 / 25 / 40 / 60 / 80",
    numbers: "tier 4 → 80",
  });
});

/**
 * A Legend Talent opened, its max the game's own call (N.js Thingies "LegendTalent_MaxLV", recorded beside the root): the
 * call's value `max`, the table's max `base` it read, and its rows `maxRows` (what the game added to the table's max).
 */
function legend(
  t: number,
  points: number,
  per: number,
  [max, base]: [number, number],
  maxRows: Row[],
) {
  const { rows, expand } = placed(
    {
      0: [leaf("Level", points, `Spelunk[18][${String(t)}]`, "level")],
      1: maxRows,
    },
    [
      lazy(
        "Legend Talent",
        Math.round(points * per),
        `Thingies("LegendPTS_bonus", ${String(t)}, 0)`,
      ),
    ],
    [
      recNode(0, "Thingies", {
        a: ["LegendPTS_bonus", t, 0],
        v: Math.round(points * per),
        r: [[`CustomLists.LegendTalents[${String(t)}][2]`, per]],
      }),
      recNode(1, "Thingies", {
        a: ["LegendTalent_MaxLV", t, 0],
        v: max,
        r: [[`CustomLists.LegendTalents[${String(t)}][1]`, String(base)]],
      }),
    ],
  );
  return kidsOf(expand(rows[0]?.id ?? ""));
}

test("[FR-018] a Legend Talent's Points say their max, the game's max level of the talent (the table's alone)", () => {
  // Midusian Appetite: no Research grid bonus nor the Menagerie raises its max
  expect(legend(25, 3, 500, [3, 3], [])[0]?.name).toBe("Points (max 3)");
});

test("[FR-018] a Legend Talent whose max the Menagerie raises says the game's max", () => {
  // Wowa Woowa: the table's 5, and 3 more with the Menagerie's unlock 19
  const menagerie: Row = {
    node: row({
      pieceKey: "m",
      value: 1,
      code: 'MenagerieStuff("UnlockOwned", 19, 0)',
      name: "Menagerie unlock 19",
    }),
    open: null,
  };
  expect(legend(36, 8, 3, [8, 5], [menagerie])[0]?.name).toBe("Points (max 8)");
});

test("[FR-018] a sigil's tier whose table bonus is not the bonus at its tier says no tiers", () => {
  useGameTables(TABLES);
  const { rows, expand } = placed(
    {
      0: [
        leaf(
          "Sigil bonus at its current tier",
          75,
          "CustomLists.SigilDesc[14][12]",
          "fixedValue",
        ),
        leaf("Sigil level", 4, "CauldronP2W[4][29]", "level"),
      ],
    },
    [lazy("Emoji Veggie", 75, 'Labb("SigilBonus", "Blank", 14, 0)')],
    [recNode(0, "Labb", { a: ["SigilBonus", "Blank", 14, 0], v: 75 })],
  );
  const [tier] = kidsOf(expand(rows[0]?.id ?? ""));
  expect(tier?.name).toBe("Sigil tier");
  expect(tier?.formula).toBeNull();
});
