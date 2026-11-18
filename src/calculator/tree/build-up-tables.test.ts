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

test("[FR-018] a Legend Talent's Points say their max, from the table", () => {
  useGameTables(TABLES);
  const { rows, expand } = placed(
    { 0: [leaf("Level", 3, "Spelunk[18][25]", "level")] },
    [lazy("Midusian Appetite", 1500, 'Thingies("LegendPTS_bonus", 25, 0)')],
    [
      recNode(0, "Thingies", {
        a: ["LegendPTS_bonus", 25, 0],
        v: 1500,
        r: [["CustomLists.LegendTalents[25][2]", 500]],
      }),
    ],
  );
  expect(kidsOf(expand(rows[0]?.id ?? ""))[0]?.name).toBe("Points (max 3)");
});
