// The patch radar (spec 008 US10, FR-029, FR-035, FR-041; T049): the shapes of the trees are saved per game version,
// parts and names only; a new version compares each tree's new shape with the old one and lights the band; Close puts it
// out until the next patch; an unreadable shapes file is said once, on the same band. Every key, name and hash is
// invented; a character is "Character N (class)".
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { TREE_CATALOG } from "../shared/index.ts";
import type { RadarUpdate } from "../shared/index.ts";
import { feedsIndex, SAVE_EVERY } from "./feeds-index.ts";
import { patchRadar, shapeChange } from "./radar.ts";
import { savedFiles, SHAPES_RESET } from "./saved-files.ts";
import type { TreeShapes } from "./saved-files.ts";

const OLD_SHA = "a".repeat(64);
const NEW_SHA = "b".repeat(64);
const NEWER_SHA = "c".repeat(64);
const ASKED = TREE_CATALOG.filter((n) => !n.live).map((n) => n.id);
const [FIRST = "", SECOND = "", THIRD = ""] = ASKED;
/** A mosaic with these characters' names. */
const named = (names: string[]) =>
  JSON.stringify({
    attrs: { UserInfo: [names[0]], GetPlayersUsernames: names },
  });

test("a tree's change is by piece key: parts new, parts gone and names changed, never the order", () => {
  expect(
    shapeChange(
      "hp",
      [
        ['["Sword"]', "Sword"],
        ['["Owned"]', "Owned"],
        ['["Card"]', "Card"],
      ],
      [
        ['["Owned"]', "Owned"],
        ['["Shield"]', "Shield"],
        ['["Card"]', "Card bonus"],
      ],
    ),
  ).toEqual({
    catalogId: "hp",
    added: ["Shield"],
    removed: ["Sword"],
    renamed: [["Card", "Card bonus"]],
  });
  expect(
    shapeChange(
      "hp",
      [
        ['["Sword"]', "Sword"],
        ['["Owned"]', "Owned"],
      ],
      [
        ['["Owned"]', "Owned"],
        ['["Sword"]', "Sword"],
      ],
    ),
  ).toBe(null);
});
/** The radar over the feeds index and the real files, as pipelines.ts joins them; the same `dir` again is a restart. */
function setup(
  saved?: TreeShapes | string,
  dir = mkdtempSync(join(tmpdir(), "radar-")),
) {
  const file = join(dir, "tree-shapes.json");
  if (typeof saved === "string") writeFileSync(file, saved);
  else if (saved) savedFiles(dir).shapes.save(saved);
  const shapes = savedFiles(dir).shapes;
  const sent: RadarUpdate[] = [];
  const radar = patchRadar({
    send: (r) => {
      sent.push(r);
    },
    shapes,
  });
  const ask = vi.fn<(seq: number, id: string, mosaicJson: string) => void>();
  const index = feedsIndex({ shapes, ask, changed: vi.fn(), radar });
  index.mosaic(named(["Qwynn"]));
  return {
    dir,
    radar,
    index,
    sent,
    last: () => sent.at(-1),
    /** The worker's answer to the last ask, the tree asked. */
    answer(parts: [string, string][] | null) {
      const [seq = 0, id = ""] = ask.mock.lastCall ?? [];
      index.received(seq, parts);
      return id;
    },
    file: (): Record<string, unknown> =>
      JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>,
  };
}
/** The app started again over the same files, on the same game version. */
function restart(dir: string) {
  const t = setup(undefined, dir);
  t.index.game(NEW_SHA);
  return t;
}

const OLD: TreeShapes = {
  gameSha: OLD_SHA,
  trees: new Map([
    [
      FIRST,
      [
        ['["Sword"]', "Sword"],
        ['["Owned"]', "Owned"],
      ],
    ],
    [SECOND, [['["Card"]', "Card"]]],
    [THIRD, [['["Talent"]', "Talent"]]],
  ]),
};
const SHIELD = {
  catalogId: FIRST,
  added: ["Shield"],
  removed: [],
  renamed: [],
};
const WITH_SHIELD: [string, string][] = [
  ['[0,"Sword"]', "Sword"],
  ['[0,"Owned"]', "Owned"],
  ['[0,"Shield"]', "Shield"],
];

