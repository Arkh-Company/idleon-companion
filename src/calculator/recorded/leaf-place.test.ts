// The read a step's leaf stands for, by its own place (spec 010, T231): the reads its record's step count holds decide,
// never the value among the call's reads nor their order; two there are refused with the reason.
import { expect, test } from "vitest";
import { stepsGuide } from "../declared/draft-steps.ts";
import { recorded } from "../declared/lock-fixture.ts";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { recordingOf } from "../fixtures/recording-fixture.ts";
import { instrument } from "../instrument.ts";
import { bootRecorder } from "../tree-record.ts";
import { makeSteps } from "./steps.ts";

type Rx = NonNullable<Parameters<typeof recordingOf>[0][0]["rx"]>;

/** `return s.B + <right>;` recorded with the reads `rx`: s.B worth `left` (6), the right leaf `v` (6); the step's expression. */
function stepOf(right: string, rx: Rx, left = 6, v = 6) {
  const { ops } = instrument(
    `Blocks._customBlock_T = function (p) { return s.B + ${right}; };`,
  );
  const [b, r] = ops.flatMap((o, i) => (o.kind === "leaf" ? [i] : []));
  const op = ops.findIndex((o) => o.kind === "op");
  const x: [number, number][] = [
    [b ?? -1, left],
    [r ?? -1, v],
    [op, left + v],
  ];
  const r0 = rx.map(([path, val]): [string, number] => [path, Number(val)]);
  const rec = recordingOf([{ b: "T", v: left + v, r: r0, rx, x }]);
  return makeSteps(rec, ops).of(0).steps[0]?.e;
}

test("a leaf whose code names no path is the read at its own place, never another read of its value before it (T231)", () => {
  // B, worth the same 6, is read first, at the place before A's: the order and the value would both take it; D, after
  expect(
    stepOf("s.A", [
      ["B", 6, 0],
      ["A", 6, 1],
      ["D", 6, 2],
    ]),
  ).toMatchObject({
    l: { t: "read", p: "B", v: 6 },
    r: { t: "read", p: "A", v: 6 },
  });
});

test("two reads of a leaf's value at its own place are refused with the reason, never tied by order (T231)", () => {
  expect(
    stepOf("s.A", [
      ["B", 6, 0],
      ["C", 6, 1],
      ["A", 6, 1],
    ]),
  ).toMatchObject({
    l: { t: "read", p: "B", v: 6 },
    r: {
      t: "val",
      v: 6,
      why: "duas leituras de valor 6 no lugar da folha (C; A), e o lugar não as separa",
    },
  });
});

test("a variable leaf reads nothing at its own place: a read made there with its value is none of its (T231)", () => {
  // Q, read between B's record and p's, holds p's 6
  expect(
    stepOf("p", [
      ["B", 6, 0],
      ["Q", 6, 1],
    ]),
  ).toMatchObject({ r: { t: "val", v: 6 } });
});

test("a variable leaf with a place and no recorded write is never tied by value to the one read of its value made elsewhere (T232)", () => {
  // Q, the only read worth 6, was read at s.B's place, before p's
  expect(
    stepOf(
      "p",
      [
        ["B", 5, 0],
        ["Q", 6, 0],
      ],
      5,
    ),
  ).toEqual({
    t: "op",
    o: "+",
    l: { t: "read", p: "B", v: 5 },
    r: { t: "val", v: 6 },
    v: 11,
  });
});

/** TreeLoopBest over TreeList [3, 1, 2], its call, and where its max was recorded in its step log, turn by turn. */
function loopBest() {
  const recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
  const rec = recorder.record(
    mosaicOf({ TreeList: [3, 1, 2] }),
    [["TreeLoopBest", []]],
    { recompute: [], builders: [] },
  );
  const n = rec.nodes.find((x) => x.b === "TreeLoopBest");
  if (!n) throw new Error("no call");
  const max = recorder.ops.findIndex(
    (o) => o.block === "TreeLoopBest" && o.kind === "op",
  );
  const at = (n.x ?? []).flatMap(([o], j) => (o === max ? [j] : []));
  return { rec, recorder, n, at };
}

