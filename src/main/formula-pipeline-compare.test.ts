// The open tree live in the formula pipeline (spec 009 FR-015, replacing the 008's "Game changed · Refresh"): a newer
// reading writes the open number's value and its parts' into the tree on screen, with no button, and a change asks the
// tree again in silence, one request at a time and at most every 10 s since the last tree came, so its ⓘ and shares close
// with the live values. A mark still takes the tree's values by piece. The tree host is a fake; every value and name is
// invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
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

// The 10 s between two silent rebuilds are counted on a fake clock (FR-015, NFR-002).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
});
const seconds = (n: number) => {
  vi.setSystemTime(Date.now() + n * 1_000);
};

/** The Drop Rate's tree, 10 s after it came: a change may ask it again at once. */
function readyDrop() {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree(dropTree(CALCULATED.dropRate, 4));
  seconds(10);
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

test("a newer reading writes the open number's value and text and its parts' into the tree at once, and asks the tree again in silence", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(shown(h)).toEqual({
    rootText: "9x",
    root: 9,
    kids: [7, 2],
    calculatedAt: 1_000,
  });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  expect(h.last()).not.toHaveProperty("gameChanged");
});

test("the tree asked again comes with its ⓘ closing on the new value; a change while it is asked opens no other request, and after it comes only a new change asks again", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.setPair(pairAt(3, 10));
  h.values({ dropRate: 10, [SWORD]: 8, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  const formula: [string[], number[]] = [
    ["Sword", "+", "Ring"],
    [7, 2, 9],
  ];
  h.tree({ ...dropTree(9, 7), formula });
  const t = h.last();
  expect(t?.state === "ready" && t.root.formula).toEqual(formula);
  expect(shown(h).calculatedAt).toBe(2_000);
  // The values of a reading the new tree already has ask nothing.
  h.setPair(pairAt(4, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  // A new change within 10 s of the new tree is written in place, and asks the tree only once the 10 s are past.
  h.setPair(pairAt(5, 10));
  h.values({ dropRate: 10, [SWORD]: 8, [RING]: 2 });
  expect(shown(h).kids).toEqual([8, 2]);
  expect(h.host.request).toHaveBeenCalledTimes(2);
  seconds(10);
  h.setPair(pairAt(6, 10));
  h.values({ dropRate: 10, [SWORD]: 8, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(3);
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
  // A newer change while the tree is asked opens no second request.
  h.setPair(pairAt(3, 10));
  h.values({ dropRate: 10, [SWORD]: 4, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
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

test("a branch opened while the tree is asked again waits for the new one: the window asks it again then", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.p.request({ treeId: "dropRate", nodeId: "root/Ring" });
  // One waiting job in the host: an expand sent now would replace the tree asked, which would never come.
  expect(h.host.request).toHaveBeenCalledTimes(2);
});

test("a change at each reading asks the tree once in 10 s: the values are asked and written at each reading, and the tree after the 10 s", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree(dropTree(CALCULATED.dropRate, 4));
  for (let n = 1; n <= 9; n++) {
    seconds(1);
    const asked = h.host.values.mock.calls.length;
    h.setPair(pairAt(n + 1, 10 + n));
    expect(h.host.values).toHaveBeenCalledTimes(asked + 1);
    h.values({ dropRate: 10 + n, [SWORD]: 4 + n, [RING]: 2 });
    expect(shown(h).kids).toEqual([4 + n, 2]);
  }
  expect(h.host.request).toHaveBeenCalledOnce();
  seconds(1);
  h.setPair(pairAt(11, 20));
  h.values({ dropRate: 20, [SWORD]: 14, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  expect(h.host.request.mock.lastCall?.[1]).toEqual({
    type: "number",
    id: "dropRate",
    character: 0,
  });
});

test("the game closing with the tree asked again in silence keeps the tree on screen, stale", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.p.status({ game: "closed", reader: "connecting" });
  const t = h.last();
  expect(t?.state).toBe("ready");
  expect(t?.state === "ready" && t.stale).toBe(true);
  expect(shown(h).kids).toEqual([7, 2]);
});

test("a tree asked again in silence that fails keeps the tree on screen, and says so in the log with its id", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.unavailable();
  expect(h.last()?.state).toBe("ready");
  expect(shown(h).kids).toEqual([7, 2]);
  expect(h.log).toHaveBeenCalledWith({ event: "treeFailed", id: "dropRate" });
});

test("a branch asked keeps its turn: a change meanwhile is written in place, and the tree is asked only after the branch comes", () => {
  const h = readyDrop();
  h.p.request({ treeId: "dropRate", nodeId: "root/Ring" });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  const drops = h.host.dropCurrent.mock.calls.length;
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(shown(h).kids).toEqual([7, 2]);
  expect(h.host.dropCurrent).toHaveBeenCalledTimes(drops);
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.tree({ ...ring, kids: [node({ id: "root/Ring/Gem", pieceKey: null })] });
  expect(h.host.request).toHaveBeenCalledTimes(3);
  expect(h.host.request.mock.lastCall?.[1]).toMatchObject({ type: "number" });
});
