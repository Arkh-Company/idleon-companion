// A cache whose last write comes from a loop over its keys (spec 010, Fase 4 q; the game's StarSigns(0) multiplies
// each StarSigns[p] by the chip, the key built as text right before the write): the write's place is the step recorded
// right before it, past the key's text, and its turn gives the step, never the last turn's value. The invented game's
// TreeKeysBuild sums TreeKeys.a to 5 and multiplies each key by TreeTurnItem(0) = 2 in a loop, a before b.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { makeSteps } from "../recorded/steps.ts";
import { placeOfWrite } from "./answer-key-item.ts";
import { answerKeyOfSteps } from "./answer-key-steps.ts";
import { inventedRecorder } from "./lock-fixture.ts";

const record = () => {
  const r = inventedRecorder();
  const rec = r.record(
    mosaicOf({
      DNSM: {
        $m: { ...activeAs(0).DNSM.$m, TreeKeys: { $m: { a: 10, b: 8 } } },
      },
    }),
    [["TreeKeysRead", [0, 0, 0]]],
    {
      recompute: [],
      builders: [
        { cache: "TreeKeys", run: { block: "TreeKeysBuild", args: [] } },
      ],
    },
  );
  const author = rec.nodes.find((n) => n.b === "TreeKeysBuild");
  if (!author) throw new Error("no author");
  const writes = rec.writes.filter(
    (w) => w.node === author.id && w.path === "DNSM.TreeKeys.a",
  );
  return { r, rec, author, writes };
};

test("a write right after the text of its key has its place at the step before that text: an earlier turn's (-1)", () => {
  const { r, rec, author, writes } = record();
  expect(writes.map((w) => w.v)).toEqual([2, 5, 10]);
  const { stepAt } = makeSteps(rec, r.ops).of(author.id);
  const last = writes.at(-1);
  expect(last && placeOfWrite(author, stepAt, last.xi, r.ops)).toBe(-1);
});

test("the cache's running total closes through the loop's turn of its last write: added to 5, then multiplied by 2", () => {
  const { r, rec, author } = record();
  const made = makeSteps(rec, r.ops);
  const key = answerKeyOfSteps(rec, made.of(author.id), {
    node: author.id,
    value: 10,
    ops: r.ops,
    turnOf: made.turnOf,
    path: "DNSM.TreeKeys.a",
  });
  if ("error" in key) throw new Error(key.reason);
  expect(key.pools.map((p) => [p.kind, p.value])).toEqual([
    ["additive", 5],
    ["multi", 2],
  ]);
});
