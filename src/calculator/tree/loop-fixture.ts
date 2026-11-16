// A cache filled in a loop over a step written by hand, for the loop tests (pieces.cjs entryRows and cacheRows at
// BASELINE-4): W adds s.A to the running total t in each turn, and Top reads the total.
import { instrument } from "../instrument.ts";
import type { RecNode, Recording } from "../recording.ts";
import { buildTree } from "../tree-build.ts";
import { openPath as open, recordingOf } from "./tree-fixture.ts";

/**
 * A loop over `t = t + s.A` written by hand: Top reads the cache W wrote at the end of each turn. `turns` gives each
 * turn's running total before, its A, and the reads the turn made (with their place in the step log).
 */
export const LOOP = instrument(
  "Blocks._customBlock_W = function () { t = t + s.A; };",
).ops;
export const [OP, T, A] = ["op", "leaf", "leaf"].map((kind, i) =>
  LOOP.findIndex(
    (o, j) =>
      o.kind === kind &&
      (i < 2 || j > LOOP.findIndex((x) => x.kind === "leaf")),
  ),
);
export function loopOf(
  turns: [before: number, a: number][],
  rx: NonNullable<RecNode["rx"]>,
  more: Partial<RecNode> = {},
  writes = turns.map(([t, a], i) => ({
    path: "DNSM.Acc.v",
    node: 2,
    v: t + a,
    seq: i + 1,
    xi: 3 * (i + 1),
  })),
) {
  const last = writes.at(-1)?.v ?? 0;
  return recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 1, r: [["DNSM.Acc.v", last, writes.length]] },
      {
        b: "W",
        x: turns.flatMap(([t, a]): [number, number][] => [
          [T ?? -1, t],
          [A ?? -1, a],
          [OP ?? -1, t + a],
        ]),
        rx,
        ...more,
      },
    ],
    writes,
    { root: 0 },
  );
}
export const loopRows = (rec: Recording) =>
  open(buildTree(rec, 0, LOOP), "DNSM.Acc.v");
