// A draft's references, names and keys (spec 010, research R5, R7, R12; moved out of draft.ts as they were): a part's
// structured reference, with `{character}` and `*` for a character's index; a name only with its proof in the names
// table; a key unique among its siblings.
import type { Op } from "../instrument.ts";
import { STATIC_NAMES } from "../names/names-table.ts";
import { nameOf, recipeName } from "../names/names.ts";
import { renameOf } from "../names/renames.ts";
import { STATE_NAMES } from "../names/state-names.ts";
import type { Recording } from "../recording.ts";
import type { Walked } from "./draft.ts";
import { CALL } from "./not-leaves.ts";
import { hasRawCharacterIndex } from "./refs.ts";
import type { Ref, RefArg } from "./refs.ts";
import { unnamed } from "./save-args.ts";

/** A path with each character's index as its marker: the recorded character `{character}`, any other `*`. */
export const marked = (path: string, character: number): string =>
  path.replace(
    /\bPlayerDATABASE\[(\d+)\]/g,
    (_, i: string) =>
      `PlayerDATABASE[${Number(i) === character ? "{character}" : "*"}]`,
  );

export function refOf(w: Walked, character: number): Ref {
  // shortcut: a call's arguments are taken as the recorder kept them (numbers and short texts)
  if (w.call) return { call: w.call.b, args: w.call.a as RefArg[] };
  const m = CALL.exec(w.key);
  return m
    ? {
        call: m[1] ?? "",
        args: JSON.parse(`[${m[2] ?? ""}]`) as RefArg[],
      }
    : { read: marked(w.key, character) };
}

/** The code the names table goes by: a call as the tree writes it, `Block(a, b)`, or the recorded path. */
export const codeOf = (ref: Ref, key: string): string =>
  "call" in ref
    ? `${ref.call}(${ref.args.map((a) => JSON.stringify(a)).join(", ")})`
    : key;

/** A name with its proof: the names table's own (a rename, a static name, a recipe over the game, a state rule). */
export function provenName(
  code: string,
): { name: string; nameProof: { names: string } } | null {
  if (hasRawCharacterIndex(code)) return null;
  const proven =
    renameOf(code) !== null ||
    STATIC_NAMES.has(code) ||
    recipeName(code) !== null ||
    STATE_NAMES.some((r) => r.test.test(code) && r.name(code) !== null);
  const name = proven ? nameOf(code) : null;
  return name ? { name, nameProof: { names: code } } : null;
}
/** A part's proven name; none with an argument from the character, the save or a place that does not decide. */
export function partName(
  w: Walked,
  character: number,
  rec: Recording,
  ops: readonly Op[],
  rootRef?: Ref,
) {
  const code = refOf(w, character);
  return w.call && unnamed(code, rec, ops, w.call, rootRef)
    ? null
    : provenName(codeOf(code, w.key));
}

export const slug = (text: string): string =>
  text
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 56)
    .replace(/^-+|-+$/g, "") || "part";
/** A key unique among its siblings (research R12): the reference's slug, then `end` past its cut, then -2, -3… */
export function keyIn(taken: Set<string>, text: string, end = ""): string {
  const base = slug(text) + end;
  let k = base;
  for (let n = 2; taken.has(k); n++) k = `${base}-${String(n)}`;
  taken.add(k);
  return k;
}