test("a loop's variable is its write of the turn before, by its place: never the one read of its value, the first turn's write nor its own turn's (T232)", () => {
  // TreeLoopBest over TreeList [3, 1, 2]: every turn writes 3, and TreeList[0] is the one read worth 3; the first turn's
  // best is the code's 0 it was set to
  const { rec, recorder, n } = loopBest();
  const max = (best: object, i: number, v: number) => ({
    t: "fn",
    name: "max",
    args: [best, { t: "read", p: `TreeList[${String(i)}]`, v }],
    v: 3,
  });
  const was = (e: object) => ({ t: "def", e, v: 3 });
  const zero = { t: "def", e: { t: "num", v: 0 }, v: 0 };
  expect(makeSteps(rec, recorder.ops).of(n.id).steps).toEqual([
    { v: 3, e: max(was(max(was(max(zero, 0, 3)), 1, 1)), 2, 2) },
  ]);
});

test("a loop turn's own steps take no write of an earlier turn: from the write's place on, they do (T232)", () => {
  const { rec, recorder, n, at } = loopBest();
  const [, second, third] = at;
  if (second === undefined || third === undefined) throw new Error("no turns");
  const best = (from: number) =>
    makeSteps(rec, recorder.ops).turnOf(n, { from, to: third }).steps[0]?.e;
  // the third turn alone: its best came in from the second turn's write, outside it
  expect(best(second + 1)).toMatchObject({
    args: [{ t: "val", v: 3 }, { p: "TreeList[2]" }],
  });
  expect(best(second)).toMatchObject({
    args: [
      { t: "def", e: { args: [{ t: "def" }, { p: "TreeList[1]" }] } },
      { p: "TreeList[2]" },
    ],
  });
});

test("a leaf whose code names a path is the read of it at its own place, never one read before it that the call's lock leaves alone (T231 r1)", () => {
  // x.A is 6 at the leaf's place and 5 after it, so the call's lock takes it out; y.x.A, worth 6, is read before
  expect(
    stepOf(
      "s.x.A",
      [
        ["B", 5, 0],
        ["y.x.A", 6, 0],
        ["x.A", 6, 1],
        ["x.A", 5, 2],
      ],
      5,
    ),
  ).toMatchObject({ r: { t: "read", p: "x.A", v: 6 } });
});

test("a leaf whose code names a path is the read of it at its own place, never one read after it that the call's lock leaves alone (T231 r1)", () => {
  // as above, with z.x.A, worth 6, read after the place
  expect(
    stepOf(
      "s.x.A",
      [
        ["B", 5, 0],
        ["x.A", 6, 1],
        ["x.A", 5, 2],
        ["z.x.A", 6, 2],
      ],
      5,
    ),
  ).toMatchObject({ r: { t: "read", p: "x.A", v: 6 } });
});

test("a leaf that reads, with a place, is never tied by value to a read made before its place (T231 r1)", () => {
  // Q, the only read worth 6, was read at s.B's place: s.A names no path Q fits
  expect(
    stepOf(
      "s.A",
      [
        ["B", 5, 0],
        ["Q", 6, 0],
      ],
      5,
    ),
  ).toMatchObject({ r: { t: "val", v: 6 } });
});

test("a leaf that reads, with a place, is never tied by value to a read made after its place (T231 r1)", () => {
  expect(
    stepOf(
      "s.A",
      [
        ["B", 5, 0],
        ["Q", 6, 2],
      ],
      5,
    ),
  ).toMatchObject({ r: { t: "val", v: 6 } });
});

test("two reads of the path a leaf names at its own place are refused with the reason (T231 r1)", () => {
  expect(
    stepOf(
      "s.x.A",
      [
        ["B", 5, 0],
        ["x.A", 6, 1],
        ["w.x.A", 6, 1],
      ],
      5,
    ),
  ).toMatchObject({
    r: {
      t: "val",
      v: 6,
      why: "duas leituras de valor 6 no lugar da folha (x.A; w.x.A), e o lugar não as separa",
    },
  });
});

test("a number read as text at the leaf's own place is its read; one read as text elsewhere is not (T231 r1)", () => {
  expect(
    stepOf("s.A", [
      ["B", 6, 0],
      ["C", "6", 0],
      ["A", "6", 1],
    ]),
  ).toMatchObject({
    l: { t: "val", v: 6 },
    r: { t: "read", p: "A", v: 6 },
  });
});

