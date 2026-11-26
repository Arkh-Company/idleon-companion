// The references of a blueprint (spec 010, FR-003, research R5 and R12). A reference is a call of the game's block or a
// path the game read, never an expression. `{character}` stands for the tree's character and `*` for any character
// (the best of them, or their sum); a character's index is never written out, nor a call's argument the game gave from
// the save: that one is `*`.

/** A call's argument: a number, a short text, or a short list of numbers (the points spent per tab, T159). */
export type RefArg = string | number | readonly number[];
export type Ref = { call: string; args: readonly RefArg[] } | { read: string };

/** The longest text argument a ref may have: recorder.js keeps a call's text argument cut to it (arg-text.test.ts). */
export const ARG_TEXT_MAX = 40;

export const CHARACTER = "{character}";
const ANY = "[*]";

const resolve = (read: string, character: number): string =>
  read.replaceAll(CHARACTER, String(character));

/** A call's arguments as the game gets them: an argument `{character}` is the tree's character. */
export const callArgs = (
  ref: Extract<Ref, { call: string }>,
  character: number,
): RefArg[] => ref.args.map((a) => (a === CHARACTER ? character : a));

/** A call's key, `Block(args in JSON)`: a blueprint's ref and a recorded node (answer-key-terms.ts, callRef) give it. */
export const callKey = (call: string, args: readonly unknown[]): string =>
  `${call}(${args.map((a) => JSON.stringify(a)).join(",")})`;

/** The key that ties a blueprint node to an answer-key term and a recorded node: `Block(args in JSON)`, or the path. */
export const refKey = (ref: Ref, character: number): string =>
  "call" in ref
    ? callKey(ref.call, callArgs(ref, character))
    : resolve(ref.read, character);

/** A call's argument the game gave from the save (save-args.ts): any value; one save's number is never written out. */
export const SAVE = "*";

/** A call's reference without its `{character}` and `*` arguments (a draft's key never carries them). */
export const unmarked = (ref: Ref): Ref =>
  "call" in ref
    ? { ...ref, args: ref.args.filter((a) => a !== CHARACTER && a !== SAVE) }
    : ref;

/** A recorded call's key, `Block(args in JSON)`, as its block and arguments; null for any other text. */
export function parseKey(
  key: string,
): { call: string; args: unknown[] } | null {
  const m = /^([A-Za-z_$][\w$]*)\((.*)\)$/s.exec(key);
  if (!m) return null;
  try {
    return {
      call: m[1] ?? "",
      args: JSON.parse(`[${m[2] ?? ""}]`) as unknown[],
    };
  } catch {
    return null;
  }
}

/** A cache's author by any call of its block (T208): its whole args; the load takes it only there (blueprint.ts). */
export const ANY_CALL = "any";
export const isAnyCall = (ref: Ref): boolean =>
  "call" in ref && ref.args.length === 1 && ref.args[0] === ANY_CALL;

/**
 * Whether a recorded key is the one a ref stands for: each `*` argument of a call takes any value, the rest the same;
 * `any` (T208) is any call of the block.
 */
export function keyMatches(ref: Ref, key: string, character: number): boolean {
  if ("call" in ref && isAnyCall(ref)) return parseKey(key)?.call === ref.call;
  if (!("call" in ref) || !ref.args.includes(SAVE))
    return refKey(ref, character) === key;
  const got = parseKey(key);
  const want = callArgs(ref, character);
  return (
    got !== null &&
    got.call === ref.call &&
    got.args.length === want.length &&
    want.every(
      (a, i) => a === SAVE || JSON.stringify(a) === JSON.stringify(got.args[i]),
    )
  );
}

/** The refusal when two different recorded calls match a ref's `*` (the tie would be by order); null otherwise. */
export function savedTwice(
  ref: Ref,
  keys: readonly string[],
  character: number,
): string | null {
  if (!("call" in ref) || !ref.args.includes(SAVE)) return null;
  const hits = [...new Set(keys.filter((k) => keyMatches(ref, k, character)))];
  return hits.length > 1
    ? `duas chamadas casam com ${refKey(ref, character)}: ${hits.join(" e ")}; a ligação seria pela ordem`
    : null;
}

/** A path with `[*]` (any index) as the body of a regular expression: the rest literal, each `[*]` an index caught. */
export const starPattern = (path: string): string =>
  path
    .split(ANY)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\[(\\d+)\\]");

/** An `each.list`'s item path for the tree's character: the item's place in the list is the match's first group. */
export const eachPattern = (list: string, character: number): RegExp =>
  new RegExp(`^${starPattern(resolve(list, character))}$`);

/** An `each.as`'s names, one per `[*]` of its list (T179: two for the equipment's rows and slots). */
export const eachNames = (as: string | readonly string[]): string[] =>
  typeof as === "string" ? [as] : [...as];

/** The recorded read a path stands for: with `*`, the first one of any character and how many matched. */
export function matchRead(
  pattern: string,
  recorded: readonly string[],
  character: number,
): { path: string; matches: number } | null {
  const path = resolve(pattern, character);
  const hits = path.includes(ANY)
    ? recorded.filter((p) => new RegExp(`^${starPattern(path)}$`).test(p))
    : recorded.filter((p) => p === path);
  const [first] = hits;
  return first === undefined ? null : { path: first, matches: hits.length };
}

/** Spec 008's piece key, so `values`, "Where this goes" and the radar read it as today. */
export const pieceKeyOf = (ref: Ref, character: number): string =>
  "call" in ref
    ? JSON.stringify([character, ref.call, ...callArgs(ref, character)])
    : JSON.stringify([character, resolve(ref.read, character)]);

/** A group's part of a node id: its system, or `pending-<its place in the pool>` in a draft's group with none yet. */
export const groupPart = (g: { system: string | null }, gi: number): string =>
  g.system ?? `pending-${String(gi)}`;

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

/**
 * A path of names, dots and indices (`[n]`, `[{character}]`, `[*]`); a key's name after a dot may start with `+{` and
 * `%` as the game writes it (T197, `DNSM.GalleryTrophyBonTOT.%_LUK`, `DNSM.CardBonusS.+{%_Total_Mining_Efficiency`).
 */
export const isPathRead = (read: string): boolean =>
  /^[A-Za-z_$][\w$]*(?:\.(?:\+\{)?%?[\w$]+|\[(?:\d+|\{character\}|\*)\])*$/.test(
    read,
  );
