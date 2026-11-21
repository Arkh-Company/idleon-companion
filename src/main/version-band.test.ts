// The version band (spec 008 FR-018; design.md C18): the names and tags were checked on one game's code, and only the
// same code, by its sha256, hides the band. The bytes here are invented.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { RULES_GAME_SHA, versionBand } from "./version-band.ts";

const CODE = new TextEncoder().encode("an invented game code");
const SHA = createHash("sha256").update(CODE).digest("hex");

test("the game code the rules were checked on hides the band", () => {
  const band = versionBand(SHA);
  expect(band.read(CODE)).toBe(SHA); // the version the tree shapes are saved for (FR-027)
  expect(band.checked()).toBe(true);
});

test("another game code shows the band", () => {
  const band = versionBand(SHA);
  band.read(new TextEncoder().encode("the invented game, patched"));
  expect(band.checked()).toBe(false);
});

test("no game code read yet, or rules with no checked version, show the band", () => {
  expect(versionBand(SHA).checked()).toBe(false);
  const unchecked = versionBand(null);
  unchecked.read(CODE);
  expect(unchecked.checked()).toBe(false);
});

test("the rules' version is the N.js the names table was checked on", () => {
  // read as a file: the main never imports the calculator
  const table = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "../calculator/names/names-static.json"),
      "utf8",
    ),
  ) as { njsIndex: string };
  expect(RULES_GAME_SHA).toMatch(/^[0-9a-f]{64}$/);
  expect(RULES_GAME_SHA).toBe(table.njsIndex);
});
