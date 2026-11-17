// The two fields of a pool and a system group (spec 009, data-model.md): how its rows give its value, and whether a
// pool adds its bonuses first or multiplies everything.
import { expect, test } from "vitest";
import { COMBINE_KINDS, NODE_ROLES, POOL_KINDS } from "./formula-tree.ts";

test("a pool or a group combines its rows by a sum, a product, 1 + percent, or the root's max or min", () => {
  expect(COMBINE_KINDS).toEqual([
    "sum",
    "product",
    "onePlusPercent",
    "max",
    "min",
  ]);
});

test("a pool is additive or multi", () => {
  expect(POOL_KINDS).toEqual(["additive", "multi"]);
});

test("the roles have the pool and the system group", () => {
  expect(NODE_ROLES).toEqual(expect.arrayContaining(["pool", "system"]));
});
