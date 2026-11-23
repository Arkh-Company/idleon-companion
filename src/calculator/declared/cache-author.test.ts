// A read of a cache built before the root (spec 010, T166; spec, Open Questions 23/11): it ties to the block that wrote
// it, by the recorded write (its path and the number of the last write the read saw), and the tree goes down through
// that block to the save. With more than one possible author it is refused with the reason, never by value or order.
// The invented game (fake-game.js, TreeAuthor*) builds the cache in the recipe's builders' pass.
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

// the running game's cache: TreeBase × 3 + TreeStats.a = 4 × 3 + 3 = TreeStats.a × 5
const attrs = {
  DNSM: { $m: { ...activeAs(0).DNSM.$m, TreeAuthor: { $m: { v: 15 } } } },
};
const builder = (block: string) => ({
  cache: "TreeAuthor",
  run: { block, args: [] },
});
const record = (root: string, ...builders: string[]): Recording =>
  inventedRecorder().record(mosaicOf(attrs), [[root, [0, 0, 0]]], {
    recompute: [],
    builders: builders.map(builder),
  });
const keyOf = (rec: Recording) => answerKey(rec, inventedRecorder().ops);

/** Each node as its reference and its children's, down the tree. */
type Shape = [string, Shape[]];
const shape = (n: DraftNode | BlueprintNode): Shape => [
  n.ref ? refKey(n.ref, 0) : "",
  (n.children ?? []).map(shape),
];

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const author = (call = "TreeAuthorBuild"): BlueprintNode => ({
  key: "author",
  name: "Author",
  ref: { call, args: [] },
  children: [leaf("base", "TreeBase"), leaf("a", "TreeStats.a")],
});
const blueprint = (root: string, source: BlueprintNode): Blueprint => ({
  id: "invented-author",
  root: { name: "Invented", ref: { call: root, args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        { system: "cards", sources: [source] },
        { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
      ],
    },
  ],
});
const cache = (children: BlueprintNode[]): BlueprintNode => ({
  key: "cache",
  name: "Cache",
  ref: { read: "DNSM.TreeAuthor.v" },
  children,
});
const lock = (rec: Recording, bp: Blueprint) => {
  const key = keyOf(rec);
  if ("error" in key) throw new Error(key.reason);
  const { ops } = inventedRecorder();
  return lockBlueprint({
    blueprint: bp,
    key,
    rec,
    ops,
    character: 0,
    characterClass: 3,
  });
};

test("the answer key keeps the cache read as a source when one block wrote it, and refuses two possible authors", () => {
  const key = keyOf(record("TreeAuthorRead", "TreeAuthorBuild"));
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBe(95);
  expect(key.pools.map((p) => p.terms.map((t) => t.ref))).toEqual([
    ["DNSM.TreeAuthor.v", "TreeCapped"],
  ]);
  const two = keyOf(
    record("TreeAuthorRead", "TreeAuthorBuild", "TreeAuthorAgain"),
  );
  expect("reason" in two ? two.reason : "no refusal").toMatch(
    /a leitura de DNSM\.TreeAuthor\.v tem mais de um autor possível \(TreeAuthorBuild\(\) seq \d+; TreeAuthorAgain\(\) seq \d+\)/,
  );
});

test("the draft writes the cache read's child as the block that wrote it, opened down to the save", () => {
  const rec = record("TreeAuthorRead", "TreeAuthorBuild");
  const key = keyOf(rec);
  if ("error" in key) throw new Error(key.reason);
  const draft = draftBlueprint(
    "invented-author",
    { name: "Invented", ref: { call: "TreeAuthorRead", args: [0, 0, 0] } },
    key,
    rec,
    inventedRecorder().ops,
  );
  expect(
    draft.pools.map((p) => p.groups.map((g) => g.sources.map(shape))),
  ).toEqual([
    [
      [
        [
          "DNSM.TreeAuthor.v",
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
      ],
      [[["TreeCapped", []]]],
    ],
  ]);
});

test("the lock goes down the cache read through its author, and the level closes by the author's count", () => {
  const rec = record("TreeAuthorRead", "TreeAuthorBuild");
  const ok = lock(rec, blueprint("TreeAuthorRead", cache([author()])));
  expect(ok.errors).toEqual([]);
  expect(ok.counts).toEqual({
    closed: 4,
    closedByRecorded: 0,
    leaves: 3,
    branches: 2,
  });
  // another block as the child: outside the count, and the author is a part with no child
  const other = lock(
    rec,
    blueprint("TreeAuthorRead", cache([author("TreeAuthorAgain")])),
  );
  expect(other.errors.map(lockMessage)).toEqual([
    "filho fora da conta: invented-author/0/cards/cache/author",
    "parte não declarada: invented-author/0/cards/cache: TreeAuthorBuild()",
  ]);
});

test("the lock refuses a cache read below a source with two possible authors, with the reason", () => {
  const source: BlueprintNode = {
    key: "call",
    name: "Call",
    ref: { call: "TreeAuthorCall", args: [] },
    children: [cache([author()])],
  };
  const rec = record("TreeAuthorDeep", "TreeAuthorBuild", "TreeAuthorAgain");
  expect(
    lock(rec, blueprint("TreeAuthorDeep", source)).errors.map(lockMessage),
  ).toEqual([
    expect.stringMatching(
      /^invented-author\/0\/cards\/call\/cache: a leitura de DNSM\.TreeAuthor\.v tem mais de um autor possível \(TreeAuthorBuild\(\) seq \d+; TreeAuthorAgain\(\) seq \d+\)$/,
    ),
  ]);
});
