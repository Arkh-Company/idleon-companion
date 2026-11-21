// The load of the blueprints (spec 010, research R8): only a complete blueprint is served; a refused one does not take
// the others down; a review file is never read as a blueprint.
import { expect, test } from "vitest";
import { blueprintOf, loadBlueprints } from "./blueprints.ts";

const root = { name: "Invented", ref: { call: "Invented", args: [0] } };
const pools = [
  {
    kind: "additive",
    groups: [
      {
        system: "talents",
        sources: [
          {
            key: "a",
            name: "Invented A",
            ref: { read: "A[1]" },
            leaf: "level",
          },
        ],
      },
    ],
  },
];

test("a sketch and a draft are not served; a complete one is; a refused one does not take the others down", () => {
  const out = loadBlueprints({
    "../blueprints/w1/sketch-one.blueprint.json": { id: "sketch-one", root },
    "../blueprints/w1/draft-one.blueprint.json": {
      id: "draft-one",
      root,
      pools,
      pending: [{ where: "pools/0/groups/0/sources/0", kind: "descend" }],
    },
    "../blueprints/w2/complete-one.blueprint.json": {
      id: "complete-one",
      root,
      pools,
    },
    "../blueprints/w2/broken-one.blueprint.json": {
      id: "other-id",
      root,
      pools,
    },
    "../blueprints/w3/complete-one.blueprint.json": {
      id: "complete-one",
      root,
      pools,
    },
  });
  expect([...out.stages]).toEqual([
    ["sketch-one", "sketch"],
    ["draft-one", "draft"],
    ["complete-one", "complete"],
  ]);
  expect([...out.complete.keys()]).toEqual(["complete-one"]);
  expect(out.refused.map((r) => r.file)).toEqual([
    "../blueprints/w2/broken-one.blueprint.json",
    "../blueprints/w3/complete-one.blueprint.json",
  ]);
  expect(out.refused[0]?.reason).toMatch(/id/);
});

test("a review file is never read as a blueprint", () => {
  const out = loadBlueprints({
    "../blueprints/w1/complete-one.review.json": { version: 1 },
  });
  expect(out.stages.size).toBe(0);
  expect(out.refused).toEqual([]);
});

test("blueprintOf serves only a complete blueprint: a sketch or an unknown id is null (unknownNumber)", () => {
  expect(blueprintOf("no-such-number")).toBe(null);
  expect(blueprintOf("stamps-gilded-chance")).toBe(null);
});
