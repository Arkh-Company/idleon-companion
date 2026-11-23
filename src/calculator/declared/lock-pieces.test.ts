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
import type { RecNode } from "../recording.ts";
import { inventedRecorder, levelContext, recorded } from "./lock-fixture.ts";
import { lockLevels } from "./lock-levels.ts";
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
    const children = pieceChildren(line, levelContext(rec, ops, LINE));
    if (!Array.isArray(children)) throw new Error("two values");
    return children.map((c) => [
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

/** An invented piece with the count and the children given, and a param it does not use. */
const pieceOf = (combine: string, children: Raw[]) => ({
  id: "invented-signs",
  params: ["stat"],
  combine,
  children,
});
const leaf = (key: string, ref: Raw, kind = "rawBonus"): Raw => ({
  key,
  name: `Invented ${key}`,
  ref,
  leaf: kind,
});
/** The lock of a line `line` that calls `piece`, over the root `root` of the invented game with `attrs`. */
const lockOver = (root: string, line: Raw, piece: unknown, attrs: object) =>
  lockBlueprint({
    blueprint: blueprint(line, piece, root),
    ...recorded(root, attrs),
    character: 0,
    characterClass: 3,
  });
/** A recorded node that only read `r`. */
const reader = (r: NonNullable<RecNode["r"]>): RecNode => ({
  id: 0,
  b: "Reader",
  a: [],
  c: [],
  p: null,
  pxi: 0,
  r,
});
const signsLine = () => {
  const line = blueprint(CALL).pools[0]?.groups[0]?.sources[0];
  if (!line) throw new Error("no line");
  return line;
};

test("a piece's leaves and items are tied by their place: below the line's call only, and two values for one path are refused with both", () => {
  // TreeMultiTwice reads TreeSignMulti as 2, then as 3
  const twice = lockOver(
    "TreeMultiTwiceRoot",
    { ref: { call: "TreeMultiTwice", args: [] } },
    pieceOf("sum", [leaf("multi", { read: "TreeSignMulti" })]),
    { TreeSignMulti: 2 },
  ).errors;
  expect(twice).toEqual([
    { kind: "childNoValue", where: `${LINE}/multi`, expected: 2, got: 3 },
  ]);
  expect(twice.map(lockMessage)).toEqual([
    `filho sem valor na gravação: ${LINE}/multi: a gravação tem 2 e 3`,
  ]);
  // TreeCapped is read by the root, outside the line's call: the sign's place has no value for it
  const outside = signsWith((kids) =>
    kids.push(leaf("capped", { read: "TreeCapped" })),
  );
  expect(lock(blueprint(CALL, outside), [1]).errors).toEqual([
    { kind: "childNoValue", where: `${LINE}/sign-0/capped` },
  ]);
  // an item of the list read with two values: the line has no children to close by
  const { rec, ops } = recorded("TreeSignsRoot", state([1]));
  const ctx = levelContext(rec, ops, LINE);
  expect(
    pieceChildren(signsLine(), ctx, [
      reader([
        ["TreeSigns[0]", 1],
        ["TreeSigns[0]", 2],
      ]),
    ]),
  ).toEqual({ two: [1, 2] });
});

test("an item recorded with a replacement pattern fills its model in as it is", () => {
  const { rec, ops } = recorded("TreeSignsRoot", state([1]));
  expect(
    pieceChildren(signsLine(), levelContext(rec, ops, LINE), [
      reader([["TreeSigns[0]", "$'"]]),
    ]),
  ).toMatchObject([
    {
      key: "sign-0",
      nameProof: { table: "InventedSigns", row: "$'" },
      ref: { call: "TreeSign", args: ["Drop", "$'"] },
    },
  ]);
});

test("a line whose call gives no number is notClosing, as any level", () => {
  const { rec, ops } = recorded("TreeSignsRoot", state([1, 2]));
  const call = rec.nodes.find((n) => n.b === "TreeSigns");
  if (!call) throw new Error("no call");
  expect(
    lockLevels(
      signsLine(),
      { ...call, v: "thirty" },
      levelContext(rec, ops, LINE),
    ).errors,
  ).toEqual([
    { kind: "notClosing", where: LINE, expected: Number.NaN, got: 30 },
  ]);
});

test("a middle level whose reference the recording lacks is childNoValue at its place", () => {
  const never = structuredClone(SIGNS);
  if (never.children[0])
    never.children[0].ref = {
      call: "TreeNeverCalled",
      args: ["{stat}", "{sign}"],
    };
  expect(lock(blueprint(CALL, never), [1]).errors).toEqual([
    { kind: "childNoValue", where: `${LINE}/sign-0` },
  ]);
});

const seraphLock = (below: Raw) =>
  lockOver(
    "TreeSeraphRoot",
    { ref: { call: "TreeSeraphLine", args: [] } },
    pieceOf("product", [
      leaf("multi", { read: "TreeSignMulti" }),
      {
        key: "seraph",
        name: "Invented Seraph",
        ref: { call: "TreeSeraph", args: [] },
        ...below,
      },
      leaf("table", { call: "TreeDeclTable", args: [] }, "fixedValue"),
    ]),
    { TreeSignMulti: 2, TreeSummonLv: 40 },
  );

test("a piece's call level with no combine closes by its own recorded count; a leaf that reads only a game table passes", () => {
  const out = seraphLock({
    children: [leaf("summoning", { read: "TreeSummonLv" }, "level")],
  });
  expect(out.errors).toEqual([]);
  // the line, the Seraph, the pool and the root closed; the multi, the summoning, the table and TreeCapped
  expect(out.counts).toEqual({
    closed: 4,
    closedByRecorded: 0,
    leaves: 4,
    branches: 2,
  });
  // the Seraph's part left out, a read it never made in its place
  expect(
    seraphLock({ children: [leaf("capped", { read: "TreeCapped" })] }).errors,
  ).toEqual([
    { kind: "childNoValue", where: `${LINE}/seraph/capped` },
    { kind: "undeclaredPart", where: `${LINE}/seraph`, got: "TreeSummonLv" },
  ]);
});

test("a piece's leaf whose call reads the save is leafHasChildren with its first child", () => {
  expect(seraphLock({ leaf: "rawBonus" }).errors).toEqual([
    { kind: "leafHasChildren", where: `${LINE}/seraph`, got: "TreeSummonLv" },
  ]);
});
