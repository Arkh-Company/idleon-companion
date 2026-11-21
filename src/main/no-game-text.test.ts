// No game code and no quoted proof in the repository (spec 008 T062, CHK018; FR-032): a scan of the text of src/ and of
// the spec folder. The game's text and images may be in it as data (Vinicius, 14/11: the names table copies texts of
// the game's tables); its code never: a table written as the game's code, a row of its numbers, a minified snippet.
// Proofs name a place (a photo, a sprite, the bench's rule, the game's block), never the game's text. The invented games
// of the tests are scanned too: their lines are short and their lists small.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const FOLDERS = ["src", "specs/008-formula-trees"];
const TEXT = /\.(?:tsx?|c?js|mjs|json|md|ya?ml|css|html|svg)$/;
// Rebuilt by `just diagramas` and ignored by git: never in the repository.
const IGNORED = /(?:^|\/)(?:diagramas\/local|node_modules)\//;

/** The game's code for a table: one string of words split by spaces (what src/keeper/game-tables.ts reads). */
const SPLIT_TABLE = /["'][^"'\s]+(?: [^"'\s]+){7,}["']\.split\(/;
/** A row of the game's numbers: 20 or more in one list. */
const NUMBER_ROW = /\[(?:\s*-?\d[\d.e+-]*\s*,){19,}/;
/** The game's file is minified: a long line with a function written without spaces is a piece of it. */
const MINIFIED_FN = /function\([\w$,]*\)\{/;
const LONG_LINE = 200;
// ponytail: shape-based; a pasted snippet that was reformatted, or one shorter than LONG_LINE, passes. The upgrade is
// the session's privacy.cjs against the game's own file before each code PR (T062).
/** A proof's value: what follows a `proof` key, in any of the three quotes. */
const PROOF = /\bproof["']?\s*:\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
/** A quote, or code: "; " only joins references. */
const QUOTE_OR_CODE = /["'`“”‘’]|[{}]|;(?!\s)|=>/;

function gameText(text: string): string[] {
  const hits: string[] = [];
  text.split("\n").forEach((line, i) => {
    const at = `line ${String(i + 1)}`;
    if (SPLIT_TABLE.test(line)) hits.push(`${at}: the game's code for a table`);
    if (NUMBER_ROW.test(line)) hits.push(`${at}: a row of the game's numbers`);
    if (line.length > LONG_LINE && MINIFIED_FN.test(line))
      hits.push(`${at}: a snippet of the game's code`);
  });
  for (const [, , proof] of text.matchAll(PROOF))
    if (proof !== undefined && QUOTE_OR_CODE.test(proof))
      hits.push(`a quoted proof: ${proof.slice(0, 40)}`);
  return hits;
}

const files = FOLDERS.flatMap((folder) =>
  readdirSync(join(ROOT, folder), { recursive: true, encoding: "utf8" })
    .map((f) => `${folder}/${f.replaceAll("\\", "/")}`)
    .filter((f) => TEXT.test(f) && !IGNORED.test(f)),
);

test("the scan reads the code, the tests, the invented games and the spec's documents", () => {
  for (const f of [
    "src/main/index.ts",
    "src/calculator/fixtures/fake-game.js",
    "src/keeper/mock-game/static/game/N.js",
    "src/shared/screens/rules/windows-46-110.json",
    "specs/008-formula-trees/design.md",
    "specs/008-formula-trees/catalogo-de-arvores.md",
    "specs/008-formula-trees/prototipo/load-game.cjs",
    "src/calculator/names/names-static.json",
    "src/calculator/names/names-recipes.json",
  ])
    expect(files).toContain(f);
});

test("no file of src/ or of the spec folder holds the game's code for a table, a snippet of its code or a quoted proof", () => {
  expect(
    files.flatMap((f) =>
      gameText(readFileSync(join(ROOT, f), "utf8")).map((h) => `${f}: ${h}`),
    ),
  ).toEqual([]);
});

// The cases are built here, so this file never holds what it looks for.
const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `W${String(i)}`).join(" ");
const numbers = (n: number) =>
  Array.from({ length: n }, (_, i) => String(i)).join(",");
const fn = "function(a,b){";
const KEY = "proof";

test.each([
  [
    "the game's code for a table",
    `x.Names=function(){return"${words(8)}".split(" ")};`,
  ],
  ["a row of the game's numbers", `const t = [${numbers(20)}];`],
  [
    "a snippet of the game's code",
    `x.A=${fn}var c=a*b;return c}`.padEnd(LONG_LINE + 1, ";"),
  ],
  ["a quoted proof", `{ ${KEY}: 'N.js Boat "Upgrade LV"' }`],
  ["a proof with the game's code", `"${KEY}": "N.js Boat return a*b;"`],
  ["a proof with a curly quote", `${KEY}: "N.js Boat “Upgrade”"`],
])("the scan catches %s", (_, line) => {
  expect(gameText(line)).not.toEqual([]);
});

test.each([
  [
    "a short list of names",
    `x.Names=function(){return"${words(7)}".split(" ")};`,
  ],
  ["a short row of numbers", `const t = [${numbers(19)}];`],
  ["a short minified line", `x.A=${fn}return a*b};`],
  [
    "a long line of the app's own code",
    `const a = function (b) {`.padEnd(LONG_LINE + 1, " "),
  ],
  [
    "a proof by reference",
    `${KEY}: "bench pieces.cjs condSub done; N.js RoyalG"`,
  ],
  ["a proof of a photo", `"${KEY}": "foto:0349"`],
  // the game's text as data: a name copied from a table, a table's words as a list
  [
    "a game table's text as a name",
    `"Invented(1)": ["${words(12)} (achievement)", "tables CustomLists.X"],`,
  ],
  ["a game table's words as a list", `["${words(8).split(" ").join('", "')}"]`],
])("the scan lets %s through", (_, line) => {
  expect(gameText(line)).toEqual([]);
});
