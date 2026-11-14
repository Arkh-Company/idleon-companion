// A game-bug rule inside the closed groups of a call (spec 008 FR-016): a source the call counts twice is still the
// call's own when it sits under "At 0". A hand-written recording with invented blocks.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { recordingOf } from "./tree-fixture.ts";

const kidsOf = (n: CalcTreeNode | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];

test("a source counted twice at 0 is tagged inside the At 0 group", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Total", v: 4, c: [2, 3, 4] },
      { b: "Some", v: 4, x: [[0, 4]] },
      { b: "Nothing", v: 0, x: [[0, 0]] },
      { b: "Nothing", v: 0, x: [[0, 0]] },
    ],
    [],
    { root: 0 },
  );
  const rule = {
    id: "inventedTwice",
    in: /^Total\(/,
    test: /^Nothing\(\)$/,
    proof: "N.js Total",
  };
  const kids = kidsOf(buildTree(rec, 0, [], [rule]).root);
  const zero = kids.find((k) => k.role === "atZero");
  expect(kidsOf(zero).map((k) => [k.code, k.flags.gameBug])).toEqual([
    ["Nothing()", "inventedTwice"],
    ["Nothing()", "inventedTwice"],
  ]);
  expect(kids[0]?.flags.gameBug).toBeUndefined();
});
