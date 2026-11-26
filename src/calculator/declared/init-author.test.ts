// A cache an actor's init built (spec 010, T189; spec, Open Questions 23/11: "o cache montado por um ajudante ou evento
// fora dos builders da receita desce pela conta desse ajudante ou evento"), as the game's ActorEvents_577 builds
// DNSM.CompanionBon: the recording keeps the init as an event with its steps, and the tree goes down through its count.
// The invented game (fake-game.js, InitActor and TreeInitRead) builds DNSM.TreeInitBon.v = TreeStats.a × 5.
import { expect, test } from "vitest";
import { mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { refKey } from "./refs.ts";

const ROOT = "TreeInitRead";
type Shape = [string, Shape[]];
const shape = (n: DraftNode): Shape => [
  n.ref ? refKey(n.ref, 0) : "",
  (n.children ?? []).map(shape),
];
const leaf = (read: string): BlueprintNode => ({
  key: read.toLowerCase().replace(/\W+/g, "-"),
  name: read,
  ref: { read },
  leaf: "level",
});

function recordedInit() {
  const r = inventedRecorder();
  const rec = r.record(
    mosaicOf({ Scenario: "initBuilt" }),
    [[ROOT, [0, 0, 0]]],
    { recompute: [], builders: [] },
  );
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  return { rec, key, ops: r.ops };
}

test("the draft goes down a cache an actor's init built through the init's own count", () => {
  const { rec, key, ops } = recordedInit();
  expect(key.final).toBe(95);
  const ref = { call: ROOT, args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  expect(draft.pools[0]?.groups.map((g) => g.sources.map(shape))).toEqual([
    [
      [
        "DNSM.TreeInitBon.v",
        [["ActorEvents_577_init()", [["TreeStats.a", []]]]],
      ],
    ],
    [["TreeCapped", []]],
  ]);
});

test("the lock closes the cache an actor's init built by the init's count", () => {
  const input = recordedInit();
  const init: BlueprintNode = {
    key: "init",
    name: "Init",
    ref: { call: "ActorEvents_577_init", args: [] },
    children: [leaf("TreeStats.a")],
  };
  const blueprint: Blueprint = {
    id: "invented-init",
    root: { name: "Invented", ref: { call: ROOT, args: [0, 0, 0] } },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "cards",
            sources: [
              { ...leaf("DNSM.TreeInitBon.v"), children: [init] },
              leaf("TreeCapped"),
            ],
          },
        ],
      },
    ],
  };
  const lock = lockBlueprint({
    blueprint,
    ...input,
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors.map(lockMessage)).toEqual([]);
});
