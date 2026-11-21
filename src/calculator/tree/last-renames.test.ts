// pieces.cjs `opus5` at BASELINE-4 beyond the OPUS5 list (tree/last-renames.ts): the rules by a leaf's code, by the rows
// above it, the count of maps by its rows and the statue's base bonus. Rows written by hand, with invented names.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { aboveRenames } from "./above-renames.ts";
import { LAST_RENAMES } from "./last-renames.ts";
import { isNameText } from "../names/name-text.ts";
import { finish, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { kidsOf, placed, read, recNode } from "./tree-fixture.ts";

const R = LAST_RENAMES;
const leaf = (
  code: string | null,
  value: number,
  more: Partial<Row["node"]> = {},
): Row => ({
  node: row({ pieceKey: null, value, code, ...more }),
  open: null,
});
const unknown = (code: string, value: number) =>
  leaf(code, value, { leaf: "unknown", why: "a why" });
const earlier = (v = 3): Row => ({
  node: row({ pieceKey: null, value: v, code: null, leaf: "unknown" }),
  open: null,
  earlier: true,
});
const one = (r: Row) => {
  const [x] = finish(9, [r, read("Q", 2)]);
  return [x?.node.name, x?.node.leaf, x?.node.why, x?.node.flags];
};

test("[rename5] the Big Fish upgrade's level with no name of its own is named, its type kept", () => {
  const r = leaf("Spelunk[11][3]", 40, {
    name: "Game value",
    leaf: "level",
    flags: { unnamed: true },
  });
  expect(one(r)).toEqual(["Big Fish upgrade 3 level", "level", null, {}]);
  // a name of its own stays
  expect(
    one(leaf("Spelunk[11][3]", 40, { name: "Fish", leaf: "level" }))[0],
  ).toBe("Fish");
});

test("[OPUS5_AT] the golden food total's 0 is its start value; another value, or a typed one, keeps its name", () => {
  expect(one(unknown("DNSM.GfoodBonus", 0))).toEqual([
    R.goldStart.name,
    "fixedValue",
    null,
    {},
  ]);
  expect(one(unknown("DNSM.GfoodBonus", 2))[0]).not.toBe(R.goldStart.name);
  expect(one(leaf("DNSM.GfoodBonus", 0, { leaf: "level" }))[0]).not.toBe(
    R.goldStart.name,
  );
});

test.each([
  ["DNSM.TKnS_DN", R.kingdom],
  ["DNSM.playHPbasePOT2", R.foodSlots],
])("[OPUS5_PROGRESS] %s is the loop's running total", (code, p) => {
  expect(one(unknown(code, 5))).toEqual([p.name, "unknown", p.why, {}]);
  // with rows, it is no leaf
  const lazy: Row = {
    node: row({ pieceKey: null, value: 5, code, kids: "lazy" }),
    open: 1,
  };
  expect(finish(9, [lazy, read("Q", 2)])[0]?.node.name).not.toBe(p.name);
});

const above = (...codes: (string | null)[]) =>
  codes.map((code) => ({ code, name: "Row" }));

test.each([['Summoning("TomeBonus", 4, 0)'], ["DNSM.AlchBubbles.A9"]])(
  "[TOME_DN2] TalentCalc's scratch number under %s is the Tome points over 5,000, whatever its type",
  (code) => {
    const [r] = aboveRenames(
      [leaf("DNSM.CalcTalentDN2", 2, { leaf: "level" })],
      above(code, null),
    );
    expect([r?.node.name, r?.node.leaf, r?.node.why]).toEqual([
      R.tome.name,
      "quantity",
      null,
    ]);
    expect(isNameText(R.tome.name)).toBe(true);
  },
);

test("[TOME_DN2] another bonus, another scratch number or a row with rows keeps its name", () => {
  for (const [r, u] of [
    [leaf("DNSM.CalcTalentDN2", 2), above('Summoning("TomeBonus", 6, 0)')],
    [leaf("DNSM.CalcTalentDN1", 2), above("DNSM.AlchBubbles.A9")],
    [
      { ...leaf("DNSM.CalcTalentDN2", 2), open: 1 },
      above("DNSM.AlchBubbles.W8"),
    ],
  ] as const)
    expect(aboveRenames([r], u)[0]?.node.name).not.toBe(R.tome.name);
});

test("[OPUS5_PROGRESS] a win bonus's 0 among more rows is the total of the earlier turns", () => {
  const win = unknown("DNSM.SummWinBonus[18]", 0);
  const [r] = aboveRenames([win, unknown("Q", 3)], above("Win()"));
  expect([r?.node.name, r?.node.leaf, r?.node.why]).toEqual([
    R.winBonus.name,
    "unknown",
    R.winBonus.why,
  ]);
  // alone, with another value, or typed: as it is
  expect(aboveRenames([win], above("Win()"))[0]?.node.name).not.toBe(
    R.winBonus.name,
  );
  expect(
    aboveRenames(
      [unknown("DNSM.SummWinBonus[18]", 2), unknown("Q", 3)],
      above("Win()"),
    )[0]?.node.name,
  ).not.toBe(R.winBonus.name);
  expect(
    aboveRenames(
      [leaf("DNSM.SummWinBonus[18]", 0, { leaf: "level" }), unknown("Q", 3)],
      above("Win()"),
    )[0]?.node.name,
  ).not.toBe(R.winBonus.name);
});

test.each([
  ["DNSM.CalcTalentMAP[209]", R.maps],
  ['RunCodeOfTypeXforThingY("OverkillStuffs", "2", 0)', R.overkill],
])(
  "[OPUS5_PROGRESS] an unlinked earlier value right under %s is its loop's progress",
  (code, p) => {
    const [r] = aboveRenames([earlier()], above(null, code));
    expect([r?.node.name, r?.node.leaf, r?.node.why, r?.node.flags]).toEqual([
      p.name,
      "unknown",
      p.why,
      {},
    ]);
    // two rows up, or a named one: as it is
    expect(aboveRenames([earlier()], above(code, null))[0]?.node.name).not.toBe(
      p.name,
    );
    const named: Row = {
      ...earlier(),
      node: { ...earlier().node, name: "Crop", flags: {} },
    };
    expect(aboveRenames([named], above(null, code))[0]?.node.name).toBe("Crop");
  },
);

test("[OPUS5] the first sign of a sign total, a fixed value, is a raw bonus like the others", () => {
  const sign = leaf(null, 3, { name: "Invented (sign 4)", leaf: "fixedValue" });
  expect(aboveRenames([sign], above("DNSM.StarSigns.Drop"))[0]?.node.leaf).toBe(
    "rawBonus",
  );
  expect(aboveRenames([sign], above("DNSM.Other"))[0]?.node.leaf).toBe(
    "fixedValue",
  );
  const other = leaf(null, 3, { name: "Invented", leaf: "fixedValue" });
  expect(
    aboveRenames([other], above("DNSM.StarSigns.Drop"))[0]?.node.leaf,
  ).toBe("fixedValue");
});

const lazy = (code: string, value: number, open = 1): Row => ({
  node: row({ pieceKey: null, value, code, kids: "lazy" }),
  open,
});

test("[OPUS5_PROGRESS] the count of maps with the earlier maps' total among its rows is named for it", () => {
  const { rows } = placed({ 1: [earlier(106), lazy("Turn()", 1, 2)] }, [
    lazy("DNSM.CalcTalentMAP[209]", 107),
    leaf("Q", 3),
  ]);
  expect(rows[0]?.name).toBe(R.maps.parent);
  // another cache: as it is
  const other = placed({ 1: [earlier(106), lazy("Turn()", 1, 2)] }, [
    lazy("DNSM.CalcTalentMAP[210]", 107),
    leaf("Q", 3),
  ]);
  expect(other.rows[0]?.name).not.toBe(R.maps.parent);
});

const STATUE_CALL = 'ArbitraryCode("StatueBonusGiven3")';
const statueNodes = (level: number, per: number) => [
  ...Array.from({ length: 5 }, (_, i) => recNode(i, `Call${String(i)}`)),
  recNode(5, "ArbitraryCode", {
    a: ["StatueBonusGiven3"],
    r: [
      ["StatueLevels[3][0]", level],
      ["CustomLists.StatueInfo[3][3]", per],
    ],
  }),
];
test("[openStatue] the statue's first product under its call is its level × its bonus per level, with its ⓘ", () => {
  const base = leaf("DNSM.statuearbDN", 12, { leaf: "unknown" });
  const { rows, expand } = placed(
    { 1: [base, leaf("Q", 2)] },
    [lazy(STATUE_CALL, 24), leaf("Other", 1)],
    statueNodes(4, 3),
  );
  const [first] = kidsOf(expand(rows[0]?.id ?? ""));
  expect([first?.name, first?.leaf, first?.formula]).toEqual([
    "Base statue bonus",
    null,
    [
      ["Statue level", "×", "Bonus per statue level"],
      [4, 3, 12],
    ],
  ]);
  expect(kidsOf(first).map((k) => [k.code, k.value, k.leaf])).toEqual([
    ["StatueLevels[3][0]", 4, "level"],
    ["CustomLists.StatueInfo[3][3]", 3, "fixedValue"],
  ]);
  expect(first && checkTree(first, 10)).not.toBeNull();
});

test("[openStatue] another product, no statue call above, or no reads keep the read as it is", () => {
  const base = leaf("DNSM.statuearbDN", 12, { leaf: "unknown" });
  for (const [top, nodes] of [
    [lazy(STATUE_CALL, 24), statueNodes(4, 4)],
    [lazy('ArbitraryCode("Other3")', 24), statueNodes(4, 3)],
    [lazy(STATUE_CALL, 24), statueNodes(Number.NaN, 3)],
    [lazy(STATUE_CALL, 24), statueNodes(-4, -3)],
  ] as const) {
    const { rows, expand } = placed(
      { 1: [base, leaf("Q", 2)] },
      [top, leaf("Other", 1)],
      [...nodes],
    );
    expect(kidsOf(expand(rows[0]?.id ?? ""))[0]?.name).not.toBe(
      "Base statue bonus",
    );
  }
});

test("[OPUS5] each rule by the rows above tests its own code, an earlier value and the count's own row", () => {
  // another cache's 0 among more rows
  expect(
    aboveRenames([unknown("DNSM.Other", 0), unknown("Q", 3)], above("Win()"))[0]
      ?.node.name,
  ).not.toBe(R.winBonus.name);
  // a value with no name that is no earlier value
  const plain: Row = { ...earlier(), earlier: false };
  expect(
    aboveRenames([plain], above(null, "DNSM.CalcTalentMAP[209]"))[0]?.node.name,
  ).not.toBe(R.maps.name);
  // a row that only has the earlier maps' name names no count
  const named = leaf(null, 106, { name: R.maps.name, leaf: "fixedValue" });
  const { rows } = placed({ 1: [named, lazy("Turn()", 1, 2)] }, [
    lazy("DNSM.CalcTalentMAP[209]", 107),
    leaf("Q", 3),
  ]);
  expect(rows[0]?.name).not.toBe(R.maps.parent);
  // another read under the statue's call, with the same product
  const { rows: s, expand } = placed(
    { 1: [leaf("DNSM.other", 12, { leaf: "unknown" }), leaf("Q", 2)] },
    [lazy(STATUE_CALL, 24), leaf("Other", 1)],
    statueNodes(4, 3),
  );
  expect(kidsOf(expand(s[0]?.id ?? ""))[0]?.name).not.toBe("Base statue bonus");
});

test.each(Object.entries(LAST_RENAMES))(
  "every text of the rule %s may be a name or a why",
  (_key, rule) => {
    const texts = Object.entries(rule)
      .filter(
        ([k, v]) =>
          ["name", "parent", "why"].includes(k) && typeof v === "string",
      )
      .map(([, v]) => String(v));
    expect(texts.filter((t) => !isNameText(t))).toEqual([]);
  },
);
