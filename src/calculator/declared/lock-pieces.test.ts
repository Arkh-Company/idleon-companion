// A piece's line in the lock (spec 010, T170, T171; spec, Open Questions 23/11): the line takes the value of its
// reference (the call or the cache the game read) and closes by the count of its piece's children, each level by its
// declared combine over the recorded values of the leaves; an `each` node has one child per item of the recorded list,
// its size from the recording. There the engine does not look for a cache's author nor a loop's turns. The invented
// game (fake-game.js, TreeSign*) sums a bonus × a multi over the items of TreeSigns.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import { answerKey } from "./answer-key.ts";
import { parseBlueprint } from "./blueprint.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { inventedRecorder, levelContext, recorded } from "./lock-fixture.ts";
import { pieceChildren } from "./lock-pieces.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { refKey } from "./refs.ts";

type Raw = Record<string, unknown>;
const SIGNS = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      "..",
      "fixtures",
      "blueprints",
      "invented-signs.piece.json",
    ),
    "utf8",
  ),
) as Raw & { children: (Raw & { children: Raw[] })[] };
/** The invented piece with `change` made to a deep copy of its model child's children. */
const signsWith = (change: (kids: Raw[]) => void) => {
  const p = structuredClone(SIGNS);
  change(p.children[0]?.children ?? []);
  return p;
};
const state = (list: number[]) => ({
  TreeSigns: list,
  TreeSignBonus: { $m: { Drop: [0, 5, 10, 20] } },
  TreeSignMulti: 2,
});

const CALL = { ref: { call: "TreeSigns", args: ["Drop"] } };
const LINE = "invented-signs-number/0/cards/signs";
/** An invented blueprint whose first source is a line `line` that calls the piece, over `root`. */
function blueprint(line: Raw, piece: unknown = SIGNS, root = "TreeSignsRoot") {
  const out = parseBlueprint(
    {
      id: "invented-signs-number",
      root: { name: "Invented", ref: { call: root, args: [0, 0, 0] } },
      pools: [
        {
          kind: "additive",
          groups: [
            {
              system: "cards",
              sources: [
                {
                  key: "signs",
                  name: "Invented Signs",
                  ...line,
                  piece: { name: "invented-signs", args: { stat: "Drop" } },
                },
              ],
            },
            {
              system: "stamps",
              sources: [
                {
                  key: "capped",
                  name: "Invented Capped",
                  ref: { read: "TreeCapped" },
                  leaf: "rawBonus",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      fileId: "invented-signs-number",
      systemIds: new Set(["cards", "stamps"]),
      pieces: new Map([["invented-signs", piece]]),
    },
  );
  if (!out.ok) throw new Error(out.reason);
  return out.blueprint;
}
const lock = (bp: Blueprint, list: number[]) =>
  lockBlueprint({
    blueprint: bp,
    ...recorded("TreeSignsRoot", state(list)),
    character: 0,
    characterClass: 3,
  });
const keyOf = (n: BlueprintNode) => (n.ref ? refKey(n.ref, 0) : "");

test("an each node has one child per item of the recorded list, the item in place of its name; the size comes from the recording", () => {
  const line = blueprint(CALL).pools[0]?.groups[0]?.sources[0];
  if (!line) throw new Error("no line");
  const kids = (list: number[]) => {
    const { rec, ops } = recorded("TreeSignsRoot", state(list));
    return pieceChildren(line, levelContext(rec, ops, LINE)).map((c) => [
      c.key,
      keyOf(c),
      c.nameProof,
      (c.children ?? []).map(keyOf),
    ]);
  };
  const sign = (at: number, item: number) => [
    `sign-${String(at)}`,
    `TreeSign("Drop",${String(item)})`,
    { table: "InventedSigns", row: item },
    [`TreeSignBonus.Drop[${String(item)}]`, "TreeSignMulti"],
  ];
  expect(kids([1, 2, 3])).toEqual([sign(0, 1), sign(1, 2), sign(2, 3)]);
  expect(kids([3, 1])).toEqual([sign(0, 3), sign(1, 1)]);
});

test("the lock closes a piece's line by its children's count over the recorded leaves, each level by its combine", () => {
  const out = lock(blueprint(CALL), [1, 2, 3]);
  expect(out.errors).toEqual([]);
  // the line and its 3 signs, the pool and the root closed; 2 leaves a sign and TreeCapped
  expect(out.counts).toEqual({
    closed: 6,
    closedByRecorded: 0,
    leaves: 7,
    branches: 4,
  });
  expect(lock(blueprint(CALL), [1, 3]).errors).toEqual([]);
});

test("a cache read's line closes by its piece: the cache's author is not looked for", () => {
  const r = inventedRecorder();
  const rec = r.record(
    mosaicOf({
      ...state([1, 2, 3]),
      DNSM: {
        $m: { ...activeAs(0).DNSM.$m, TreeSignsDrop: { $m: { v: 70 } } },
      },
    }),
    [["TreeSignsCached", [0, 0, 0]]],
    {
      recompute: [],
      builders: [
        { cache: "TreeSignsDrop", run: { block: "TreeSignsBuild", args: [] } },
      ],
    },
  );
  const key = answerKey(rec, r.ops);
  if ("error" in key) throw new Error(key.reason);
  expect(key.pools[0]?.terms.map((t) => t.ref)).toEqual([
    "DNSM.TreeSignsDrop.v",
    "TreeCapped",
  ]);
  const out = lockBlueprint({
    blueprint: blueprint(
      { ref: { read: "DNSM.TreeSignsDrop.v" } },
      SIGNS,
      "TreeSignsCached",
    ),
    key,
    rec,
    ops: r.ops,
    character: 0,
    characterClass: 3,
  });
  expect(out.errors).toEqual([]);
  expect(out.counts.branches).toBe(4);
});

test("a piece whose count does not close is refused with the level and the two values; a leaf the recording lacks has no value", () => {
  // the multi left out: each sign gives its bonus only
  const errors = lock(
    blueprint(
      CALL,
      signsWith((kids) => kids.pop()),
    ),
    [1, 3],
  ).errors;
  expect(errors).toEqual([
    {
      kind: "notClosing",
      where: `${LINE}/sign-0`,
      expected: 10,
      got: 5,
    },
    {
      kind: "notClosing",
      where: `${LINE}/sign-1`,
      expected: 40,
      got: 20,
    },
    { kind: "notClosing", where: LINE, expected: 50, got: 25 },
  ]);
  expect(errors.map(lockMessage).at(-1)).toBe(
    `nível não fecha: ${LINE}: as partes dão 25, o valor gravado é 50`,
  );
  // the sign's own count, sum in place of product: 5 + 2
  const summed = structuredClone(SIGNS);
  if (summed.children[0]) summed.children[0].combine = "sum";
  expect(
    lock(blueprint(CALL, summed), [1]).errors.map((e) => [
      e.where,
      e.expected,
      e.got,
    ]),
  ).toEqual([
    [`${LINE}/sign-0`, 10, 7],
    [LINE, 10, 7],
  ]);
  // a leaf the game never read: no value, and its levels give no number
  const unread = signsWith((kids) => {
    kids[1] = { ...kids[1], ref: { read: "TreeNeverRead" } };
  });
  expect(lock(blueprint(CALL, unread), [1]).errors).toEqual([
    { kind: "childNoValue", where: `${LINE}/sign-0/multi` },
  ]);
});
