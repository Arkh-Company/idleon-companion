// A talent source's class in the draft (spec 010, T059; moved out of draft.ts as it was): from the game's talent order
// only, never guessed.
import type { Context } from "../boot.ts";
import { askNames } from "../game-names.ts";
import { isObj } from "./blueprint-root.ts";
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

/**
 * A tab's classes (T207): each class whose tabs hold it, by the game's ReturnClasses (class → the classes whose tabs it
 * holds, read in the recorder's context); with none read, the tab's class only.
 */
export function classesOf(
  tab: number,
  families: ReadonlyMap<number, readonly number[]> = new Map(),
): number[] {
  const all = [...families].flatMap(([c, tabs]) =>
    tabs.includes(tab) ? [c] : [],
  );
  return all.length > 0 ? all.sort((a, b) => a - b) : [tab];
}

/** The game's ReturnClasses of each class of the talent order's tabs (T207), read in the recorder's context; a class
 * whose reading fails is left out. */
export function gameFamilies(
  context: Pick<Context, "run">,
  ms: number,
): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (let c = 1; c <= STAR / TAB; c++)
    try {
      const json = context.run(
        `JSON.stringify(__calc.call("ReturnClasses",[${String(c)}]))`,
        ms,
      );
      const tabs: unknown = typeof json === "string" ? JSON.parse(json) : null;
      if (Array.isArray(tabs) && tabs.every((t) => typeof t === "number"))
        out.set(c, tabs);
    } catch {
      // a class the game does not answer for has no family
    }
  return out;
}

/** A list of the game's tables (`CustomLists.TalentOrder`), read in the recorder's context (names-reader.js); empty
 * when it is none or the reading fails. */
export function gameList(
  context: Pick<Context, "run" | "sandbox">,
  id: string,
  ms: number,
): unknown[] {
  const read = askNames(context, { cells: [], tables: [id] }, ms);
  const form: unknown =
    isObj(read) && Array.isArray(read.forms) ? read.forms[0] : null;
  try {
    const list: unknown = typeof form === "string" ? JSON.parse(form) : null;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
