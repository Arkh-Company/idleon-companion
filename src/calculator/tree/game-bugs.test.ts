// A game-bug rule inside the closed groups of a call (spec 008 FR-016): a source the call counts twice is still the
// call's own when it sits under "At 0". A hand-written recording with invented blocks.
import { expect, test } from "vitest";
import { node } from "../../main/formula-fixture.ts";
import { checkTree } from "../../main/tree-check.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { GAME_BUGS } from "./game-bugs.ts";
import { buildTree } from "../tree-build.ts";
import { kidsOf, recordingOf } from "./tree-fixture.ts";

test("the rule tests the call the rows come from, also behind a call that only passes its value on", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Total", v: 6, c: [2] },
      { b: "Pass", v: 6, c: [3] },
      { b: "Twice", v: 6, c: [4, 5] },
      { b: "Source", v: 3, x: [[0, 3]] },
      { b: "Source", v: 3, x: [[0, 3]] },
    ],
    [],
    { root: 0 },
  );
  const rule = {
    id: "inventedTwice",
    in: /^Twice\(/,
    test: /^Source\(\)$/,
    proof: "N.js Twice",
  };
  const build = buildTree(rec, 0, [], [rule]);
  const [pass] = kidsOf(build.root);
  expect(pass?.code).toBe("Pass()");
  const rows = kidsOf(build.expand(pass?.id ?? "") ?? undefined);
  expect(rows.map((k) => [k.code, k.value, k.flags.gameBug])).toEqual([
    ["Source()", 3, "inventedTwice"],
    ["Source()", 3, "inventedTwice"],
  ]);
});

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

test("every game-bug rule's id passes the main's check of a tree (tree-check.ts isRuleId)", () => {
  for (const id of [...GAME_BUGS.map((r) => r.id), "inventedTwice"])
    expect(checkTree(node({ flags: { gameBug: id } }), 1)).not.toBe(null);
});
