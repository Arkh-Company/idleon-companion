// A scratch box read is named by the write it comes from (spec 009 T023, decision of 18/11): never the name, nor the
// rows, of another write of the same box.
import { expect, test } from "vitest";
import { buildTree } from "../tree-build.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { shapeOf } from "../tree-engine.ts";
import { scratchName } from "./scratch-names.ts";
import { recordingOf } from "./tree-fixture.ts";

const call = (b: string, ...a: (string | number)[]) =>
  recordingOf([{ b, a }]).nodes[0] ?? recordingOf([{ b: "?" }]).nodes[0];

test.each<
  [string, string, (string | number)[], number, ReturnType<typeof scratchName>]
>([
  [
    "the villagers the caverns count",
    "Holes",
    ["VillagersOwned", 0, 0],
    3,
    { name: "Cavern villagers owned" },
  ],
  [
    "the monument multiplier's start",
    "Holes",
    ["MonumentROGbonuses", 2, 6],
    0,
    { name: "Start value", leaf: "fixedValue" },
  ],
  [
    "the monument multiplier from its 9th bonus: the game's name of that bonus, Wisdom's",
    "Holes",
    ["MonumentROGbonuses", 2, 6],
    1,
    { name: "x Wisdom Bonuses Multi" },
  ],
  [
    "the same for Bravery's monument",
    "Holes",
    ["MonumentROGbonuses", 0, 3],
    1,
    { name: "x Bravery Bonuses Multi" },
  ],
  [
    "the same for Justice's monument",
    "Holes",
    ["MonumentROGbonuses", 1, 0],
    1,
    { name: "x Justice Bonuses Multi" },
  ],
  [
    "a monument multiplier on its way, after its 9th bonus: no name of its own",
    "Holes",
    ["MonumentROGbonuses", 2, 6],
    2,
    { name: null },
  ],
  [
    "the 9th bonus's own multiplier has no 9th bonus in it: its write 1 has no name of its own",
    "Holes",
    ["MonumentROGbonuses", 2, 9],
    1,
    { name: null },
  ],
  [
    "a nametag's grade multiplier",
    "Gallery",
    ["InitializeNametagBonuses", 0, 0],
    1,
    { name: "Nametag grade multiplier (grade factor)" },
  ],
])("%s", (_case, b, a, at, name) => {
  expect(
    scratchName(
      b === "Holes" ? "DNSM.HoleozDN" : "DNSM.GalleryDN2",
      call(b, ...a),
      at,
    ),
  ).toEqual(name);
});

test.each<[string, string[], ReturnType<typeof scratchName>]>([
  [
    "The Slab's count, from the items found",
    ["Meals[0][99]", "Cards[1].length"],
    { name: "Base AGI and LUK per 100 items found, shown on The Slab" },
  ],
  [
    "the Tome's, from its completion points",
    ["PixelHelperActor[4].behaviors.getBehavior(ActorEvents_229)._GenInfo[84]"],
    { name: "% AGI for every 2000 Tome Completion Points over 5000" },
  ],
  ["a turn of a counter: the name of its path", ["Meals[0][3]"], undefined],
])(
  "the bubbles' counter box is named by what its write read: %s",
  (_case, reads, name) => {
    const talents = call("TalentCalc", -2);
    expect(scratchName("DNSM.CalcTalentDN2", talents, 7, () => reads)).toEqual(
      name,
    );
    // another mode of the block uses the box for other counts: the name of its path
    expect(
      scratchName("DNSM.CalcTalentDN2", call("TalentCalc", -4), 7, () => reads),
    ).toBeUndefined();
  },
);

test("a box with no rule, or a writer of no rule's mode, keeps the name of its path (undefined)", () => {
  expect(
    scratchName("DNSM.Other", call("Holes", "VillagersOwned"), 0),
  ).toBeUndefined();
  expect(
    scratchName(
      "DNSM.GalleryDN2",
      call("Gallery", "InitializeTrophyBonuses", 0, 0),
      1,
    ),
  ).toBeUndefined();
});

test("in a tree, each read of the box has the name of its own write: the start, the 9th bonus, a step on the way, the villagers", () => {
  const rec = recordingOf(
    [
      { b: "(setup: game helpers)" },
      { b: "(root)", c: [2] },
      { b: "Top", v: 20, c: [3, 7] },
      { b: "Holes", a: ["MonumentROGbonuses", 2, 6], v: 9, c: [4, 5, 6] },
      { b: "ReadA", v: 2, r: [["DNSM.HoleozDN", 1, 0]] },
      { b: "ReadB", v: 8, r: [["DNSM.HoleozDN", 4.5, 1]] },
      { b: "ReadD", v: 11, r: [["DNSM.HoleozDN", 5.5, 3]] },
      { b: "Holes", a: ["VillagersOwned", 0, 0], v: 3, c: [8] },
      { b: "ReadC", v: 6, r: [["DNSM.HoleozDN", 3, 2]] },
    ],
    [
      { path: "DNSM.HoleozDN", node: 3, v: 1, seq: 0 },
      { path: "DNSM.HoleozDN", node: 3, v: 4.5, seq: 1 },
      { path: "DNSM.HoleozDN", node: 7, v: 3, seq: 2 },
      { path: "DNSM.HoleozDN", node: 3, v: 5.5, seq: 3 },
    ],
    { setup: 0, root: 1 },
  );
  const build = buildTree(rec, 0);
  const named = new Map(shapeOf(build));
  const at = (i: number, own: string) =>
    named.get(JSON.stringify([0, "DNSM.HoleozDN", own, i]));
  expect(at(0, 'Holes("MonumentROGbonuses", 2, 6)')).toBe("Start value");
  expect(at(1, 'Holes("MonumentROGbonuses", 2, 6)')).toBe(
    "x Wisdom Bonuses Multi",
  );
  expect(at(2, 'Holes("MonumentROGbonuses", 2, 6)')).toBe("Game value");
  expect(at(0, 'Holes("VillagersOwned", 0, 0)')).toBe("Cavern villagers owned");
  // the start is a fixed value of the game's code
  const rows: CalcTreeNode[] = [];
  const walk = (n: CalcTreeNode): void => {
    rows.push(n);
    const kids = n.kids === "lazy" ? (build.expand(n.id)?.kids ?? []) : n.kids;
    if (Array.isArray(kids)) kids.forEach(walk);
  };
  walk(build.root);
  expect(rows.find((n) => n.name === "Start value")?.leaf).toBe("fixedValue");
});

test("the royal total starts at 0, a fixed value, and its next writes are the total", () => {
  const royal = call("RoyalG", "TotalStatz", 0, 0);
  expect(scratchName("DNSM.TKnS_DN", royal, 0)).toEqual({
    name: "Start value",
    leaf: "fixedValue",
  });
  expect(scratchName("DNSM.TKnS_DN", royal, 5)).toEqual({
    name: "Royal total stats (cached)",
  });
});
