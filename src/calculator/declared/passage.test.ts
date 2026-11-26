// A pass-through variable a call writes and reads back (spec 010, T188; the game's PostOfficeINFO and its
// DNSM.PostOffInfoDN1): the read is never a line nor a leaf, and never opens into its own call again; the tree goes
// down through the expression that gave the write, at its place. The invented game (fake-game.js, TreePassRoot) adds
// TreePassDN() (TreeBase × 2, then + TreeLevel), TreePassBare() (TreeBase with no step, then × 3) and TreeCapped.
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { refKey } from "./refs.ts";

const ROOT = "TreePassRoot";
type Shape = [string, Shape[]];
const shape = (n: DraftNode): Shape => [
  n.ref ? refKey(n.ref, 0) : "",
  (n.children ?? []).map(shape),
];
const leaf = (read: string): BlueprintNode => ({
  key: read.toLowerCase(),
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

test("the draft goes down a pass-through variable through the expression that gave its write", () => {
  const { rec, key, ops } = recorded(ROOT);
  expect(key.final).toBe(125);
  const ref = { call: ROOT, args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  expect(draft.pools[0]?.groups.map((g) => g.sources.map(shape))).toEqual([
    [
      [
        "TreePassDN()",
        [
          ["TreeBase", []],
          ["TreeLevel", []],
        ],
      ],
    ],
    [["TreePassBare()", [["TreeBase", []]]]],
    [["TreeCapped", []]],
  ]);
});

test("the lock closes a call with a pass-through variable by the parts of its write, with no line for the variable", () => {
  const input = recorded(ROOT);
  const blueprint: Blueprint = {
    id: "invented-pass",
    root: { name: "Invented", ref: { call: ROOT, args: [0, 0, 0] } },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "cards",
            sources: [
              call("TreePassDN", [leaf("TreeBase"), leaf("TreeLevel")]),
              call("TreePassBare", [leaf("TreeBase")]),
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
