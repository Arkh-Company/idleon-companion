// The real catalog against its rules (SC-004, SC-006, FR-002, FR-004). Character names here are invented canaries.
import { expect, test } from "vitest";
import { ACTIONS_GROUP, catalogProblems } from "./reading-catalog-rules.ts";
import { CATALOG, classOf, groupOf } from "./reading-catalog.ts";
import { NUMBER_IDS, STATE_EXCLUDED } from "./state.ts";

const fast = CATALOG.filter((r) => r.reading === "rápida");
const PREFIXES = ["DNSM", "Personagem", "OutrosPersonagens", "_vars"];
const CANARIES = ["Aria", "Bruno", "Hero", "Mate", "Sidekick", "Zorblax"];
const INVENTED_DATABASE = { $m: { Aria: {}, Bruno: {}, Zorblax: {} } };

test("the catalog obeys its rules for the numbers shown", () => {
  expect(catalogProblems(CATALOG, NUMBER_IDS)).toEqual([]);
});

test("every row has every column filled", () => {
  expect(CATALOG.length).toBeGreaterThan(0);
  for (const row of CATALOG) {
    expect(Number.isInteger(row.bytes) && row.bytes >= 0).toBe(true);
    expect(Object.values(row).filter((cell) => cell === "")).toEqual([]);
  }
});

test("the fast reading has 97 rows, 13 of them in the actions group", () => {
  expect(fast).toHaveLength(97);
  expect(CATALOG.filter((r) => r.group === ACTIONS_GROUP)).toHaveLength(13);
  expect(fast.filter((r) => r.group === ACTIONS_GROUP)).toHaveLength(13);
});

test("a row name is a key or one known prefix and a key", () => {
  const bad = CATALOG.map((r) => r.name.split(".")).filter(
    (parts) =>
      parts.length > 2 ||
      (parts.length === 2 && !PREFIXES.includes(parts[0] ?? "")),
  );
  expect(bad).toEqual([]);
});

test("no cell of the catalog has a canary character name", () => {
  const words = new RegExp(`\\b(${CANARIES.join("|")})\\b`);
  const cells = CATALOG.flatMap((r) => Object.values(r).flat().map(String));
  expect(cells.filter((c) => words.test(c))).toEqual([]);
});

test("no row is named after a character", () => {
  const characters = Object.keys(INVENTED_DATABASE.$m);
  expect(CATALOG.filter((r) => characters.includes(r.name))).toEqual([]);
});

test("no excluded key is in the fast reading", () => {
  expect(fast.filter((r) => STATE_EXCLUDED.includes(r.name))).toEqual([]);
});

test("the classes and groups of the shared API use the catalog", () => {
  const actions = fast.find((r) => r.group === ACTIONS_GROUP);
  expect(actions).toBeDefined();
  expect(classOf([actions?.name ?? ""], null)).toBe("fast");
  expect(groupOf([actions?.name ?? ""], null)).toBe(ACTIONS_GROUP);
  expect(classOf(["NotInTheCatalog"], null)).toBe("slow");
  expect(groupOf(["NotInTheCatalog"], null)).toBeNull();
});
