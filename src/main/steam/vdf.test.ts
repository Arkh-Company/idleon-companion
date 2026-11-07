import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  VdfShapeError,
  findPath,
  getLaunchOptions,
  parseVdf,
  setLaunchOptions,
} from "./vdf.ts";

const fixture = readFileSync(
  join(import.meta.dirname, "fixtures", "localconfig.vdf"),
  "utf8",
);
const GAME = "1476970";
const APPS = ["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"];

/** The text of `a` before and after the first difference with `b`, to check only one span changed. */
function diffSpan(a: string, b: string): { prefix: number; suffix: number } {
  let prefix = 0;
  while (prefix < a.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++;
  return { prefix, suffix };
}

test("parses keys, values and blocks, skipping // comments", () => {
  const root = parseVdf(fixture);
  const tf2 = findPath(root, [...APPS, "440", "LaunchOptions"]);
  expect(tf2?.value).toBe("-novid");
  expect(findPath(root, [...APPS, GAME])?.children?.map((c) => c.key)).toEqual([
    "LastPlayed",
    "LaunchOptions",
  ]);
});

test("finds keys case-insensitively: the file has Apps, the path asks for apps", () => {
  expect(findPath(parseVdf(fixture), APPS)?.key).toBe("Apps");
});

test('unescapes \\" \\\\ \\n and \\t', () => {
  const root = parseVdf('"k" "a\\"b\\\\c\\nd\\te"');
  expect(findPath(root, ["k"])?.value).toBe('a"b\\c\nd\te');
});

test("the span of a value is its raw text between the quotes", () => {
  const text = '"k"  "a\\"b"';
  const node = findPath(parseVdf(text), ["k"]);
  expect(node && text.slice(node.start, node.end)).toBe('a\\"b');
});

test("reads the game's launch option, unescaped", () => {
  expect(getLaunchOptions(fixture, GAME)).toBe(
    '"C:\\Tools\\fps.exe" %command% -windowed',
  );
  expect(getLaunchOptions(fixture, "999")).toBeUndefined();
});

test("setting the option changes only the bytes of that value, escaping quotes and backslashes", () => {
  const option = '"C:\\Users\\A B\\IdleOn Companion.exe" --keeper %command%';
  const out = setLaunchOptions(fixture, GAME, option);
  const node = findPath(parseVdf(fixture), [...APPS, GAME, "LaunchOptions"]);
  if (!node) throw new Error("fixture without LaunchOptions");

  expect(out.slice(0, node.start)).toBe(fixture.slice(0, node.start));
  expect(out.slice(out.length - (fixture.length - node.end))).toBe(
    fixture.slice(node.end),
  );
  expect(out.slice(node.start, out.length - (fixture.length - node.end))).toBe(
    '\\"C:\\\\Users\\\\A B\\\\IdleOn Companion.exe\\" --keeper %command%',
  );
  expect(getLaunchOptions(out, GAME)).toBe(option);
  expect(getLaunchOptions(out, "440")).toBe("-novid");
});

test("an app block without LaunchOptions gets one line inside it, with the block's indentation", () => {
  const text = [
    '"UserLocalConfigStore"',
    "{",
    '\t"Software" { "Valve" { "Steam" {',
    '\t\t"apps"',
    "\t\t{",
    `\t\t\t"${GAME}"`,
    "\t\t\t{",
    '\t\t\t\t"LastPlayed"\t\t"1"',
    "\t\t\t}",
    "\t\t}",
    "\t} } }",
    "}",
    "",
  ].join("\n");
  const out = setLaunchOptions(text, GAME, "-x");
  expect(out).toBe(
    text.replace(
      '\t\t\t\t"LastPlayed"\t\t"1"\n',
      '\t\t\t\t"LastPlayed"\t\t"1"\n\t\t\t\t"LaunchOptions"\t\t"-x"\n',
    ),
  );
});

test("with no app block it inserts the block inside apps", () => {
  const text = [
    '"UserLocalConfigStore"',
    "{",
    '\t"Software" { "Valve" { "Steam" {',
    '\t\t"apps"',
    "\t\t{",
    '\t\t\t"440"',
    "\t\t\t{",
    "\t\t\t}",
    "\t\t}",
    "\t} } }",
    "}",
    "",
  ].join("\n");
  const out = setLaunchOptions(text, GAME, "-x");
  expect(out).toBe(
    text.replace(
      "\t\t\t}\n\t\t}\n",
      `\t\t\t}\n\t\t\t"${GAME}"\n\t\t\t{\n\t\t\t\t"LaunchOptions"\t\t"-x"\n\t\t\t}\n\t\t}\n`,
    ),
  );
  expect(getLaunchOptions(out, GAME)).toBe("-x");
});

test("\\r\\n line endings are kept", () => {
  const text = fixture.replaceAll("\n", "\r\n");
  const replaced = setLaunchOptions(text, GAME, "-a");
  expect(replaced.replaceAll("\r\n", "")).not.toContain("\n");

  const noApp = text.replace(`"${GAME}"`, '"999"');
  const inserted = setLaunchOptions(noApp, GAME, "-a");
  expect(inserted.replaceAll("\r\n", "")).not.toContain("\n");
  expect(getLaunchOptions(inserted, GAME)).toBe("-a");
  const { prefix, suffix } = diffSpan(noApp, inserted);
  expect(prefix + suffix).toBe(noApp.length); // only an insertion, nothing of the file changed
});

test("with no apps path it throws VdfShapeError", () => {
  expect(() =>
    setLaunchOptions('"UserLocalConfigStore" { "Software" { } }', GAME, "-x"),
  ).toThrow(VdfShapeError);
});

test.each([
  ["an unclosed block", '"a" { "b" "c"'],
  ["a stray closing brace", '"a" "b" }'],
  ["an unterminated string", '"a" "b'],
  ["a key without a value", '"a"'],
  ["an unquoted token", "a b"],
])("%s throws VdfShapeError", (_name, text) => {
  expect(() => parseVdf(text)).toThrow(VdfShapeError);
});
