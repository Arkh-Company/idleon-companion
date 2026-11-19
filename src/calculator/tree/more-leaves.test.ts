// pieces.cjs `opus3More` at BASELINE-4, the three rules the earlier phases left out: F7a (a count of maps whose rows are
// only its last turns, tree/leaf-passes.ts and tree/parent-passes.ts), F7c (the obols' total of a stat,
// tree/leaf-passes.ts) and F7f (the friend score, tree/above-renames.ts). Rows written by hand, with invented names.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { aboveRenames } from "./above-renames.ts";
import { MAPS_COUNT } from "./leaf-passes.ts";
import { isNameText } from "./name-text.ts";
import { finish, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { placed, read } from "./tree-fixture.ts";

const MAPS = "Maps with at least 1,000,000,000 kills (this character)";
const MAPS_8 = "Maps with at least 100,000,000 kills (this character)";

const lazy = (code: string, value: number, open = 1): Row => ({
  node: row({ pieceKey: null, value, code, kids: "lazy" }),
  open,
});
const part = (name: string, value: number): Row => ({
  node: row({ pieceKey: null, value, code: null, name, leaf: "unknown" }),
  open: null,
});

test.each([
  ["DNSM.CalcTalentMAP[209]", MAPS],
  ["DNSM.CalcTalentMAP[49_4]", MAPS_8],
])(
  "[OPUS3-F7a] the count %s whose rows are only leaves is that count, a quantity with no rows",
  (code, name) => {
    const { rows, expand } = placed(
      { 1: [part("Earlier", 106), part("Plus", 1)] },
      [lazy(code, 107), part("Other", 3)],
    );
    // a leaf now: nothing to open
    expect(expand(rows[0]?.id ?? "")).toBeNull();
    expect(rows[0]).toMatchObject({
      name,
      leaf: "quantity",
      condition: null,
      why: null,
      formula: null,
      kids: [],
      flags: {},
    });
    expect(isNameText(name)).toBe(true);
    expect(rows[0] && checkTree(rows[0], 1)).not.toBeNull();
  },
);

test("[OPUS3-F7a] a count with a row that opens, or another cache, keeps its rows", () => {
  const opens = placed({ 1: [part("Earlier", 106), lazy("Turn()", 1, 2)] }, [
    lazy("DNSM.CalcTalentMAP[209]", 107),
    part("Other", 3),
  ]);
  expect(opens.rows[0]?.kids).toBe("lazy");
  const other = placed({ 1: [part("Earlier", 106), part("Plus", 1)] }, [
    lazy("DNSM.CalcTalentMAP[210]", 107),
    part("Other", 3),
  ]);
  expect(other.rows[0]?.name).not.toBe(MAPS);
  const branch: Row = { ...part("Turn", 1), group: [part("A", 1)] };
  const built = placed({ 1: [part("Earlier", 106), branch] }, [
    lazy("DNSM.CalcTalentMAP[209]", 107),
    part("Other", 3),
  ]);
  expect(built.rows[0]?.kids).toBe("lazy");
});

test("[OPUS3-F7a] a leaf of that count, typed or not, is the count", () => {
  const typed: Row = {
    node: {
      ...read("DNSM.CalcTalentMAP[209]", 7).node,
      leaf: "level",
      why: "a why",
      formula: { rule: ["If a: 1", "yes → 1"] },
    },
    open: null,
  };
  const [r] = finish(9, [typed, read("Q", 2)]);
  expect([r?.node.name, r?.node.leaf, r?.node.why, r?.node.formula]).toEqual([
    MAPS,
    "quantity",
    null,
    null,
  ]);
  expect(MAPS_COUNT.test.test("DNSM.CalcTalentMAP[209]")).toBe(true);
});

const OBOL =
  "PixelHelperActor[4].behaviors.getBehavior(ActorEvents_29)._ScrollCircleINFO[43][5][3]";
test("[OPUS3-F7c] the obols' total of a stat is a raw bonus, named by its slot", () => {
  const untyped: Row = {
    node: { ...read(OBOL, 12).node, leaf: "unknown", why: "a why" },
    open: null,
  };
  const [r] = finish(9, [untyped, read("Q", 2)]);
  expect([r?.node.name, r?.node.leaf, r?.node.why, r?.node.flags]).toEqual([
    "Obols: stat 5 total",
    "rawBonus",
    null,
    {},
  ]);
  // typed already, it keeps its own
  const typed: Row = {
    node: { ...read(OBOL, 12).node, leaf: "level" },
    open: null,
  };
  expect(finish(9, [typed, read("Q", 2)])[0]?.node.leaf).toBe("level");
  // another cell of the list is no total
  const [other] = finish(9, [
    read(OBOL.replace(/\[3\]$/, "[2]"), 12),
    read("Q", 2),
  ]);
  expect(other?.node.name).not.toBe("Obols: stat 5 total");
});

const earlier = (v = 7): Row => ({
  node: row({ pieceKey: null, value: v, code: null, leaf: "unknown" }),
  open: null,
  earlier: true,
});
test.each([['Thingies("FriendBonusQTY", 2, 300)'], ["DNSM.FrendBonzStatz[2]"]])(
  "[OPUS3-F7f] an unlinked earlier value within three rows under %s is the friend's score",
  (code) => {
    const up = [
      { code, name: "Friend bonus" },
      { code: null, name: "Part" },
      { code: null, name: "Branch" },
    ];
    const [r] = aboveRenames([earlier()], up);
    expect([r?.node.name, r?.node.leaf, r?.node.why, r?.node.flags]).toEqual([
      "Friend score",
      "quantity",
      null,
      {},
    ]);
  },
);

test("[OPUS3-F7f] a friend bonus four rows up, a named earlier value, a value with rows or a typed one keeps its name", () => {
  const code = 'Thingies("FriendBonusQTY", 2, 300)';
  const far = [
    { code, name: "Friend bonus" },
    { code: null, name: "A" },
    { code: null, name: "B" },
    { code: null, name: "C" },
  ];
  expect(aboveRenames([earlier()], far)[0]?.node.name).not.toBe("Friend score");
  const near = [{ code, name: "Friend bonus" }];
  const named: Row = {
    ...earlier(),
    node: { ...earlier().node, name: "Crop", flags: {} },
  };
  const rows: Row = { ...earlier(), group: [part("A", 7)] };
  const typed: Row = {
    ...earlier(),
    node: { ...earlier().node, leaf: "level" },
  };
  const plain: Row = { ...earlier(), earlier: false };
  for (const r of [named, rows, typed, plain])
    expect(aboveRenames([r], near)[0]?.node.name).not.toBe("Friend score");
});
