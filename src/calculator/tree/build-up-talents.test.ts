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

/** The All-talent levels of talent 99 opened, its preset's Super Talents being `supers`. */
function allTalent(supers: number[]) {
  const nodes = Array.from({ length: 10 }, (_, i) => recNode(i, "Other"));
  nodes[1] = recNode(1, "RunCodeOfTypeXforThingY", {
    a: ["AllTalentLV", "99"],
    v: 268,
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
          value: 268,
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

test("[FR-018] the All-talent levels: its sources, with no check, no Super Talent list and no second Points invested", () => {
  const n = allTalent([10, 120]);
  expect(kidsOf(n).map((k) => [k.name, k.value])).toEqual([
    ["Super Talent levels given (not a Super Talent here)", 125],
    ["Symbols Of Beyond ~R", 22],
    ["Maroon Warship", 1],
    ["Class level", 2019],
  ]);
  expect(n?.formula && formulaLines(n.formula)).toMatchObject({
    names: "floor(min(Cap, sum of the sources) + Super Talent levels)",
    numbers: "Super Talent levels 0 → 268",
  });
});

test("[FR-018] a Super Talent's All-talent levels count its Super Talent levels", () => {
  const n = allTalent([10, 99]);
  expect(kidsOf(n)[0]?.name).toBe("Super Talent levels given");
  expect(n?.formula && formulaLines(n.formula).numbers).toBe(
    "Super Talent levels 125 → 268",
  );
});
