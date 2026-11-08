// The real round: each photo's captured state gives the name the game showed (FR-020, SC-001).
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { identifyScreen, SCREEN_CATALOG, toReading } from "../index.ts";
import type { Reading, ScreenCatalog, ScreenRule } from "../index.ts";

interface Captured {
  photo: string;
  reading: Reading;
  expected: string;
}

const CAPTURED: Captured[] = readFileSync(
  new URL("./fixtures/captured-states.jsonl", import.meta.url),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as Captured);

const reading = ({ photo, reading: r }: Captured): Reading => {
  const checked = toReading(r, 0);
  if (!checked) throw new Error(`Photo ${photo} is not a Reading`);
  return checked;
};

// ponytail: a cave with its window closed is menu2 0, but its rules come with window 69, in Phase 4.
const inScope = ({ reading: r }: Captured) =>
  r.menu2 <= 45 && !(r.menu2 === 0 && (r.hole ?? -1) >= 0);

test.each(CAPTURED.filter(inScope).map((c) => [c.photo, c] as const))(
  "photo %s gives its name",
  (_, captured) => {
    expect(identifyScreen(reading(captured), SCREEN_CATALOG)).toBe(
      captured.expected,
    );
  },
);

const alone = (rule: ScreenRule): ScreenCatalog => ({
  overlays: [],
  screens: [rule],
  unprovenWindows: [],
});
const size = (rule: ScreenRule) => Object.keys(rule.when).length;

/** The rules of the deciding list that match, most conditions first. */
function matches(r: Reading): ScreenRule[] {
  for (const list of [SCREEN_CATALOG.overlays, SCREEN_CATALOG.screens]) {
    const found = list.filter(
      (rule) => identifyScreen(r, alone(rule)) !== "Unknown screen",
    );
    if (found.length > 0) return found.toSorted((a, b) => size(b) - size(a));
  }
  return [];
}

test.each(CAPTURED.map((c) => [c.photo, c] as const))(
  "photo %s ends in no tie",
  (_, captured) => {
    const [first, second] = matches(reading(captured));
    if (first && second) expect(size(first)).toBeGreaterThan(size(second));
  },
);

test.each(CAPTURED.map((c) => [c.photo, c] as const))(
  "photo %s carries no player name",
  (_, { reading: r }) => {
    expect([null, "Tester"]).toContain(r.char);
    expect(r.codexSel).toBeNull();
  },
);

test("every line is a Reading", () => {
  expect(CAPTURED.length).toBeGreaterThan(0);
  for (const captured of CAPTURED) {
    expect(toReading(captured.reading, 0), captured.photo).not.toBeNull();
  }
});
