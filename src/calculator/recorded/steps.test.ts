// The steps and checks of a block (build-tree.cjs 8d at BASELINE-4), from the invented game's recording and the
// instrumentation's steps: what each number of the block's arithmetic was made of.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { instrument } from "../instrument.ts";
import { bootRecorder } from "../tree-record.ts";
import { recordingOf } from "../fixtures/recording-fixture.ts";
import { lastReads, makeSteps } from "./steps.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

const NONE = { recompute: [], builders: [] };
/** The steps and checks of the root call of `block`, and the ids of its calls by block. */
function blockOf(block: string, mosaic = mosaicOf()) {
  const rec = recorder.record(mosaic, [[block, [0, 0, 0]]], NONE);
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("no root call");
  const kid = (b: string) => rec.nodes.find((n) => n.b === b)?.id;
  return { ...makeSteps(rec, recorder.ops).of(top.id), kid };
}

test("the block's top step is a tree of its calls, its reads and the operators, each with its value", () => {
  const { steps, kid } = blockOf("TreeSources");
  expect(steps).toEqual([
    {
      v: 52,
      e: {
        t: "op",
        o: "+",
        l: {
          t: "op",
          o: "*",
          l: { t: "call", id: kid("TreeReads"), v: 8 },
          r: { t: "call", id: kid("TreeLoop"), v: 6 },
          v: 48,
        },
        r: { t: "read", p: "TreeBase", v: 4 },
        v: 52,
      },
    },
  ]);
});

test("a min of the game is a function step with its name; its numbers are constants", () => {
  expect(blockOf("TreeMinCap").steps).toEqual([
    {
      v: 50,
      e: {
        t: "fn",
        name: "min",
        args: [
          { t: "read", p: "TreeCapped", v: 80 },
          { t: "num", v: 50 },
        ],
        v: 50,
      },
    },
  ]);
});

test("a check on the player's state is kept with its answer, and its read is used up", () => {
  const { steps, checks } = blockOf("TreeConditionNo");
  expect(checks).toEqual([
    {
      v: false,
      e: {
        t: "op",
        o: ">",
        l: { t: "read", p: "TreeOwned", v: 0 },
        r: { t: "num", v: 0 },
        v: false,
      },
    },
  ]);
  expect(steps).toEqual([
    {
      v: 4,
      e: {
        t: "op",
        o: "+",
        l: { t: "read", p: "TreeBase", v: 4 },
        r: { t: "val", v: 0 },
        v: 4,
      },
    },
  ]);
});

test("a check of the block's own argument only routes the code: it is no check", () => {
  expect(blockOf("TreeCacheFill").checks).toEqual([]);
});

test("a variable opens into the earlier step that set it, and each top step counts in the order it ran", () => {
  const twice = {
    t: "op",
    o: "*",
    l: { t: "read", p: "TreeBase", v: 4 },
    r: { t: "num", v: 2 },
    v: 8,
  };
  expect(blockOf("TreeDef").steps).toEqual([
    { v: 8, e: twice },
    {
      v: 9,
      e: {
        t: "op",
        o: "+",
        l: { t: "def", e: twice, v: 8 },
        r: { t: "num", v: 1 },
        v: 9,
      },
    },
  ]);
});

test("`x *= y` is what x was before, times y", () => {
  expect(blockOf("TreeAssign").steps).toEqual([
    {
      v: 13,
      e: {
        t: "op",
        o: "+",
        l: {
          t: "def",
          e: {
            t: "op",
            o: "*",
            l: { t: "read", p: "TreeBase", v: 4 },
            r: { t: "num", v: 3 },
            v: 12,
          },
          v: 12,
        },
        r: { t: "num", v: 1 },
        v: 13,
      },
    },
  ]);
});

test("`+=`, `-=`, `/=` and `++` each open into what the variable was before", () => {
  const was = (e: object, v: number) => ({ t: "def", e, v });
  const added = {
    t: "op",
    o: "+",
    l: { t: "read", p: "TreeBase", v: 4 },
    r: { t: "num", v: 6 },
    v: 10,
  };
  const less = {
    t: "op",
    o: "-",
    l: was(added, 10),
    r: { t: "num", v: 2 },
    v: 8,
  };
  const split = {
    t: "op",
    o: "/",
    l: was(less, 8),
    r: { t: "num", v: 4 },
    v: 2,
  };
  const plusOne = {
    t: "op",
    o: "+",
    l: was(split, 2),
    r: { t: "val", v: 1 },
    v: 3,
  };
  expect(blockOf("TreeAssignAll").steps).toEqual([
    {
      v: 15,
      e: { t: "op", o: "*", l: was(plusOne, 3), r: { t: "num", v: 5 }, v: 15 },
    },
  ]);
});

