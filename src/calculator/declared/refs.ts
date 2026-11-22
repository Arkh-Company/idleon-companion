// The references of a blueprint (spec 010, FR-003, research R5 and R12). A reference is a call of the game's block or a
// path the game read, never an expression. `{character}` stands for the tree's character and `*` for any character
// (the best of them, or their sum); a character's index is never written out.

/** A call's argument: a number, a short text, or a short list of numbers (the points spent per tab, T159). */
export type RefArg = string | number | readonly number[];
export type Ref = { call: string; args: readonly RefArg[] } | { read: string };

const CHARACTER = "{character}";
const ANY = "[*]";

const resolve = (read: string, character: number): string =>
  read.replaceAll(CHARACTER, String(character));

/** A call's arguments as the game gets them: an argument `{character}` is the tree's character. */
export const callArgs = (
  ref: Extract<Ref, { call: string }>,
  character: number,
): RefArg[] => ref.args.map((a) => (a === CHARACTER ? character : a));

/** The key that ties a blueprint node to an answer-key term and a recorded node: `Block(args in JSON)`, or the path. */
export const refKey = (ref: Ref, character: number): string =>
  "call" in ref
    ? `${ref.call}(${callArgs(ref, character)
        .map((a) => JSON.stringify(a))
        .join(",")})`
    : resolve(ref.read, character);

/** The recorded read a path stands for: with `*`, the first one of any character and how many matched. */
export function matchRead(
  pattern: string,
  recorded: readonly string[],
  character: number,
): { path: string; matches: number } | null {
  const path = resolve(pattern, character);
  const hits = path.includes(ANY)
    ? recorded.filter((p) =>
        new RegExp(
          `^${path
            .split(ANY)
            .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("\\[\\d+\\]")}$`,
        ).test(p),
      )
    : recorded.filter((p) => p === path);
  const [first] = hits;
  return first === undefined ? null : { path: first, matches: hits.length };
}

/** Spec 008's piece key, so `values`, "Where this goes" and the radar read it as today. */
export const pieceKeyOf = (ref: Ref, character: number): string =>
  "call" in ref
    ? JSON.stringify([character, ref.call, ...callArgs(ref, character)])
    : JSON.stringify([character, resolve(ref.read, character)]);

/** `<number>/<pool>/<system>/<key>/<key>…`: the blueprint's keys, never the raw reference. */
export const nodeId = (
  numberId: string,
  pool: number,
  system: string,
  keys: readonly string[],
): string => [numberId, String(pool), system, ...keys].join("/");

// shortcut: only PlayerDATABASE is a list by character; add another such path here when a blueprint reads one.
export const hasRawCharacterIndex = (read: string): boolean =>
  /\bPlayerDATABASE\[\d+\]/.test(read);

/** A path of names, dots and indices (`[n]`, `[{character}]`, `[*]`). */
export const isPathRead = (read: string): boolean =>
  /^[A-Za-z_$][\w$]*(?:\.[\w$]+|\[(?:\d+|\{character\}|\*)\])*$/.test(read);
