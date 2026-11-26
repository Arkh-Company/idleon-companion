// What the check mode's tests share (spec 010, T033, T040): the invented snapshot with a class per character, the
// recorder over the roots it is given, booted once per file, and the two classes' runs.
import { CHARACTERS, GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { bootRecorder } from "../tree-record.ts";
import type { RecordFn } from "./real-trees-check.ts";

/** The invented snapshot: the first character of class 3 and active, the second of class 7. */
export function snapshot(classes: readonly number[]) {
  const snap = JSON.parse(mosaicOf({ CharacterClass: classes[0] })) as {
    attrs: { PlayerDATABASE: { $m: Record<string, { $m: object }> } };
  };
  CHARACTERS.forEach((name, i) => {
    const saved = snap.attrs.PlayerDATABASE.$m[name];
    if (saved) saved.$m = { ...saved.$m, CharacterClass: classes[i] };
  });
  return snap;
}

/** Both classes, the class-7 character with no point in class 3's talent: TreeDeclTalent(0) gives it 0, as the game. */
export function twoClasses() {
  const snap = snapshot([3, 7]);
  const second = snap.attrs.PlayerDATABASE.$m[CHARACTERS[1]];
  if (second) second.$m = { ...second.$m, SkillLevels: [0, 8] };
  return snap;
}

let recorder: ReturnType<typeof bootRecorder> | null = null;
/** The invented game's recorder, booted once per file. */
export const checkRecorder = () =>
  (recorder ??= bootRecorder(
    GAME,
    PAK,
    { startMs: 5_000, numberMs: 500 },
    { infinite: true },
  ));

/** The recorder over the roots it is given. */
export const recordRoots: RecordFn = (mosaic, scene, roots, routine) =>
  checkRecorder().record(
    mosaic,
    roots,
    { recompute: [], builders: [] },
    scene,
    [],
    routine,
  );

export const BOTH = [
  { character: 0, characterClass: 3 },
  { character: 1, characterClass: 7 },
];
