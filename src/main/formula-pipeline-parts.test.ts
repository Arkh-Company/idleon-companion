// "Game changed · Refresh" by a part of an open node (spec 008 FR-024, design.md C11; Vinicius's choice of 16/11): the
// pipeline asks the live values of the open tree's parts with the numbers in view, and the band lights when the text of
// one changes, never by a counter alone. The window never gets the parts' values. The tree host is a fake; every value
// and name is invented.
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
const gameChanged = (t: FormulaTree | undefined) =>
  t?.state === "ready" ? t.gameChanged : null;

function readyDrop(character: number | null = null) {
  const h = setup();
  h.p.request({ id: "dropRate", character });
  h.tree(node({ value: CALCULATED.dropRate, kids: [sword, lazy] }));
  return h;
}

test("the open tree's parts are asked with the numbers in view; the window never gets their values", () => {
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

test("the band lights when a part's text changes in a newer reading, with the root's the same", () => {
  const h = readyDrop();
  h.setPair(pairAt(2));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: 9 });
  expect(gameChanged(h.last())).toBe(true);
});

test("a part that moves below its text, or comes unavailable, does not light it", () => {
  const h = readyDrop();
  h.setPair(pairAt(2));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: 4.0001 });
  h.setPair(pairAt(3));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: null });
  expect(gameChanged(h.last())).toBe(false);
});

test("another character's tree asks no part: the live values are the active character's", () => {
  const h = readyDrop(1);
  expect(lastIds(h)).not.toContain(SWORD);
});