test("two reads with the same value: the one the code's own path names", () => {
  const [step] = blockOf("TreeTwins").steps;
  expect(step?.e).toMatchObject({
    l: { t: "read", p: "TreeTwins[0]", v: 3 },
    r: { l: { t: "read", p: "TreeTwins[1]", v: 3 } },
  });
});

test("a text literal of the code never enters a check, only whether it is empty", () => {
  const { ops } = instrument(
    'Blocks._customBlock_T = function () { return s.A === "secret" ? 1 : 0; };',
  );
  const test = ops.findIndex((o) => o.kind === "test");
  const leaf = ops.findIndex((o) => o.kind === "leaf");
  const rec = recordingOf([
    {
      b: "T",
      v: 1,
      r: [["A", 3]],
      rx: [["A", 3, 0]],
      x: [
        [leaf, 3],
        [test, true],
      ],
    },
  ]);
  const { checks } = makeSteps(rec, ops).of(0);
  expect(checks).toHaveLength(1);
  expect(JSON.stringify(checks)).not.toContain("secret");
});

test("a path read with several values ends with the last one", () => {
  expect(
    lastReads({
      rx: [
        ["A", 1, 0],
        ["B", 2, 0],
        ["A", 3, 2],
        ["C", "(text)", 2],
        ["D", 5, 2],
        ["D", 5, 3],
      ],
    }),
  ).toEqual(new Map([["A", 3]]));
});

test("a loop turn's steps read only what that turn read (build-tree.cjs 8d2)", () => {
  const { ops } = instrument(
    "Blocks._customBlock_T = function () { return s.A * 2; };",
  );
  const leaf = ops.findIndex((o) => o.kind === "leaf");
  const op = ops.findIndex((o) => o.kind === "op");
  const rec = recordingOf([
    {
      b: "T",
      v: 12,
      // B holds the same 6 in the first turn only: it names nothing in the second
      rx: [
        ["B", 6, 0],
        ["A", 6, 2],
      ],
      x: [
        [leaf, 6],
        [op, 12],
        [leaf, 6],
        [op, 12],
      ],
    },
  ]);
  const n = rec.nodes[0];
  if (!n) throw new Error("no node");
  const [step] = makeSteps(rec, ops).turn(n, n.x?.slice(2, 4), {
    from: 2,
    to: 4,
  });
  expect(step?.e).toMatchObject({ l: { t: "read", p: "A", v: 6 } });
});

test("a value a call set before a loop turn never ties to a read of that turn by its value", () => {
  const { ops } = instrument(
    "Blocks._customBlock_T = function () { var p = Blocks._customBlock_P(); return p * 2; };",
  );
  const leaf = ops.findIndex((o) => o.kind === "leaf");
  const op = ops.findIndex((o) => o.kind === "op");
  const rec = recordingOf([
    {
      b: "T",
      v: 12,
      c: [1],
      r: [
        ["D", 6],
        ["C", 6],
      ],
      rx: [
        ["D", 6, 0],
        ["C", 6, 3],
      ],
      x: [
        [leaf, 6],
        [op, 12],
        [leaf, 6],
        [op, 12],
      ],
    },
    { b: "P", v: 6 },
  ]);
  const n = rec.nodes[0];
  if (!n) throw new Error("no node");
  const [step] = makeSteps(rec, ops).turn(n, n.x?.slice(2, 4), {
    from: 2,
    to: 4,
  });
  // P's call is in no turn: a loose value, never the turn's read C with its value (T177 r4)
  expect(step?.e).toMatchObject({ l: { t: "val", v: 6 } });
});

