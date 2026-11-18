// The open tree live in the formula pipeline (spec 009 FR-015, replacing the 008's "Game changed · Refresh"): a newer
// reading writes the open number's value and its parts' into the tree on screen, with no button; a change the parts
// followed do not explain asks the tree again by itself. A mark still takes the tree's values by piece. The tree host is
// a fake; every value and name is invented.
import { expect, test } from "vitest";
import { node, pairOf, pipeline as setup } from "./formula-fixture.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { CALCULATED } from "./stats-pipeline-fixture.ts";

const SWORD = '[0,"Sword"]';
const RING = '[0,"Ring"]';
const sword = (value: number) =>
  node({ id: "root/Sword", pieceKey: SWORD, value, role: "piece" });
const ring = node({ id: "root/Ring", pieceKey: RING, value: 2 });
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
const shown = (h: ReturnType<typeof setup>) => {
  const t = h.last();
  if (t?.state !== "ready" || !Array.isArray(t.root.kids))
    throw new Error("not ready");
  return {
    rootText: t.rootText,
    root: t.root.value,
    kids: t.root.kids.map((k) => k.value),
    calculatedAt: t.calculatedAt,
  };
};

test("a newer reading writes the open number's value and text and its parts' into the tree, asking nothing again", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(shown(h)).toEqual({
    rootText: "9x",
    root: 9,
    kids: [7, 2],
    calculatedAt: 1_000,
  });
  expect(h.host.request).toHaveBeenCalledOnce();
  expect(h.last()).not.toHaveProperty("gameChanged");
});

test("another character's tree never takes them: the live values are the active character's", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: 1 });
  h.tree(dropTree(CALCULATED.dropRate, 4));
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7 });
  expect(shown(h).kids).toEqual([4, 2]);
  expect(shown(h).root).toBe(CALCULATED.dropRate);
});

test("a counter or timer that moves no number in view sends no new tree (FR-024)", () => {
  const h = readyDrop();
  const count = h.sent.length;
  h.setPair(pairAt(2));
  h.values({ dropRate: CALCULATED.dropRate, [SWORD]: 4, [RING]: 2 });
  expect(h.sent).toHaveLength(count);
});

test("a value of the reading the tree was built on, or an unavailable number, changes nothing", () => {
  const h = readyDrop();
  const count = h.sent.length;
  h.values({ dropRate: 9, [SWORD]: 7 });
  h.setPair(pairAt(2));
  h.values({ dropRate: null });
  expect(h.sent).toHaveLength(count);
  expect(h.host.request).toHaveBeenCalledOnce();
});

test("the game closed: the tree takes no value over the last reading", () => {
  const h = readyDrop();
  h.p.status({ game: "closed", reader: "connecting" });
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7 });
  expect(shown(h).kids).toEqual([4, 2]);
});

test("the number moving with no part followed moving asks the tree again by itself, the old one on screen meanwhile; the new one has no `was`", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 4, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  expect(h.last()?.state).toBe("ready");
  h.tree(dropTree(9, 7));
  const t = h.last();
  if (t?.state !== "ready" || !Array.isArray(t.root.kids))
    throw new Error("not ready");
  expect(shown(h)).toEqual({
    rootText: "9x",
    root: 9,
    kids: [7, 2],
    calculatedAt: 2_000,
  });
  expect(t.root.was).toBe(undefined);
  expect(t.root.kids.map((k) => k.was)).toEqual([undefined, undefined]);
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
