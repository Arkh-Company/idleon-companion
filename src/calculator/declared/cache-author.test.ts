// A read of a cache built before the root (spec 010, T166; spec, Open Questions 23/11): it ties to the block that wrote
// it, by the recorded write (its path and the number of the last write the read saw), and the tree goes down through
// that block to the save. With more than one possible author it is refused with the reason, never by value or order.
// The invented game (fake-game.js, TreeAuthor*) builds the cache in the recipe's builders' pass.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import type { Recipe, Recording } from "../recording.ts";
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
type Run = Recipe["builders"][number]["run"];
const builder = (run: string | Run) => ({
  cache: "TreeAuthor",
  run: typeof run === "string" ? { block: run, args: [] } : run,
});
const record = (root: string, ...builders: (string | Run)[]): Recording =>
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

const draftOf = (rec: Recording, root: string) => {
  const key = keyOf(rec);
  if ("error" in key) throw new Error(key.reason);
  const ref = { call: root, args: [0, 0, 0] };
  return draftBlueprint("invented", { name: "I", ref }, key, rec, [
    ...inventedRecorder().ops,
  ]);
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
      [["TreeCapped", []]],
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
  const { errors } = lock(rec, blueprint("TreeAuthorDeep", source));
  expect(errors.map((e) => e.kind)).toEqual(["openingRefused"]);
  expect(errors.map(lockMessage)).toEqual([
    expect.stringMatching(
      /^invented-author\/0\/cards\/call\/cache: a leitura de DNSM\.TreeAuthor\.v tem mais de um autor possível \(TreeAuthorBuild\(\) seq \d+; TreeAuthorAgain\(\) seq \d+\)$/,
    ),
  ]);
});

/** The lock's refusals of the opening, as their messages; the draft's pending entries. */
const refusals = (rec: Recording, root: string, source: BlueprintNode) =>
  lock(rec, blueprint(root, source)).errors.map((e) =>
    e.kind === "openingRefused" ? lockMessage(e) : e.kind,
  );
const descents = (rec: Recording, root: string) =>
  draftOf(rec, root).pending.filter((p) => p.kind === "descend");

test("a cache a helper's event wrote outside any block: the answer key keeps it, the lock refuses it and the draft waits", () => {
  const rec = record("TreeAuthorRead", {
    slot: 0,
    behavior: "ActorEvents_29",
    event: "_customEvent_TreeAuthorFill",
    args: [],
  });
  expect("error" in keyOf(rec)).toBe(false);
  expect(refusals(rec, "TreeAuthorRead", cache([author()]))).toEqual([
    "invented-author/0/cards/cache: o cache DNSM.TreeAuthor.v foi escrito fora de um bloco",
  ]);
  expect(descents(rec, "TreeAuthorRead")).toEqual([
    { where: "pools/0/groups/0/sources/0", kind: "descend" },
  ]);
});

test("a cache read with no recorded write is never a leaf: the lock refuses it and the draft waits", () => {
  const rec = record("TreeAuthorRead");
  expect("error" in keyOf(rec)).toBe(false);
  expect(
    refusals(rec, "TreeAuthorRead", leaf("cache", "DNSM.TreeAuthor.v")),
  ).toEqual([
    "invented-author/0/cards/cache: o cache DNSM.TreeAuthor.v não tem escrita gravada: falta o builder na receita ou o builder deu outro valor",
  ]);
  expect(descents(rec, "TreeAuthorRead")).toEqual([
    { where: "pools/0/groups/0/sources/0", kind: "descend" },
  ]);
});

test("a cache its author sums in a loop over its own value is refused below the author, not a leaf of its last turn", () => {
  const rec = record("TreeAuthorRead", "TreeAuthorLoop");
  expect("error" in keyOf(rec)).toBe(false);
  const loop: BlueprintNode = {
    key: "author",
    name: "Author",
    ref: { call: "TreeAuthorLoop", args: [] },
    children: [leaf("self", "DNSM.TreeAuthor.v")],
  };
  expect(refusals(rec, "TreeAuthorRead", cache([loop]))).toContainEqual(
    "invented-author/0/cards/cache/author/self: o cache DNSM.TreeAuthor.v é somado em voltas pelo autor",
  );
  expect(descents(rec, "TreeAuthorRead")).toContainEqual({
    where: "pools/0/groups/0/sources/0/children/0/children/0",
    kind: "descend",
  });
});

test("the cache never becomes a leaf: a cache read declared as a leaf is leafHasChildren, with its author", () => {
  const rec = record("TreeAuthorRead", "TreeAuthorBuild");
  const bp = blueprint("TreeAuthorRead", {
    ...leaf("cache", "DNSM.TreeAuthor.v"),
  });
  expect(lock(rec, bp).errors.map(lockMessage)).toEqual([
    "folha com filhos na gravação: invented-author/0/cards/cache: o primeiro é TreeAuthorBuild()",
  ]);
});

test("the place decides the author: the read ties to the helpers' last write before it, not to the builders' pass after", () => {
  // the helpers build it by TreeAuthorAgain, then TreeAuthorBuild (both 15); the root reads it; the pass builds it again
  const rec = inventedRecorder().record(
    mosaicOf({ ...attrs, Scenario: "authorBuilt" }),
    [["TreeAuthorRead", [0, 0, 0]]],
    { recompute: [], builders: [builder("TreeAuthorBuild")] },
  );
  const ok = lock(rec, blueprint("TreeAuthorRead", cache([author()])));
  expect(ok.errors).toEqual([]);
  expect(ok.counts.leaves).toBe(3);
});

test("the read a call returns after its own write is a passage, not the helpers' cache its first step read", () => {
  // the helpers built the cache (TreeAuthorBuild last); TreeAuthorPlaces read it, wrote it again and returns it read back
  const rec = inventedRecorder().record(
    mosaicOf({ ...attrs, Scenario: "authorBuilt" }),
    [["TreeAuthorPlacesRoot", [0, 0, 0]]],
    { recompute: [], builders: [] },
  );
  const source: BlueprintNode = {
    key: "call",
    name: "Call",
    ref: { call: "TreeAuthorPlaces", args: [] },
    children: [leaf("cache", "DNSM.TreeAuthor.v")],
  };
  expect(
    lock(rec, blueprint("TreeAuthorPlacesRoot", source)).errors.map(
      lockMessage,
    ),
  ).toEqual([]);
  expect(
    draftOf(rec, "TreeAuthorPlacesRoot").pools[0]?.groups[0]?.sources.map(
      shape,
    ),
  ).toEqual([["TreeAuthorPlaces()", [["DNSM.TreeAuthor.v", []]]]]);
});

test("the draft waits for the descent of a cache read with two possible authors, and keeps the root's own passage a leaf", () => {
  const deep = draftOf(
    record("TreeAuthorDeep", "TreeAuthorBuild", "TreeAuthorAgain"),
    "TreeAuthorDeep",
  );
  expect(deep.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    ["TreeAuthorCall()", [["DNSM.TreeAuthor.v", []]]],
  ]);
  expect(deep.pending).toContainEqual({
    where: "pools/0/groups/0/sources/0/children/0",
    kind: "descend",
  });
  // TreeCountNone writes DNSM.TreeCount.v itself, then reads it: a passage of the root, no cache (the 3 is a constant)
  const own = draftOf(record("TreeCountNone"), "TreeCountNone");
  expect(
    own.pools.map((p) => p.groups.map((g) => g.sources.map(shape))),
  ).toEqual([[[["", []]], [["DNSM.TreeCount.v", []]], [["TreeLoop()", []]]]]);
});
