// The game's own passes of pieces.cjs explainRaw at BASELINE-4, over recordings written by hand: each block's rows are
// the ones the bench writes from the game's code, in its order, with their types.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { instrument } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { isNameText } from "./name-text.ts";
import { kidsOf, recordingOf } from "./tree-fixture.ts";

type Spec = Partial<RecNode> & Pick<RecNode, "b">;
/** The root's rows when the root call is `top`, with `more` calls after it, as [code, value, leaf, condition]. */
const rowsOf = (top: Spec, ...more: Spec[]) =>
  kidsOf(
    buildTree(
      recordingOf([{ b: "(root)", c: [1] }, top, ...more], [], { root: 0 }),
      0,
    ).root,
  ).map((k) => [k.code, k.value, k.leaf, k.condition]);

test("[Companions] an owned companion is a yes with its bonus; one not owned is a no", () => {
  expect(
    rowsOf({
      b: "Companions",
      a: ["c1"],
      v: 3,
      r: [["DNSM.CompanionBon[c1]", 3]],
    }),
  ).toEqual([
    [null, 1, "condition", "owned"],
    ["DNSM.CompanionBon[c1]", 3, "rawBonus", null],
  ]);
  expect(rowsOf({ b: "Companions", a: ["c2"], v: 0 })).toEqual([
    [null, 0, "condition", "owned"],
  ]);
});

test("[Companions] the bonus of an owned companion is an added bonus", () => {
  const root = buildTree(
    recordingOf(
      [
        { b: "(root)", c: [1] },
        { b: "Companions", a: ["c1"], v: 3, r: [["DNSM.CompanionBon[c1]", 3]] },
      ],
      [],
      { root: 0 },
    ),
    0,
  ).root;
  expect(kidsOf(root).map((k) => [k.leaf, k.fmt])).toEqual([
    ["condition", null],
    ["rawBonus", "+"],
  ]);
});

test("[GetTalentNumber] a talent with no points stops before its curve: the check and the points", () => {
  const root = buildTree(
    recordingOf(
      [
        { b: "(root)", c: [1] },
        { b: "GetTalentNumber", a: [1, 5], v: 0, r: [["SkillLevels[5]", 0]] },
      ],
      [],
      { root: 0 },
    ),
    0,
  ).root;
  const [check, zero] = kidsOf(root);
  expect([check?.value, check?.leaf, check?.condition]).toEqual([
    0,
    "condition",
    "limit",
  ]);
  // the points are 0: they sit in their place, beside the check (spec 009, FR-016)
  expect([zero?.code, zero?.value, zero?.leaf]).toEqual([
    "SkillLevels[5]",
    0,
    "investedPoints",
  ]);
});

test("[Breeding] a shiny pet's level: its EXP, the base levels, the Menagerie's unlock and the requirement's exponent", () => {
  expect(
    rowsOf(
      {
        b: "Breeding",
        a: ["SpecialPassives", "Lv", 2],
        v: 9,
        c: [2],
        r: [["Breeding[1][2]", 500]],
      },
      { b: "MenagerieStuff", v: 1 },
    ),
  ).toEqual([
    ["Breeding[1][2]", 500, "quantity", null],
    [null, 19, "fixedValue", null],
    [null, 1, "condition", "owned"],
    [null, 1.6, "fixedValue", null],
  ]);
});

test("[CardLv] a card's stars: the cards collected, the base stars and the two unlocks of a star more", () => {
  expect(
    rowsOf(
      {
        b: "RunCodeOfTypeXforThingY",
        a: ["CardLv", "cardZ"],
        v: 5,
        c: [2, 3],
        r: [["Cards[0].cardZ", 12]],
      },
      { b: "RiftStuff", v: 1 },
      { b: "Spelunk", v: 0 },
    ),
  ).toEqual([
    ["Cards[0].cardZ", 12, "quantity", null],
    [null, 4, "fixedValue", null],
    [null, 1, "condition", "owned"],
    [null, 0, "condition", "owned"],
  ]);
});

test("a block of another mode keeps its own rows", () => {
  expect(
    rowsOf({
      b: "RunCodeOfTypeXforThingY",
      a: ["Other", "cardZ"],
      v: 12,
      r: [["Cards[0].cardZ", 12]],
    }),
  ).toEqual([["Cards[0].cardZ", 12, "quantity", null]]);
});

test("a read of the block's own steps is no data row of a pass's rows", () => {
  const { ops } = instrument(
    "Blocks._customBlock_RunCodeOfTypeXforThingY = function () { return s.Q * 2; };",
  );
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "RunCodeOfTypeXforThingY",
        a: ["CardLv", "cardZ"],
        v: 14,
        r: [["Q", 7]],
        rx: [["Q", 7, 0]],
        x: [
          [ops.findIndex((o) => o.kind === "leaf"), 7],
          [ops.findIndex((o) => o.kind === "op"), 14],
        ],
      },
    ],
    [],
    { root: 0 },
  );
  const codes = kidsOf(buildTree(rec, 0, ops).root).map((k) => k.code);
  expect(codes).not.toContain("Q");
});

