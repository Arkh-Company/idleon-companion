// A common branch shared between recipes (spec 010, part R; spec, Open Questions 24/11: nothing written twice): the
// first draft that meets a branch with no param writes its piece; a later draft whose occurrence has the body of the
// piece already written (in `blueprints/pieces/`, or by an earlier draft of the run) calls it and writes none, by the
// piece's own places; another body is written whole, with why in the guide. The invented game (fake-game.js,
// TreeShared*) calls TreeShared() once under each of two roots; TreeCommonConst(k) once and twice (TreeCommon*Root).
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import type { CommonBranch } from "./draft-pieces.ts";
import { draftJson, pieceJson } from "./draft-json.ts";
import { knownUse } from "./draft-known-pieces.ts";
import type { KnownPieces } from "./draft-known-pieces.ts";
import { draftBlueprint, NO_CONTEXT } from "./draft.ts";
import type { DraftBlueprint, DraftNode } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { SYSTEMS } from "./systems.ts";

const SHARED: readonly CommonBranch[] = [
  { name: "invented-shared", ref: { call: "TreeShared", args: [] } },
];
const CONST = [
  {
    name: "invented-const",
    ref: { call: "TreeCommonConst", args: ["{k}"] },
  },
];
type Raw = Record<string, unknown>;
const draftOf = (
  block: string,
  branches: readonly CommonBranch[] = SHARED,
  pieces?: KnownPieces,
): DraftBlueprint => {
  const { rec, key, ops } = recorded(block);
  return draftBlueprint(
    "invented-shared-root",
    { name: "Invented", ref: { call: block, args: [0, 0, 0] } },
    key,
    rec,
    ops,
    { ...NO_CONTEXT, branches, ...(pieces && { pieces }) },
  );
};
/** The lines below the sources that call `call`. */
const linesOf = (d: DraftBlueprint, call: string): DraftNode[] =>
  d.pools
    .flatMap((p) => p.groups.flatMap((g) => g.sources))
    .flatMap((s) => s.children ?? [])
    .filter((c) => c.ref && "call" in c.ref && c.ref.call === call);
/** A piece as its file has it, from a draft's pieces. */
const written = (d: DraftBlueprint): Map<string, Raw> =>
  new Map((d.pieces ?? []).map((p) => [p.id, JSON.parse(pieceJson(p)) as Raw]));

test("the first draft that meets a branch with no param, once, writes its piece and its line calls it", () => {
  const d = draftOf("TreeSharedRootA");
  expect(linesOf(d, "TreeShared").map((l) => [l.piece, l.children])).toEqual([
    [{ name: "invented-shared", args: {} }, undefined],
  ]);
  expect(d.pieces?.map((p) => [p.id, p.children.map((c) => c.ref)])).toEqual([
    ["invented-shared", [{ read: "TreeBase" }, { read: "TreeLevel" }]],
  ]);
  expect(d.notes ?? []).toEqual([]);
});

test("another recipe whose branch has the body of the piece already written calls it and writes none", () => {
  const known = written(draftOf("TreeSharedRootA"));
  const d = draftOf("TreeSharedRootB", SHARED, known);
  expect(linesOf(d, "TreeShared").map((l) => [l.piece, l.children])).toEqual([
    [{ name: "invented-shared", args: {} }, undefined],
  ]);
  expect(d.pieces).toBeUndefined();
  expect(d.notes ?? []).toEqual([]);
});

