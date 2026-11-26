// A variable leaf by its place (spec 010, T232): its last recorded write before it, the value only confirming it; a
// loop turn's own steps take an earlier turn's write as from outside them, and a write before the loop as built; with
// no write, what no step set (leaf-reads.ts setBy): the code's number, or the one path its setting code names.
import { expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { recordingOf } from "../fixtures/recording-fixture.ts";
import { instrument } from "../instrument.ts";
import { bootRecorder } from "../tree-record.ts";
import { makeSteps } from "./steps.ts";

type Rx = NonNullable<Parameters<typeof recordingOf>[0][0]["rx"]>;

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

test("a loop turn's own steps take the write made before the loop, by its place: never a value with no source, nor the read of its value (T232 r1)", () => {
  // TreeLoopScaled over TreeBase 4 and TreeList [8, 1, 2]: m = TreeBase * 2 = 8 before the loop, and TreeList[0] is 8 too
  const recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
  const rec = recorder.record(
    mosaicOf({ TreeList: [8, 1, 2] }),
    [["TreeLoopScaled", []]],
    { recompute: [], builders: [] },
  );
  const n = rec.nodes.find((x) => x.b === "TreeLoopScaled");
  if (!n) throw new Error("no call");
  const [scale, max] = recorder.ops.flatMap((o, i) =>
    o.block === "TreeLoopScaled" && o.kind === "op" && o.parent === undefined
      ? [i]
      : [],
  );
  const log = n.x ?? [];
  const m = log.findIndex(([o]) => o === scale);
  const [first, second] = log.flatMap(([o], j) => (o === max ? [j] : []));
  if (first === undefined || second === undefined) throw new Error("no turns");
  const made = makeSteps(rec, recorder.ops);
  const scaled = (from: number, to: number, i: number) => {
    expect(made.turnOf(n, { from, to }).steps[0]?.e).toMatchObject({
      args: [
        {},
        {
          l: { t: "read", p: `TreeList[${String(i)}]` },
          r: {
            t: "def",
            e: { o: "*", l: { t: "read", p: "TreeBase", v: 4 }, v: 8 },
            v: 8,
          },
        },
      ],
    });
  };
  scaled(m + 1, first, 0);
  scaled(first + 1, second, 1);
});

test("a loop turn whose test skips the loop's write takes an earlier turn's write as from outside it, by the write's place in the loop: never the write built (T232 r2)", () => {
  // TreeLoopIf over TreeList [3, 1, 2]: only the first turn writes best = TreeList[0] * 1 = 3; the second turn's test
  // reads best 3 and TreeList[0] is the read worth 3
  const recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
  const rec = recorder.record(
    mosaicOf({ TreeList: [3, 1, 2] }),
    [["TreeLoopIf", []]],
    { recompute: [], builders: [] },
  );
  const n = rec.nodes.find((x) => x.b === "TreeLoopIf");
  if (!n) throw new Error("no call");
  const mine = (kind: string) =>
    recorder.ops.flatMap((o, i) =>
      o.block === "TreeLoopIf" && o.kind === kind ? [i] : [],
    );
  const [test0] = mine("test");
  const [mul] = mine("op");
  const log = n.x ?? [];
  const write = log.findIndex(([o]) => o === mul);
  const second = log.findIndex(([o], j) => o === test0 && j > write);
  if (write < 0 || second < 0) throw new Error("no turns");
  const turn = makeSteps(rec, recorder.ops).turnOf(n, {
    from: write + 1,
    to: second,
  });
  expect(turn.checks[0]?.e).toMatchObject({
    l: { t: "read", p: "TreeList[1]" },
    r: { t: "val", v: 3 },
  });
});

test("a variable set last by an assignment no step recorded is never an earlier write of its name of the same value: no place decides (T232 r2)", () => {
  // the minifier reuses `o`: A and B both worth 5, and only `s.A * 1` is a step of the log
  const last = (body: string) => {
    const { ops } = instrument(
      `Blocks._customBlock_T = function () { ${body} return s.C + o; };`,
    );
    const [a, c, o] = ops.flatMap((x, i) => (x.kind === "leaf" ? [i] : []));
    const [mul, add] = ops.flatMap((x, i) => (x.kind === "op" ? [i] : []));
    const xs = [a, mul, c, o, add].map((id, j): [number, number] => [
      id ?? -1,
      [5, 5, 6, 5, 11][j] ?? 0,
    ]);
    const rx: Rx = [
      ["A", 5, 0],
      ["B", 5, 1],
      ["C", 6, 2],
    ];
    const r = rx.map(([p, v]): [string, number] => [p, Number(v)]);
    const rec = recordingOf([{ b: "T", v: 11, r, rx, x: xs }]);
    return makeSteps(rec, ops).of(0).steps.at(-1)?.e;
  };
  expect(last("var o = s.A * 1; o = U.asNumber(s.B);")).toMatchObject({
    r: { t: "val", v: 5 },
  });
  expect(last("var o = U.asNumber(s.B); o = s.A * 1;")).toMatchObject({
    r: { t: "def", e: { o: "*" }, v: 5 },
  });
});

/** `var x = <def>; return s.B + <leaf>;` recorded with the reads `rx`, s.B worth 6 and the leaf `v`: the step's expression. */
function varOf(def: string, rx: Rx, v: number, leaf = "x") {
  const { ops } = instrument(
    `Blocks._customBlock_T = function () { var x = ${def}; return s.B + ${leaf}; };`,
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

test("a variable no step set, read through asNumber, is the read its setting code names, never one of two of its value (T232)", () => {
  const num = (rx: Rx) => varOf("s.x.T", rx, 15, "U.asNumber(x)");
  expect(
    num([
      ["B", 6, 0],
      ["x.T", "15", 0],
    ]),
  ).toMatchObject({ r: { t: "read", p: "x.T", v: 15 } });
  expect(
    num([
      ["B", 6, 0],
      ["x.T", "15", 0],
      ["y.x.T", "15", 0],
    ]),
  ).toMatchObject({ r: { t: "val", v: 15 } });
});

test("a variable no step set is never the read its setting code names picked by value: two paths that fit, or the one worth it beside another (T232 r1)", () => {
  const x = (rx: Rx) => varOf("s.x.T", [["B", 6, 0], ...rx], 15);
  expect(
    x([
      ["x.T", "15", 0],
      ["y.x.T", "15", 0],
    ]),
  ).toMatchObject({ r: { t: "val", v: 15 } });
  expect(
    x([
      ["x.T", "14", 0],
      ["y.x.T", "15", 0],
    ]),
  ).toMatchObject({ r: { t: "val", v: 15 } });
});

test("a variable no step set from a member of one name is that path only, never another ending in it (T232 r1)", () => {
  const t = (path: string) =>
    varOf(
      "s.T",
      [
        ["B", 6, 0],
        [path, "15", 0],
      ],
      15,
    );
  expect(t("T")).toMatchObject({ r: { t: "read", p: "T", v: 15 } });
  expect(t("y.T")).toMatchObject({ r: { t: "val", v: 15 } });
});

test("a variable no step set from a path with a computed key is no read: the key is not known (T232 r1)", () => {
  expect(
    varOf(
      "s.x[s.k].T",
      [
        ["B", 6, 0],
        ["x.a.T", "15", 0],
      ],
      15,
    ),
  ).toMatchObject({ r: { t: "val", v: 15 } });
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

test("a variable no step set is never the one path left once a working map's that fits is taken out: two fit (T232 r2)", () => {
  expect(
    varOf(
      "s.x.T",
      [
        ["B", 6, 0],
        ["DNSM.x.T", "15", 0],
        ["y.x.T", "15", 0],
      ],
      15,
    ),
  ).toMatchObject({ r: { t: "val", v: 15 } });
});
