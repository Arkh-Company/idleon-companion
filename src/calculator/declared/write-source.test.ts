// A cache's write with no step of its own (spec 010, T191): the game's ActorEvents_577 init writes a companion's bonus
// as a CompanionDB cell, and TalentCalc(-3) a family bonus as FamilyBonsuesREAL's value. The write's count is the bare
// read or the call made right before it, after the turn's last step, by its place (the value only checks). The invented
// game (fake-game.js, TreeWriteRead) reads TreeWriteBare's two writes: TreeBig k2, and TreeWriteCall().
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { refKey } from "./refs.ts";

const ROOT = "TreeWriteRead";
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
const call = (block: string, children: BlueprintNode[]): BlueprintNode => ({
  key: block.toLowerCase(),
  name: block,
  ref: { call: block, args: [] },
  children,
});

function recordedWrites(
  root = ROOT,
  cache = "TreeWriteBon",
  block = "TreeWriteBare",
  over: { v?: number; attrs?: object } = {},
) {
  const r = inventedRecorder();
  const attrs = {
    ...over.attrs,
    DNSM: {
      $m: {
        ...activeAs(0).DNSM.$m,
        [cache]: { $m: { v: over.v ?? 7, w: 8 } },
      },
    },
  };
  const rec = r.record(mosaicOf(attrs), [[root, [0, 0, 0]]], {
    recompute: [],
    builders: [{ cache, run: { block, args: [] } }],
  });
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  return { rec, key, ops: r.ops };
}

test("the draft goes down a write with no step through the bare read or the call made right before it", () => {
  const { rec, key, ops } = recordedWrites();
  expect(key.final).toBe(95);
  const ref = { call: ROOT, args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  expect(draft.pools[0]?.groups.map((g) => g.sources.map(shape))).toEqual([
    [["DNSM.TreeWriteBon.v", [["TreeWriteBare()", [["TreeBig.k2", []]]]]]],
    [
      [
        "DNSM.TreeWriteBon.w",
        [["TreeWriteBare()", [["TreeWriteCall()", [["TreeBase", []]]]]]],
      ],
    ],
    [["TreeCapped", []]],
  ]);
});

test("a call made after the write, worth the same, is no source of it: the write's count is the read before it", () => {
  const { rec, key, ops } = recordedWrites(
    "TreeWriteLateRead",
    "TreeWriteLate",
    "TreeWriteLate",
  );
  expect(key.final).toBe(87);
  const ref = { call: "TreeWriteLateRead", args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  expect(draft.pools[0]?.groups.map((g) => g.sources.map(shape))).toEqual([
    [["DNSM.TreeWriteLate.v", [["TreeWriteLate()", [["TreeBig.k2", []]]]]]],
    [["TreeCapped", []]],
  ]);
});

test("a table's text cell read after a write with no step, worth the written literal, is no source of it", () => {
  const { rec, key, ops } = recordedWrites(
    "TreeWriteCellRead",
    "TreeWriteCell",
    "TreeWriteCell",
  );
  expect(key.final).toBe(87);
  const author = rec.nodes.find((n) => n.b === "TreeWriteCell");
  expect(author?.rx).toContainEqual(
    expect.arrayContaining(["CustomLists.ListCells[0]", "7"]),
  );
  const ref = { call: "TreeWriteCellRead", args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  const shapes = draft.pools[0]?.groups.map((g) => g.sources.map(shape));
  expect(JSON.stringify(shapes)).not.toContain("ListCells");
});

test("the lock closes a write with no step by its bare read and by its call", () => {
  const input = recordedWrites();
  const blueprint: Blueprint = {
    id: "invented-write",
    root: { name: "Invented", ref: { call: ROOT, args: [0, 0, 0] } },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "cards",
            sources: [
              {
                ...leaf("DNSM.TreeWriteBon.v"),
                children: [call("TreeWriteBare", [leaf("TreeBig.k2")])],
              },
              {
                ...leaf("DNSM.TreeWriteBon.w"),
                children: [
                  call("TreeWriteBare", [
                    call("TreeWriteCall", [leaf("TreeBase")]),
                  ]),
                ],
              },
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

test("a write with no step whose window has a read and a call is the right side of the code's assignment there", () => {
  // TreeWriteRhs reads TreeBase, then A = TreeWriteCall(), then t.h.w = A: both are in the write's window
  const input = recordedWrites(
    "TreeWriteRhsRead",
    "TreeWriteRhs",
    "TreeWriteRhs",
  );
  expect(input.key.final).toBe(88);
  const blueprint: Blueprint = {
    id: "invented-write",
    root: {
      name: "Invented",
      ref: { call: "TreeWriteRhsRead", args: [0, 0, 0] },
    },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "cards",
            sources: [
              {
                ...leaf("DNSM.TreeWriteRhs.w"),
                children: [
                  call("TreeWriteRhs", [
                    call("TreeWriteCall", [leaf("TreeBase")]),
                  ]),
                ],
              },
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

test("a write on the side of a ? : its test took goes down that side's read, never the test's (Fase 4 t)", () => {
  // TreeWriteSide: `0 == TreeFlagOn ? v = 0 : v = TreeBig k2`, as the game's SailzArtiBonusL
  const { rec, key, ops } = recordedWrites(
    ROOT,
    "TreeWriteBon",
    "TreeWriteSide",
  );
  expect(key.final).toBe(95);
  const ref = { call: ROOT, args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  expect(draft.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    ["DNSM.TreeWriteBon.v", [["TreeWriteSide()", [["TreeBig.k2", []]]]]],
  ]);
});

test("a write through a variable set on both sides of a ? : goes down the side its test took (Fase 4 t)", () => {
  // TreeWriteSideVar: `1 == TreeOwned ? (t = TreeBase, v = t) : (t = TreeBig k2, v = t)`, as the game's companions
  const { rec, key, ops } = recordedWrites(
    ROOT,
    "TreeWriteBon",
    "TreeWriteSideVar",
  );
  const ref = { call: ROOT, args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  expect(draft.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    ["DNSM.TreeWriteBon.v", [["TreeWriteSideVar()", [["TreeBig.k2", []]]]]],
  ]);
});

test("a write through a variable set on both sides of a ? : goes down the first side when its test took it (Fase 4 t)", () => {
  // TreeOwned 1: v is the first side's TreeBase (4); the order of the sides never decides
  const { rec, key, ops } = recordedWrites(
    ROOT,
    "TreeWriteBon",
    "TreeWriteSideVar",
    { v: 4, attrs: { TreeOwned: 1 } },
  );
  const ref = { call: ROOT, args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  expect(draft.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    ["DNSM.TreeWriteBon.v", [["TreeWriteSideVar()", [["TreeBase", []]]]]],
  ]);
});

test("a write whose key is made in its left side goes down the side its test took (Fase 4 t)", () => {
  // TreeWriteSideKey: `r.h["" + k] = t` on each side, a step of the key between the test and the write, as the game's
  // companions
  const { rec, key, ops } = recordedWrites(
    ROOT,
    "TreeWriteBon",
    "TreeWriteSideKey",
  );
  const ref = { call: ROOT, args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  expect(draft.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    ["DNSM.TreeWriteBon.v", [["TreeWriteSideKey()", [["TreeBig.k2", []]]]]],
  ]);
});
