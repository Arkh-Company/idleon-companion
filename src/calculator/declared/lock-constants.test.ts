// A constant with its conditions inside a call (spec 010, T209 form 3; data-model "Constante com condição dentro de uma
// chamada"; FR-018 of 009): the block writes a variable of its own with a number of the code and multiplies it under
// conditions; each multiplier is a line with the conditions that apply it, and one whose condition did not apply shows
// its neutral value. The invented game's TreeDoubled(e) doubles DNSM.TreeDbl when TreeUpg[e] is 101 and when
// TreeOwnedFlag() is 1, then multiplies it by TreeLevel.
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { parseBlueprint } from "./blueprint.ts";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import { inventedRecorder, recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const level = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const times = (
  key: string,
  constant: number,
  condition: BlueprintNode,
): BlueprintNode => ({ key, name: key, constant, children: [condition] });
const source = (max = 2, more: BlueprintNode[] = []): BlueprintNode => ({
  key: "doubled",
  name: "Doubled",
  ref: { call: "TreeDoubled", args: [0] },
  children: [
    times("at-max", max, {
      key: "upg",
      name: "Upg",
      ref: { read: "TreeUpg[0]" },
      leaf: "condition",
      conditionKind: "max",
    }),
    times("owned", 2, {
      key: "flag",
      name: "Flag",
      ref: { call: "TreeOwnedFlag", args: [] },
      leaf: "condition",
      conditionKind: "owned",
    }),
    ...more,
    level("level", "TreeLevel"),
  ],
});
const blueprint = (s: BlueprintNode): Blueprint => ({
  id: "invented-constants",
  root: { name: "Invented", ref: { call: "TreeDoubledPool", args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        { system: "cards", sources: [s] },
        { system: "stamps", sources: [level("capped", "TreeCapped")] },
      ],
    },
  ],
});
const lock = (s: BlueprintNode, attrs: object) =>
  lockBlueprint({
    ...recorded("TreeDoubledPool", { TreeUpg: [101], ...attrs }),
    blueprint: blueprint(s),
    character: 0,
    characterClass: 3,
  }).errors;

test("each multiplier the block applied is its constant, by the condition that applied it, and the level closes (form 3)", () => {
  expect(lock(source(), {})).toEqual([]);
});

test("a multiplier whose condition did not apply shows its neutral value: the level still closes (form 3)", () => {
  expect(lock(source(), { TreeFlagOn: 0 })).toEqual([]);
  expect(lock(source(), { TreeUpg: [5], TreeFlagOn: 0 })).toEqual([]);
});

test("a constant the code does not have at its condition's place is refused (form 3)", () => {
  expect(lock(source(3), {})).toContainEqual(
    expect.objectContaining({
      kind: "notClosing",
      where: "invented-constants/0/cards/doubled/at-max",
    }),
  );
});

test("a constant no write took is checked by its condition read off in the level, and never counts as passed (r1 of P and Q)", () => {
  const run = (s: BlueprintNode, attrs: object) =>
    lockBlueprint({
      ...recorded("TreeDoubledPool", { TreeUpg: [101], ...attrs }),
      blueprint: blueprint(s),
      character: 0,
      characterClass: 3,
    });
  // the wrong constant under a condition off: no write to check it by, so its condition is no passed leaf
  const off = run(source(3), { TreeUpg: [5] });
  expect(off.errors).toEqual([]);
  expect(off.closedAt).not.toContain(
    "invented-constants/0/cards/doubled/at-max/upg",
  );
  // a constant whose condition the level never read: refused, never let through as off
  const unread = times("other", 2, {
    key: "nope",
    name: "Nope",
    ref: { read: "TreeNope" },
    leaf: "condition",
    conditionKind: "max",
  });
  expect(run(source(2, [unread]), {}).errors).toContainEqual(
    expect.objectContaining({
      kind: "conditionMismatch",
      where: "invented-constants/0/cards/doubled/other/nope",
    }),
  );
});

test("a constant whose condition the level read on, with no write that took it, is refused (r2 of P and Q)", () => {
  // TreeDoubledIdle reads TreeUpg[0] == 101 and writes no factor under it: the x2 declared there has no write
  const idle = { ...source(), ref: { call: "TreeDoubledIdle", args: [0] } };
  const errors = lockBlueprint({
    ...recorded("TreeDoubledIdlePool", { TreeUpg: [101] }),
    blueprint: {
      ...blueprint(idle),
      root: {
        name: "Invented",
        ref: { call: "TreeDoubledIdlePool", args: [0, 0, 0] },
      },
    },
    character: 0,
    characterClass: 3,
  }).errors;
  expect(errors).toContainEqual(
    expect.objectContaining({
      kind: "conditionMismatch",
      where: "invented-constants/0/cards/doubled/at-max/upg",
    }),
  );
});

test("the load takes a constant in a call's level only with its conditions as children (form 3)", () => {
  const parse = (s: BlueprintNode) =>
    parseBlueprint(blueprint(s), {
      fileId: "invented-constants",
      systemIds: new Set(["cards", "stamps"]),
    }).ok;
  expect(parse(source())).toBe(true);
  const bare = source();
  const kids = [...(bare.children ?? [])];
  kids[0] = { key: "at-max", name: "At max", constant: 2, leaf: "fixedValue" };
  expect(parse({ ...bare, children: kids })).toBe(false);
});

test("two multipliers under the same reading part by the code's own number at the write's place: the x6 side (form 3)", () => {
  const x6 = times("past-max", 6, {
    key: "upg",
    name: "Upg",
    ref: { read: "TreeUpg[0]" },
    leaf: "condition",
    conditionKind: "equalsValue",
  });
  expect(lock(source(2, [x6]), { TreeUpg: [102] })).toEqual([]);
  expect(lock(source(2, [x6]), {})).toEqual([]);
});

test("the block's constants in a builder of the pass, whose writes of the variable are the pass's scratch (form 3)", () => {
  const r = inventedRecorder();
  const attrs = {
    TreeUpg: [101],
    DNSM: { $m: { ...activeAs(0).DNSM.$m, TreeDblCache: { $m: { v: 100 } } } },
  };
  const rec = r.record(mosaicOf(attrs), [["TreeDoubledCacheRead", [0, 0, 0]]], {
    recompute: [],
    builders: [
      { cache: "TreeDblCache", run: { block: "TreeDoubledBuild", args: [] } },
    ],
  });
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  const cache: BlueprintNode = {
    key: "cache",
    name: "Cache",
    ref: { read: "DNSM.TreeDblCache.v" },
    children: [
      {
        key: "build",
        name: "Build",
        ref: { call: "TreeDoubledBuild", args: [] },
        children: [source()],
      },
    ],
  };
  const bp: Blueprint = {
    ...blueprint(cache),
    root: {
      name: "Invented",
      ref: { call: "TreeDoubledCacheRead", args: [0, 0, 0] },
    },
  };
  expect(
    lockBlueprint({
      blueprint: bp,
      key,
      rec,
      ops: r.ops,
      character: 0,
      characterClass: 3,
    }).errors,
  ).toEqual([]);
});