test("the line keeps the pending places the piece still has open; filled in its file, none, and the recipe passes the lock", () => {
  const piece = written(draftOf("TreeSharedRootA")).get("invented-shared");
  if (!piece) throw new Error("no piece");
  const open = draftOf(
    "TreeSharedRootB",
    SHARED,
    new Map([["invented-shared", piece]]),
  );
  // the places below the line, in the piece's body
  const under = (d: DraftBlueprint) =>
    d.pending.filter((p) => /\/children\/\d+\/children\//.test(p.where));
  expect(under(open).map((p) => p.kind)).toEqual([
    "name",
    "leaf",
    "name",
    "leaf",
  ]);
  // filled once, in the piece's file: the recipe keeps none of them
  const children = piece.children as Raw[];
  const filled = {
    ...piece,
    children: children.map((c) => ({ ...c, name: "Filled", leaf: "rawBonus" })),
  };
  const known = new Map([["invented-shared", filled]]);
  const d = draftOf("TreeSharedRootB", SHARED, known);
  expect(under(d)).toEqual([]);
  const raw = JSON.parse(draftJson(d)) as Raw & {
    pending: { where: string; kind: string }[];
  };
  for (const p of raw.pending) {
    const node = p.where
      .split("/")
      .reduce<Raw | undefined>((o, k) => o?.[k] as Raw | undefined, raw);
    if (!node) continue;
    if (p.kind === "name") node.name = "Filled";
    else if (p.kind === "leaf") node.leaf = "rawBonus";
    else if (p.kind === "system")
      node.system = ["cards", "stamps", "alchemy"][Number(p.where.at(-1))];
  }
  const out = parseBlueprint(
    { ...raw, pending: undefined },
    {
      fileId: "invented-shared-root",
      systemIds: new Set(SYSTEMS.map((s) => s.id)),
      pieces: known,
    },
  );
  if (!out.ok) throw new Error(out.reason);
  const lock = lockBlueprint({
    blueprint: out.blueprint,
    ...recorded("TreeSharedRootB"),
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors.map(lockMessage)).toEqual([]);
});

test("a body other than the piece already written is written whole, the reason in the guide", () => {
  const other = {
    id: "invented-shared",
    params: [],
    children: [{ key: "base", name: null, ref: { read: "TreeBase" } }],
  };
  const d = draftOf(
    "TreeSharedRootB",
    SHARED,
    new Map([["invented-shared", other]]),
  );
  const [line] = linesOf(d, "TreeShared");
  expect(line?.piece).toBeUndefined();
  expect(line?.children?.map((c) => c.ref)).toEqual([
    { read: "TreeBase" },
    { read: "TreeLevel" },
  ]);
  expect(d.pieces).toBeUndefined();
  expect(d.notes).toEqual([
    expect.stringMatching(
      /invented-shared.*o corpo difere do pedaço já escrito/,
    ),
  ]);
});

test("a piece with a param the branch does not take, or with no children, is another body", () => {
  const piece = written(draftOf("TreeSharedRootA")).get("invented-shared");
  if (!piece) throw new Error("no piece");
  for (const other of [
    { ...piece, params: ["x"] },
    { ...piece, children: undefined },
  ]) {
    const d = draftOf(
      "TreeSharedRootB",
      SHARED,
      new Map([["invented-shared", other]]),
    );
    expect(linesOf(d, "TreeShared").map((l) => l.piece)).toEqual([undefined]);
    expect(d.notes).toEqual([expect.stringMatching(/o corpo difere/)]);
  }
});

test("a place the piece's own pending holds is never pending below the line (T216)", () => {
  const piece = written(draftOf("TreeSharedRootA")).get("invented-shared");
  if (!piece) throw new Error("no piece");
  const pending = ["children/0", "children/1"].flatMap((where) => [
    { where, kind: "name" },
    { where, kind: "leaf" },
  ]);
  const d = draftOf(
    "TreeSharedRootB",
    SHARED,
    new Map([["invented-shared", { ...piece, pending }]]),
  );
  expect(linesOf(d, "TreeShared").map((l) => l.piece)).toEqual([
    { name: "invented-shared", args: {} },
  ]);
  expect(
    d.pending.filter((p) => /\/children\/\d+\/children\//.test(p.where)),
  ).toEqual([]);
});

test("a place the occurrence leaves pending `descend` with no children calls the piece whose file descended it", () => {
  const leaf = { call: "TreeDeep", args: [0] };
  const piece = {
    id: "invented-shared",
    params: [],
    children: [
      {
        key: "deep",
        name: "Deep",
        ref: leaf,
        children: [{ key: "base", name: "Base", ref: { read: "TreeBase" } }],
      },
    ],
  };
  const use = knownUse(piece, {
    where: "/pools/0/groups/0/sources/0/children/0",
    branch: { name: "invented-shared", params: [], args: {} },
    children: [{ key: "deep", name: null, ref: leaf }],
    pending: [{ where: "/children/0", kind: "descend" }],
  });
  expect(use).toEqual({
    piece: { name: "invented-shared", args: {} },
    pending: [],
  });
});

test("a branch with a param met once calls the piece already written where its places hold the arg; never by value", () => {
  // the piece of TreeCommonConst from a draft that met it twice: TreeList[{k}], and TreeTwins[1] that stays written
  const known = written(draftOf("TreeCommonTwiceRoot", CONST));
  const d = draftOf("TreeCommonOnceRoot", CONST, known);
  expect(linesOf(d, "TreeCommonConst").map((l) => l.piece)).toEqual([
    { name: "invented-const", args: { k: 1 } },
  ]);
  expect(d.pieces).toBeUndefined();
  // with no piece written, a branch with a param met once is still written whole (T203 r1)
  const alone = draftOf("TreeCommonOnceRoot", CONST);
  expect(linesOf(alone, "TreeCommonConst").map((l) => l.piece)).toEqual([
    undefined,
  ]);
});
