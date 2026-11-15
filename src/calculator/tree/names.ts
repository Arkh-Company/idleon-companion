// The name of a row (spec 008, T023, FR-012a): the names table first (tree/names-table.ts), then the bench's rules that
// name any argument by its shape (names-008 rule 6): `getLOG` and `Log2` (pieces.cjs CALL_NAMES, [F5B-LOG2]), a block's
// mode in words (pieces.cjs `nameOf`, proposal P2) and the recorder's label of a game's working value (build-tree.cjs
// `inputOf`). A row with none of them keeps the generic name and `unnamed`. A recipe's name comes from the installed
// game's table (`resolveNames`): when its table changed, the row has no name, never a wrong one.
import { NAME_RECIPES, partTable, STATIC_NAMES } from "./names-table.ts";
import type { NamePart, NameRecipe } from "./names-table.ts";
import { clean, isNameText, transformText } from "./name-text.ts";

export {
  clean,
  isNameText,
  MAX_NAME,
  NAME_SIGNS,
  transformText,
} from "./name-text.ts";

const CALL = /^([^(]+)\((.*)\)$/;
/** A call's block and arguments, from the text the tree writes (`callText`); null for a read path. */
function callOf(code: string): [string, unknown[]] | null {
  const m = CALL.exec(code);
  if (!m) return null;
  try {
    const args: unknown = JSON.parse(`[${m[2] ?? ""}]`);
    return Array.isArray(args) ? [m[1] ?? "", args] : null;
  } catch {
    return null;
  }
}

/** pieces.cjs `nameOf`, proposal P2: a block's mode in words, with its numeric arguments when one is not 0. */
function modeInWords(args: readonly unknown[]): string | null {
  const [mode, ...rest] = args;
  if (typeof mode !== "string" || !/^[A-Za-z][A-Za-z0-9_,]*$/.test(mode))
    return null;
  if (/^(Filler|filler)$/.test(mode)) return null;
  const words = mode
    .replace(/[_,]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .trim();
  const nums = rest.filter((x) => typeof x === "number");
  const tail = nums.some((x) => x !== 0) ? ` ${nums.join(", ")}` : "";
  return (words.charAt(0).toUpperCase() + words.slice(1) + tail).replace(
    /\s+/g,
    " ",
  );
}

/** A game cache by its label, as the recorder labels it (build-tree.cjs `inputOf`): the label, then an entry or none. */
export const cacheOf = (label: string) =>
  new RegExp(`^DNSM\\.${label}(?:\\..+|\\[\\d+\\])?$`);

/** pieces.cjs NAMES_BY_LABEL: the working values of the game the bench names by their label, over the generic name. */
export const NAMES_BY_LABEL: readonly (readonly [
  label: string,
  name: string,
])[] = [
  ["GurtBonuzzDN", "Best bonus of this talent among your characters"],
  // the same variable then holds Vial Mastery and the vial boosts the call adds
  ["CauldStatDNzz", "Vial bonus boosts (%)"],
  ["ArcadBonDNz", "Arcade maxed doubler"],
  ["GalleryDN2", "Trophy slot multiplier (podium level)"],
  ["CalcTalentDN1", "Lowest skill level among the 9 skills"],
  ["cardLvCalco", "Card stars"],
];

/** The rules by shape (names-008 rule 6), each with its proof by reference: the first whose test matches decides. */
export const SHAPE_NAMES: readonly {
  test: RegExp;
  proof: string;
  name: (code: string, call: [string, unknown[]] | null) => string | null;
  /** The recorder's label of a game's working value: shown, and still no name yet (the bench's generic name). */
  generic?: true;
}[] = [
  ...NAMES_BY_LABEL.map(([label, name]) => ({
    test: cacheOf(label),
    proof: "bench pieces.cjs NAMES_BY_LABEL",
    name: () => name,
  })),
  {
    test: /^getLOG\(/,
    proof: "bench pieces.cjs CALL_NAMES; N.js getLOG",
    name: () => "log₁₀",
  },
  {
    test: /^Log2\(/,
    proof: "bench pieces.cjs CALL_NAMES F5B-LOG2; N.js Log2",
    name: () => "log₂",
  },
  {
    test: /^[^(]+\(/,
    proof: "bench pieces.cjs nameOf P2",
    name: (_, call) => (call ? modeInWords(call[1]) : null),
  },
  {
    test: /^DNSM\.\w+(?:\..+|\[\d+\])?$/,
    proof: "bench build-tree.cjs inputOf, the game caches",
    generic: true,
    name: (code) =>
      clean(
        `Working value of the game (${/^DNSM\.(\w+)/.exec(code)?.[1] ?? ""})`,
      ),
  },
  {
    test: /^DummyNumbersStatManager\.|^DummyList\d*\[/,
    proof: "bench build-tree.cjs inputOf, the scratch numbers",
    generic: true,
    name: () => "Working value of the game",
  },
];

// ponytail: one table of the installed game's names per worker, set once at its boot (tree-engine.ts); rows read it
// where they are made, in every module of the assembly. A second game in the same worker would set it again.
let gameNames: ReadonlyMap<string, string> = new Map();
/** The names of the recipes resolved over the installed game (`resolveNames`). */
export function useGameNames(names: ReadonlyMap<string, string>): void {
  gameNames = names;
}

const RECIPE_KEYS = new Set(NAME_RECIPES.map((r) => r.key));

/** The row's name for its call or read path; null when nothing names it (the row keeps the generic name). */
export function nameOf(code: string): string | null {
  const known = STATIC_NAMES.get(code);
  if (known) return known.name;
  if (RECIPE_KEYS.has(code)) return gameNames.get(code) ?? null;
  const call = callOf(code);
  return SHAPE_NAMES.find((r) => r.test.test(code))?.name(code, call) ?? null;
}

/** Whether `code`'s name, if any, is only the recorder's label of a game's working value: it counts as no name yet
 * (FR-012a), so the ⓘ writes the game's path. */
export const isGeneric = (code: string): boolean =>
  !STATIC_NAMES.has(code) &&
  !RECIPE_KEYS.has(code) &&
  !!SHAPE_NAMES.find((r) => r.test.test(code))?.generic;

/** A term of the ⓘ for `code`: its name, else the game's path or call as it is (FR-012a). */
export const termName = (code: string): string | null =>
  isGeneric(code) ? null : nameOf(code);

/** pieces.cjs `pathName`: a read in the ⓘ by its name, its tag in brackets and its " · …" gone; else its path. */
export function pathName(p: string): string {
  const name = termName(p);
  return name === null
    ? p
    : name
        .replace(/ · .*$/, "")
        .replace(/\s*\((?!.*\d.*[×÷+−]).*?\)\s*$/, "")
        .trim();
}

/** pieces.cjs `callName`: a call in the ⓘ by its name, any bracket at its end gone; else the call as it is. */
export function callName(text: string): string {
  const name = termName(text);
  return name === null ? text : name.replace(/\s*\(.*?\)\s*$/, "").trim();
}

/**
 * The recipes' names over the installed game: `textOf` gives the text of a part's table cell (null when it is no text),
 * `tableOk` whether the table's sha256 is the bench's. A recipe whose table changed, or whose text is missing, has no name.
 */
export function resolveNames(
  textOf: (p: NamePart) => string | null,
  tableOk: (id: string) => boolean,
  recipes: readonly NameRecipe[] = NAME_RECIPES,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of recipes) {
    if (!r.parts.every((p) => tableOk(partTable(p)))) continue;
    const texts = r.parts.map((p) => {
      const raw = textOf(p);
      return raw === null ? null : transformText(p.transform, raw);
    });
    if (texts.some((t) => t === null)) continue;
    const name = (r.template ?? "{0}").replace(
      /\{(\d)\}/g,
      (_, k: string) => texts[Number(k)] ?? "",
    );
    if (name && isNameText(name)) out.set(r.key, name);
  }
  return out;
}
