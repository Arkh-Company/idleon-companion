// A lazy branch opened while the open tree is asked again in silence (spec 009 FR-015): it waits for that tree and is
// asked on it; a tree that never takes the screen (failed, refused, diverged, the game closing) leaves the worker with no
// build of the tree on screen, so the row is unavailable and the next branch asks the tree again on the 10 s clock
// (NFR-002), by a timer when no reading comes. The tree host is a fake; every value and name is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { node, pipeline as setup } from "./formula-fixture.ts";
import {
  dropTree,
  pairAt,
  readyDrop,
  RING,
  ring,
  seconds,
  shown,
  SWORD,
  sword,
} from "./formula-compare-fixture.ts";

// The 10 s between two silent rebuilds are counted on a fake clock (FR-015, NFR-002).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
});

const EXPAND_RING = { treeId: "dropRate", nodeId: "root/Ring" };
const gem = node({ id: "root/Ring/Gem", pieceKey: null });

test("a branch opened while the tree is asked again is asked as soon as the new tree comes, and lands in it", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.p.request(EXPAND_RING);
  // One waiting job in the host: an expand sent now would replace the tree asked, which would never come.
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.tree(dropTree(9, 7));
  expect(h.host.request).toHaveBeenCalledTimes(3);
  expect(h.host.request.mock.lastCall?.[1]).toEqual({
    type: "expand",
    ...EXPAND_RING,
  });
  h.branch({ ...ring, kids: [gem] });
  const t = h.last();
  expect(
    t?.state === "ready" && Array.isArray(t.root.kids) && t.root.kids[1]?.kids,
  ).toEqual([gem]);
  expect(shown(h).calculatedAt).toBe(2_000);
});

const EXPAND_SWORD = { treeId: "dropRate", nodeId: "root/Sword" };
const kidOf = (h: ReturnType<typeof setup>, i: number) => {
  const t = h.last();
  return t?.state === "ready" && Array.isArray(t.root.kids)
    ? t.root.kids[i]
    : undefined;
};

test("a branch opened while the tree is asked again is unavailable at once when the new one fails; the next branch asks the tree again when the 10 s are past", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  h.p.request(EXPAND_RING);
  h.unavailable();
  // The worker dropped the tree on screen when it began the new one: no branch of it is asked.
  expect(h.host.request).toHaveBeenCalledTimes(2);
  expect(kidOf(h, 1)).toMatchObject({ flags: { unavailable: true }, kids: [] });
  // The branch waits, and the tree is asked by the clock of the silent rebuilds (NFR-002), never at the click.
  h.p.request(EXPAND_SWORD);
  h.p.request(EXPAND_SWORD);
  expect(h.host.request).toHaveBeenCalledTimes(2);
  h.setPair(pairAt(3, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(2);
  seconds(10);
  h.setPair(pairAt(4, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(3);
  expect(h.host.request.mock.lastCall?.[1]).toMatchObject({ type: "number" });
  expect(h.last()?.state).toBe("ready");
  h.tree(dropTree(9, 7));
  expect(h.host.request).toHaveBeenCalledTimes(4);
  expect(h.host.request.mock.lastCall?.[1]).toEqual({
    type: "expand",
    ...EXPAND_SWORD,
  });
  const edge = node({ id: "root/Sword/Edge", pieceKey: null });
  h.branch({ ...sword(7), kids: [edge] });
  expect(kidOf(h, 0)?.kids).toEqual([edge]);
});

test("a branch waiting for the tree asked again by the clock is unavailable when that tree fails too, and nothing more is asked", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  h.unavailable();
  h.p.request(EXPAND_SWORD);
  expect(h.host.request).toHaveBeenCalledTimes(2);
  seconds(10);
  h.setPair(pairAt(3, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(3);
  h.unavailable();
  expect(kidOf(h, 0)).toMatchObject({ flags: { unavailable: true }, kids: [] });
  h.setPair(pairAt(4, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  expect(h.host.request).toHaveBeenCalledTimes(3);
});

test.each<[string, unknown]>([
  ["a tree the check refuses", { id: 1 }],
  ["a tree whose root is not the Stats number", dropTree(99, 7)],
])(
  "%s, asked again in silence with a branch waiting: the branch is unavailable, never asked of that build",
  (_name, raw) => {
    const h = readyDrop();
    h.setPair(pairAt(2, 9));
    h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
    h.p.request(EXPAND_RING);
    h.tree(raw);
    expect(h.host.request).toHaveBeenCalledTimes(2);
    expect(kidOf(h, 1)).toMatchObject({
      flags: { unavailable: true },
      kids: [],
    });
    expect(shown(h).calculatedAt).toBe(1_000);
  },
);

/** A silent rebuild that failed at 10 s: the tree on screen has no build in the worker, and the 10 s start again. */
function failedRebuild() {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  h.unavailable();
  return h;
}

test.each<
  [string, { game: "running" | "closed"; reader: "released" | "connecting" }]
>([
  ["the reader released", { game: "running", reader: "released" }],
  ["the game closed", { game: "closed", reader: "connecting" }],
])(
  "with %s no reading comes: a branch with no build asks the tree when the 10 s are past, by one timer",
  (_name, status) => {
    const h = failedRebuild();
    h.p.status(status);
    h.p.request(EXPAND_SWORD);
    h.p.request(EXPAND_SWORD);
    expect(h.host.request).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(9_999);
    expect(h.host.request).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(h.host.request).toHaveBeenCalledTimes(3);
    expect(h.host.request.mock.lastCall?.[1]).toMatchObject({ type: "number" });
    h.tree(dropTree(9, 7));
    expect(h.host.request.mock.lastCall?.[1]).toEqual({
      type: "expand",
      ...EXPAND_SWORD,
    });
  },
);

test("the timer of a branch waiting for the tree goes when the tree closes", () => {
  const h = failedRebuild();
  h.p.request(EXPAND_SWORD);
  expect(vi.getTimerCount()).toBe(1);
  h.p.close();
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(10_000);
  expect(h.host.request).toHaveBeenCalledTimes(2);
});

test("the game closing takes the timer of a rebuild waiting its 10 s away: no tree is asked, and no worker starts, by itself", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  h.tree(dropTree(9, 7));
  seconds(2);
  h.setPair(pairAt(3, 10));
  h.values({ dropRate: 10, [SWORD]: 8, [RING]: 2 });
  expect(vi.getTimerCount()).toBe(1);
  const asked = h.host.request.mock.calls.length;
  h.p.status({ game: "closed", reader: "connecting" });
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(10_000);
  expect(h.host.request).toHaveBeenCalledTimes(asked);
});

test("the game closing with the tree asked again in silence: the next branch asks the tree again first, never the build the host kept", () => {
  const h = readyDrop();
  h.setPair(pairAt(2, 9));
  h.values({ dropRate: 9, [SWORD]: 7, [RING]: 2 });
  h.p.status({ game: "closed", reader: "connecting" });
  // The 10 s since the last tree are past: the tree is asked at the click, once.
  h.p.request(EXPAND_SWORD);
  h.p.request(EXPAND_SWORD);
  expect(h.host.request).toHaveBeenCalledTimes(3);
  expect(h.host.request.mock.lastCall?.[1]).toMatchObject({ type: "number" });
  h.tree(dropTree(9, 7));
  expect(h.host.request).toHaveBeenCalledTimes(4);
  expect(h.host.request.mock.lastCall?.[1]).toEqual({
    type: "expand",
    ...EXPAND_SWORD,
  });
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
