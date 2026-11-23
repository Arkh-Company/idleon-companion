// The write a cache read saw is chosen by its place (spec 010, T166; CODING_STANDARDS, "The answer key ties by the
// recorded place, never by value alone"): the step that uses the read ties to the last read of the step log at or
// before its place, never to the read with the same value nor to the first one. When the reads the steps use saw
// writes of different blocks, the place does not decide: refused with the reason. And the expression of the author's
// write is its last step in its turn, only with the write's value, the turn starting after its write before it.
import { expect, test } from "vitest";
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import type { BlockSteps, Expr, LoopTurn, Step } from "../recorded/steps.ts";
import { cacheAuthor, writeExpr } from "./cache-author.ts";
import { present } from "./lock-fixture.ts";

const X = "DNSM.TreeAuthor.v";
const node = (id: number, b: string, p: number | null, c: number[] = []) =>
  ({ id, b, a: [], c, p, pxi: 0 }) satisfies RecNode;
const write = (n: number, seq: number, xi = 0): RecWrite => ({
  path: X,
  node: n,
  v: 15,
  xi,
  seq,
});
// the reader, under the root, read the cache at the places 0 and 3: the first saw TreeAuthorAgain's write (seq 1), the
// second TreeAuthorBuild's (seq 2), both 15
const rec: Recording = {
  nodes: [
    node(0, "(root)", null, [1]),
    {
      ...node(1, "TreeAuthorRead", 0),
      r: [[X, 15, 1]],
      rx: [
        [X, 15, 0, 1],
        [X, 15, 3, 2],
      ],
    },
    node(2, "(setup: game helpers)", null, [3, 4]),
    node(3, "TreeAuthorAgain", 2),
    node(4, "TreeAuthorBuild", 2),
  ],
  writes: [write(3, 1), write(4, 2)],
  spliced: [],
  bpStart: null,
  setup: 2,
  root: 0,
  builders: null,
  fromGame: [],
};
const reader = present(rec.nodes[1], "reader");
const read: Expr = { t: "read", p: X, v: 15 };
const step = (v: number): Step => ({
  v,
  e: { t: "op", o: "*", l: read, r: { t: "num", v: 2 }, v },
});
const stepsAt = (...at: number[]): BlockSteps => ({
  steps: at.map(() => step(30)),
  checks: [],
  stepAt: at,
});
const authorOf = (steps: BlockSteps) => {
  const a = cacheAuthor(rec, X, reader, steps);
  return a && "node" in a ? a.node.b : a;
};

test("the step that uses the cache read ties to the read at its place, not to the first read nor by value", () => {
  // the read at place 0 (a check, no step) saw TreeAuthorAgain; the step at place 3 used the one TreeAuthorBuild wrote
  expect(authorOf(stepsAt(3))).toBe("TreeAuthorBuild");
});

test("reads the steps use at places that saw writes of different blocks are refused: the place does not decide", () => {
  expect(authorOf(stepsAt(0, 3))).toEqual({
    refused: `a leitura de ${X} tem mais de um autor possível (TreeAuthorAgain() seq 1; TreeAuthorBuild() seq 2)`,
    ambiguous: true,
  });
});

/** writeExpr with a turnOf that keeps the range it got and gives one step of value `v`. */
const exprOf = (w: RecWrite, v: number, spliced: RecWrite[] = []) => {
  const ranges: LoopTurn[] = [];
  const e = writeExpr(
    { ...rec, writes: [write(4, 5, 3), w], spliced },
    { node: present(rec.nodes[4], "author"), write: w },
    (_n, range) => {
      ranges.push(range);
      return { steps: [step(v)], checks: [] };
    },
  );
  return { e, ranges };
};

test("the author's write gives no expression when its last step in the turn has another value", () => {
  expect(exprOf(write(4, 9, 7), 30).e).toBeNull();
  expect(exprOf(write(4, 9, 7), 15).e).toEqual(step(15).e);
});

test("the author's turn starts after its write before it by number, whether that write is the cache's or the pass's", () => {
  // the pass's scratch write (seq 4) comes before the cache's (seq 5): the turn starts after the cache's, at xi 3
  const { ranges } = exprOf(write(4, 9, 7), 15, [write(4, 4, 2)]);
  expect(ranges).toEqual([{ from: 3, to: 6 }]);
});

// the reader read the cache at place 0 (TreeAuthorAgain's write, seq 1), wrote it itself (seq 2) and read it again
const own: Recording = {
  ...rec,
  nodes: rec.nodes.map((n) =>
    n.id === 1
      ? {
          ...n,
          rx: [
            [X, 15, 0, 1],
            [X, 30, 3, 2],
          ],
        }
      : n,
  ),
  writes: [write(3, 1), { ...write(1, 2), v: 30 }],
};
const nameOf = (a: ReturnType<typeof cacheAuthor>) =>
  a && "node" in a ? a.node.b : a;

test("a place whose read saw the reader's own write is a passage: the other place decides, no second author", () => {
  const a = cacheAuthor(own, X, present(own.nodes[1], "r"), stepsAt(0, 3));
  expect(nameOf(a)).toBe("TreeAuthorAgain");
});

test("the exact place of the read decides: the term opened at the place after the reader's own write is a passage", () => {
  // each step its own read of the cache, at the places 0 and 3: the read opened is one of them, by the object itself
  const reads = [0, 3].map((): Expr => ({ t: "read", p: X, v: 15 }));
  const steps: BlockSteps = {
    steps: reads.map((l) => ({
      v: 30,
      e: { t: "op", o: "*", l, r: { t: "num", v: 2 }, v: 30 },
    })),
    checks: [],
    stepAt: [0, 3],
  };
  const r = present(own.nodes[1], "r");
  expect(cacheAuthor(own, X, r, steps, reads[1])).toBeNull();
  expect(nameOf(cacheAuthor(own, X, r, steps, reads[0]))).toBe(
    "TreeAuthorAgain",
  );
});

test("an author that reads the cache after its one write is refused as reading its own write, not as a sum in turns", () => {
  // TreeAuthorAgain, a block of the helpers (outside the root), wrote the cache once and then read it
  const self: Recording = {
    ...rec,
    nodes: rec.nodes.map((n) =>
      n.id === 3 ? { ...n, rx: [[X, 15, 1, 1]] } : n,
    ),
    writes: [write(3, 1)],
  };
  expect(
    cacheAuthor(self, X, present(self.nodes[3], "author"), stepsAt(1)),
  ).toEqual({
    refused: `o cache ${X} é lido pelo próprio autor depois de escrevê-lo`,
  });
});
