// Every row that ends with no kids is a leaf with its type (audit family 6, the memory of the 9 types of leaf): one of
// the 9, or `unknown` with its `why`, never no type. A call that opens empty is typed when it is placed, and ends there.
// Invented calls and values.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { lazy, leaf, named, placed } from "./tree-fixture.ts";

const typed = (n: CalcTreeNode | undefined) => [
  n?.kids,
  n?.leaf,
  typeof n?.why,
];

test("a branch that ends with no kids is a leaf with a type, unknown with its why when nothing proves one", () => {
  const [n] = placed({}, [named("Invented branch", 5, [])]).rows;
  expect(typed(n)).toEqual([[], "unknown", "string"]);
});

test("a call that opens empty is typed when it is placed, and has no kids to open", () => {
  const [n] = placed({ 1: [] }, [lazy("Invented call", 3, "Call1()", 1)]).rows;
  expect(typed(n)).toEqual([[], "unknown", "string"]);
});

test("a call that opens into rows stays to be opened, with no type of leaf", () => {
  const parts = [
    leaf("Part A", 1, "Stats.a", "rawBonus"),
    leaf("Part B", 2, "Stats.b", "rawBonus"),
  ];
  const [n] = placed({ 1: parts }, [
    lazy("Invented call", 3, "Call1()", 1),
  ]).rows;
  expect([n?.kids, n?.leaf ?? null]).toEqual(["lazy", null]);
});
