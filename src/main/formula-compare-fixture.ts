// The Drop Rate's tree of the live-tree tests of the formula pipeline (formula-pipeline-compare.test.ts and
// formula-pipeline-branches.test.ts): its parts, the Stats' next pairs and the fake clock's seconds. A test file that
// loads it fakes the clock first. Every value and name is invented.
import { vi } from "vitest";
import { node, pairOf, pipeline as setup } from "./formula-fixture.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { CALCULATED } from "./stats-pipeline-fixture.ts";

export const SWORD = '[0,"Sword"]';
export const RING = '[0,"Ring"]';
export const sword = (value: number) =>
  node({ id: "root/Sword", pieceKey: SWORD, value, role: "piece" });
export const ring = node({ id: "root/Ring", pieceKey: RING, value: 2 });
export const dropTree = (total: number, swordValue: number) =>
  node({ value: total, kids: [sword(swordValue), ring] });

/** The Stats' next pair, at `n` seconds, with its Drop Rate. */
export const pairAt = (
  n: number,
  dropRate = CALCULATED.dropRate,
): StatsPair => ({
  ...pairOf("Invented", n),
  numbers: { ...CALCULATED, dropRate },
});

export const seconds = (n: number) => {
  vi.setSystemTime(Date.now() + n * 1_000);
};

/** The Drop Rate's tree, 10 s after it came: a change may ask it again at once. */
export function readyDrop() {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree(dropTree(CALCULATED.dropRate, 4));
  seconds(10);
  return h;
}
export const shown = (h: ReturnType<typeof setup>) => {
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
