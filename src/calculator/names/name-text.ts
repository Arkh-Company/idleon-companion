// The text of a name (spec 008, T023): a game table's text as a name (pieces.cjs `clean` and the recipes' transforms) and
// the barrier every name passes, the host's own (src/main/tree-check.ts), so a table's text never makes it refuse a tree.

const CAPS_ROMAN = /\b(?:Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii)\b/g;
/**
 * The markers of the game's text (family 4 of the audit of 19/11), which the game swaps for a number before it shows
 * the text: "{", "}", "$", "#", "<" (the multiplier's place, "<x"), an "x" left alone by them ("}x higher" \u2192 "higher",
 * "by }x" at the end), a lone "+" or "%", the "_" and "|" of its words, its ideograms and its "(Tap for more info)".
 */
const markers = (s: string): string =>
  s
    .replace(/\+?\{%?|\}/g, "")
    .replace(/[_|]/g, " ")
    .replace(/[\u3000-\u9fff]/g, "")
    // (a "#" before a number is the game's own numbering, "Dream #4")
    .replace(/\(\s*#\s*\)|#(?!\d)|\$/g, "")
    .replace(/\(\s*tap for more info\s*\)/gi, "")
    .replace(/\.?\s*Total Bonus: x\b.*$/, "")
    .replace(/\s+by(?: an? \w+)? x(?=\s|$)/g, "")
    .replace(/\s+by(?=\s+and\b|$)/g, "")
    // (a bundle's id, "bon x", is no marker)
    .replace(/(?<!\b(?:ban|bon|bun))(^|\s)<?x(?=\s|$)/g, "$1")
    // (a "+" between numbers is the math of a name, "20 + 20 × rarity")
    .replace(/(^|[:(]|(?<!\d)\s)[+%]+(?=[\s)]|$)(?!\s*\d)/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
/** The class a talent's "~R", "~G" or "~P" stands for: the game draws it as the class's coloured icon. */
const CLASS_OF: Readonly<Record<string, string>> = {
  R: "Warrior",
  G: "Archer",
  P: "Mage",
};
const classTags = (s: string): string =>
  s
    .replace(
      /\s*~([RGP])\b/gi,
      (_, c: string) => ` (${CLASS_OF[c.toUpperCase()] ?? ""})`,
    )
    .trim();
/** pieces.cjs `clean` without the capitals rule (the recipes' `clean-keep-case`). */
const keepCase = (s: string): string => classTags(markers(s));
/** The one cleaner of a name of the game's text, with its case kept: a static name's, a rule's, a table's. */
export const tidy = keepCase;

/** pieces.cjs `clean` [F2-ROMAN]: a table's text as a name; all capitals become title case, roman numerals kept. */
export function clean(s: string): string {
  const x = markers(s);
  return classTags(
    x === x.toUpperCase()
      ? x
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .replace(CAPS_ROMAN, (r) => r.toUpperCase())
      : x,
  );
}

/**
 * A column's header, the text of a list's row the game has not filled (N.js ResGridSquares: "Name … desc"; "Filler",
 * "Blank"): it names no row (family 16 of the audit of 19/11), or every row of the list would have the same name.
 */
const HEADER = /^(?:name|desc|type|filler|blank)$/i;
/** The recipes' transforms (names-recipes.json `about`); null for a transform the app does not know, or a header. */
export function transformText(transform: string, raw: string): string | null {
  const name = transformed(transform, raw);
  return name !== null && HEADER.test(name.trim()) ? null : name;
}
function transformed(transform: string, raw: string): string | null {
  const split = /^(clean|raw)\(split '(.+)' \[(\d+)\]\)$/.exec(transform);
  if (split) {
    const part = raw.split(split[2] ?? "")[Number(split[3])];
    if (part === undefined) return null;
    return split[1] === "clean" ? clean(part) : part;
  }
  switch (transform) {
    case "clean":
      return clean(raw);
    case "raw":
      return raw;
    case "clean-keep-case":
      return keepCase(raw);
    case "recorder-titlecase+clean":
      // build-tree.cjs 8f titleCase, then clean
      return clean(
        raw === raw.toUpperCase()
          ? raw.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
          : raw,
      );
    default:
      return null;
  }
}

/**
 * The copy of src/main/tree-check.ts `CODE_SIGNS` and `MAX_TEXT` (the calculator imports only its own files): what a
 * name never holds, or the host refuses the whole tree. names.test.ts compares the two; change both together.
 */
export const NAME_SIGNS =
  /[{};]|=>|&&|\|\||==|_customBlock_|\b(?:function|return|var|let|const|new|if)\s*\(/;
export const MAX_NAME = 200;

/** A name without the tag in brackets at its end ("Drop Rate (multi)" is "Drop Rate"), as an ⓘ writes it. */
export const untagged = (name: string): string =>
  name.replace(/\s*\(.*?\)\s*$/, "").trim();
/** Whether a table's text may be a name: the host takes it (a text that fails stays out, never the whole tree). */
export const isNameText = (s: string): boolean =>
  s.length <= MAX_NAME && !NAME_SIGNS.test(s);
