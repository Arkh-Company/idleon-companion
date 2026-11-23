// What the answer key's recording carries beyond the live tree's (spec 010, T162), and what a recording that fails
// still tells: the path of a list a call returns only with the answer key's option, an infinite number's place that
// never writes outside the recording, and the stages already measured when a step runs out of time.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import { recordingOf } from "./fixtures/recording-fixture.ts";
import { bootRecorder, putInfinity } from "./tree-record.ts";

const LIMITS = { startMs: 5_000, numberMs: 500 };
const NONE = { recompute: [], builders: [] };
let live: ReturnType<typeof bootRecorder>;
let answer: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  live = bootRecorder(GAME, PAK, LIMITS);
  answer = bootRecorder(GAME, PAK, LIMITS, { infinite: true });
});

test("the path of the list a call returns is in the answer key's recording only; the live tree's has none", () => {
  const vpOf = (r: ReturnType<typeof bootRecorder>) =>
    r
      .record(mosaicOf(), [["TreeTwoLists", [0, 0, 0]]], NONE)
      .nodes.find((n) => n.b === "TreeTwoLists")?.vp;
  expect(vpOf(answer)).toBe("DNSM.TreeListA");
  expect(vpOf(live)).toBeUndefined();
});

test("a helper's event is a call of its own, with its steps and its writes, in the answer key's recording only", () => {
  const eventOf = (r: ReturnType<typeof bootRecorder>) => {
    const rec = r.record(
      mosaicOf({ Scenario: "authorFilled" }),
      [["TreeAuthorRead", [0, 0, 0]]],
      NONE,
    );
    const n = rec.nodes.find((x) => x.b === "_customEvent_TreeAuthorFill");
    const w = rec.writes.find((x) => x.path === "DNSM.TreeAuthor.v");
    return (
      n && { parent: n.p, steps: n.x?.length ?? 0, writes: w?.node === n.id }
    );
  };
  expect(eventOf(answer)).toEqual({ parent: 0, steps: 2, writes: true });
  expect(eventOf(live)).toBeUndefined();
});

test("an infinite number's place never writes outside the recording, and a place that does not exist is skipped", () => {
  const rec = recordingOf([{ b: "(root)", v: 1 }]);
  for (const k of ["__proto__", "constructor", "prototype"])
    putInfinity(rec, [k, "polluted", 1]);
  putInfinity(rec, ["nodes", 0, "constructor", "polluted", 1]);
  expect(Object.prototype).not.toHaveProperty("polluted");
  expect(Object).not.toHaveProperty("polluted");
  expect(() => {
    putInfinity(rec, ["nodes", 9, "x", 0, 1, 1]);
  }).not.toThrow();
  putInfinity(rec, ["nodes", 0, "v", -1]);
  expect(rec.nodes[0]?.v).toBe(-Infinity);
});

test("a recording that runs out of time still says the time of the stages it measured", () => {
  let thrown: unknown;
  try {
    answer.record(
      mosaicOf({ Scenario: "endless" }),
      [["PlayerHPmax", [0, 0, 0]]],
      NONE,
    );
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeDefined();
  expect(Object.keys((thrown as { ms?: object }).ms ?? {})).toEqual([
    "mosaic",
    "helpers",
  ]);
});
