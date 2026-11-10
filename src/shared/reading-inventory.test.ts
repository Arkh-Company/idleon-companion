// The inventory script run as after a game patch, over an invented state (FR-004, FR-022). Every name here is made up.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

const state = {
  attrs: {
    UserInfo: ["Zorblax"],
    InventedPiece: 1,
    PlayerDATABASE: { $m: { Zorblax: { $m: { InventedSubkey: 1 } } } },
  },
};

test("prints a new piece with +, a row the state lacks with - and no character", () => {
  const file = join(mkdtempSync(join(tmpdir(), "inventory-")), "state.json");
  writeFileSync(file, JSON.stringify(state));
  const lines = execFileSync(
    process.execPath,
    ["scripts/reading-inventory.ts", file],
    { encoding: "utf8" },
  ).split(/\r?\n/);
  expect(lines).toContain("+ InventedPiece");
  expect(lines).toContain("+ Personagem.InventedSubkey");
  expect(lines).toContain("- Cards");
  expect(lines.join("\n")).not.toContain("Zorblax");
});
