// A cache's author by any call of its block (spec 010, T208; spec, Open Questions 24/11; data-model "Autor de cache por
// qualquer chamada"): the game's TalentCalc writes DNSM.BoxRewards for any argument up to 0, and the call that wrote it
// last changes from one character's run to another's. `ref.args: ["any"]` only on a cache's author; the lock ties it by
// the recorded write, and the draft writes it when the author changes between the runs. The invented game's
// TreeAuthorAny(k) writes the cache TreeAuthor in a part every k runs.
import { expect, test } from "vitest";
import { mosaicOf, activeAs } from "../fixtures/fake-mosaic.ts";
import type { Recording } from "../recording.ts";
import { answerKey } from "./answer-key.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { parseBlueprint } from "./blueprint.ts";
import { joinDrafts } from "./draft-runs.ts";
import { draftBlueprint } from "./draft.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const attrs = {
  DNSM: { $m: { ...activeAs(0).DNSM.$m, TreeAuthor: { $m: { v: 15 } } } },
};
/** The root read of the cache, with TreeAuthorAny(k) as the builder. */
const record = (k: number): Recording =>
  inventedRecorder().record(mosaicOf(attrs), [["TreeAuthorRead", [0, 0, 0]]], {
    recompute: [],
    builders: [
      { cache: "TreeAuthor", run: { block: "TreeAuthorAny", args: [k] } },
    ],
  });
const keyOf = (rec: Recording) => {
  const key = answerKey(rec, inventedRecorder().ops);
  if ("error" in key) throw new Error(key.reason);
  return key;
};
const ROOT = { call: "TreeAuthorRead", args: [0, 0, 0] };

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const blueprint = (args: (string | number)[]): Blueprint => ({
  id: "invented-any",
  root: { name: "Invented", ref: ROOT },
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
                  ref: { call: "TreeAuthorAny", args },
                  children: [
                    leaf("base", "TreeBase"),
                    leaf("a", "TreeStats.a"),
                  ],
                },
              ],
            },
          ],
        },
        { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
      ],
    },
  ],
});
const lock = (rec: Recording, bp: Blueprint) =>
  lockBlueprint({
    blueprint: bp,
    key: keyOf(rec),
    rec,
    ops: inventedRecorder().ops,
    character: 0,
    characterClass: 3,
  });

test("the lock ties `any` to the call of its block that wrote the cache, in each run; one argument fits one run only", () => {
  for (const k of [1, 2])
    expect(lock(record(k), blueprint(["any"])).errors).toEqual([]);
  expect(lock(record(2), blueprint([1])).errors.map((e) => e.kind)).toEqual([
    "childOutside",
    "undeclaredPart",
  ]);
});

const parse = (raw: unknown) =>
  parseBlueprint(raw, {
    fileId: "invented-any",
    systemIds: new Set(["cards", "stamps"]),
  });

test("the load takes `any` only as the whole args of a cache's author", () => {
  expect(parse(blueprint(["any"]))).toMatchObject({ ok: true });
  // with another argument
  expect(parse(blueprint(["any", 1]))).toMatchObject({ ok: false });
  // on a node that is no cache's author: a pool's source, a call's child
  const bp = blueprint(["any"]);
  const source = bp.pools[0]?.groups[0]?.sources[0];
  const author = source?.children?.[0];
  if (!source || !author) throw new Error("no source");
  const asSource = {
    ...bp,
    pools: [
      { ...bp.pools[0], groups: [{ system: "cards", sources: [author] }] },
    ],
  };
  expect(parse(asSource)).toMatchObject({
    ok: false,
    reason: expect.stringMatching(/any só no autor de um cache/),
  });
  const below = {
    ...author,
    key: "below",
    children: [{ ...author, children: [leaf("base", "TreeBase")] }],
  };
  const underCall = {
    ...bp,
    pools: [
      { ...bp.pools[0], groups: [{ system: "cards", sources: [below] }] },
    ],
  };
  expect(parse(underCall)).toMatchObject({
    ok: false,
    reason: expect.stringMatching(/any só no autor de um cache/),
  });
});

const draftOf = (rec: Recording) =>
  draftBlueprint(
    "invented-any",
    { name: "Invented", ref: ROOT },
    keyOf(rec),
    rec,
    [...inventedRecorder().ops],
  );

test("the draft writes `any` for a cache's author whose call changes between the character runs, its name pending", () => {
  const joined = joinDrafts({ draft: draftOf(record(1)), characterClass: 3 }, [
    { draft: draftOf(record(2)), characterClass: 5 },
  ]);
  const author = joined.pools[0]?.groups[0]?.sources[0]?.children?.[0];
  expect(author).toMatchObject({
    key: "tree-author-any-any",
    name: null,
    ref: { call: "TreeAuthorAny", args: ["any"] },
  });
  expect(author?.nameProof).toBeUndefined();
  expect(joined.pending).toContainEqual({
    where: "pools/0/groups/0/sources/0/children/0",
    kind: "name",
  });
  // the same call in every run: as the draft wrote it
  const same = joinDrafts({ draft: draftOf(record(1)), characterClass: 3 }, [
    { draft: draftOf(record(1)), characterClass: 5 },
  ]);
  expect(same.pools[0]?.groups[0]?.sources[0]?.children?.[0]?.ref).toEqual({
    call: "TreeAuthorAny",
    args: [1],
  });
});
