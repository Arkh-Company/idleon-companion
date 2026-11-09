// The preload and the window carry none of the catalog's rules: only the keeper and the app load its entry.
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { expect, test } from "vitest";
import * as shared from "../index.ts";

const SRC = join(import.meta.dirname, "..", "..");
const ENTRY = "src/shared/screens";
const CATALOG = /^src\/shared\/screens(?:\/catalog|\/rules\/.*)?$/;
const IMPORT = /(?:\bfrom|\bimport|\brequire\s*\()\s*\(?\s*["'](\.[^"']*)["']/g;
const ITS_OWN_FILES = [
  "src/shared/screens/index.ts",
  "src/shared/screens/catalog.ts",
];

// Resolved to the file it names, so any spelling of the path is the same target.
const target = (file: string, specifier: string) =>
  posix
    .join(posix.dirname(file), specifier)
    .replace(/\.[cm]?[jt]sx?$/, "")
    .replace(/\/(?:index)?$/, "");

function catalogLoads(file: string, text: string): string[] {
  if (ITS_OWN_FILES.includes(file)) return [];
  const mayLoadEntry = /^src\/(?:keeper|main)\//.test(file);
  return [...text.matchAll(IMPORT)]
    .map((match) => target(file, match[1] ?? ""))
    .filter((t) => CATALOG.test(t) && !(mayLoadEntry && t === ENTRY));
}

// Tests may load the catalog; they never ship.
const sources = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => /\.(?:tsx?|c?js|mjs)$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ file: `src/${f}`, text: readFileSync(join(SRC, f), "utf8") }));

test.each(["SCREEN_CATALOG", "KNOWN_WINDOWS", "parseScreenCatalog"])(
  "src/shared/index.ts does not export %s",
  (name) => {
    expect(Object.keys(shared)).not.toContain(name);
  },
);

test("the scan reads the shared code, the preload and the window", () => {
  const files = sources.map((s) => s.file);
  for (const f of [
    "src/shared/index.ts",
    "src/preload/index.ts",
    "src/renderer/App.tsx",
  ])
    expect(files).toContain(f);
});

test("only the keeper and the app load the catalog, and through its entry", () => {
  expect(
    sources.flatMap((s) =>
      catalogLoads(s.file, s.text).map((hit) => `${s.file}: ${hit}`),
    ),
  ).toEqual([]);
});

test.each([
  ["src/renderer/a.ts", 'import { X } from "../shared/screens/index.ts";'],
  ["src/renderer/a.ts", 'import { X } from "../shared/screens/catalog.ts";'],
  ["src/renderer/a.ts", 'import { X } from "../shared/screens";'],
  ["src/renderer/a.ts", 'import { X } from "../shared/screens/";'],
  [
    "src/renderer/a.ts",
    'const x = await import("../shared/screens/index.js");',
  ],
  ["src/preload/a.ts", 'const x = require("../shared/screens/catalog");'],
  ["src/preload/a.ts", 'import "../shared/screens/rules/menus.json";'],
  ["src/shared/index.ts", 'export { X } from "./screens/catalog.ts";'],
  ["src/shared/index.ts", 'export * from "./screens/index.ts";'],
  ["src/shared/screens/identify.ts", 'import { X } from "./catalog.ts";'],
  ["src/shared/screens/identify.ts", 'import { X } from "./index.ts";'],
  ["src/keeper/a.ts", 'import { X } from "../shared/screens/catalog.ts";'],
])("the scan catches, in %s: %s", (file, line) => {
  expect(catalogLoads(file, line)).not.toEqual([]);
});

test.each([
  ["src/keeper/a.ts", 'import { X } from "../shared/screens/index.ts";'],
  ["src/main/a.ts", 'import { X } from "../shared/screens/index.ts";'],
  ["src/renderer/a.ts", 'import { X } from "../shared/screens/identify.ts";'],
])("the scan allows, in %s: %s", (file, line) => {
  expect(catalogLoads(file, line)).toEqual([]);
});
