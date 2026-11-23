// The opening of a cache's author (spec 010, T168; CODING_STANDARDS, "The answer key ties by the recorded place, never
// by value alone"): the author's write opens by the steps of its turn, and a cache read in that count ties to the write
// its own place in those very steps saw, never to every place of the author's whole call that reads the path.
import { expect, test } from "vitest";
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import type { BlockSteps, Expr } from "../recorded/steps.ts";
import { openingOf } from "./level-openings.ts";
import type { LevelContext } from "./lock-levels.ts";
import { present } from "./lock-fixture.ts";

const X = "DNSM.TreeAuthor.v";
const Y = "DNSM.TreeOther.v";
const node = (id: number, b: string, p: number | null, c: number[] = []) =>
  ({ id, b, a: [], c, p, pxi: 0 }) satisfies RecNode;
const write = (path: string, n: number, seq: number, v: number, xi = 0) =>
  ({ path, node: n, v, xi, seq }) satisfies RecWrite;
// TreeAuthorNested read TreeOther at the place 0 (TreeOtherBuild's write, seq 1) and at the place 4 (TreeOtherAgain's,
// seq 2), and wrote TreeAuthor (seq 3) from the first: TreeOther × 2 = 10
const rec: Recording = {
  nodes: [
    node(0, "(root)", null, [1]),
    { ...node(1, "TreeAuthorRead", 0), r: [[X, 10, 0]], rx: [[X, 10, 0, 3]] },
    node(2, "(builders)", null, [3, 4, 5]),
    node(3, "TreeOtherBuild", 2),
    node(4, "TreeOtherAgain", 2),
    {
      ...node(5, "TreeAuthorNested", 2),
      rx: [
        [Y, 5, 0, 1],
        [Y, 7, 4, 2],
      ],
    },
  ],
  writes: [write(Y, 3, 1, 5), write(Y, 4, 2, 7), write(X, 5, 3, 10, 2)],
  spliced: [],
  bpStart: 0,
  setup: null,
  root: 0,
  builders: 2,
  fromGame: [],
};
const timesOf = (l: Expr, k: number, v: number): Expr => ({
  t: "op",
  o: "*",
  l,
  r: { t: "num", v: k },
  v,
});
// the author's whole call: TreeOther × 2 at the place 1, TreeOther × 3 at the place 5
const whole: BlockSteps = {
  steps: [
    { v: 10, e: timesOf({ t: "read", p: Y, v: 5 }, 2, 10) },
    { v: 21, e: timesOf({ t: "read", p: Y, v: 7 }, 3, 21) },
  ],
  checks: [],
  stepAt: [1, 5],
};
const ctx: LevelContext = {
  rec,
  stepsOf: (id) => (id === 5 ? whole : { steps: [], checks: [] }),
  // a turn's steps are new objects at each call, as makeSteps gives them
  turnOf: () => ({
    steps: [{ v: 10, e: timesOf({ t: "read", p: Y, v: 5 }, 2, 10) }],
    checks: [],
    stepAt: [1],
  }),
  character: 0,
  where: "invented",
};

test("a cache read in its author's count ties to the write its place in the author's turn saw", () => {
  const root = present(rec.nodes[1], "reader");
  const opened = openingOf(
    { expr: { t: "read", p: X, v: 10 }, scope: root },
    ctx,
  );
  const author = Array.isArray(opened) ? opened[0] : undefined;
  const e = author?.expr;
  const other = openingOf(
    {
      expr: e?.t === "op" ? e.l : null,
      scope: present(rec.nodes[5], "author"),
      steps: author?.steps,
    },
    ctx,
  );
  // every place of the whole call would see two authors (TreeOtherBuild, TreeOtherAgain): refused
  expect(Array.isArray(other) ? other.map((o) => o.part) : other).toEqual([
    "TreeOtherBuild()",
  ]);
});