test("[GetTalentNumber] a talent with points keeps its own rows: the pass is only for one with no points", () => {
  expect(
    rowsOf({
      b: "GetTalentNumber",
      a: [1, 5],
      v: 5,
      r: [["SkillLevels[5]", 3]],
    }).map(([code, value]) => [code, value]),
  ).toEqual([["SkillLevels[5]", 3]]);
});

test("[GetTalentNumber] a talent whose call opens into another keeps that call's rows", () => {
  expect(
    rowsOf(
      { b: "GetTalentNumber", a: [1, 5], v: 0, c: [2] },
      { b: "Curve", v: 2 },
    ).map(([code]) => code),
  ).toEqual(["Curve()"]);
});

test("[GetTalentNumber] points with a value of 0: the check passes", () => {
  expect(
    rowsOf({
      b: "GetTalentNumber",
      a: [1, 5],
      v: 0,
      r: [["SkillLevels[5]", 3]],
    })[0],
  ).toEqual([null, 1, "condition", "limit"]);
});

test("[Companions] a companion whose call opens into another keeps that call's rows", () => {
  expect(
    rowsOf(
      { b: "Companions", a: ["c1"], v: 3, c: [2] },
      { b: "Bonus", v: 3 },
    ).map(([code]) => code),
  ).toEqual(["Bonus()"]);
});

test("[Breeding] another value of the shiny pets keeps its own rows", () => {
  expect(
    rowsOf({
      b: "Breeding",
      a: ["SpecialPassives", "Other", 2],
      v: 500,
      r: [["Breeding[1][2]", 500]],
    }).map(([code, value]) => [code, value]),
  ).toEqual([["Breeding[1][2]", 500]]);
});

/**
 * The block `top` opened under the root's own call (the root's first level is the mould's, tree/mould.ts), with `more`
 * calls after it: their ids start at 3.
 */
function treeOf(top: Spec, ...more: Spec[]): CalcTreeNode {
  const build = buildTree(
    recordingOf(
      [
        { b: "(root)", c: [1] },
        { b: "Wrap", v: top.v ?? 0, c: [2] },
        top,
        ...more,
      ],
      [],
      { root: 0 },
    ),
    0,
  );
  const [first] = kidsOf(build.root);
  const block = first?.role === "piece" ? first : kidsOf(first)[0];
  const open = build.expand(block?.id ?? "");
  if (!open) throw new Error("the block does not open");
  return open;
}
/** Each row of a level, a group's rows in it, as [name, flags]. */
const named = (n: CalcTreeNode): [string, CalcTreeNode["flags"]][] =>
  kidsOf(n).flatMap((k) =>
    k.role === "piece" ? [[k.name, k.flags]] : named(k),
  );

test.each([
  [
    "[Companions] an owned companion",
    treeOf({
      b: "Companions",
      a: ["c1"],
      v: 3,
      r: [["DNSM.CompanionBon[c1]", 3]],
    }),
    ["Owned", "Companion bonus"],
  ],
  [
    "[Companions] a companion not owned",
    // (a block with no read, no step and no call is a constant of the game: it never opens)
    treeOf({ b: "Companions", a: ["c2"], v: 0, r: [["Owned.c2", 0]] }),
    ["Owned"],
  ],
  [
    "[GetTalentNumber] a talent with no points",
    treeOf({
      b: "GetTalentNumber",
      a: [1, 5],
      v: 0,
      r: [["SkillLevels[5]", 0]],
    }),
    // spec 009, FR-018: the check is in the talent's ⓘ ("0 while Points in the talent ≤ 0"), never a row
    ["Points in the talent"],
  ],
  [
    "[Breeding] a shiny pet's level",
    treeOf(
      {
        b: "Breeding",
        a: ["SpecialPassives", "Lv", 2],
        v: 9,
        c: [3],
        r: [["Breeding[1][2]", 500]],
      },
      { b: "MenagerieStuff", v: 1 },
    ),
    [
      "Shiny EXP",
      "Base levels",
      "Menagerie unlock 11 (+10 levels)",
      "Requirement: (1 + L^1.6) × 1.7^L",
    ],
  ],
  [
    "[CardLv] a card's stars",
    treeOf(
      {
        b: "RunCodeOfTypeXforThingY",
        a: ["CardLv", "cardZ"],
        v: 5,
        c: [3, 4],
        r: [["Cards[0].cardZ", 12]],
      },
      { b: "RiftStuff", v: 1 },
      { b: "Spelunk", v: 0 },
    ),
    [
      "Cards collected",
      "Base stars",
      "Rift 5th star unlocked",
      "Spelunking 6th star unlocked",
    ],
  ],
])("%s: its rows have the bench's names", (_case, root, names) => {
  // (the block's other reads follow, as data rows)
  expect(named(root).slice(0, names.length)).toEqual(names.map((n) => [n, {}]));
  expect(names.every(isNameText)).toBe(true);
  expect(checkTree(root, 100)).not.toBeNull();
});
