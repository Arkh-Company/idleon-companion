// The lock and another class's source (spec 010, FR-002a): the invented Drop Rate (TreeDeclChain and its blueprint
// decl-chain), whose talent is class 3's.
import { expect, test } from "vitest";
import { chainInput, inventedBlueprint, sourceOf } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

test("another class's source is not descended: below it is what its own class's character has (FR-002a)", () => {
  // the talent's points as the twin's record: its own class's character sees the wrong child
  const bp = inventedBlueprint("decl-chain");
  const points = sourceOf(bp, 0, "talents", "talent", "talent", "points");
  points.ref = { read: "TreeTwins[1]" };
  points.leaf = "record";
  expect(lockBlueprint(chainInput(bp)).errors.map((e) => e.kind)).toContain(
    "undeclaredPart",
  );
  // another class's character: the source is not in its tree, only its value is checked
  expect(
    lockBlueprint({ ...chainInput(bp), characterClass: 5 }).errors,
  ).toEqual([
    {
      kind: "classMismatch",
      where: "decl-chain/0/talents/talent",
      expected: "3",
      got: 5,
    },
  ]);
});