test("a new game version compares each tree's new shape with the old one and lights the band, still checking until the last old tree (FR-035)", () => {
  const t = setup(OLD);
  t.index.game(NEW_SHA);
  expect(t.sent).toEqual([]);
  expect(t.answer(WITH_SHIELD)).toBe(FIRST);
  expect(t.last()).toEqual({
    changed: [SHIELD],
    checking: true,
    warning: null,
  });
  // The same shape: nothing new to say.
  expect(t.answer([['[0,"Card"]', "Card"]])).toBe(SECOND);
  expect(t.sent).toHaveLength(1);
  // The last old tree: the count is final.
  t.answer([['[0,"Talent"]', "Talent bonus"]]);
  expect(t.last()).toEqual({
    changed: [
      SHIELD,
      {
        catalogId: THIRD,
        added: [],
        removed: [],
        renamed: [["Talent", "Talent bonus"]],
      },
    ],
    checking: false,
    warning: null,
  });
});

test("an old tree that cannot be compared stops the checking when the asks end", () => {
  const t = setup(OLD);
  t.index.game(NEW_SHA);
  t.answer(WITH_SHIELD);
  t.answer(null); // SECOND fails and is skipped
  for (let i = 2; i < ASKED.length; i++) t.answer([['[0,"Talent"]', "Talent"]]);
  expect(t.last()).toEqual({
    changed: [SHIELD],
    checking: false,
    warning: null,
  });
});

test("the same game version, or no shape saved before, lights nothing", () => {
  const same = setup(OLD);
  same.index.game(OLD_SHA);
  same.answer([['[0,"Shield"]', "Shield"]]);
  expect(same.sent).toEqual([]);

  const first = setup();
  first.index.game(NEW_SHA);
  first.answer([['[0,"Shield"]', "Shield"]]);
  expect(first.sent).toEqual([]);
  first.radar.replay();
  expect(first.last()).toBe(null);
});

test("the shapes file of the new version keeps parts and names only: no value, no character, no character's name (FR-029)", () => {
  const t = setup(OLD);
  t.index.game(NEW_SHA);
  t.answer([
    ['[0,"Sword"]', "Sword"],
    ['[0,"Bonus","qwynn"]', "Bonus"],
    ['[0,"Shield"]', "Qwynn's shield"],
  ]);
  for (let i = 1; i < ASKED.length; i++) t.answer([]);
  const file = t.file();
  expect(file).toMatchObject({ version: 1, gameSha: NEW_SHA });
  expect((file.trees as Record<string, unknown>)[FIRST]).toEqual([
    ['["Sword"]', "Sword"],
  ]);
  const text = JSON.stringify(file);
  expect(text.toLowerCase()).not.toContain("qwynn");
  expect(text).not.toContain("[0,");
  // What the band says has no character's name either.
  expect(JSON.stringify(t.sent).toLowerCase()).not.toContain("qwynn");
});

test("Close puts the band out; a new change of the same patch lights it again, and a new page gets what is shown", () => {
  const t = setup(OLD);
  t.index.game(NEW_SHA);
  t.answer(WITH_SHIELD);
  t.radar.replay();
  expect(t.last()?.changed).toEqual([SHIELD]);
  t.radar.dismiss();
  expect(t.last()).toBe(null);
  t.radar.replay();
  expect(t.last()).toBe(null);
  // The same shape: still out.
  t.answer([['[0,"Card"]', "Card"]]);
  expect(t.last()).toBe(null);
  // A new change of the same patch: the band comes back with every change.
  t.answer([
    ['[0,"Talent"]', "Talent"],
    ['[0,"Ring"]', "Ring"],
  ]);
  expect(t.last()?.changed.map((c) => c.catalogId)).toEqual([FIRST, THIRD]);
  // The next patch starts over, against the shapes of this one: new game files, then their version.
  t.radar.dismiss();
  t.index.reset();
  t.index.game(NEWER_SHA);
  t.answer([...WITH_SHIELD, ['[0,"Axe"]', "Axe"]]);
  expect(t.last()).toEqual({
    changed: [{ catalogId: FIRST, added: ["Axe"], removed: [], renamed: [] }],
    checking: true,
    warning: null,
  });
});

