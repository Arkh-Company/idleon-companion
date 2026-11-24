// A talent source's class in the draft (spec 010, T059; moved out of draft.ts as it was): from the game's talent order
// only, never guessed.
import type { RecNode } from "../recording.ts";

/** 008 catalogo-de-arvores.md (provada): class c's tab is TalentOrder[15×(c−1)..+14]; the star talents [615..679]. */
const TAB = 15;
const STAR = 615;
export function talentClass(
  order: readonly unknown[],
  talent: number,
): number | null {
  const at = order.flatMap((t, i) =>
    (typeof t === "number" || typeof t === "string") && Number(t) === talent
      ? [i]
      : [],
  );
  const [i] = at;
  // a talent in two places, or a star talent (any class), has no class of its own: never one by the order
  return at.length === 1 && i !== undefined && i < STAR
    ? Math.floor(i / TAB) + 1
    : null;
}
/** The class of a source whose call is a talent (N.js GetTalentNumber(mode, talent)), or null. */
export function sourceClass(
  call: RecNode | undefined,
  order: readonly unknown[],
): number | null {
  const talent = call?.b === "GetTalentNumber" ? call.a[1] : undefined;
  return typeof talent === "number" ? talentClass(order, talent) : null;
}
