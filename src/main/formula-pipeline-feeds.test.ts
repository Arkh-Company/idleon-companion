// Where this goes in the formula pipeline (spec 008 US8, FR-027): the trees and branches the window gets carry `feeds`
// from the index, the shapes are asked of the tree host in the background, and the open tree follows a new count. The
// tree host is a fake; every key, name and hash is invented.
import { expect, test } from "vitest";
import { TREE_CATALOG } from "../shared/index.ts";
import type { FormulaTree, TreeNode } from "../shared/index.ts";
import { SAVE_EVERY } from "./feeds-index.ts";
import { node, pairOf, pipeline, shapesOf } from "./formula-fixture.ts";
import { CALCULATED } from "./stats-pipeline-fixture.ts";

const SHA = "a".repeat(64);
const ASKED = TREE_CATALOG.filter((n) => !n.live).map((n) => n.id);
const part = (key: string): [string, string] => [key, "Game value"];
const sword = node({
  id: "root/Sword",
  pieceKey: '[0,"Sword"]',
  role: "piece",
});
const lazy = node({ id: "root/Part", pieceKey: '[0,"Part"]', kids: "lazy" });

const rootOf = (t: FormulaTree | undefined) =>
  t?.state === "ready" ? t.root : null;
const kidsOf = (n: TreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];

/** The Drop Rate open, its kids a Sword and a lazy part; the saved shapes give the Sword to `hp` and `str`. */
function open(
  trees = new Map([
    ["hp", [part('["Sword"]'), part('["Inside"]')]],
    ["str", [part('["Sword"]'), part('["Inside"]')]],
  ]),
) {
  const h = pipeline(pairOf(), true, shapesOf({ gameSha: SHA, trees }));
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: CALCULATED.dropRate, kids: [sword, lazy] }));
  return h;
}

test("a part of 2 or more numbers carries how many; a part of 1 or none carries nothing", () => {
  const h = open();
  const [s, l] = kidsOf(rootOf(h.last()));
  expect(s?.feeds).toBe(2);
  expect(l?.feeds).toBeUndefined();
  expect(rootOf(h.last())?.feeds).toBeUndefined();
});

test("an opened branch carries the counts too", () => {
  const h = open();
  h.p.request({ treeId: "dropRate", nodeId: "root/Part" });
  h.tree({
    ...lazy,
    kids: [node({ id: "root/Part/In", pieceKey: '[0,"Inside"]' })],
  });
  const [, branch] = kidsOf(rootOf(h.last()));
  expect(kidsOf(branch)[0]?.feeds).toBe(2);
});

test("feeds lists the numbers of a piece, each one a tree to open", () => {
  const h = open();
  expect(h.p.feeds('[0,"Sword"]')).toEqual(
    ASKED.filter((id) => id === "hp" || id === "str"),
  );
  expect(h.p.feeds('[0,"Nowhere"]')).toEqual([]);
});

test("once the game's code is read, the shapes missing are asked of the host over the Stats' mosaic", () => {
  const h = open();
  expect(h.host.shape).not.toHaveBeenCalled();
  h.p.gameRead(SHA);
  const [, id, mosaic] = h.host.shape.mock.lastCall ?? [];
  expect(id).toBe(ASKED.find((n) => n !== "hp" && n !== "str"));
  expect(mosaic).toBe(pairOf().mosaicJson);
});

test("the open tree follows the index when it is written: its badges change with no new request", () => {
  const h = open(new Map());
  h.p.gameRead(SHA);
  const requests = h.host.request.mock.calls.length;
  for (let i = 0; i < SAVE_EVERY; i++) h.shape([part('[1,"Sword"]')]);
  expect(kidsOf(rootOf(h.last()))[0]?.feeds).toBe(SAVE_EVERY);
  expect(h.host.request.mock.calls.length).toBe(requests);
});

test("the game closed stops the asks; open again, they go on", () => {
  const h = open(new Map());
  h.p.gameRead(SHA);
  h.p.status({ game: "closed", reader: "connecting" });
  h.shape([part('[0,"Sword"]')]);
  expect(h.host.shape).toHaveBeenCalledOnce();
  h.p.status({ game: "running", reader: "attached" });
  expect(h.host.shape).toHaveBeenCalledTimes(2);
});

test("new game files wait for the code to be read again before asking", () => {
  const h = open(new Map());
  h.p.gameRead(SHA);
  h.p.gameFiles("C:\\invented\\resources");
  h.shape([part('[0,"Sword"]')]);
  expect(h.host.shape).toHaveBeenCalledOnce();
  h.p.gameRead(SHA);
  expect(h.host.shape).toHaveBeenCalledTimes(2);
});

test("no reading stops the asks", () => {
  const h = open(new Map());
  h.p.gameRead(SHA);
  h.setPair(null);
  h.shape([part('[0,"Sword"]')]);
  expect(h.host.shape).toHaveBeenCalledOnce();
});
