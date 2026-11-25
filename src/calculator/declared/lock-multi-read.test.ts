// A cache read as a Multi pool's factor (spec 010, Fase 4 q; the Drop Rate's 1 + FamBonusQTYs[32] / 100 and
// 1 + AlchVials.7drMulto / 100): the source's level is the read, whose value is the cache's, not the factor the pool
// multiplies by. The invented game's TreeAuthorMulti gives (4 + 80) × (1 + TreeAuthor.v / 100), TreeAuthorSum's 12.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const item = (i: number): BlueprintNode => ({
  key: `item-${String(i)}`,
  name: "Item",
  ref: { call: "TreeTurnItem", args: [i] },
  children: [leaf("list", `TreeList[${String(i)}]`)],
});

test("a cache read as a Multi pool's factor closes by the cache's value, its author below (Fase 4 q)", () => {
  const r = inventedRecorder();
  const rec = r.record(
    mosaicOf({
      DNSM: { $m: { ...activeAs(0).DNSM.$m, TreeAuthor: { $m: { v: 12 } } } },
    }),
    [["TreeAuthorMulti", [0, 0, 0]]],
    {
      recompute: [],
      builders: [
        { cache: "TreeAuthor", run: { block: "TreeAuthorSum", args: [] } },
      ],
    },
  );
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  const blueprint: Blueprint = {
    id: "invented-multi-read",
    root: {
      name: "Invented",
      ref: { call: "TreeAuthorMulti", args: [0, 0, 0] },
    },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "stamps",
            sources: [leaf("base", "TreeBase"), leaf("capped", "TreeCapped")],
          },
        ],
      },
      {
        kind: "multi",
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
                    ref: { call: "TreeAuthorSum", args: [] },
                    children: [item(0), item(1), item(2)],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const lock = lockBlueprint({
    blueprint,
    key,
    rec,
    ops: r.ops,
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors.map(lockMessage)).toEqual([]);
});
