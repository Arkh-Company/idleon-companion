// A class source drafted by a character of its class (spec 010, T207, FR-002a): the game's ReturnClasses gives each
// class the tabs it holds, so a source's classes are every class whose tabs hold its tab's; the draft takes the source
// from a run of one of them when the active character's class has no such source. Two invented classes: 3 holds tab
// 3, and 5 holds tabs 3 and 5.
import { expect, test } from "vitest";
import { classesOf } from "./draft-class.ts";
import type { DraftBlueprint, DraftNode } from "./draft.ts";
import { joinDrafts } from "./draft-runs.ts";

const FAMILIES = new Map([
  [3, [3]],
  [5, [3, 5]],
  [7, [7]],
]);

test("a talent's classes are each class whose tabs hold its tab, by the game's ReturnClasses", () => {
  expect(classesOf(3, FAMILIES)).toEqual([3, 5]);
  expect(classesOf(5, FAMILIES)).toEqual([5]);
  // with no families read from the game, the tab's class only
  expect(classesOf(3, new Map())).toEqual([3]);
});

const read = (key: string, path: string): DraftNode => ({
  key,
  name: null,
  ref: { read: path },
});
const draftWith = (
  talent: DraftNode,
  pending: DraftBlueprint["pending"],
): DraftBlueprint => ({
  id: "invented",
  root: { name: "Invented", ref: { call: "InventedRoot", args: [] } },
  pools: [
    {
      kind: "additive",
      groups: [
        { system: null, sources: [read("capped", "TreeCapped")] },
        { system: null, sources: [talent] },
      ],
    },
  ],
  pending,
});
const talent = (children: DraftNode[]): DraftNode => ({
  key: "get-talent-number-1-3",
  name: "Invented Talent",
  ref: { call: "GetTalentNumber", args: [1, 3] },
  classes: [5],
  children,
});

test("a class source the active character's class has not comes from the run of a class that has it, its pending places with it", () => {
  // the active character (class 7) has the talent at 0: only its points
  const active = draftWith(talent([read("points", "SkillLevels[3]")]), [
    { where: "pools/0/groups/1", kind: "system" },
    { where: "pools/0/groups/1/sources/0/children/0", kind: "leaf" },
  ]);
  // the class-5 character has it: its points and its curve, in another group's place
  const own = talent([
    read("points", "SkillLevels[3]"),
    read("curve", "CustomLists.TalentDescriptions[3][1][0]"),
  ]);
  const other: DraftBlueprint = {
    ...draftWith(own, []),
    pools: [{ kind: "additive", groups: [{ system: null, sources: [own] }] }],
    pending: [{ where: "pools/0/groups/0/sources/0/children/1", kind: "leaf" }],
  };
  const joined = joinDrafts({ draft: active, characterClass: 7 }, [
    { draft: other, characterClass: 5 },
  ]);
  expect(
    joined.pools[0]?.groups[1]?.sources[0]?.children?.map((c) => c.key),
  ).toEqual(["points", "curve"]);
  expect(joined.pending).toEqual([
    { where: "pools/0/groups/1", kind: "system" },
    { where: "pools/0/groups/1/sources/0/children/1", kind: "leaf" },
  ]);
  // a class with the source keeps its own draft
  const mine = joinDrafts({ draft: active, characterClass: 5 }, [
    { draft: other, characterClass: 7 },
  ]);
  expect(mine).toEqual(active);
});
