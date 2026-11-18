// The All-talent levels of a talent (spec 009, FR-018; N.js RunCodeOfTypeXforThingY "AllTalentLV"): its sources, with
// no check and no list of the Super Talents of the preset, which say only whether the Super Talent levels count. Rows
// written by hand, with the shape the recording gives (pesquisa-contas.md, Haungry For Gold).
import { expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { cond, placed, recNode } from "./tree-fixture.ts";

const leaf = (
  name: string,
  value: number,
  code: string | null,
  kind: Row["node"]["leaf"],
): Row => ({
  node: row({ pieceKey: code, value, code, name, leaf: kind }),
  open: null,
});
const lazy = (name: string, value: number, code: string): Row => ({
  node: row({ pieceKey: code, value, code, name, kids: "lazy" }),
  open: 9,
});
const check = (name: string, yes: boolean, code: string | null = null) => {
  const c = cond(name, yes, code);
  return { ...c, node: { ...c.node, name } };
};
const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];

/**
 * The All-talent levels of talent 99 opened, worth `v`, its preset's Super Talents being `supers` and the Super Talent
 * levels the game counted `superLv` (DNSM.AllTalMaxSUPERdn). The sources give the game's sum: 22 + 1 + ceil(75.62) +
 * floor(16.83) + 5 × floor((97 + 8) ÷ 100) + min(5, 5) + max(0, floor((2019 − 500) ÷ 100 × 1)) = 140.
 */
function allTalent(supers: number[], superLv: number, v: number) {
  const nodes = Array.from({ length: 10 }, (_, i) => recNode(i, "Other"));
  nodes[1] = recNode(1, "RunCodeOfTypeXforThingY", {
    a: ["AllTalentLV", "99"],
    v,
    r: [
      ["DNSM.AllTalMaxCapFR", 9999],
      ["DNSM.AllTalMaxSUPERdn", superLv],
    ],
  });
  const { rows, expand } = placed(
    {
      1: [
        lazy(
          "Super Talent levels given",
          125,
          'Thingies("SuperTalentPTS_LVgiven", 0, 0)',
        ),
        lazy("Symbols Of Beyond ~R", 22, "GetTalentNumber(1, 149)"),
        lazy("Maroon Warship", 1, "AchieveStatus(291)"),
        lazy("Nobisect", 75.62, 'Divinity("Bonus_Minor", 8, 2)'),
        lazy(
          "LV FOR ALL TALENTS ABOVE LV 1 (family bonus)",
          16.83,
          "DNSM.FamBonusQTYs[68]",
        ),
        lazy("Universe Talent", 5, 'ArcaneType("ArcaneUpgBonus", 57, 0)'),
        lazy(
          "+1 LV for all Talents per 100 Class LV over 500",
          1,
          'GamingStatType("SuperBitType", 47, 0)',
        ),
        leaf(
          "Haungry for gold level",
          409,
          "SkillLevels[99]",
          "investedPoints",
        ),
        leaf("Talent preset in use", 0, "PlayerStuff[1]", "unknown"),
        ...supers.map((t, i) =>
          leaf(
            `Super Talent ${String(i + 1)} (page 1)`,
            t,
            `Spelunk[28][${String(i)}]`,
            "choice",
          ),
        ),
        leaf(
          "Sneaking Masteries completed",
          8,
          "OptionsListAccount[232]",
          "quantity",
        ),
        leaf("Class level", 2019, "Lv0[0]", "level"),
        check("Haungry for gold level > 0.5", true),
        check(
          "Banned from All-talent levels",
          false,
          'RunCodeOfTypeXforThingY("TalentBannedforAllLV", "99")',
        ),
      ],
    },
    [
      {
        node: row({
          pieceKey: "a",
          value: v,
          code: 'RunCodeOfTypeXforThingY("AllTalentLV", "99")',
          name: "All-talent levels",
          kids: "lazy",
        }),
        open: 1,
      },
    ],
    nodes,
  );
  return expand(rows[0]?.id ?? "");
}

const SOURCES = [
  ["Symbols Of Beyond ~R", 22],
  ["Maroon Warship", 1],
  ["Nobisect", 75.62],
  ["LV FOR ALL TALENTS ABOVE LV 1 (family bonus)", 16.83],
  ["Universe Talent", 5],
  ["+1 LV for all Talents per 100 Class LV over 500", 1],
  ["Sneaking Masteries completed", 8],
  ["Class level", 2019],
];

test("[FR-018] the All-talent levels: its sources, its Super Talent levels at 0 off the list, and an ⓘ that closes", () => {
  const n = allTalent([10, 120], 0, 140);
  expect(kidsOf(n).map((k) => [k.name, k.value])).toEqual([
    ["Super Talent levels (would give 125)", 0],
    ...SOURCES,
  ]);
  expect(n?.formula && formulaLines(n.formula)).toMatchObject({
    names: "floor(min(Cap, sum of the sources) + Super Talent levels)",
    numbers: "floor(min(9,999, 140) + 0) = 140",
  });
});

test("[FR-018] a Super Talent's All-talent levels count its Super Talent levels", () => {
  const n = allTalent([10, 99], 125, 265);
  expect(kidsOf(n).map((k) => [k.name, k.value])[0]).toEqual([
    "Super Talent levels given",
    125,
  ]);
  expect(n?.formula && formulaLines(n.formula).numbers).toBe(
    "floor(min(9,999, 140) + 125) = 265",
  );
});

test("[FR-018] All-talent levels whose sources do not give its value keep their rows", () => {
  const n = allTalent([10, 120], 0, 999);
  expect(kidsOf(n).map((k) => k.name)).toContain("Super Talent 1 (page 1)");
  expect(kidsOf(n).map((k) => k.name)).toContain("Haungry for gold level");
});
