// A cache its author wrote more than once (spec 010, T168; spec, Open Questions 23/11): a write is a turn only when it
// adds an item to the path's own value (`d.X.v = d.X.v + item`). An author whose last write overwrote the cache opens by
// that write's count; one that mixes overwrites and turns is refused with the reason. The invented game (fake-game.js,
// TreeAuthor*) builds the cache in the recipe's builders' pass.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { READ_CAP } from "../recording.ts";
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
  for (let s = source; s;) {
    const [, [author]] = s;
    const kids = author?.[1] ?? [];
    const own = kids.find(([k]) => k.startsWith("TreeTurnItem"));
    if (own) items.push(own[0]);
    s = kids.find(([k]) => k === "DNSM.TreeAuthor.v");
  }
  expect(items).toEqual([
    "TreeTurnItem(2)",
    "TreeTurnItem(1)",
    "TreeTurnItem(0)",
  ]);
});

test("an author that sums into a key not yet set starts on the empty key's 0: one line a turn, the first one too (T192)", () => {
  // TreeAuthorKey: asNumber(the empty key) + TreeTurnItem(i) a turn = 2 + 4 + 6 = 12, as the game's Gallery sums
  const rec = record("TreeAuthorKey", 12);
  expect(drafted(rec)).toEqual([
    ["DNSM.TreeAuthor.v", [["TreeAuthorKey()", [item(0), item(1), item(2)]]]],
  ]);
  const author: BlueprintNode = {
    key: "author",
    name: "Author",
    ref: { call: "TreeAuthorKey", args: [] },
    children: [itemNode(0), itemNode(1), itemNode(2)],
  };
  expect(lock(rec, author).errors.map(lockMessage)).toEqual([]);
});

test("the empty key's 0 is the read at its place, never another read worth 0: one line a turn, the first one too (T194)", () => {
  // TreeAuthorAlias: asNumber(m.h[k]) + TreeTurnItem(i) a turn, TreeOwned (0) read before it, as the game's shinies
  const rec = record("TreeAuthorAlias", 12);
  expect(drafted(rec)).toEqual([
    ["DNSM.TreeAuthor.v", [["TreeAuthorAlias()", [item(0), item(1), item(2)]]]],
  ]);
  const author: BlueprintNode = {
    key: "author",
    name: "Author",
    ref: { call: "TreeAuthorAlias", args: [] },
    children: [itemNode(0), itemNode(1), itemNode(2)],
  };
  expect(lock(rec, author).errors.map(lockMessage)).toEqual([]);
});

const once: BlueprintNode = {
  key: "author",
  name: "Author",
  ref: { call: "TreeAuthorOnce", args: [] },
  children: [itemNode(1)],
};

test("an author that writes a key not yet set once starts on the empty key's 0: its count is the item (as the game's meals)", () => {
  // TreeAuthorOnce: TreeTurnItem(1) × 2 + asNumber(the empty key) = 8
  const rec = record("TreeAuthorOnce", 8);
  expect(lock(rec, once).errors.map(lockMessage)).toEqual([]);
});

test("with the author's read list full, the empty key is the one with no number of it in its step log before the write", () => {
  // the recorder keeps 80 first reads (READ_CAP): the read of the empty key falls off the list, as in TalentCalc(-6)
  const rec = record("TreeAuthorOnce", 8);
  const author = rec.nodes.find((n) => n.b === "TreeAuthorOnce");
  if (!author) throw new Error("no author");
  author.r = (author.r ?? []).filter(([p]) => p !== "DNSM.TreeAuthor.v");
  while (author.r.length < READ_CAP)
    author.r.push([`TreePad${String(author.r.length)}`, 0, 0]);
  expect(lock(rec, once).errors.map(lockMessage)).toEqual([]);
});

/** A turn of TreeAuthorRelay*: a line by TreeTurnAt(), the pass-through's call, the turn's twin a termPart child. */
const relayLine = (turn: number): BlueprintNode => ({
  key: `item-turn-${String(turn)}`,
  name: "Item",
  ref: { call: "TreeTurnAt", args: [] },
  children: [
    {
      key: "item",
      name: "Item",
      ref: { call: "TreeTurnAt", args: [] },
      children: [leaf("list", `TreeList[${String(turn - 1)}]`)],
    },
    {
      key: "twin",
      name: "Twin",
      ref: { read: `TreeTwins[${String(turn - 1)}]` },
      leaf: "record",
      termPart: { system: "achievements" },
    },
  ],
});
const relay = (block: string): BlueprintNode => ({
  key: "author",
  name: "Author",
  ref: { call: block, args: [] },
  children: [relayLine(1), relayLine(2)],
});

