// A line with a link to another tree as a pool's source (spec 010, T200; the Drop Rate's LUK): the source's value is a
// curve that reads the same call twice through a working value, so the term's references are that call twice. The
// invented game's TreeLinkTwice reads TreeDeclLuck() so.
import { expect, test } from "vitest";
import type { Blueprint } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const blueprint: Blueprint = {
  id: "invented-link",
  root: { name: "Invented", ref: { call: "TreeLinkTwice", args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        {
          system: "luk-stats",
          sources: [
            {
              key: "luck",
              name: "Luck",
              ref: { call: "TreeDeclLuck", args: [] },
              tree: "invented-luck",
            },
          ],
        },
        {
          system: "stamps",
          sources: [
            {
              key: "capped",
              name: "Capped",
              ref: { read: "TreeCapped" },
              leaf: "level",
            },
          ],
        },
      ],
    },
  ],
};

test("a source that is a line with a link has no other part where its term reads the same call twice", () => {
  const input = recorded("TreeLinkTwice");
  expect(input.key.pools[0]?.terms[0]?.refs).toEqual([
    "TreeDeclLuck()",
    "TreeDeclLuck()",
  ]);
  expect(
    lockBlueprint({ ...input, blueprint, character: 0, characterClass: 3 })
      .errors,
  ).toEqual([]);
});
