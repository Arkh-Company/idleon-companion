// Where this goes (spec 008 US8, FR-027; T045): a piece that 2 or more catalog numbers use shows how many, and the
// list of them opens each tree. The index is built from the saved tree shapes and asked in the background, one tree
// at a time, never per second. Every key, name and hash is invented; a character is "Character N (class)".
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { isCatalogId, TREE_CATALOG } from "../shared/index.ts";
import type { TreeNode } from "../shared/index.ts";
import { feedKey, feedsIndex, SAVE_EVERY, withFeeds } from "./feeds-index.ts";
import { savedFiles } from "./saved-files.ts";
import type { TreeShapes } from "./saved-files.ts";

const SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);
const MOSAIC = '{"invented":1}';
/** Live trees need a map actor (FR-023): they are never asked. */
const ASKED = TREE_CATALOG.filter((n) => !n.live).map((n) => n.id);
const [FIRST = "", SECOND = "", THIRD = ""] = ASKED;

const part = (key: string): [string, string] => [key, "Game value"];

function setup(saved?: TreeShapes) {
  const dir = mkdtempSync(join(tmpdir(), "feeds-"));
  const files = savedFiles(dir);
  if (saved) files.shapes.save(saved);
  const shapes = savedFiles(dir).shapes;
  const ask = vi.fn<(seq: number, id: string, mosaicJson: string) => void>();
  const changed = vi.fn();
  const index = feedsIndex({ shapes, ask, changed });
  /** The id and seq of the last ask. */
  const asked = () => {
    const [seq = 0, id = ""] = ask.mock.lastCall ?? [];
    return { seq, id };
  };
  /** Answers the last ask with these parts. */
  const answer = (parts: unknown) => {
    index.received(asked().seq, parts);
  };
  const file = (): unknown =>
    JSON.parse(readFileSync(join(dir, "tree-shapes.json"), "utf8"));
  return { index, ask, changed, asked, answer, file, dir };
}

/** The index running over the invented game, the game's version known. */
function running(saved?: TreeShapes) {
  const t = setup(saved);
  t.index.mosaic(MOSAIC, []);
  t.index.game(SHA);
  return t;
}

test("a piece key without the character is the same part in any character's tree", () => {
  expect(feedKey('[0,"Sword",3]')).toBe('["Sword",3]');
  expect(feedKey('[2,"Sword",3]')).toBe('["Sword",3]');
  expect(feedKey("not json")).toBe("not json");
});

test("the index counts the piece keys across the shapes of the catalog trees (FR-027)", () => {
  const { index } = setup({
    gameSha: SHA,
    trees: new Map([
      [FIRST, [part('["Sword"]'), part('["Owned"]')]],
      [SECOND, [part('["Sword"]')]],
      [THIRD, [part('["Sword"]')]],
    ]),
  });
  expect(index.count('[0,"Sword"]')).toBe(3);
  expect(index.count('[1,"Owned"]')).toBe(1);
  expect(index.count('[0,"Nowhere"]')).toBe(0);
});

test("the list of a piece gives each number it feeds, in the catalog's order, each one a tree to open", () => {
  const { index } = setup({
    gameSha: SHA,
    trees: new Map([
      [THIRD, [part('["Sword"]')]],
      [FIRST, [part('["Sword"]')]],
    ]),
  });
  const list = index.list('[0,"Sword"]');
  expect(list).toEqual([FIRST, THIRD]);
  expect(list.every(isCatalogId)).toBe(true);
  expect(index.list('[0,"Nowhere"]')).toEqual([]);
});

const node = (fields: Partial<TreeNode>): TreeNode =>
  ({
    id: "root",
    pieceKey: null,
    name: "Total",
    kids: [],
    ...fields,
  }) as TreeNode;

test("only a piece of 2 or more numbers gets feeds; one of 1 gets nothing, and a stale count goes", () => {
  const root = node({
    pieceKey: '[0,"Total"]',
    kids: [
      node({ id: "root/a", pieceKey: '[0,"Sword"]' }),
      node({ id: "root/b", pieceKey: '[0,"Owned"]', feeds: 4 }),
      node({ id: "root/c", kids: "lazy" }),
    ],
  });
  const counts: Record<string, number> = { '["Sword"]': 3, '["Owned"]': 1 };
  const fed = withFeeds(root, (key) => counts[feedKey(key)] ?? 0);
  expect(fed.feeds).toBeUndefined();
  const kids = Array.isArray(fed.kids) ? fed.kids : [];
  expect(kids.map((k) => k.feeds)).toEqual([3, undefined, undefined]);
  expect(kids[2]?.kids).toBe("lazy");
  expect(root.kids).not.toBe(fed.kids); // the tree given is not changed
});

test("a tree whose counts did not change comes back as it was", () => {
  const root = node({
    kids: [node({ id: "root/a", pieceKey: "k", feeds: 2 })],
  });
  expect(withFeeds(root, () => 2)).toBe(root);
});