test("an author's write's turn holds the call that gave its pass-through, before its write on another path, by the place (T226)", () => {
  // TreeAuthorRelay: TreeTurnAt() into TreeCountDN, then TreeRelayDN by a step, then the cache, a turn: each turn's call
  // is the other turn's too (the same key), one after the first line, one before the second
  const rec = record("TreeAuthorRelay", 18);
  const at = (i: number): Shape => [
    "TreeTurnAt()",
    [
      ["TreeTurnAt()", [[`TreeList[${String(i)}]`, []]]],
      [`TreeTwins[${String(i)}]`, []],
    ],
  ];
  expect(drafted(rec)).toEqual([
    ["DNSM.TreeAuthor.v", [["TreeAuthorRelay()", [at(0), at(1)]]]],
  ]);
  expect(lock(rec, relay("TreeAuthorRelay")).errors.map(lockMessage)).toEqual(
    [],
  );
});

test("an author's pass-through call made before the loop has no place in the turns after the first (T226)", () => {
  const rec = record("TreeAuthorRelayEarly", 12);
  expect(
    lock(rec, relay("TreeAuthorRelayEarly")).errors.map(lockMessage),
  ).toEqual([
    "invented-author/0/cards/cache/author: a chamada de TreeTurnAt() não tem lugar na volta 2 do laço de TreeAuthorRelayEarly()",
  ]);
});

test("an author's write's turn with two calls of its pass-through's key is refused with the reason, never tied to the first (r1 of W)", () => {
  // TreeAuthorRelaySkip: no write of the cache in the middle turn, so the last write's turn holds two TreeTurnAt()
  const rec = record("TreeAuthorRelaySkip", 32);
  expect(
    lock(rec, relay("TreeAuthorRelaySkip")).errors.map(lockMessage),
  ).toEqual([
    "invented-author/0/cards/cache/author: duas chamadas de TreeTurnAt() na volta 2 do laço de TreeAuthorRelaySkip(), e o lugar não as separa",
  ]);
});

test("a write's turn holds the call begun right after the write before it, never the one begun after its own (r1 of W)", () => {
  // TreeAuthorRelayNext: turn 2's TreeArg(2) began right after the cache's first write (seq equal); a `*` child, whose
  // argument of the save differs a turn, is turn 1's only
  const line = (i: number): BlueprintNode => ({
    ...itemNode(i),
    key: `line-${String(i)}`,
    children: [
      itemNode(i),
      {
        key: "arg",
        name: "Arg",
        ref: { call: "TreeArg", args: ["*"] },
        termPart: { system: "achievements" },
        children: [leaf("base", "TreeBase")],
      },
    ],
  });
  const author = {
    ...relay("TreeAuthorRelayNext"),
    children: [line(0), line(1)],
  };
  const rec = record("TreeAuthorRelayNext", 120);
  expect(lock(rec, author).errors.map(lockMessage)).toEqual([]);
});

test("the best of three members goes down the member whose turn wrote the cache, by its place, never the last turn's (T212)", () => {
  // TreeAuthorBest over TreeList [1, 3, 2]: the bonuses 2, 6, 4; the cache is the second member's 6
  const rec = inventedRecorder().record(
    mosaicOf({
      TreeList: [1, 3, 2],
      DNSM: {
        $m: { ...activeAs(0).DNSM.$m, TreeAuthor: { $m: { v: 6 } } },
      },
    }),
    [["TreeAuthorRead", [0, 0, 0]]],
    {
      recompute: [],
      builders: [
        { cache: "TreeAuthor", run: { block: "TreeAuthorBest", args: [] } },
      ],
    },
  );
  const author: BlueprintNode = {
    key: "author",
    name: "Author",
    ref: { call: "TreeAuthorBest", args: [] },
    children: [itemNode(1)],
  };
  expect(lock(rec, author).errors.map(lockMessage)).toEqual([]);
});
