// A common branch as a piece in the draft (spec 010, T203; spec, Open Questions 24/11): a declared list of branches
// several sources call; where the draft meets one, it writes `piece: { name, args }` in place of the subtree, and the
// piece once, from its first occurrence, its params in place of their args; an occurrence the game ran another way is
// written as the draft gives it. The invented game (fake-game.js, TreeCommon*) calls TreeCommon(1), (2) and (3).
import { format } from "prettier";
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import type { Blueprint } from "./blueprint.ts";
import { draftJson, pieceJson } from "./draft-json.ts";
import { shortKey } from "./draft-pieces.ts";
import { draftBlueprint, NO_CONTEXT } from "./draft.ts";
import type { DraftBlueprint, DraftNode } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { SYSTEMS } from "./systems.ts";

const ID = "invented-common-root";
const BRANCHES = [
  { name: "invented-common", ref: { call: "TreeCommon", args: ["{k}"] } },
];
const ROOT = {
  name: "Invented",
  ref: { call: "TreeCommonRoot", args: [0, 0, 0] },
};
const draftOf = (): DraftBlueprint => {
  const { rec, key, ops } = recorded("TreeCommonRoot");
  return draftBlueprint(ID, ROOT, key, rec, ops, {
    ...NO_CONTEXT,
    branches: BRANCHES,
  });
};
/** The line that calls TreeCommon(k) (or another block) in the draft. */
const lineOf = (
  d: DraftBlueprint,
  k: number,
  call = "TreeCommon",
): DraftNode | undefined =>
  d.pools
    .flatMap((p) => p.groups.flatMap((g) => g.sources))
    .flatMap((s) => s.children ?? [])
    .find(
      (c) =>
        c.ref && "call" in c.ref && c.ref.call === call && c.ref.args[0] === k,
    );
/** The draft of a root over TreeCommonConst(k): it reads TreeList[k] and TreeTwins[1], a constant equal to the arg 1. */
const constDraft = (block: string): DraftBlueprint => {
  const { rec, key, ops } = recorded(block);
  return draftBlueprint(
    ID,
    { name: "Invented", ref: { call: block, args: [0, 0, 0] } },
    key,
    rec,
    ops,
    {
      ...NO_CONTEXT,
      branches: [
        {
          name: "invented-const",
          ref: { call: "TreeCommonConst", args: ["{k}"] },
        },
      ],
    },
  );
};
type Raw = Record<string, unknown>;
const load = (d: unknown, piece: unknown) =>
  parseBlueprint(d, {
    fileId: ID,
    systemIds: new Set(SYSTEMS.map((s) => s.id)),
    pieces: new Map([["invented-common", piece]]),
  });
const lockOf = (blueprint: Blueprint) =>
  lockBlueprint({
    blueprint,
    ...recorded("TreeCommonRoot"),
    character: 0,
    characterClass: 3,
  });

test("a common branch is one piece, from its first occurrence; each call is a line with the piece and its args", () => {
  const d = draftOf();
  expect(lineOf(d, 1)).toMatchObject({
    piece: { name: "invented-common", args: { k: 1 } },
  });
  expect(lineOf(d, 2)).toMatchObject({
    piece: { name: "invented-common", args: { k: 2 } },
  });
  expect([lineOf(d, 1)?.children, lineOf(d, 2)?.children]).toEqual([
    undefined,
    undefined,
  ]);
  expect(d.pieces?.map((p) => [p.id, p.params])).toEqual([
    ["invented-common", ["k"]],
  ]);
  const [piece] = d.pieces ?? [];
  expect(piece?.children.map((c) => [c.ref, c.name])).toEqual([
    // the param's own read waits for its name: one name for every arg is the agent's
    [{ read: "TreeList[{k}]" }, null],
    [{ read: "TreeBase" }, null],
  ]);
  // the game ran TreeCommon(3) another way: written as the draft gives it, never as the piece
  const other = lineOf(d, 3);
  expect(other?.piece).toBeUndefined();
  expect(other?.children?.map((c) => c.ref)).toEqual([{ read: "TreeBase" }]);
  // the piece goes apart, never in the draft's own JSON
  expect(draftJson(d)).not.toContain('"pieces"');
});

