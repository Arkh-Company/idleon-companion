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
import { feedsIndex } from "./feeds-index.ts";
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

/** The radar over the feeds index and the real files, as pipelines.ts joins them. */
function setup(saved?: TreeShapes | string) {
  const dir = mkdtempSync(join(tmpdir(), "radar-"));
  const file = join(dir, "tree-shapes.json");
  if (typeof saved === "string") writeFileSync(file, saved);
  else if (saved) savedFiles(dir).shapes.save(saved);
  const shapes = savedFiles(dir).shapes;
  const sent: RadarUpdate[] = [];
  const radar = patchRadar({
    send: (r) => {
      sent.push(r);
    },
    warning: shapes.warning(),
  });
  const ask = vi.fn<(seq: number, id: string, mosaicJson: string) => void>();
  const index = feedsIndex({ shapes, ask, changed: vi.fn(), radar });
  index.mosaic(named(["Qwynn"]));
  return {
    radar,
    index,
    sent,
    last: () => sent.at(-1),
    /** The worker's answer to the last ask, the tree asked. */
    answer(parts: [string, string][]) {
      const [seq = 0, id = ""] = ask.mock.lastCall ?? [];
      index.received(seq, parts);
      return id;
    },
    file: (): unknown => JSON.parse(readFileSync(file, "utf8")),
  };
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

test("a new game version compares each tree's new shape with the old one and lights the band (FR-035)", () => {
  const t = setup(OLD);
  t.index.game(NEW_SHA);
  expect(t.sent).toEqual([]);
  expect(t.answer([['[0,"Sword"]', "Sword"], ['[0,"Owned"]', "Owned"], ['[0,"Shield"]', "Shield"]])).toBe(FIRST); // prettier-ignore
  expect(t.last()).toEqual({
    changed: [
      { catalogId: FIRST, added: ["Shield"], removed: [], renamed: [] },
    ],
    warning: null,
  });
  // The same shape: nothing new to say.
  expect(t.answer([['[0,"Card"]', "Card"]])).toBe(SECOND);
  expect(t.sent).toHaveLength(1);
  t.answer([['[0,"Talent"]', "Talent bonus"]]);
  expect(t.last()?.changed.map((c) => c.catalogId)).toEqual([FIRST, THIRD]);
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
  expect((file as { trees: Record<string, unknown> }).trees[FIRST]).toEqual([
    ['["Sword"]', "Sword"],
  ]);
  const text = JSON.stringify(file);
  expect(text.toLowerCase()).not.toContain("qwynn");
  expect(text).not.toContain("[0,");
  // What the band says has no character's name either.
  expect(JSON.stringify(t.sent).toLowerCase()).not.toContain("qwynn");
});

test("Close puts the band out until the next patch, and a new page gets what is shown", () => {
  const t = setup(OLD);
  t.index.game(NEW_SHA);
  t.answer([['[0,"Shield"]', "Shield"]]);
  t.radar.replay();
  expect(t.last()?.changed).toHaveLength(1);
  t.radar.dismiss();
  expect(t.last()).toBe(null);
  // More trees of the same patch: the band stays out.
  t.answer([['[0,"Card"]', "Card"], ['[0,"Ring"]', "Ring"]]); // prettier-ignore
  expect(t.last()).toBe(null);
  t.radar.replay();
  expect(t.last()).toBe(null);
  // The next patch lights it again, against the shapes of this one: new game files, then their version.
  t.index.reset();
  t.index.game(NEWER_SHA);
  t.answer([['[0,"Shield"]', "Shield"], ['[0,"Axe"]', "Axe"]]); // prettier-ignore
  expect(t.last()).toEqual({
    changed: [{ catalogId: FIRST, added: ["Axe"], removed: [], renamed: [] }],
    warning: null,
  });
});

test("an unreadable shapes file is said once on the band, which Close puts out (FR-041)", () => {
  const t = setup("{");
  t.radar.replay();
  expect(t.last()).toEqual({ changed: [], warning: SHAPES_RESET });
  t.radar.dismiss();
  t.radar.replay();
  expect(t.last()).toBe(null);
  // The app goes on: the shapes start empty and are asked again.
  t.index.game(NEW_SHA);
  expect(t.answer([['[0,"Sword"]', "Sword"]])).toBe(FIRST);
});