test("the shapes are asked one tree at a time, in the catalog's order, only once the version and a reading are known", () => {
  const t = setup();
  t.index.game(SHA);
  expect(t.ask).not.toHaveBeenCalled();
  t.index.mosaic(MOSAIC, []);
  expect(t.ask).toHaveBeenCalledOnce();
  expect(t.asked().id).toBe(FIRST);
  t.index.mosaic('{"invented":2}', []);
  expect(t.ask).toHaveBeenCalledOnce();
  t.answer([part('[0,"Sword"]')]);
  expect(t.asked().id).toBe(SECOND);
  expect(t.ask).toHaveBeenLastCalledWith(2, SECOND, '{"invented":2}');
});

test("a saved tree of the same version is not asked again", () => {
  const t = running({
    gameSha: SHA,
    trees: new Map([[FIRST, [part('["Sword"]')]]]),
  });
  expect(t.asked().id).toBe(SECOND);
});

test("another game version starts over, and its shapes replace the old ones", () => {
  const t = running({
    gameSha: OTHER_SHA,
    trees: new Map([[FIRST, [part('["Sword"]')]]]),
  });
  expect(t.index.count('[0,"Sword"]')).toBe(0);
  expect(t.changed).toHaveBeenCalled();
  expect(t.asked().id).toBe(FIRST);
});

test("the file is written every few trees and at the end, never at each tree, and the open tree's badges follow it", () => {
  const t = running();
  for (let i = 0; i < SAVE_EVERY - 1; i++) t.answer([part('[0,"Sword"]')]);
  expect(() => t.file()).toThrow();
  expect(t.changed).not.toHaveBeenCalled();
  t.answer([part('[0,"Sword"]')]);
  expect(t.file()).toMatchObject({ version: 1, gameSha: SHA });
  expect(t.changed).toHaveBeenCalledOnce();
  expect(t.index.count('[3,"Sword"]')).toBe(SAVE_EVERY);
});

test("the file keeps the parts without the character and never a character's name (FR-010a)", () => {
  const t = setup();
  // Two invented names, one a prefix of the other.
  t.index.mosaic(MOSAIC, ["Qwynn", "Qwyn"]);
  t.index.game(SHA);
  t.answer([
    part('[0,"Sword"]'),
    part('[0,"Bonus","qwynn"]'),
    ['[0,"Shield"]', "Qwyn's shield"],
  ]);
  for (let i = 1; i < SAVE_EVERY; i++) t.answer([]);
  const saved = JSON.stringify(t.file());
  expect(saved).toContain('[\\"Sword\\"]');
  expect(saved.toLowerCase()).not.toContain("qwyn");
  expect(saved).not.toContain("[0,");
});

test.each([
  ["no list", { parts: 1 }],
  ["a part that is no pair", [["k"]]],
  ["a part with a value", [["k", 3]]],
  ["a key too long", [part("k".repeat(2_001))]],
])(
  "a shape with %s is a failure: the tree is skipped and the next one asked",
  (_name, raw) => {
    const t = running();
    t.answer(raw);
    expect(t.asked().id).toBe(SECOND);
    expect(t.index.count("k")).toBe(0);
  },
);

test("after 3 failures the index stops asking until new game files", () => {
  const t = running();
  for (let i = 0; i < 3; i++) t.answer(null);
  expect(t.ask).toHaveBeenCalledTimes(3);
  t.index.reset();
  t.index.game(SHA);
  expect(t.ask).toHaveBeenCalledTimes(4);
  expect(t.asked().id).toBe(FIRST);
});

test("only failures in a row stop the asks", () => {
  const t = running();
  t.answer(null);
  t.answer(null);
  t.answer([part('[0,"Sword"]')]);
  t.answer(null);
  t.answer(null);
  expect(t.ask).toHaveBeenCalledTimes(6);
});

test("the last tree writes the file, however few came since the last write", () => {
  const last = ASKED.at(-1) ?? "";
  const t = running({
    gameSha: SHA,
    trees: new Map(ASKED.slice(0, -1).map((id) => [id, [part('["Sword"]')]])),
  });
  expect(t.asked().id).toBe(last);
  t.answer([part('[0,"Owned"]')]);
  expect(t.file()).toMatchObject({ trees: { [last]: [part('["Owned"]')] } });
  expect(t.ask).toHaveBeenCalledOnce();
});

test("an answer that is not the last ask's is ignored", () => {
  const t = running();
  t.index.received(99, [part('[0,"Sword"]')]);
  expect(t.ask).toHaveBeenCalledOnce();
});

test("the game closed pauses the asks; open again, the tree in flight is asked again", () => {
  const t = running();
  t.index.pause(true);
  t.answer([part('[0,"Sword"]')]); // the host ended the worker: no answer counts
  expect(t.ask).toHaveBeenCalledOnce();
  t.index.pause(false);
  expect(t.ask).toHaveBeenCalledTimes(2);
  expect(t.asked().id).toBe(FIRST);
});

test("no reading or no character stops the asks", () => {
  const t = running();
  t.index.mosaic(null, []);
  t.answer([part('[0,"Sword"]')]);
  expect(t.ask).toHaveBeenCalledOnce();
});