test("a branch met once is no piece: its line is written whole, a constant equal to its arg stays, the reason in the guide", () => {
  const d = constDraft("TreeCommonOnceRoot");
  const line = lineOf(d, 1, "TreeCommonConst");
  expect(line?.piece).toBeUndefined();
  expect(line?.children?.map((c) => c.ref)).toEqual([
    { read: "TreeList[1]" },
    { read: "TreeTwins[1]" },
  ]);
  expect(d.pieces).toBeUndefined();
  expect(d.notes).toEqual([
    expect.stringMatching(/invented-const.*uma ocorrência só/),
  ]);
  expect(draftJson(d)).not.toContain('"notes"');
});

test("met twice with other args and one body, a branch is a piece: only the place that changes with the arg is its param", () => {
  const d = constDraft("TreeCommonTwiceRoot");
  expect([
    lineOf(d, 1, "TreeCommonConst")?.piece,
    lineOf(d, 2, "TreeCommonConst")?.piece,
  ]).toEqual([
    { name: "invented-const", args: { k: 1 } },
    { name: "invented-const", args: { k: 2 } },
  ]);
  const [piece] = d.pieces ?? [];
  expect(piece?.children.map((c) => c.ref)).toEqual([
    { read: "TreeList[{k}]" },
    { read: "TreeTwins[1]" },
  ]);
});

test("the piece's JSON is as prettier leaves it, its keys short (the gitleaks reads a long one as a secret)", async () => {
  const [piece] = draftOf().pieces ?? [];
  if (!piece) throw new Error("no piece");
  const json = pieceJson(piece);
  expect(await format(json, { parser: "json" })).toBe(json);
  const keys = [...json.matchAll(/"key": "([^"]*)"/g)].map((m) => m[1] ?? "");
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.filter((k) => k.length > 7)).toEqual([]);
});

test("a short key twice among siblings takes a letter, never a number (a number in a key reads as an argument)", () => {
  const taken = new Set<string>();
  const keys = Array.from({ length: 30 }, () =>
    shortKey(taken, 'Summoning["RibbonBonus","*",0]'),
  );
  expect(keys.slice(0, 3)).toEqual(["summoni", "summ-b", "summ-c"]);
  expect(new Set(keys).size).toBe(30);
  expect(keys.filter((k) => /\d|.{8}/.test(k))).toEqual([]);
  // the first one too: the base keeps no digit of the reference
  expect(shortKey(new Set(), "W1Stat[2]")).not.toMatch(/\d/);
});

test("the draft loads with its piece, the lock refuses it only for its pending entries; filled, the piece passes at each line", () => {
  const d = draftOf();
  const [piece] = d.pieces ?? [];
  const raw = JSON.parse(draftJson(d)) as Raw & {
    pending: { where: string; kind: string }[];
  };
  const body = JSON.parse(
    pieceJson(piece ?? { id: "", params: [], children: [] }),
  ) as Raw & {
    children: Raw[];
  };
  const out = load(raw, body);
  if (!out.ok) throw new Error(out.reason);
  expect(out.stage).toBe("draft");
  expect(new Set(lockOf(out.blueprint).errors.map((e) => e.kind))).toEqual(
    new Set(["pending"]),
  );
  // filled as the agent would: the piece's places once in its file, the recipe's own in the recipe
  for (const c of body.children) {
    c.name = "Filled";
    c.leaf = "rawBonus";
  }
  for (const p of raw.pending) {
    const at = p.where
      .split("/")
      .reduce<Raw | undefined>((o, k) => o?.[k] as Raw | undefined, raw);
    if (!at) continue;
    if (p.kind === "name") at.name = "Filled";
    else if (p.kind === "leaf") at.leaf = "rawBonus";
    else if (p.kind === "system")
      at.system = ["cards", "stamps", "alchemy"][Number(p.where.at(-1))];
  }
  const done = load({ ...raw, pending: undefined }, body);
  if (!done.ok) throw new Error(done.reason);
  expect(lockOf(done.blueprint).errors.map(lockMessage)).toEqual([]);
});
