// The calculator's copy of the tree contract is pinned both ways against src/shared/formula-tree.ts (CODING_STANDARDS,
// "A forced copy of a shared literal is pinned both ways"): the literals by value, the types by `just typecheck`.
import { expect, expectTypeOf, test } from "vitest";
import {
  CONDITION_KINDS,
  LEAF_FAMILY,
  LEAF_KINDS,
  NODE_ROLES,
} from "../shared/index.ts";
import type { TreeFlags, TreeNode, TreeRequest } from "../shared/index.ts";
import {
  CALC_CONDITION_KINDS,
  CALC_LEAF_FAMILY,
  CALC_LEAF_KINDS,
  CALC_NODE_ROLES,
} from "./tree-contract.ts";
import type {
  CalcTreeFlags,
  CalcTreeNode,
  CalcTreeRequest,
} from "./tree-contract.ts";

test("the literals equal the shared ones", () => {
  expect(CALC_LEAF_KINDS).toEqual(LEAF_KINDS);
  expect(CALC_CONDITION_KINDS).toEqual(CONDITION_KINDS);
  expect(CALC_NODE_ROLES).toEqual(NODE_ROLES);
  expect(CALC_LEAF_FAMILY).toEqual(LEAF_FAMILY);
});

test("the types equal the shared ones", () => {
  expectTypeOf<CalcTreeFlags>().toEqualTypeOf<TreeFlags>();
  expectTypeOf<Omit<CalcTreeNode, "kids">>().toEqualTypeOf<
    Omit<TreeNode, "kids">
  >();
  expectTypeOf<CalcTreeNode["kids"]>().toEqualTypeOf<TreeNode["kids"]>();
  expectTypeOf<CalcTreeNode>().toEqualTypeOf<TreeNode>();
  expectTypeOf<CalcTreeRequest>().toEqualTypeOf<TreeRequest>();
});

test("no row carries a `was`: the 009 took out the 008's compare", () => {
  expectTypeOf<CalcTreeNode>().not.toHaveProperty("was");
  expectTypeOf<TreeNode>().not.toHaveProperty("was");
});
