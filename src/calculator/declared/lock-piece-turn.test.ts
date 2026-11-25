// A piece with pools over a cache whose last write comes from a loop over its keys (spec 010, Fase 4 q; the game's star
// signs): the terms of that write are in its own turn, at its place, never in the last turn's step; a term of two parts
// is the pool's whole factor, the code's cap included (FR-018 of 009: the cap goes in the ⓘ, it is no number of its
// own). The invented game's TreeKeysCapBuild gives a = (2 + 3) × max(1, min(2, 1 + TreeTurnItem(0) × floor(…TreeStats.a
// …))) × min(5, pow(1.1 + TreeBase / 100, ceil((TreeLevel + 1) / 20))) = 5 × 2 × 5.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import { parseBlueprint } from "./blueprint.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";

type Raw = Record<string, unknown>;
const leaf = (key: string, read: string, extra: Raw = {}): Raw => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
  ...extra,
});
const constant = (key: string, n: number): Raw => ({
  key,
  name: key,
  constant: n,
  leaf: "fixedValue",
});
const PIECE: Raw = {
  id: "invented-keys",
  params: [],
  pools: [
    {
      kind: "additive",
      groups: [
        {
          system: "bundles",
          sources: [constant("two", 2), constant("three", 3)],
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
              key: "chip",
              name: "chip",
              ref: { call: "TreeTurnItem", args: [0] },
              children: [
                {
                  key: "item",
                  name: "item",
                  ref: { call: "TreeTurnItem", args: [0] },
                  children: [leaf("list", "TreeList[0]")],
                },
                leaf("rift", "TreeStats.a", { termPart: { system: "stamps" } }),
              ],
            },
          ],
        },
        {
          system: "prayers",
          sources: [
            {
              key: "seraph",
              name: "seraph",
              ref: { read: "TreeBase" },
              children: [
                leaf("base", "TreeBase"),
                leaf("lv", "TreeLevel", { termPart: { system: "stamps" } }),
              ],
            },
          ],
        },
      ],
    },
  ],
};

test("a piece over a cache's last write from a loop over its keys: its terms at that write's turn, a capped term whole", () => {
  const r = inventedRecorder();
  const rec = r.record(
    mosaicOf({
      TreeLevel: 300,
      DNSM: {
        $m: { ...activeAs(0).DNSM.$m, TreeKeys: { $m: { a: 50, b: 40 } } },
      },
    }),
    [["TreeKeysRead", [0, 0, 0]]],
    {
      recompute: [],
      builders: [
        { cache: "TreeKeys", run: { block: "TreeKeysCapBuild", args: [] } },
      ],
    },
  );
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  const out = parseBlueprint(
    {
      id: "invented-keys-number",
      root: {
        name: "Invented",
        ref: { call: "TreeKeysRead", args: [0, 0, 0] },
      },
      pools: [
        {
          kind: "additive",
          groups: [
            {
              system: "cards",
              sources: [
                {
                  key: "keys",
                  name: "Keys",
                  ref: { read: "DNSM.TreeKeys.a" },
                  piece: { name: "invented-keys", args: {} },
                },
                leaf("capped", "TreeCapped"),
              ],
            },
          ],
        },
      ],
    },
    {
      fileId: "invented-keys-number",
      systemIds: new Set(["cards", "stamps", "bundles", "prayers"]),
      pieces: new Map([["invented-keys", PIECE]]),
    },
  );
  if (!out.ok) throw new Error(out.reason);
  const lock = lockBlueprint({
    blueprint: out.blueprint,
    key,
    rec,
    ops: r.ops,
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors.map(lockMessage)).toEqual([]);
});
