// A running total summed in a loop (spec 010, T175): each turn's write is a term of the answer key, read at the turn's
// own place (makeSteps turnOf), in the root's engine and a piece's alike; turns that do not part by their place are
// refused with the reason. The invented game (fake-game.js, TreeActive*) sums a table's items only where they are on.
import { expect, test } from "vitest";
import { answerKey } from "./answer-key.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { mosaicOf } from "../fixtures/fake-mosaic.ts";

const keyOf = (block: string, on = [1, 0, 1, 1]) => {
  const r = inventedRecorder();
  const rec = r.record(
    mosaicOf({
      TreeActiveBonus: [5, 10, 20, 40],
      TreeActiveOn: on,
      TreeSignMulti: 2,
    }),
    [[block, [0, 0, 0]]],
    { recompute: [], builders: [] },
  );
  return answerKey(rec, r.ops);
};

test("a running total summed in a loop has one term per turn, each at its own place: only the items the game added", () => {
  const key = keyOf("TreeActiveSum");
  if ("error" in key) throw new Error(key.reason);
  expect(key.form).toBe("chain");
  expect(
    key.pools.map((p) => [
      p.kind,
      p.value,
      p.terms.map((t) => [t.ref, t.value]),
    ]),
  ).toEqual([
    [
      "additive",
      65,
      [
        ["TreeActiveBonus[0]", 5],
        ["TreeActiveBonus[2]", 20],
        ["TreeActiveBonus[3]", 40],
      ],
    ],
    ["multi", 2, [["TreeSignMulti", 2]]],
  ]);
  for (const p of key.pools) expect(p.error).toBeLessThanOrEqual(1e-6);
  expect(key.final).toBe(130);
  // only the 0 the total starts at is a write with no term
  expect(key.pollution.loopWrite).toBe(1);
});

test("a turn's pool keeps the turn's own step, never the next write's", () => {
  // the 30 of the third item is a turn of the first `+` (step 0), after the second `+` (step 1); step 2 is the × multi
  const key = keyOf("TreeActiveSum", [2, 0, 1, 0]);
  if ("error" in key) throw new Error(key.reason);
  expect(key.pools.map((p) => [p.kind, p.value, p.steps])).toEqual([
    ["additive", 30, [0, 1]],
    ["multi", 2, [2]],
  ]);
});

test("a turn whose write has no step of its own at its place is refused with the reason", () => {
  const key = keyOf("TreeActiveMixed");
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(
    /a escrita 5 do acumulador DNSM\.TreeActiveMixed\.v não tem passo no lugar da sua volta$/,
  );
});
