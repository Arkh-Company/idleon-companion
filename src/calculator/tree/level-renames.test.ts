// pieces.cjs `rename` at BASELINE-4, the rules that look only at a row and the rows of its level (tree/level-renames.ts):
// the context rows that go, and the loop progress a leaf is, each with its name and why. They run in the level's
// `finish`, before its types and groups.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { buildTree } from "../tree-build.ts";
import { isNameText } from "./name-text.ts";
import { finish, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { kidsOf, read, recordingOf } from "./tree-fixture.ts";

const lazy = (code: string, value = 2): Row => ({
  node: row({ pieceKey: code, value, code, kids: "lazy" }),
  open: 1,
});
const call = (code: string, value = 2): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
});
/** The level's rows as [code, name, leaf, why, flags], its groups' rows in it. */
const level = (rows: Row[]) =>
  finish(9, rows)
    .flatMap((r) => (r.group && r.node.role !== "piece" ? r.group : [r]))
    .map((r) => [
      r.node.code,
      r.node.name,
      r.node.leaf,
      r.node.why,
      r.node.flags,
    ]);

test.each([
  "DNSM.GalleryDN1",
  "DNSM.SavePlDN",
  "DNSM.PetszzBrDNq",
  "DNSM.AllTalWhichPlayer",
  "ItemDefinitionsGET.itemB.UQ1txt",
  "DNSM.Stamp_bonuses_DRI",
  "DummyNumbersStatManager.Stamp_bonuses_DRI",
  // by its name: the recorder's label of the same working value, and the current map
  "DNSM.GalleryDN1[2]",
  "DNSM.SavePlDN.k",
  "CurrentMap",
])("[DROP_CODE, DROP_NAME, rule 52] the context read %s is no row", (code) => {
  expect(level([read("Kept", 4), read(code, 5)]).map(([c]) => c)).toEqual([
    "Kept",
  ]);
});

test("[B2-1] the shiny pets' level counter goes, even with rows under it; a context read with rows under it stays", () => {
  expect(
    level([
      read("Kept", 4),
      lazy("DNSM.PetszzBrDN1"),
      read("DNSM.PetszzBrDN1", 3),
      lazy("DNSM.GalleryDN1"),
      lazy("DNSM.GalleryDN1[2]"),
      lazy("DNSM.Stamp_bonuses_DRI"),
    ]).map(([c]) => c),
  ).toEqual([
    "Kept",
    "DNSM.GalleryDN1",
    "DNSM.GalleryDN1[2]",
    "DNSM.Stamp_bonuses_DRI",
  ]);
});

test.each([
  "DNSM.GalleryDN10",
  "XDNSM.GalleryDN1",
  "ItemDefinitionsGET.itemB.UQ1val",
  "DNSM.Stamp_bonuses_DRIx",
  "PlayerDATABASE[0].CurrentMapLv",
  "DNSM.PetszzBrDN10",
  "XDNSM.PetszzBrDN1",
])("the read %s is no context: it stays", (code) => {
  expect(level([read(code, 5)]).map(([c]) => c)).toEqual([code]);
});

const STAMPS_WHY =
  "progress of the loop in StampBonusOfTypeX: the total of the earlier stamps of this type, before this stamp adds to it (N.js)";
test.each(["DNSM", "DummyNumbersStatManager"])(
  "[rule 53] the stamp loop's total in %s is the total of the earlier stamps, the loop's progress",
  (cache) => {
    const code = `${cache}.Stamp_TOTAL_bonus_of_type_X`;
    expect(level([read(code, 6)])).toEqual([
      [code, "Total of the earlier stamps", "unknown", STAMPS_WHY, {}],
    ]);
  },
);

test("[rule 53] a stamp total with rows under it keeps its name", () => {
  expect(level([lazy("DNSM.Stamp_TOTAL_bonus_of_type_X")])).toEqual([
    ["DNSM.Stamp_TOTAL_bonus_of_type_X", "Stamp total so far", null, null, {}],
  ]);
});

test.each([
  "CustomLists.RANDOlist[53][4]",
  "RANDOlist[53][0]",
  "DNSM.RANDOlist[53]",
])(
  "the card's per-star value %s is named so, with no code: a fixed value",
  (code) => {
    expect(level([read(code, 3)])).toEqual([
      [null, "Bonus per star (card)", "fixedValue", null, {}],
    ]);
  },
);

test("a card's per-star value with rows under it is named so, with no code, and keeps its rows", () => {
  const [r] = finish(9, [lazy("CustomLists.RANDOlist[53][4]")]);
  expect([r?.node.name, r?.node.code, r?.node.leaf, r?.node.kids]).toEqual([
    "Bonus per star (card)",
    null,
    null,
    "lazy",
  ]);
  expect(level([read("CustomLists.RANDOlist[52][4]", 3)])[0]?.[1]).not.toBe(
    "Bonus per star (card)",
  );
});

const PETS_WHY =
  "progress of the loop in Breeding(ShinyBonusS): the total of the earlier pets with this bonus type, before this pet adds to it (N.js)";
test.each(["CustomLists.RANDOlist[90][3]", "RANDOlist[90][0]"])(
  "[rule 67] beside a pet's passive, %s is the total of the earlier pets with that bonus",
  (code) => {
    expect(
      level([call('Breeding("SpecialPassives", 2, 1)'), read(code, 0)]).at(-1),
    ).toEqual([
      code,
      "Earlier pets with the same shiny bonus",
      "unknown",
      PETS_WHY,
      {},
    ]);
  },
);

test("[rule 67] the shiny table cell with no pet's passive beside it, or with rows under it, keeps its name", () => {
  const name = (rows: Row[]) =>
    finish(9, rows)
      .flatMap((r) => (r.group && r.node.role !== "piece" ? r.group : [r]))
      .find((r) => r.node.code?.includes("RANDOlist[90]"))?.node.name;
  expect(
    name([
      call('Breeding("Other", 2)'),
      read("CustomLists.RANDOlist[90][3]", 0),
    ]),
  ).not.toBe("Earlier pets with the same shiny bonus");
  expect(
    name([
      call('Breeding("SpecialPassives", 2, 1)'),
      lazy("CustomLists.RANDOlist[90][3]"),
    ]),
  ).not.toBe("Earlier pets with the same shiny bonus");
  expect(
    name([
      call('Breeding("SpecialPassives", 2, 1)'),
      read("CustomLists.RANDOlist[90][3]x", 0),
    ]),
  ).not.toBe("Earlier pets with the same shiny bonus");
});

test("in a tree, a block's context read goes and its stamp total is the loop's progress; every text passes the host", () => {
  const root = buildTree(
    recordingOf(
      [
        { b: "(root)", c: [1] },
        {
          b: "Block",
          v: 9,
          r: [
            ["DNSM.GalleryDN1", 2],
            ["DNSM.Stamp_TOTAL_bonus_of_type_X", 4],
            ["Stats.base", 5],
          ],
        },
      ],
      [],
      { root: 0 },
    ),
    0,
  ).root;
  expect(kidsOf(root).map((k) => [k.code, k.name])).toEqual([
    ["DNSM.Stamp_TOTAL_bonus_of_type_X", "Total of the earlier stamps"],
    ["Stats.base", expect.any(String)],
  ]);
  expect(
    [
      "Total of the earlier stamps",
      "Bonus per star (card)",
      "Earlier pets with the same shiny bonus",
      STAMPS_WHY,
      PETS_WHY,
    ].every(isNameText),
  ).toBe(true);
  expect(checkTree(root, 100)).not.toBeNull();
});