/** `return s.B + s.A;` recorded with the reads `rx`: both leaves worth 6, the sum 12. */
function twoLeaves(
  rx: NonNullable<Parameters<typeof recordingOf>[0][0]["rx"]>,
) {
  const { ops } = instrument(
    "Blocks._customBlock_T = function () { return s.B + s.A; };",
  );
  const [b, a] = ops.flatMap((o, i) => (o.kind === "leaf" ? [i] : []));
  const op = ops.findIndex((o) => o.kind === "op");
  const x: [number, number][] = [
    [b ?? -1, 6],
    [a ?? -1, 6],
    [op, 12],
  ];
  const rec = recordingOf([
    {
      b: "T",
      v: 12,
      r: [
        ["B", 6],
        ["A", 6],
      ],
      rx,
      x,
    },
  ]);
  return makeSteps(rec, ops).of(0).steps[0]?.e;
}

test("a leaf whose code names no path is the read at its own place, never another read of its value before it (T231)", () => {
  // B, worth the same 6, is read first, at the place before A's: the order and the value would both take it
  expect(
    twoLeaves([
      ["B", 6, 0],
      ["A", 6, 1],
    ]),
  ).toMatchObject({
    l: { t: "read", p: "B", v: 6 },
    r: { t: "read", p: "A", v: 6 },
  });
});

test("two reads of a leaf's value at its own place are refused with the reason, never tied by order (T231)", () => {
  expect(
    twoLeaves([
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

test("an author's pass-through read by its alias in a turn is its read there, not «sem fonte» beside the cache's same value (T231)", () => {
  // TreeAuthorRelayRead over twins [3, 5, 7]: turn 3 reads the cache (6) and TreeCountDN (6); TreeCountDN was 2 in turn 1
  const rec = recorder.record(
    mosaicOf({ TreeTwins: [3, 5, 7] }),
    [["TreeAuthorRelayRead", []]],
    NONE,
  );
  const author = rec.nodes.find((n) => n.b === "TreeAuthorRelayRead");
  if (!author) throw new Error("no author");
  const last = makeSteps(rec, recorder.ops).of(author.id).steps.at(-1);
  expect(last?.e).toMatchObject({
    r: { r: { t: "read", p: "DNSM.TreeCountDN", v: 6 } },
  });
});

test("a block's own argument in its count keeps its place among the block's parameters (T209, form 1)", () => {
  // TreeArg(t) is TreeBase × t, as the game's Holes("B_UPG", 82, 20) is its 3rd argument × Holes[11][55]
  const rec = recorder.record(mosaicOf(), [["TreeArg", [3]]], NONE);
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("no root call");
  expect(makeSteps(rec, recorder.ops).of(top.id).steps).toEqual([
    {
      v: 12,
      e: {
        t: "op",
        o: "*",
        l: { t: "read", p: "TreeBase", v: 4 },
        r: { t: "val", v: 3, arg: 0 },
        v: 12,
      },
    },
  ]);
});

test("the parameter set again on the side that ran, with the argument's number, is no argument (r1 of P and Q)", () => {
  const rec = recorder.record(mosaicOf(), [["TreeArgAgain", [3]]], NONE);
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("no root call");
  const { steps } = makeSteps(rec, recorder.ops).of(top.id);
  expect(steps[0]?.v).toBe(12);
  expect(JSON.stringify(steps)).not.toContain('"arg"');
});

test("the parameter set again after its read in a loop is no argument in any turn (r1 of P and Q)", () => {
  const rec = recorder.record(mosaicOf(), [["TreeArgLoop", [3]]], NONE);
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("no root call");
  const { steps } = makeSteps(rec, recorder.ops).of(top.id);
  expect(steps.length).toBeGreaterThan(0);
  expect(JSON.stringify(steps)).not.toContain('"arg"');
});

test("a leaf of an inner function that declares the parameter's name is no argument of the block (r2 of P and Q)", () => {
  const rec = recorder.record(mosaicOf(), [["TreeArgInner", [3]]], NONE);
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("no root call");
  const { steps } = makeSteps(rec, recorder.ops).of(top.id);
  expect(steps.length).toBeGreaterThan(0);
  expect(JSON.stringify(steps)).not.toContain('"arg"');
});

test("a number read from a game table's text with a mark taken out is that read, by the path the code names (T209, form 2)", () => {
  // TreeTextTot is asNumber(replace(string(ListTot[0]), "TOT", "")) × TreeBase, as the game's "50TOT"
  const { steps } = blockOf("TreeTextTot");
  expect(steps).toEqual([
    {
      v: 200,
      e: {
        t: "op",
        o: "*",
        l: { t: "read", p: "CustomLists.ListTot[0]", v: 50 },
        r: { t: "read", p: "TreeBase", v: 4 },
        v: 200,
      },
    },
  ]);
});
