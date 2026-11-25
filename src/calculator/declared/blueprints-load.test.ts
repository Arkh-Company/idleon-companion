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
  // every loaded one, in any stage, for the real-trees run
  expect([...out.all].map(([id, bp]) => [id, bp.id])).toEqual([
    ["sketch-one", "sketch-one"],
    ["draft-one", "draft-one"],
    ["complete-one", "complete-one"],
  ]);
  expect(out.refused.map((r) => r.file)).toEqual([
    "../blueprints/w2/broken-one.blueprint.json",
    "../blueprints/w3/complete-one.blueprint.json",
  ]);
  expect(out.refused[0]?.reason).toMatch(/id/);
});

test("the pieces loaded, raw by their id, keep the first of a repeated id; the second is refused (part R)", () => {
  const first = { id: "one", params: [], children: [] };
  const out = loadBlueprints({
    "../blueprints/w1/one.piece.json": first,
    "../blueprints/w2/one.piece.json": { id: "one", params: ["x"] },
  });
  expect([...out.pieces]).toEqual([["one", first]]);
  expect(out.refused.map((r) => r.file)).toEqual([
    "../blueprints/w2/one.piece.json",
  ]);
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

test("a line with a link loads when its tree is another blueprint's file, and is refused when none is (T200)", () => {
  const link = (tree: string) => ({
    id: "with-link",
    root,
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "talents",
            sources: [{ key: "a", name: "Invented A", ref: root.ref, tree }],
          },
        ],
      },
    ],
  });
  const files = (tree: string) => ({
    "../blueprints/w1/sketch-one.blueprint.json": { id: "sketch-one", root },
    "../blueprints/w1/with-link.blueprint.json": link(tree),
  });
  expect(loadBlueprints(files("sketch-one")).stages.get("with-link")).toBe(
    "complete",
  );
  expect(loadBlueprints(files("no-such-one")).refused[0]?.reason).toMatch(
    /não existe/,
  );
  // the line is the linked recipe's root (r1): another call is another number
  const other = files("sketch-one");
  other["../blueprints/w1/sketch-one.blueprint.json"].root = {
    ...root,
    ref: { call: "Invented", args: [1] },
  };
  expect(loadBlueprints(other).refused[0]?.reason).toMatch(
    /a linha não é a raiz de sketch-one/,
  );
});
