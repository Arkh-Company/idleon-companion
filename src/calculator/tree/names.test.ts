// The name of a row (spec 008, T023): the names table, then the rules by shape; a recipe only with the installed game's
// table; nothing else gives the generic name and `unnamed` (FR-012a). The table's keys are taken from the table itself,
// so this file holds no game text.
import { afterEach, expect, test } from "vitest";
import { checkTree, CODE_SIGNS, MAX_TEXT } from "../../main/tree-check.ts";
import { formulaFor } from "./formulas.ts";
import { GENERIC_NAME, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { at, read } from "./tree-fixture.ts";
import {
  callName,
  clean,
  nameOf,
  NAMES_BY_LABEL,
  pathName,
  isNameText,
  MAX_NAME,
  NAME_SIGNS,
  resolveNames,
  transformText,
  useGameNames,
} from "./names.ts";
import { NAME_RECIPES, partTable, STATIC_NAMES } from "./names-table.ts";
import type { NameRecipe } from "./names-table.ts";

afterEach(() => {
  useGameNames(new Map());
});

const [staticKey, staticName] = [...STATIC_NAMES][0] ?? ["", { name: "" }];
/** A recipe of a game cache: the rule by shape would name it, the recipe must win. */
const cacheRecipe = NAME_RECIPES.find((r) => r.key.startsWith("DNSM."));

test("a call named by the table", () => {
  expect(nameOf(staticKey)).toBe(staticName.name);
  expect(row({ pieceKey: "k", value: 1, code: staticKey })).toMatchObject({
    name: staticName.name,
    flags: {},
  });
});

test("a call no rule nor the table names gives a generic name and flags.unnamed", () => {
  expect(nameOf("Invented()")).toBeNull();
  expect(row({ pieceKey: "k", value: 1, code: "Invented()" })).toMatchObject({
    name: GENERIC_NAME,
    flags: { unnamed: true },
  });
  // a row given its name is named, whatever its code
  expect(
    row({ pieceKey: "k", value: 1, code: "Invented()", name: "A rule's name" })
      .flags,
  ).toEqual({});
  // a part with no value is unavailable, named or not
  expect(row({ pieceKey: "k", value: null, code: staticKey }).flags).toEqual({
    unavailable: true,
  });
  expect(row({ pieceKey: "k", value: null, code: null }).flags).toEqual({
    unnamed: true,
    unavailable: true,
  });
});

test("a recipe's row is named only by the installed game's table, never by a rule by shape", () => {
  expect(cacheRecipe).toBeDefined();
  const key = cacheRecipe?.key ?? "";
  expect(nameOf(key)).toBeNull();
  useGameNames(new Map([[key, "Invented cache"]]));
  expect(nameOf(key)).toBe("Invented cache");
});

test.each([
  ["getLOG(10)", "log₁₀"],
  ["Log2(8)", "log₂"],
  // P2: the mode in words, with its numbers when one is not 0
  ['Invented("SomeMode_Two,x2", 0, 3)', "Some Mode Two x 2 0, 3"],
  ['Invented("SomeMode", 0, 0)', "Some Mode"],
  ['Invented("lowerMode")', "Lower Mode"],
  ['Invented("Filler", 1)', null],
  ['Invented("with space")', null],
  ['Invented(3, "Mode")', null],
  ["Invented(not json)", null],
  // the recorder's label of a game's working value
  ["DNSM.Some_Cache[2]", "Working value of the game (Some Cache)"],
  ["DNSM.SomeCache.entry", "Working value of the game (SomeCache)"],
  ["DNSM.SomeCache", "Working value of the game (SomeCache)"],
  ["DNSM.SomeCache[x]", null],
  ["DummyNumbersStatManager.x", "Working value of the game"],
  ["DummyList3[1]", "Working value of the game"],
  ["Stats.q", null],
])("%s is named %s by its shape", (code, name) => {
  expect(nameOf(code)).toBe(name);
  // only the game's working value is a generic name: no name yet, so the ⓘ writes the game's path (FR-012a); log₁₀,
  // log₂ and a mode in words are names
  const r = row({ pieceKey: "k", value: 1, code });
  expect([r.name, r.flags]).toEqual([
    name ?? GENERIC_NAME,
    name && !name.startsWith("Working value") ? {} : { unnamed: true },
  ]);
});

test.each(NAMES_BY_LABEL)(
  "the working value %s is named %s by its label, a name of its own",
  (label, name) => {
    for (const code of [`DNSM.${label}`, `DNSM.${label}[2]`]) {
      const r = row({ pieceKey: "k", value: 1, code });
      expect([r.name, r.flags]).toEqual([name, {}]);
      expect(checkTree({ id: "x", ...r }, 1)).not.toBeNull();
    }
    // the label is the whole key: a longer one keeps the generic name
    expect(
      row({ pieceKey: "k", value: 1, code: `DNSM.${label}x` }).flags,
    ).toEqual({ unnamed: true });
  },
);

const recipeCall = NAME_RECIPES.find((r) => r.key.includes("("))?.key ?? "";
test.each([
  // no name, or the game's working value only: the game's path as it is (FR-012a)
  ["Stats.q", undefined, "Stats.q"],
  ["DNSM.SomeCache[2]", undefined, "DNSM.SomeCache[2]"],
  // a name loses its tag in brackets and its " · …"; a bracket of numbers with an operation stays
  [cacheRecipe?.key ?? "", "Invented cache (tag)", "Invented cache"],
  [cacheRecipe?.key ?? "", "Invented cache · more", "Invented cache"],
  [cacheRecipe?.key ?? "", "Invented cache (2 × 3)", "Invented cache (2 × 3)"],
])("the ⓘ writes the read %s by its name", (path, name, term) => {
  if (name) useGameNames(new Map([[path, name]]));
  expect(pathName(path)).toBe(term);
});

test.each([
  ['Invented("SomeMode", 0, 3)', undefined, "Some Mode 0, 3"],
  ["Invented(2)", undefined, "Invented(2)"],
  // a call's name loses any bracket at its end
  [recipeCall, "Invented call (2 × 3)", "Invented call"],
])("the ⓘ writes the call %s by its name", (text, name, term) => {
  if (name) useGameNames(new Map([[text, name]]));
  expect(callName(text)).toBe(term);
});

test.each([
  ["getLOG(100)", "log₁₀"],
  ['Invented("SomeMode", 0, 0)', "Some Mode"],
])("the ⓘ writes %s by its name, never the game's call", (code, name) => {
  const part: Row = {
    node: row({ pieceKey: "k", value: 2, code }),
    open: null,
  };
  expect(formulaFor(at(6), [part, read("Stats.a", 3)])).toEqual([
    `${name} × Stats.a`,
    "2 × 3 = 6",
  ]);
});

test.each([
  ["FIRST_INVENTED_II", "First Invented II"],
  ["Mixed_Case {%value}", "Mixed Case value"],
  ["+{ TEXT", "Text"],
  // a lone + or % goes, one after a letter stays
  ["Some+ % Text", "Some+ Text"],
  // the CJK range goes
  ["a　b", "ab"],
])("clean %s", (raw, name) => {
  expect(clean(raw)).toBe(name);
});

test.each<[string, string, string | null]>([
  ["clean", "ALL_CAPS", "All Caps"],
  ["clean-keep-case", "ALL_CAPS", "ALL CAPS"],
  ["recorder-titlecase+clean", "TWO WORDS", "Two Words"],
  ["recorder-titlecase+clean", "Mixed WORDS", "Mixed WORDS"],
  // title case first: its roman numerals are no longer all capitals for clean
  ["recorder-titlecase+clean", "PART II", "Part Ii"],
  ["clean(split '|' [1])", "a|SECOND_HALF", "Second Half"],
  ["raw(split '_-_' [0])", "FIRST_A_-_b", "FIRST_A"],
  ["clean(split '|' [2])", "a|b", null],
  ["unknown", "text", null],
])("transform %s of %s", (transform, raw, name) => {
  expect(transformText(transform, raw)).toBe(name);
});

const invented = (
  key: string,
  template: string | null,
  ...tables: string[]
): NameRecipe => ({
  key,
  template,
  parts: tables.map((table, i) => ({
    table,
    index: [i],
    field: null,
    transform: "clean",
  })),
});

test("a recipe resolves with its tables unchanged, its texts in the template", () => {
  const texts = new Map([
    ["CustomLists.A", "FIRST"],
    ["CustomLists.B", "second"],
  ]);
  const names = resolveNames(
    (p) => texts.get(p.table) ?? null,
    () => true,
    [
      invented("One()", "{0} (invented)", "CustomLists.A"),
      invented("Two()", "{0} and {1}", "CustomLists.A", "CustomLists.B"),
      invented("Alone()", null, "CustomLists.B"),
    ],
  );
  expect([...names]).toEqual([
    ["One()", "First (invented)"],
    ["Two()", "First and second"],
    ["Alone()", "second"],
  ]);
});

test("a recipe whose table changed, or whose cell is no text, has no name: never a wrong one", () => {
  const recipes = [
    invented("Changed()", null, "CustomLists.A", "CustomLists.B"),
    invented("NoText()", null, "CustomLists.C"),
    invented("HalfText()", "{0} and {1}", "CustomLists.A", "CustomLists.C"),
    invented("Code()", null, "CustomLists.D"),
    invented("Long()", null, "CustomLists.E"),
    invented("Empty()", null, "CustomLists.F"),
    invented("Keyword()", null, "CustomLists.G"),
  ];
  const texts = new Map([
    ["CustomLists.A", "a"],
    ["CustomLists.B", "b"],
    ["CustomLists.D", "x; y"],
    ["CustomLists.E", "x".repeat(201)],
    ["CustomLists.F", " "],
    ["CustomLists.G", "Grants if (owned)"],
  ]);
  const names = resolveNames(
    (p) => texts.get(p.table) ?? null,
    (id) => id !== "CustomLists.B",
    recipes,
  );
  expect([...names]).toEqual([]);
  expect(
    resolveNames(
      (p) => texts.get(p.table) ?? null,
      () => true,
      recipes,
    ).get("Changed()"),
  ).toBe("a");
});

test("a list's hash is the whole list's, an item's or a monster's its entry's", () => {
  const part = (table: string) => ({
    table,
    index: ["entry", 0],
    field: "name",
    transform: "clean",
  });
  expect(partTable(part("CustomLists.A"))).toBe("CustomLists.A");
  expect(partTable(part("ItemDefinitionsGET"))).toBe(
    "ItemDefinitionsGET.entry",
  );
});

test.each([
  "Plain name",
  "1 if you have it",
  "Grants if (owned)",
  "return{",
  "x; y",
  "a => b",
  "Calls _customBlock_X",
  "x".repeat(200),
  "x".repeat(201),
])("the name barrier takes %s as the host's check does", (text) => {
  const host =
    checkTree(
      { id: "x", ...row({ pieceKey: null, value: 1, code: null, name: text }) },
      1,
    ) !== null;
  expect(isNameText(text)).toBe(host);
});

test("the name barrier is the host's copy: the same signs of code and the same length", () => {
  expect([NAME_SIGNS.source, NAME_SIGNS.flags, MAX_NAME]).toEqual([
    CODE_SIGNS.source,
    CODE_SIGNS.flags,
    MAX_TEXT,
  ]);
});
