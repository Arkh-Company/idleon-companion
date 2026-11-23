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
  expect(key.pollution.loopWrite ?? 0).toBe(0);
});

test("a turn whose write has no step of its own at its place is refused with the reason", () => {
  const key = keyOf("TreeActiveMixed");
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toBe(
    "a escrita 5 do acumulador DNSM.TreeActiveMixed.v não tem passo no lugar da sua volta",
  );
});
