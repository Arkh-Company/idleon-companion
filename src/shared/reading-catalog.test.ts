// The real catalog against its rules (SC-004, SC-006, FR-002).
import { expect, test } from "vitest";
import {
  ACTIONS_GROUP,
  catalogProblems,
  classOf,
  groupOf,
} from "./reading-catalog-rules.ts";
import { CATALOG } from "./reading-catalog.ts";
import { NUMBER_IDS, STATE_EXCLUDED } from "./state.ts";

const fast = CATALOG.filter((r) => r.reading === "rápida");
const PREFIXES = ["DNSM", "Personagem", "OutrosPersonagens", "_vars"];

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

test("the fast reading has 98 rows, 13 of them in the actions group", () => {
  expect(fast).toHaveLength(98);
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

test("no excluded key is in the fast reading", () => {
  expect(fast.filter((r) => STATE_EXCLUDED.includes(r.name))).toEqual([]);
});

test("the classes and groups of the real catalog", () => {
  const actions = fast.find((r) => r.group === ACTIONS_GROUP);
  expect(actions).toBeDefined();
  expect(classOf(CATALOG, [actions?.name ?? ""], null)).toBe("fast");
  expect(groupOf(CATALOG, [actions?.name ?? ""], null)).toBe(ACTIONS_GROUP);
  expect(classOf(CATALOG, ["NotInTheCatalog"], null)).toBe("slow");
  expect(groupOf(CATALOG, ["NotInTheCatalog"], null)).toBeNull();
});
