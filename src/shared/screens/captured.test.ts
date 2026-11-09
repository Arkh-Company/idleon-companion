// The real round: each photo's captured state gives the name the game showed (FR-020, SC-001).
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  identifyScreen,
  READ_NULLS,
  SCREEN_CATALOG,
  toReading,
} from "../index.ts";
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

test.each(CAPTURED.map((c) => [c.photo, c] as const))(
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

test("a rule's photo proof is a state the rule matches", () => {
  const photos = new Map(CAPTURED.map((c) => [c.photo, c]));
  let checked = 0;
  for (const rule of [...SCREEN_CATALOG.overlays, ...SCREEN_CATALOG.screens]) {
    const [kind, id] = rule.proof.split(":");
    if (kind !== "foto" || !id) continue;
    const captured = photos.get(id);
    if (!captured) {
      // Row 0405 of section 7 is "inconclusivo", so it stays out of the fixture.
      expect(id, rule.proof).toBe("0405");
      continue;
    }
    checked++;
    // Section 7 of the screen map: "Holes[0] continua valendo com a janela 69 fechada". A cave's photo proves the cave
    // in both states, and caves 1, 2, 3, 5 and 12 were only ever photographed with the window open.
    if (Object.hasOwn(rule.when, "hole")) {
      expect(captured.reading.hole, rule.proof).toBe(rule.when.hole);
      continue;
    }
    expect(
      identifyScreen(reading(captured), alone(rule)),
      `${rule.proof} does not match "${rule.name}"`,
    ).not.toBe("Unknown screen");
  }
  expect(checked).toBeGreaterThan(0);
});

const CAVES = [
  "The Well",
  "Motherlode",
  "The Den",
  "Bravery",
  "The Bell",
  "The Harp",
  "The Lamp",
  "The Hive",
  "Grotto",
  "Justice",
  "The Jars",
  "Evertree",
  "Wisdom",
  "Gambit",
  "Temple",
  "Fountain",
  "Trench",
  "The Lair",
];

const state = (fields: Partial<Reading>): Reading => ({
  ...READ_NULLS,
  map: 1,
  menu: 0,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: null,
  afk: null,
  codexTab: null,
  t: 0,
  ...fields,
});

test.each(CAVES.map((name, hole) => [hole, name] as const))(
  "cave %i is named with the window closed and open: %s",
  (hole, name) => {
    for (const menu2 of [0, 69])
      expect(identifyScreen(state({ menu2, hole }), SCREEN_CATALOG)).toBe(name);
  },
);

test("outside a cave the screen with no window is None", () => {
  expect(identifyScreen(state({ hole: -1 }), SCREEN_CATALOG)).toBe("None");
});

test("another window opened inside a cave names that window", () => {
  expect(identifyScreen(state({ menu2: 72, hole: 3 }), SCREEN_CATALOG)).toBe(
    "The Upgrade Vault",
  );
});

test("window 64 is Orion, not The Hole", () => {
  expect(identifyScreen(state({ menu2: 64 }), SCREEN_CATALOG)).toBe("Orion");
});

test.each([53, 58, 75])("window %i has no proven name", (menu2) => {
  expect(identifyScreen(state({ menu2 }), SCREEN_CATALOG)).toBe(
    "Unknown screen",
  );
});

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