/** Old shapes of more trees than one write of the index: a restart comes between writes. */
const MANY: TreeShapes = {
  gameSha: OLD_SHA,
  trees: new Map(
    ASKED.slice(0, SAVE_EVERY + 3).map((id) => [id, [['["Card"]', "Card"]]]),
  ),
};
const CARD: [string, string][] = [['[0,"Card"]', "Card"]];
const RING: [string, string][] = [...CARD, ['[0,"Ring"]', "Ring"]];
const ringOf = (catalogId: string) => ({
  catalogId,
  added: ["Ring"],
  removed: [],
  renamed: [],
});

test("a restart in the middle of the asks goes on comparing the old trees not compared yet (FR-029)", () => {
  const t = setup(MANY);
  t.index.game(NEW_SHA);
  t.answer(RING);
  for (let i = 1; i < SAVE_EVERY; i++) t.answer(CARD);
  // Written: the new version's first trees, and the old trees not compared yet.
  expect(t.file()).toMatchObject({ gameSha: NEW_SHA, dismissed: 0 });
  expect(Object.keys(t.file().previous as object)).toEqual([
    "gameSha",
    "trees",
  ]);
  expect(
    Object.keys((t.file().previous as { trees: object }).trees),
  ).toHaveLength(3);
  t.answer(RING); // asked after the write: compared again after the restart

  const again = restart(t.dir);
  again.radar.replay();
  expect(again.last()).toEqual({
    changed: [ringOf(FIRST)],
    checking: true,
    warning: null,
  });
  expect(again.answer(RING)).toBe(ASKED[SAVE_EVERY]);
  again.answer(CARD);
  again.answer(CARD);
  expect(again.last()).toEqual({
    changed: [ringOf(FIRST), ringOf(ASKED[SAVE_EVERY] ?? "")],
    checking: false,
    warning: null,
  });
});

test("a restart with the band open shows it; after Close, it does not, and the file keeps no patch once all is compared", () => {
  const t = setup(OLD);
  t.index.game(NEW_SHA);
  t.answer(WITH_SHIELD);
  t.radar.dismiss(); // the file is written at Close
  expect(t.file()).toMatchObject({ changed: [SHIELD], dismissed: 1 });

  const closed = restart(t.dir);
  closed.radar.replay();
  expect(closed.last()).toBe(null);

  // Open again by a new change, then a restart: the band is back.
  closed.answer([
    ['[0,"Card"]', "Card"],
    ['[0,"Ring"]', "Ring"],
  ]);
  for (let i = 2; i < ASKED.length; i++) closed.answer([]);
  const open = restart(t.dir);
  open.radar.replay();
  expect(open.last()?.changed).toHaveLength(3);
  expect(open.last()?.checking).toBe(false);

  // Closed with everything compared: the patch leaves the file.
  open.radar.dismiss();
  const file = open.file();
  expect(file.gameSha).toBe(NEW_SHA);
  expect(file).not.toHaveProperty("previous");
  expect(file).not.toHaveProperty("changed");
  expect(file).not.toHaveProperty("dismissed");
  const last = restart(t.dir);
  last.radar.replay();
  expect(last.last()).toBe(null);
});

test("an unreadable shapes file is said once on the band, which Close puts out (FR-041)", () => {
  const t = setup("{");
  t.radar.replay();
  expect(t.last()).toEqual({
    changed: [],
    checking: false,
    warning: SHAPES_RESET,
  });
  t.radar.dismiss();
  t.radar.replay();
  expect(t.last()).toBe(null);
  // The app goes on: the shapes start empty and are asked again.
  t.index.game(NEW_SHA);
  expect(t.answer([['[0,"Sword"]', "Sword"]])).toBe(FIRST);
});
