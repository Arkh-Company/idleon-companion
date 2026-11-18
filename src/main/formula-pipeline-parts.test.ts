// The parts of an open node live (spec 008 FR-024; spec 009 FR-015): the pipeline asks the live values of the open tree's
// parts with the numbers in view and writes each one into its row; a part that loses its value asks the tree again. The
// live values channel carries only the catalog numbers. The tree host is a fake; every value and name is invented.
import { expect, test } from "vitest";
import type { FormulaTree } from "../shared/index.ts";
import { node, pairOf, pipeline as setup } from "./formula-fixture.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { CALCULATED } from "./stats-pipeline-fixture.ts";

const SWORD = '[0,"Sword",1]';
const INSIDE = '[0,"Inside",2]';
const sword = node({
  id: "root/Sword",
  pieceKey: SWORD,
  value: 4,
  fmt: "+",
  role: "piece",
});
const lazy = node({ id: "root/Part", pieceKey: '[0,"Part"]', kids: "lazy" });
const pairAt = (n: number): StatsPair => pairOf("Invented", n);
const lastIds = (h: ReturnType<typeof setup>) =>
  (h.host.values.mock.calls.at(-1)?.[1] ?? []) as string[];
/** The open tree's root text and the values of its first rows. */
const rows = (t: FormulaTree | undefined) =>
  t?.state === "ready" && Array.isArray(t.root.kids)
    ? { rootText: t.rootText, kids: t.root.kids.map((k) => k.value) }
    : null;

function readyDrop(character: number | null = null) {
  const h = setup();
  h.p.request({ id: "dropRate", character });
  h.tree(node({ value: CALCULATED.dropRate, kids: [sword, lazy] }));
  return h;
}

test("the open tree's parts are asked with the numbers in view; the live values channel carries only the catalog numbers", () => {
  const h = readyDrop();
  expect(lastIds(h)).toEqual(expect.arrayContaining(["dropRate", SWORD]));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: 4 });
  expect(Object.keys(h.liveSent.at(-1)?.values ?? {})).toEqual(["dropRate"]);
});

test("a branch opened adds its parts to what is asked", () => {
  const h = readyDrop();
  h.p.request({ treeId: "dropRate", nodeId: "root/Part" });
  h.tree({ ...lazy, kids: [node({ id: "root/Part/In", pieceKey: INSIDE })] });
  expect(lastIds(h)).toContain(INSIDE);
});

test("a part's value in a newer reading is written into its row, with the root's the same", () => {
  const h = readyDrop();
  const text = rows(h.last())?.rootText;
  h.setPair(pairAt(2));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: 9 });
  expect(rows(h.last())).toEqual({ rootText: text, kids: [9, 2.5] });
});

test("a part that moves below its text is written as it is; one that comes unavailable asks the tree again", () => {
  const h = readyDrop();
  h.setPair(pairAt(2));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: 4.0001 });
  expect(rows(h.last())?.kids).toEqual([4.0001, 2.5]);
  // The change asks the tree again in silence (FR-015); it comes with the part's new value.
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.tree(
    node({
      value: CALCULATED.dropRate,
      kids: [{ ...sword, value: 4.0001 }, lazy],
    }),
  );
  h.setPair(pairAt(3));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: null });
  expect(h.host.request).toHaveBeenCalledTimes(3);
  expect(h.last()?.state).toBe("ready");
});

test("a part with no live value that never had one asks nothing again", () => {
  const h = readyDrop();
  h.setPair(pairAt(2));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: null });
  expect(h.host.request).toHaveBeenCalledOnce();
});

test("a part still without value after the new tree asks the tree only once", () => {
  const h = readyDrop();
  h.setPair(pairAt(2));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: 4 });
  h.setPair(pairAt(3));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: null });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.tree(node({ value: CALCULATED.dropRate, kids: [sword, lazy] }));
  h.setPair(pairAt(4));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: null });
  expect(h.host.request).toHaveBeenCalledTimes(2);
});

test("another character's tree asks no part: the live values are the active character's", () => {
  const h = readyDrop(1);
  expect(lastIds(h)).not.toContain(SWORD);
});
