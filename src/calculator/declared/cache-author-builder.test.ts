// A call that returns a cache bare, whose author is a builder of the recipe (spec 010, T187): the author is no call of
// the reader, so the draft goes down through the builder's own recording, its writes of the path read, each by its
// place (as the game's EtcBonuses returns DNSM.TotalStatsETCmap, built by TotalStats("calcEtcBonuses")). The invented
// game (fake-game.js, TreeAuthorBareRoot) builds the cache in the recipe's builders' pass.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { refKey } from "./refs.ts";

const attrs = {
  DNSM: { $m: { ...activeAs(0).DNSM.$m, TreeAuthor: { $m: { v: 15 } } } },
};
type Shape = [string, Shape[]];
const shape = (n: DraftNode): Shape => [
  n.ref ? refKey(n.ref, 0) : "",
  (n.children ?? []).map(shape),
];

test("a call that returns a cache bare goes down through the builder that wrote it, down to the save", () => {
  const r = inventedRecorder();
  const rec = r.record(mosaicOf(attrs), [["TreeAuthorBareRoot", [0, 0, 0]]], {
    recompute: [],
    builders: [
      { cache: "TreeAuthor", run: { block: "TreeAuthorBuild", args: [] } },
    ],
  });
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  const ref = { call: "TreeAuthorBareRoot", args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, [
    ...r.ops,
  ]);
  expect(draft.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    [
      "TreeAuthorBare()",
      [
        [
          "TreeAuthorBuild()",
          [
            ["TreeBase", []],
            ["TreeStats.a", []],
          ],
        ],
      ],
    ],
  ]);
  expect(draft.pending).not.toContainEqual({
    where: "pools/0/groups/0/sources/0/children/0",
    kind: "descend",
  });
});
