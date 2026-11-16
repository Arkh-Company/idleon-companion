// "Game changed · Refresh" in the formula pipeline (spec 008 FR-024, T041): the band lights when the open tree's number
// changes in the game, never by a counter alone, and Refresh brings the new tree with "was …" on each piece that changed.
// The tree host is a fake; every value and name is invented.
import { expect, test } from "vitest";
import { node, pairOf, pipeline as setup } from "./formula-fixture.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { CALCULATED } from "./stats-pipeline-fixture.ts";

const sword = (value: number) =>
  node({ id: "root/Sword", pieceKey: '[0,"Sword"]', value, role: "piece" });
const ring = node({ id: "root/Ring", pieceKey: '[0,"Ring"]', value: 2 });
const dropTree = (total: number, swordValue: number) =>
  node({ value: total, kids: [sword(swordValue), ring] });

/** The Stats' next pair, at `n` seconds, with its Drop Rate. */
const pairAt = (n: number, dropRate = CALCULATED.dropRate): StatsPair => ({
  ...pairOf("Invented", n),
  numbers: { ...CALCULATED, dropRate },
});

function readyDrop() {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree(dropTree(CALCULATED.dropRate, 4));
  return h;
}
const gameChanged = (h: ReturnType<typeof setup>) => {
  const t = h.last();
  return t?.state === "ready" ? t.gameChanged : null;
};

test("the band lights when the open number's text changes in a newer reading", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9 });
  expect(gameChanged(h)).toBe(true);
});

test("another character's tree never lights it: the live values are the active character's", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: 1 });
  h.tree(dropTree(CALCULATED.dropRate, 4));
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9 });
  expect(gameChanged(h)).toBe(false);
});

test("a counter or timer that moves no number in view does not light it (FR-024)", () => {
  const h = readyDrop();
  // A new mosaic (the kill counter moved) with the same Drop Rate, and a change too small for its text.
  h.setPair(pairAt(2));
  h.values({ dropRate: CALCULATED.dropRate });
  h.setPair(pairAt(3));
  h.values({ dropRate: CALCULATED.dropRate + 0.1 });
  expect(gameChanged(h)).toBe(false);
});

test("a value of the reading the tree was built on, or an unavailable one, does not light it", () => {
  const h = readyDrop();
  h.values({ dropRate: 9 });
  h.setPair(pairAt(2));
  h.values({ dropRate: null });
  expect(gameChanged(h)).toBe(false);
});

test("the band lights once: a second change sends nothing new", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9 });
  const count = h.sent.length;
  h.setPair(pairAt(3, 10));
  h.values({ dropRate: 10 });
  expect(h.sent).toHaveLength(count);
});

test("the game closed: the band does not light over the last reading", () => {
  const h = readyDrop();
  h.p.status({ game: "closed", reader: "connecting" });
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9 });
  expect(gameChanged(h)).toBe(false);
});

test("Refresh asks the same number again and shows `was` on each piece that changed, the band off", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9 });
  h.p.request({ id: "dropRate", character: null });
  h.tree(dropTree(9, 7));
  const t = h.last();
  if (t?.state !== "ready" || !Array.isArray(t.root.kids))
    throw new Error("not ready");
  expect(t.gameChanged).toBe(false);
  expect(t.rootText).toBe("9x");
  expect(t.root.was).toBe(CALCULATED.dropRate);
  expect(t.root.kids.map((k) => k.was)).toEqual([4, undefined]);
});

test("another number, or the same after a character change, has no `was`", () => {
  const h = readyDrop();
  h.p.request({ id: "hp", character: null });
  h.tree(node({ value: CALCULATED.hp, kids: [sword(7)] }));
  const other = h.last();
  expect(other?.state === "ready" && other.root.was).toBe(undefined);

  const g = readyDrop();
  g.setPair(pairOf("Other", 2));
  g.p.request({ id: "dropRate", character: null });
  g.tree(dropTree(CALCULATED.dropRate, 7));
  const t = g.last();
  expect(
    t?.state === "ready" && Array.isArray(t.root.kids) && t.root.kids[0]?.was,
  ).toBe(undefined);
});

test("a mark takes the open tree's values by piece, with the characters' names to keep out (FR-025, FR-010a)", () => {
  const h = readyDrop();
  expect(h.p.markOf(0)).toEqual({
    values: {
      '[0,"InventedBlock","sub",0,0]': CALCULATED.dropRate,
      '[0,"Sword"]': 4,
      '[0,"Ring"]': 2,
    },
    names: ["Invented", "Other"],
  });
  expect(h.p.markOf(1)).toBe(null);
  h.p.close();
  expect(h.p.markOf(0)).toBe(null);
});
