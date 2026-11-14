// The calculator is one bundle, `calculator.js`, started as a worker: a dynamic `import()` would load a chunk the
// packaged app may not have next to it (lesson 004-4). A scan of the source text, like no-network.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const DIR = import.meta.dirname;
const DYNAMIC_IMPORT = /\bimport\s*\(/;

const sources = readdirSync(DIR, { recursive: true, encoding: "utf8" })
  .map((f) => f.replaceAll("\\", "/"))
  .filter(
    (f) =>
      /\.(?:tsx?|c?js|mjs)$/.test(f) &&
      !/\.test\.tsx?$/.test(f) &&
      !f.startsWith("fixtures/"),
  )
  .map((f) => ({ file: f, text: readFileSync(join(DIR, f), "utf8") }));

test("the scan reads the calculator's code", () => {
  const files = sources.map((s) => s.file);
  for (const f of ["index.ts", "engine.ts", "context.js"])
    expect(files).toContain(f);
});

test("no file of the calculator imports at run time", () => {
  expect(
    sources.filter((s) => DYNAMIC_IMPORT.test(s.text)).map((s) => s.file),
  ).toEqual([]);
});

test.each([
  'const m = await import("acorn");',
  "import ('./x.ts')",
  "return import(name);",
])("the scan catches %s", (line) => {
  expect(DYNAMIC_IMPORT.test(line)).toBe(true);
});

test.each(['import { parse } from "acorn";', 'import type { X } from "./x";'])(
  "a static import passes: %s",
  (line) => {
    expect(DYNAMIC_IMPORT.test(line)).toBe(false);
  },
);
