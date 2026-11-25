// An author's write's turn whose item reads before its pass-through (spec 010, r2 of part W): two calls of the
// pass-through's key in the turn's window are refused with the reason for every reference of the item, not its head's
// alone; the draft's guide and the lock say the same. The invented game (fake-game.js, TreeAuthorRelayRead) builds the
// cache in the recipe's builders' pass.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { stepsGuide } from "./draft-steps.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";

const block = "TreeAuthorRelayRead";
const rec = inventedRecorder().record(
  mosaicOf({
    TreeTwins: [5, 3, 7],
    DNSM: {
      $m: { ...activeAs(0).DNSM.$m, TreeAuthor: { $m: { v: 52 } } },
    },
  }),
  [["TreeAuthorRead", [0, 0, 0]]],
  {
    recompute: [],
    builders: [{ cache: "TreeAuthor", run: { block, args: [] } }],
  },
);
const ops = [...inventedRecorder().ops];
const key = answerKey(rec, ops);
if ("error" in key) throw new Error(key.reason);

const leaf = (k: string, read: string): BlueprintNode => ({
  key: k,
  name: k,
  ref: { read },
  leaf: "level",
});
/** A turn, by its twin's index: a line by the read TreeTwins[i], the pass-through's TreeTurnAt() a termPart child. */
const line = (i: number): BlueprintNode => ({
  key: `twin-${String(i)}`,
  name: "Twin",
  ref: { read: `TreeTwins[${String(i)}]` },
  leaf: "record",
  children: [
    {
      key: "at",
      name: "At",
      ref: { call: "TreeTurnAt", args: [] },
      termPart: { system: "achievements" },
      children: [leaf("list", "TreeList[2]")],
    },
  ],
});
const reason = `duas chamadas de TreeTurnAt() na volta 2 do laço de ${block}(), e o lugar não as separa`;

test("a turn's item read first, with two calls of its pass-through's key in its window, is refused with the reason (r2 of W)", () => {
  expect(stepsGuide(key, rec, ops)).toContain(`descer: pendente (${reason})`);
  const errors = lockBlueprint({
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
            {
              system: "cards",
              sources: [
                {
                  key: "cache",
                  name: "Cache",
                  ref: { read: "DNSM.TreeAuthor.v" },
                  children: [
                    {
                      key: "author",
                      name: "Author",
                      ref: { call: block, args: [] },
                      children: [line(0), line(2)],
                    },
                  ],
                },
              ],
            },
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
  expect(errors).toEqual([`invented-author/0/cards/cache/author: ${reason}`]);
});
