// [NR-G 2] the worn items' loop of the game (pieces.cjs rowOfTerm NR-G 2 and explainOnce0 NR-G 2b, OPEN_XF): in a turn of
// the worn items' total, the call is only the multiplier of the item's value, and a block that only returns that total
// takes the total's ⓘ from its writer. Invented blocks and paths, apart from the game's own cache names the rule reads.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { instrument } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import { buildTree } from "../tree-build.ts";
import { GENERIC_NAME, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";
import { wornItem } from "./term-passes.ts";
import { call, nodes, num, op, read, termsOf, val } from "./term-fixture.ts";
import { openPath, recordingOf } from "./tree-fixture.ts";

const ENTRY = "DNSM.TotalStatsETCmap.Drop";
/** (1 + the call ÷ 100) × (the item's definition + the slot's 0) */
const turn = (item = "DNSM.TotalStatsDM.UQ1val"): Expr =>
  op(
    "*",
    op("+", num(1), op("/", call(4, 3), num(100), 0.03), 1.03),
    op("+", read(item, 10), val(0), 10),
    10.3,
  );

test("[NR-G 2] a turn of the worn items' total is the item's value times the call's multiplier, with the slot's value", () => {
  const r = termsOf(undefined, () => ENTRY).term(turn(), "+", new Map());
  expect([r?.node.name, r?.node.flags]).toEqual([
    "Worn item value × (1 + Some Mode ÷ 100)",
    {},
  ]);
  const slot = r?.group?.find((x) => x.node.value === 0);
  expect(slot?.node).toMatchObject({
    name: "Slot value of the item in turn (EquipmentMap UQ1val)",
    leaf: "rawBonus",
    why: null,
  });
  expect(slot?.node.flags).toEqual({});
  expect(slot?.earlier).toBeUndefined();
  for (const x of [r, slot])
    expect(x && checkTree({ id: "x", ...x.node, kids: [] }, 1)).not.toBeNull();
});

test.each<[string, () => string | null, Expr]>([
  ["outside the worn items' loop", () => null, turn()],
  ["in another loop", () => "DNSM.OtherTotal.Drop", turn()],
  ["with no read of the item's definition", () => ENTRY, turn("Stats.item")],
])("[NR-G 2] %s the branch is the call's own", (_name, entry, e) => {
  const r = termsOf(undefined, entry).term(e, "+", new Map());
  expect(r?.node.name).not.toMatch(/^Worn item/);
  expect(
    r?.group?.find((x) => x.node.value === 0)?.node.name ?? GENERIC_NAME,
  ).toBe(GENERIC_NAME);
});

test("[NR-G 2] a call with the turn's value is no multiplier", () => {
  const e = op(
    "*",
    op("+", num(0), call(4, 3), 3),
    op("+", read("DNSM.TotalStatsDM.UQ1val", 1), val(0), 1),
    3,
  );
  const r = termsOf(undefined, () => ENTRY).term(e, "+", new Map());
  expect(r?.node.name).not.toMatch(/^Worn item/);
});

// Calc returns min(A, 5); the block that only returns the cache Calc filled takes that ⓘ (NR-G 2b)
const { ops } = instrument(
  "Blocks._customBlock_Calc = function () { return Math.min(s.A, 5); };",
);
function onlyReturns(path: string) {
  const calc: Partial<RecNode> & Pick<RecNode, "b"> = {
    b: "Calc",
    v: 5,
    x: [
      [1, 9],
      [0, 5],
    ],
    rx: [["A", 9, 0]],
    r: [["A", 9]],
  };
  const build = buildTree(
    recordingOf(
      [
        { b: "(root)", c: [1] },
        { b: "Total", v: 10, c: [2, 3] },
        calc,
        { b: "EtcBonuses", v: 5, r: [[path, 5, 2]] },
      ],
      [{ path, node: 2, v: 5, seq: 0 }],
      { root: 0 },
    ),
    0,
    ops,
  );
  return openPath(build, "EtcBonuses()");
}

test("[NR-G 2b] a block that only returns the worn items' total takes the total's ⓘ from its writer", () => {
  const n = onlyReturns(ENTRY);
  expect(n?.formula).toEqual([
    ["min", "(", "A", ",", "5", ")"],
    [9, 5, 5],
  ]);
  expect(onlyReturns("DNSM.OtherTotal.Drop")?.formula).toBeNull();
});

test("[NR-G 2] the slot's value at 0, in its place in the level, is named too; a call with no name leaves the branch's own (spec 009, FR-016)", () => {
  const zero: Row = {
    node: row({ pieceKey: null, value: 0, code: null, leaf: "unknown" }),
    open: null,
    earlier: true,
  };
  const r: Row = {
    node: row({ pieceKey: null, value: 10.3, code: null }),
    open: null,
    group: [
      zero,
      // a read of 0, and a value of an earlier step that is no 0, are no slot's value
      { node: row({ pieceKey: "z", value: 0, code: "Stats.z" }), open: null },
      { ...zero, node: { ...zero.node, value: 5 } },
    ],
  };
  const unnamed = nodes[1] ?? nodes[0];
  const out = unnamed && wornItem(r, unnamed, turn());
  expect(out?.node.name).toBe(GENERIC_NAME);
  expect(out?.group?.map((x) => x.node.name)).toEqual([
    "Slot value of the item in turn (EquipmentMap UQ1val)",
    GENERIC_NAME,
    GENERIC_NAME,
  ]);
});
