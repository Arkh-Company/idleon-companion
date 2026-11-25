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

/** `return s.B + <right>;` recorded with the reads `rx`: s.B worth `left` (6), the right leaf 6; the step's expression. */
function stepOf(right: string, rx: Rx, left = 6) {
  const { ops } = instrument(
    `Blocks._customBlock_T = function (p) { return s.B + ${right}; };`,
  );
  const [b, r] = ops.flatMap((o, i) => (o.kind === "leaf" ? [i] : []));
  const op = ops.findIndex((o) => o.kind === "op");
  const x: [number, number][] = [
    [b ?? -1, left],
    [r ?? -1, 6],
    [op, left + 6],
  ];
  const r0 = rx.map(([path, v]): [string, number] => [path, Number(v)]);
  const rec = recordingOf([{ b: "T", v: left + 6, r: r0, rx, x }]);
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

test("a variable leaf with a place is still tied by value to the one read of its value made elsewhere (T231 r1, Vinicius's option A)", () => {
  // Q, the only read worth 6, was read at s.B's place, before p's; a variable's tie by the turn's write is a later task
  expect(
    stepOf(
      "p",
      [
        ["B", 5, 0],
        ["Q", 6, 0],
      ],
      5,
    ),
  ).toMatchObject({
    l: { t: "read", p: "B", v: 5 },
    r: { t: "read", p: "Q", v: 6 },
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
