// A write of a fixed number of the code (spec 010, r5 of group 2; CODING_STANDARDS, "The answer key ties by the
// recorded place"): the step the call recorded last before the write is the branch's test, and the branch starts with
// that write of a number, so the write has no child call to give it. fake-game.js's TreeDeclLit and TreeDeclLitCall.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { bootRecorder } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
const keyOf = (block: string) =>
  answerKey(
    recorder.record(mosaicOf(), [[block, [0, 0, 0]]], {
      recompute: [],
      builders: [],
    }),
    recorder.ops,
  );

test("a branch that writes a fixed 0 and sums onto it, after a common part's call worth 0 in a step: no refusal", () => {
  const key = keyOf("TreeDeclLit");
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBe(16);
  expect(key.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)])).toEqual([
    ["additive", ["0", "TreeStats.b", "TreeStats.a"]],
    ["multi", ["2"]],
  ]);
});

test("the branch writes the call worth 0 instead, and a step also uses it: still refused", () => {
  const key = keyOf("TreeDeclLitCall");
  expect("reason" in key ? key.reason : "no refusal").toMatch(
    /vem de uma chamada filha que também entra num passo/,
  );
});
