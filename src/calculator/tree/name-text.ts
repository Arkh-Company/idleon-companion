// The text of a name (spec 008, T023): a game table's text as a name (pieces.cjs `clean` and the recipes' transforms) and
// the barrier every name passes, the host's own (src/main/tree-check.ts), so a table's text never makes it refuse a tree.

const CAPS_ROMAN = /\b(?:Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii)\b/g;
/** pieces.cjs `clean` without the capitals rule (the recipes' `clean-keep-case`). */
const keepCase = (s: string): string =>
  s
    .replace(/\+?\{%?|\}/g, "")
    .replace(/[_|]/g, " ")
    .replace(/(^|[\s:(])[+%]+(?=[\s)]|$)/g, "$1")
    .replace(/[\u3000-\u9fff]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** pieces.cjs `clean` [F2-ROMAN]: a table's text as a name; all capitals become title case, roman numerals kept. */
export function clean(s: string): string {
  const x = keepCase(s);
  return x === x.toUpperCase()
    ? x
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(CAPS_ROMAN, (r) => r.toUpperCase())
    : x;
}

/** The recipes' transforms (names-recipes.json `about`); null for a transform the app does not know. */
export function transformText(transform: string, raw: string): string | null {
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
/** Whether a table's text may be a name: the host takes it (a text that fails stays out, never the whole tree). */
export const isNameText = (s: string): boolean =>
  s.length <= MAX_NAME && !NAME_SIGNS.test(s);
