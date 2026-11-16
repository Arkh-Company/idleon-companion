// Which rows of an open node show (FR-014, design.md C15): the parts shown keep the game's order, also a part with no
// share among them (review of the feature, R-I3). Every value and name is invented.
import { expect, test } from "vitest";
import { node } from "./formula-fixture.ts";
import { partition } from "./tree-parts.ts";

test("with more than 10 parts, a Condition in the middle stays in its place among the parts shown", () => {
  const shares = [
    0.4,
    0.3,
    0.1,
    0.05,
    0.04,
    null,
    0.03,
    0.02,
    0.02,
    0.02,
    0.01,
    0.01,
  ];
  const kids = shares.map((share, i) =>
    node({
      id: `root/P${String(i)}`,
      name: `Part ${String(i)}`,
      share,
      shareMode: share === null ? "condition" : "sum",
      leaf: share === null ? "condition" : "level",
    }),
  );
  const { shown } = partition(kids);
  const order = shown.map((k) => kids.indexOf(k));
  expect(order).toContain(5);
  expect(order).toEqual(order.toSorted((a, b) => a - b));
});
