// An unnamed sum inside a source whose call a check gates (audit family 14 with the deferred A15; spec 009, FR-007,
// FR-008, FR-018): the Meritocracy bonus multiplier's shape, (1 + a ÷ 100) × (a clamp + (bonuses) ÷ 100) while a read
// is 0 or less, else 0. The read the check compares is no part of the math: the steps with no name still dissolve,
// their sources rising to the call's row, their math in its ⓘ, which closes, the check said after it in words (A39).
// Over the invented game (fake-game.js TreeMeritOf), invented values; a source named with a colon, as in the game.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { kidsIn, openPath } from "./tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
/** The multiplier TreeMeritMulti, opened under TreeMeritOf: (1 + 8 ÷ 100) × (min(1, max(0.25, 1.25)) + 151 ÷ 100). */
const multi = () =>
  openPath(
    buildTree(
      recorder.record(mosaicOf(), [["TreeMeritOf", [0, 0, 0]]], {
        recompute: [],
        builders: [],
      }),
      0,
      recorder.ops,
    ),
    "TreeMeritMulti()",
  );

test("an unnamed sum beside a check's read gives its sources to the source's row: no step with no name stays", () => {
  const rows = kidsIn(multi());
  // no branch with no code and no proven name (FR-007)
  expect(
    rows.filter(
      (k) =>
        k.code === null &&
        Array.isArray(k.kids) &&
        k.kids.length > 0 &&
        !!k.flags.unnamed,
    ),
  ).toEqual([]);
  expect(rows.map((k) => k.code).filter((c) => c !== null)).toEqual([
    "ArcadeBonus(1)",
    "TreeFlagOn",
    "TreeLoop()",
    "ArcadeBonus(2)",
    "CardBonusREAL(1)",
    "TreeLevel",
    "TreeReads()",
    "TreeOwned",
  ]);
});

test("the source's ⓘ is the steps' math with the numbers of its rows, the check after it, and closes (FR-008)", () => {
  const f = multi()?.formula;
  const [names, numbers] = f && "rule" in f ? f.rule : ["", ""];
  expect(names).toMatch(/^\(1 \+ \(Base Defence ÷ 100\)\) × \(min\(/);
  expect(names).toMatch(/: yes\)$/);
  expect(numbers).toMatch(/ = 2\.711$/);
});
