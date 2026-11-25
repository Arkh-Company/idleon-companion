// An author's write's turn whose item reads its pass-through (spec 010, r2 of part W; T230): the line's call that came by
// the pass-through is the call that gave the write the item read (cache-author.ts writeSource, by the place), never a
// call looked up by its key in the turn's window, where two of one key do not part. The invented game (fake-game.js,
// TreeAuthorRelay*) builds the cache in the recipe's builders' pass.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { stepsGuide } from "./draft-steps.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";

const ops = [...inventedRecorder().ops];
/** The recording of TreeAuthorRead over the cache `block` built, the running game's cache `v`, its key and guide. */
function recordOf(block: string, v: number, twins?: number[]) {
  const rec = inventedRecorder().record(
    mosaicOf({
      ...(twins && { TreeTwins: twins }),
      DNSM: { $m: { ...activeAs(0).DNSM.$m, TreeAuthor: { $m: { v } } } },
    }),
    [["TreeAuthorRead", [0, 0, 0]]],
    {
      recompute: [],
      builders: [{ cache: "TreeAuthor", run: { block, args: [] } }],
    },
  );
  const key = answerKey(rec, ops);
  if ("error" in key) throw new Error(key.reason);
  return { rec, key, guide: stepsGuide(key, rec, ops) };
}

const leaf = (k: string, read: string): BlueprintNode => ({
  key: k,
  name: k,
  ref: { read },
  leaf: "level",
});
/** The lock's messages over the cache's author `block`, its lines `lines`. */
function lockOf(
  { rec, key }: ReturnType<typeof recordOf>,
  block: string,
  lines: BlueprintNode[],
) {
  const author = {
    key: "author",
    name: "Author",
    ref: { call: block, args: [] },
    children: lines,
  };
  const cache = {
    key: "cache",
    name: "Cache",
    ref: { read: "DNSM.TreeAuthor.v" },
    children: [author],
  };
  return lockBlueprint({
    blueprint: {
      id: "invented-author",
      root: {
        name: "Invented",
        ref: { call: "TreeAuthorRead", args: [0, 0, 0] },
      },
      pools: [
        {
          kind: "additive",
          groups: [
            { system: "cards", sources: [cache] },
            { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
          ],
        },
      ],
    },
    key,
    rec,
    ops,
    character: 0,
    characterClass: 3,
  }).errors.map(lockMessage);
}
/** The pass-through's TreeTurnAt() of the turn of item `i`, its list's read below it. */
const at = (i: number): BlueprintNode => ({
  key: "at",
  name: "At",
  ref: { call: "TreeTurnAt", args: [] },
  children: [leaf("list", `TreeList[${String(i)}]`)],
});

test("a turn's item read first: its pass-through's call is the one that gave the write it read, by the place (T230)", () => {
  // TreeAuthorRelayRead over twins [5, 3, 7]: the last write's window holds TreeTurnAt() of the turns 2 and 3
  const relay = recordOf("TreeAuthorRelayRead", 52, [5, 3, 7]);
  expect(relay.guide).not.toContain("duas chamadas de TreeTurnAt()");
  const line = (i: number): BlueprintNode => ({
    key: `twin-${String(i)}`,
    name: "Twin",
    ref: { read: `TreeTwins[${String(i)}]` },
    children: [
      { ...leaf("twin", `TreeTwins[${String(i)}]`), leaf: "record" },
      { ...at(i), termPart: { system: "achievements" } },
    ],
  });
  expect(lockOf(relay, "TreeAuthorRelayRead", [line(0), line(2)])).toEqual([]);
});

test("a write's turn with two calls of its pass-through's key: the line's head is the one that gave the write, never the first (T230)", () => {
  // TreeAuthorRelaySkip: no write of the cache in the middle turn, so the last write's window holds TreeTurnAt() of the
  // turns 2 and 3; the first, the order's, reads TreeList[1]
  const relay = recordOf("TreeAuthorRelaySkip", 32);
  expect(relay.guide).not.toContain("duas chamadas de TreeTurnAt()");
  const line = (turn: number, i: number): BlueprintNode => ({
    key: `item-turn-${String(turn)}`,
    name: "Item",
    ref: { call: "TreeTurnAt", args: [] },
    children: [
      at(i),
      { ...leaf("base", "TreeBase"), termPart: { system: "achievements" } },
    ],
  });
  expect(
    lockOf(relay, "TreeAuthorRelaySkip", [line(1, 0), line(2, 2)]),
  ).toEqual([]);
});
