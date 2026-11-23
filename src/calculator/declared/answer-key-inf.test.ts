// An infinite number in the answer key's recording (spec 010, T162; spec, Open Questions 22/11; moved out of
// answer-key-shapes.test.ts as they were): a cost that overflows cut by a Cap, and each infinite number back at its
// place, over the invented game (fake-game.js).
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { Recording } from "../recording.ts";
import { bootRecorder } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(
    GAME,
    PAK,
    { startMs: 5_000, numberMs: 500 },
    { infinite: true },
  );
});

const record = (block: string): Recording =>
  recorder.record(mosaicOf(), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });

// Spec 010, T162 (spec, Open Questions 22/11): the recording keeps an infinite cost, and `K < x && (x = K)` is a Cap K.
test("a cost that overflows to Infinity and is cut by `K < x && (x = K)`: a chain with a Cap K, and its part", () => {
  const rec = record("TreeCostInf");
  expect(rec.writes.some((w) => w.v === Infinity)).toBe(true);
  const key = answerKey(rec, recorder.ops);
  if ("error" in key) throw new Error(key.reason);
  expect(key.form).toBe("chain");
  expect(key.top.map((l) => [l.kind, l.value ?? null, l.after])).toEqual([
    ["round", null, 1000],
    ["cap", 1000, 1000],
  ]);
  expect(key.top[1]?.before).toBe(Infinity);
  const part = answerKey(rec, recorder.ops, {
    part: ["TreeTwins[0]", "TreeStats.a"],
  });
  expect("error" in part ? part.reason : part.final).toBeCloseTo(
    0.421875 * 0.97,
    12,
  );
});

// The fifth probe's time (sonda 6): labeling an infinite number is a pass over the whole recording, seconds on the real
// game; only a recording that has one names a place for it.
test("only a recording with an infinite number marks it for its label", () => {
  record("TreeDeclChain");
  expect(recorder.context.run("__rec.infAt()", 1_000)).toBe("[]");
  record("TreeCostInf");
  expect(recorder.context.run("__rec.infAt()", 1_000)).not.toBe("[]");
});

/** What the old label pass over the whole recording (a replacer in take(), a reviver after it) gave of its state. */
const labeled = (): unknown =>
  JSON.parse(
    String(
      recorder.context.run(
        `JSON.stringify({ nodes: __rec.state.nodes, writes: __rec.state.writes, spliced: __rec.state.spliced },
          (k, v) => (v === Infinity ? "(Infinity)" : v === -Infinity ? "(-Infinity)" : v))`,
        1_000,
      ),
    ),
    (_, v: unknown) =>
      v === "(Infinity)" ? Infinity : v === "(-Infinity)" ? -Infinity : v,
  );

// The seventh probe's time (4× the fifth's): a label pass over the whole recording (a replacer in take(), a reviver
// after it) cost seconds in every root. The recording names the place of each infinite number instead, and each comes
// back there: the same recording the labels gave.
test("each infinite number comes back at its place, as the label over the whole recording gave it", () => {
  const rec = recorder.record(
    mosaicOf(),
    [
      ["TreeCostInf", [0, 0, 0]],
      ["TreeInfNeg", [0, 0, 0]],
    ],
    { recompute: [], builders: [] },
  );
  const at = JSON.parse(
    String(recorder.context.run("__rec.infAt()", 1_000)),
  ) as unknown[][];
  expect(
    at.map((p) => p.slice(0, -1).filter((k) => typeof k === "string")),
  ).toEqual(
    expect.arrayContaining([
      ["nodes", "a"],
      ["nodes", "v"],
      ["nodes", "x"],
      ["nodes", "r"],
      ["nodes", "rx"],
      ["writes", "v"],
    ]),
  );
  expect({
    nodes: rec.nodes,
    writes: rec.writes,
    spliced: rec.spliced,
  }).toEqual(labeled());
  expect(rec.nodes.some((n) => n.v === -Infinity)).toBe(true);
});

// Review of the seventh probe: a write the builders' pass moves to the spliced ones, after another it drops from the
// writes, comes back at its place there.
test("an infinite number the builders' pass moves to the spliced writes comes back at its place there", () => {
  const rec = recorder.record(mosaicOf(), [["TreeCostInf", [0, 0, 0]]], {
    recompute: [],
    builders: [
      {
        cache: "TreeWhoCache",
        run: { block: "TreeInfBuild", args: [] },
        keepLive: true,
      },
    ],
  });
  expect(rec.spliced.some((w) => w.v === Infinity)).toBe(true);
  expect({
    nodes: rec.nodes,
    writes: rec.writes,
    spliced: rec.spliced,
  }).toEqual(labeled());
});