test("a key the save does not have is the leaf's read only when noted empty at its own place, never before or after it (r2 of part X)", () => {
  const empty = (xi: number) =>
    stepOf(
      "s.x.A",
      [
        ["B", 5, 0],
        ["x.A", "(undefined)", xi],
      ],
      5,
      0,
    );
  expect(empty(0)).toMatchObject({ r: { t: "val", v: 0 } });
  expect(empty(1)).toMatchObject({ r: { t: "read", p: "x.A", v: 0 } });
  expect(empty(2)).toMatchObject({ r: { t: "val", v: 0 } });
});

test("a number read from a text is the leaf's read only when the text was read at its own place, never before or after it (r2 of part X)", () => {
  const text = (path: string, xi: number) =>
    stepOf(`U.asNumber(U.replace(U.string(s.x.T), "X", ""))`, [
      ["B", 6, 0],
      [path, "6X", xi],
    ]);
  expect(text("y.x.T", 0)).toMatchObject({ r: { t: "val", v: 6 } });
  expect(text("x.T", 1)).toMatchObject({ r: { t: "read", p: "x.T", v: 6 } });
  expect(text("z.x.T", 2)).toMatchObject({ r: { t: "val", v: 6 } });
});

test("the guide shows a leaf's two reads at its place as a value with no source, with the reason (r1 of part X)", () => {
  // TreeTieRead's l[TreeTwins[0]] reads TreeTwins[0] and TreeList[2] at its place, both 2
  const { rec, key, ops } = recorded("TreeTieRoot", {
    TreeTwins: [2, 2],
    TreeList: [1, 2, 2],
  });
  expect(stepsGuide(key, rec, ops)).toContain(
    "passo: (TreeBase * «2 sem fonte: duas leituras de valor 2 no lugar da folha (TreeTwins[0]; TreeList[2]), e o lugar não as separa») = 8",
  );
});

test("an author's pass-through read by its alias in a turn is its read there, not «sem fonte» beside the cache's same value (T231)", () => {
  // TreeAuthorRelayRead over twins [3, 5, 7]: turn 3 reads the cache (6) and TreeCountDN (6); TreeCountDN was 2 in turn 1
  const recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
  const rec = recorder.record(
    mosaicOf({ TreeTwins: [3, 5, 7] }),
    [["TreeAuthorRelayRead", []]],
    { recompute: [], builders: [] },
  );
  const author = rec.nodes.find((n) => n.b === "TreeAuthorRelayRead");
  if (!author) throw new Error("no author");
  const last = makeSteps(rec, recorder.ops).of(author.id).steps.at(-1);
  expect(last?.e).toMatchObject({
    r: { r: { t: "read", p: "DNSM.TreeCountDN", v: 6 } },
  });
});

/** `var x = <def>; return s.B + x;` recorded with the reads `rx`, s.B worth 6 and x `v`: the step's right leaf. */
function varOf(def: string, rx: Rx, v: number) {
  const { ops } = instrument(
    `Blocks._customBlock_T = function () { var x = ${def}; return s.B + x; };`,
  );
  const [b, x] = ops.flatMap((o, i) => (o.kind === "leaf" ? [i] : []));
  const op = ops.findIndex((o) => o.kind === "op");
  const xs: [number, number][] = [
    [b ?? -1, 6],
    [x ?? -1, v],
    [op, 6 + v],
  ];
  const r0 = rx.map(([path, val]): [string, number] => [path, Number(val)]);
  const rec = recordingOf([{ b: "T", v: 6 + v, r: r0, rx, x: xs }]);
  return makeSteps(rec, ops).of(0).steps[0]?.e;
}

test("a variable no step set is the read its setting code names, a number read as text too (T232)", () => {
  expect(
    varOf(
      "s.x.T",
      [
        ["B", 6, 0],
        ["x.T", "15", 0],
      ],
      15,
    ),
  ).toMatchObject({
    r: { t: "read", p: "x.T", v: 15 },
  });
});

test("a variable no step set from a working map is the call's own value, never a read of the map (T232; T209 form 3)", () => {
  expect(
    varOf(
      "s.DNSM.x.T",
      [
        ["B", 6, 0],
        ["DNSM.x.T", 15, 0],
      ],
      15,
    ),
  ).toMatchObject({ r: { t: "val", v: 15 } });
});
