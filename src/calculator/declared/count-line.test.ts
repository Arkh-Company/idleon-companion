// The count (spec 010, T215; decided by Vinicius 25/11): a cache its author counts a fixed 1 a turn when the turn's test
// passes is a `quantity` line with a model child `each` over the list the turns test, each item a `condition` leaf. The
// lock checks the line's value is the number of turns whose test the recording saw true, each item by its place. The
// invented game (fake-game.js): TreeCount* count TreeList's items at 2 or more (TreeList is 1, 2, 3: the first fails);
// another test of the turn, `TreeList[i] > 0` (every item passes it), is before the count's test in one block and after
// it in the other, so the count's test is the one whose `&&` holds the count's step, never the first nor the last.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { parseBlueprint } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";

const BLOCKS = ["TreeCountBefore", "TreeCountAfter"];

/** A recording of `${block}Root`, the cache (the game's `value`) built again by its block, as the builders pass does. */
function recordCount(block: string, value = 2) {
  const r = inventedRecorder();
  const rec = r.record(
    mosaicOf({ DNSM: { $m: { ...activeAs(0).DNSM.$m, [block]: value } } }),
    [[`${block}Root`, [0, 0, 0]]],
    { recompute: [], builders: [{ cache: block, run: { block, args: [] } }] },
  );
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  return { rec, key, ops: r.ops };
}

const item: BlueprintNode = {
  key: "item",
  name: "Item",
  ref: { read: "TreeList[{i}]" },
  leaf: "condition",
};
const countLine = (block: string, children = [item]): BlueprintNode => ({
  key: "author",
  name: "Author",
  ref: { call: block, args: [] },
  leaf: "quantity",
  each: { list: "TreeList[*]", as: "i" },
  children,
});
const recipe = (block: string, line = countLine(block)): Blueprint => ({
  id: "invented-count",
  root: { name: "Invented", ref: { call: `${block}Root`, args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        {
          system: "cards",
          sources: [
            {
              key: "count",
              name: "Count",
              ref: { call: block, args: [] },
              children: [
                {
                  key: "cache",
                  name: "Cache",
                  ref: { read: `DNSM.${block}` },
                  children: [line],
                },
              ],
            },
          ],
        },
        {
          system: "stamps",
          sources: [
            {
              key: "capped",
              name: "Capped",
              ref: { read: "TreeCapped" },
              leaf: "level",
            },
          ],
        },
      ],
    },
  ],
});
const lock = (block: string, bp = recipe(block), value = 2) =>
  lockBlueprint({
    blueprint: bp,
    ...recordCount(block, value),
    character: 0,
    characterClass: 3,
  }).errors.map(lockMessage);

test("the load takes a quantity line with a model child each, its item a condition; any other leaf with children is refused (T215)", () => {
  const load = (line: BlueprintNode) => {
    const out = parseBlueprint(recipe("TreeCountBefore", line), {
      fileId: "invented-count",
      systemIds: new Set(["cards", "stamps"]),
    });
    return out.ok ? "ok" : out.reason;
  };
  const line = countLine("TreeCountBefore");
  expect(load(line)).toBe("ok");
  const noEach = { ...line };
  delete noEach.each;
  expect(load(noEach)).toMatch(/leaf com children/);
  expect(load({ ...line, leaf: "level" })).toMatch(/leaf com children/);
  expect(load({ ...line, children: [{ ...item, leaf: "level" }] })).toMatch(
    /leaf com children/,
  );
});

test.each(BLOCKS)(
  "the draft writes the count as a quantity line over the list its turns test, each item a condition (%s, T215)",
  (block) => {
    const { rec, key, ops } = recordCount(block);
    const ref = { call: `${block}Root`, args: [0, 0, 0] };
    const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
    const cache = draft.pools[0]?.groups[0]?.sources[0]?.children?.[0];
    const line = cache?.children?.[0];
    expect(line).toMatchObject({
      ref: { call: block, args: [] },
      leaf: "quantity",
      each: { list: "TreeList[*]", as: "item" },
    });
    expect(line?.children).toEqual([
      expect.objectContaining<Partial<DraftNode>>({
        ref: { read: "TreeList[{item}]" },
        leaf: "condition",
      }),
    ]);
    const at = "pools/0/groups/0/sources/0/children/0/children/0";
    expect(draft.pending).not.toContainEqual({ where: at, kind: "descend" });
    expect(draft.pending).not.toContainEqual({
      where: `${at}/children/0`,
      kind: "leaf",
    });
  },
);

test.each(BLOCKS)(
  "the lock checks the count is the number of items whose test the recording saw true, by the count's test's place (%s, T215)",
  (block) => {
    expect(lock(block)).toEqual([]);
  },
);

test("the lock refuses an item the recording did not test, and a count that is not the number of items that passed (T215)", () => {
  const block = "TreeCountBefore";
  const other: BlueprintNode = {
    ...item,
    key: "other",
    ref: { read: "TreeList[5]" },
  };
  expect(lock(block, recipe(block, countLine(block, [item, other])))).toEqual([
    "filho fora da conta: invented-count/0/cards/count/cache/author/other",
  ]);
  // TreeCountFrom counts from 1: 1 + the 2 items that pass is 3, never the 2 the turns give
  expect(lock("TreeCountFrom", recipe("TreeCountFrom"), 3)).toEqual([
    "nível não fecha: invented-count/0/cards/count/cache/author: as partes dão 2, o valor gravado é 3",
  ]);
});

test("the lock refuses a count its author writes again after it counted: each write is a step of 1 or the start at 0 (r1 of part V)", () => {
  // TreeCountCap: the 2 items that pass, then `min(count, 5)`, a cap the count does not reach: never closed without it
  expect(lock("TreeCountCap")).toEqual([
    "invented-count/0/cards/count/cache/author: o laço de TreeCountCap() conta DNSM.TreeCountCap, mas a escrita 4 não soma 1 ao próprio valor nem é o início em 0: não é a forma do contador (T215)",
  ]);
});
