// After a game patch: `node scripts/reading-inventory.ts <state.json>` prints the pieces a real state has and the catalog
// does not (+), and the catalog rows that state does not have (-). Only names: no value and no character (FR-004, FR-022).
import { readFileSync } from "node:fs";
import {
  diffInventory,
  inventoryNames,
  parseCatalog,
} from "../src/shared/reading-catalog-rules.ts";

interface State {
  attrs: Record<string, unknown>;
  vars?: Record<string, unknown>;
}

const file = process.argv[2];
if (file === undefined) {
  console.error("usage: node scripts/reading-inventory.ts <state.json>");
  process.exit(1);
}
const state = JSON.parse(readFileSync(file, "utf8")) as State;
const char = (state.attrs.UserInfo as unknown[] | undefined)?.[0];
if (typeof char !== "string") {
  console.error("the state has no active character in UserInfo");
  process.exit(1);
}
const catalog = new URL("../src/shared/reading-catalog.md", import.meta.url);
const { added, gone } = diffInventory(
  parseCatalog(readFileSync(catalog, "utf8")),
  inventoryNames(state, char),
);
for (const name of added) console.log(`+ ${name}`);
for (const name of gone) console.log(`- ${name}`);
