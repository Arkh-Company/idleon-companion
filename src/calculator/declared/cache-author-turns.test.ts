// A cache its author wrote more than once (spec 010, T168; spec, Open Questions 23/11): a write is a turn only when it
// adds an item to the path's own value (`d.X.v = d.X.v + item`). An author whose last write overwrote the cache opens by
// that write's count; one that mixes overwrites and turns is refused with the reason. The invented game (fake-game.js,
// TreeAuthor*) builds the cache in the recipe's builders' pass.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import type { Recording } from "../recording.ts";
import { answerKey } from "./answer-key.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { refKey } from "./refs.ts";

/**
 * The recording of TreeAuthorRead over the cache `author` built, the running game's cache `v`, after TreeOther's
 * builder when `other` is its cache.
 */
const record = (author: string, v: number, other?: number): Recording =>
  inventedRecorder().record(
    mosaicOf({
      DNSM: {
        $m: {
          ...activeAs(0).DNSM.$m,
          TreeAuthor: { $m: { v } },
          ...(other === undefined ? {} : { TreeOther: { $m: { v: other } } }),
        },
      },
    }),
    [["TreeAuthorRead", [0, 0, 0]]],
    {
      recompute: [],
      builders: [
        ...(other === undefined
          ? []
          : [
              {
                cache: "TreeOther",
                run: { block: "TreeOtherBuild", args: [] },
              },
            ]),
        { cache: "TreeAuthor", run: { block: author, args: [] } },
      ],
    },
  );
const keyOf = (rec: Recording) => {
  const key = answerKey(rec, inventedRecorder().ops);
  if ("error" in key) throw new Error(key.reason);
  return key;
};

type Shape = [string, Shape[]];
const shape = (n: DraftNode | BlueprintNode): Shape => [
  n.ref ? refKey(n.ref, 0) : "",
  (n.children ?? []).map(shape),
];
/** The draft's source of the cache read, as references down the tree. */
const drafted = (rec: Recording) =>
  draftBlueprint(
    "invented",
    { name: "I", ref: { call: "TreeAuthorRead", args: [0, 0, 0] } },
    keyOf(rec),
    rec,
    [...inventedRecorder().ops],
  ).pools[0]?.groups[0]?.sources.map(shape);
const item = (i: number): Shape => [
  `TreeTurnItem(${String(i)})`,
  [[`TreeList[${String(i)}]`, []]],
];

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const lock = (rec: Recording, author: BlueprintNode) => {
  const bp: Blueprint = {
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
                children: [author],
              },
            ],
          },
          { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
        ],
      },
    ],
  };
  return lockBlueprint({
    blueprint: bp,
    key: keyOf(rec),
    rec,
    ops: inventedRecorder().ops,
    character: 0,
    characterClass: 3,
  });
};
const itemNode = (i: number): BlueprintNode => ({
  key: `item-${String(i)}`,
  name: "Item",
  ref: { call: "TreeTurnItem", args: [i] },
  children: [leaf("list", `TreeList[${String(i)}]`)],
});

test("an author whose last write overwrote the cache by a product opens by that write's count, not by turns", () => {
  // TreeAuthorProduct: 0, then TreeTurnItem(0) × 2 = 4
  const rec = record("TreeAuthorProduct", 4);
  expect(drafted(rec)).toEqual([
    ["DNSM.TreeAuthor.v", [["TreeAuthorProduct()", [item(0)]]]],
  ]);
  const author: BlueprintNode = {
    key: "author",
    name: "Author",
    ref: { call: "TreeAuthorProduct", args: [] },
    children: [itemNode(0)],
  };
  const ok = lock(rec, author);
  expect(ok.errors.map(lockMessage)).toEqual([]);
});

test("an author whose last write is a sum of two parts opens into both, not into its right side alone", () => {
  // TreeAuthorParts: 0, then TreeTurnItem(0) + TreeTurnItem(1) = 6
  expect(drafted(record("TreeAuthorParts", 6))).toEqual([
    ["DNSM.TreeAuthor.v", [["TreeAuthorParts()", [item(0), item(1)]]]],
  ]);
});

test("two items in the same turn are no turn of one item: the last write's count keeps both", () => {
  // TreeAuthorPair: 0, then + TreeTurnItem(i) + TreeList[i] a turn = 18; its last write is (own value + item) + list
  const [source] = drafted(record("TreeAuthorPair", 18)) ?? [];
  const [, [author]] = source ?? ["", []];
  expect(author?.[0]).toBe("TreeAuthorPair()");
  expect(author?.[1].map(([k]) => k)).toEqual([
    "DNSM.TreeAuthor.v",
    "TreeTurnItem(2)",
    "TreeList[2]",
  ]);
});

test("an author that overwrites the cache and then sums over it in turns is refused with the reason", () => {
  // TreeAuthorMixed: 0, then TreeTurnItem(0) × 2, then + TreeTurnItem(i) a turn = 14
  const rec = record("TreeAuthorMixed", 14);
  const author: BlueprintNode = {
    key: "author",
    name: "Author",
    ref: { call: "TreeAuthorMixed", args: [] },
    children: [itemNode(1), itemNode(2)],
  };
  expect(lock(rec, author).errors.map(lockMessage)).toEqual([
    "invented-author/0/cards/cache/author: a volta 1 do laço de TreeAuthorMixed() escreve DNSM.TreeAuthor.v sem somar sobre o próprio valor",
  ]);
});

test("a cache read in its author's count ties to the write its own place saw, not to every place that reads it", () => {
  // TreeAuthorNested reads TreeOther (TreeOtherBuild's, 5) in its write's count (× 2 = 10), then writes it itself and
  // reads it again: only the place in the count decides TreeOther's author
  const rec = record("TreeAuthorNested", 10, 5);
  expect(drafted(rec)).toEqual([
    [
      "DNSM.TreeAuthor.v",
      [
        [
          "TreeAuthorNested()",
          [["DNSM.TreeOther.v", [["TreeOtherBuild()", [["TreeBase", []]]]]]],
        ],
      ],
    ],
  ]);
  const author: BlueprintNode = {
    key: "author",
    name: "Author",
    ref: { call: "TreeAuthorNested", args: [] },
    children: [
      {
        key: "other",
        name: "Other",
        ref: { read: "DNSM.TreeOther.v" },
        children: [
          {
            key: "build",
            name: "Build",
            ref: { call: "TreeOtherBuild", args: [] },
            children: [leaf("base", "TreeBase")],
          },
        ],
      },
    ],
  };
  expect(lock(rec, author).errors.map(lockMessage)).toEqual([]);
});

test("an author's read of its own earlier turn goes down a turn at a time, each its own items", () => {
  // TreeAuthorPair: each turn's count reads the turn before it: TreeTurnItem(2), then (1), then (0)
  const items: string[] = [];
  const [source] = drafted(record("TreeAuthorPair", 18)) ?? [];
  for (let s = source; s; ) {
    const [, [author]] = s;
    const kids = author?.[1] ?? [];
    const own = kids.find(([k]) => k.startsWith("TreeTurnItem"));
    if (own) items.push(own[0]);
    s = kids.find(([k]) => k === "DNSM.TreeAuthor.v");
  }
  expect(items).toEqual(["TreeTurnItem(2)", "TreeTurnItem(1)", "TreeTurnItem(0)"]);
});
