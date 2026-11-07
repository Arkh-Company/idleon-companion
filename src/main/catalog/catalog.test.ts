import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { Catalog, Reading } from "../../shared/index.ts";
import {
  DEFAULT_CATALOG,
  catalogKey,
  loadCatalog,
  nameEntry,
  saveCatalog,
  unnamedIn,
} from "./catalog.ts";

const def: Catalog = {
  version: 1,
  menu: {
    "0": { name: "None", status: "deduced" },
    "3": { name: "Codex", status: "confirmed" },
  },
  menu2: {
    "0": { name: "None", status: "deduced" },
    "44": { name: "Sailing", status: "deduced" },
  },
  codex: { "0": { name: "Quests", status: "deduced" } },
  quickref: {},
  maps: ["Blunder Hills"],
  afk: {},
};

const base: Reading = {
  t: 1,
  map: 0,
  menu: 0,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: "Darkhe",
  afk: null,
  codexTab: null,
  codexSel: null,
};

function tempFile(): string {
  return join(mkdtempSync(join(tmpdir(), "idleon-catalog-")), "names.json");
}

test("catalog keys keep the fraction of a Quik Ref shortcut", () => {
  expect(catalogKey(0.1)).toBe("0.1");
  expect(catalogKey(0.78)).toBe("0.78");
  expect(catalogKey(44)).toBe("44");
});

test("an invalid user file falls back to the default and is kept as .bad", () => {
  const file = tempFile();
  writeFileSync(file, "{");

  expect(loadCatalog(file, def)).toBe(def);
  expect(existsSync(`${file}.bad`)).toBe(true);
  expect(existsSync(file)).toBe(false);
});

test("a missing user file gives the default and no .bad", () => {
  const file = tempFile();

  expect(loadCatalog(file, def)).toBe(def);
  expect(existsSync(`${file}.bad`)).toBe(false);
});

test("valid JSON with the wrong shape falls back to the default and is kept as .bad", () => {
  const file = tempFile();
  writeFileSync(file, JSON.stringify({ ...def, version: 2 }));

  expect(loadCatalog(file, def)).toBe(def);
  expect(existsSync(`${file}.bad`)).toBe(true);
});

test("a valid user file is loaded", () => {
  const file = tempFile();
  const user = nameEntry(def, "menu2", "999", "Test");
  writeFileSync(file, JSON.stringify(user));

  expect(loadCatalog(file, def)).toEqual(user);
});

test("naming an entry confirms it without changing the catalog it came from", () => {
  const named = nameEntry(def, "menu2", "999", "Test");

  expect(named.menu2["999"]).toEqual({ name: "Test", status: "confirmed" });
  expect(def.menu2["999"]).toBeUndefined();
});

test("saving keeps the previous file as .bak", () => {
  const file = join(
    mkdtempSync(join(tmpdir(), "idleon-catalog-")),
    "new-folder",
    "names.json",
  );
  const second = nameEntry(def, "menu2", "999", "Test");

  saveCatalog(file, def);
  saveCatalog(file, second);

  expect(readFileSync(`${file}.bak`, "utf8")).toContain('"version":1');
  expect(JSON.parse(readFileSync(`${file}.bak`, "utf8"))).toEqual(def);
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(second);
});

test("numbers missing from the catalog are reported as unnamed", () => {
  expect(unnamedIn(def, { ...base, menu: 3, menu2: 999, codexTab: 9 })).toEqual(
    [
      { table: "menu2", key: "999" },
      { table: "codex", key: "9" },
    ],
  );
});

test("a menu missing from the catalog is unnamed, fractional keys included", () => {
  expect(unnamedIn(def, { ...base, menu: 7 })).toEqual([
    { table: "menu", key: "7" },
  ]);
  expect(unnamedIn(def, { ...base, menu: 0.5 })).toEqual([
    { table: "menu", key: "0.5" },
  ]);
});

test("no window and a closed Codex add nothing to unnamed", () => {
  expect(unnamedIn(def, { ...base, menu: 0, menu2: 0, codexTab: 9 })).toEqual(
    [],
  );
});

test("the default catalog is valid and in English", () => {
  const all = [
    ...Object.values(DEFAULT_CATALOG.menu),
    ...Object.values(DEFAULT_CATALOG.menu2),
    ...Object.values(DEFAULT_CATALOG.codex),
    ...Object.values(DEFAULT_CATALOG.quickref),
  ];

  expect(DEFAULT_CATALOG.version).toBe(1);
  expect(all.filter((e) => /[À-ÿ]|\(\?\)/.test(e.name))).toEqual([]);
  expect(DEFAULT_CATALOG.menu2["2"]).toEqual({
    name: "Anvil",
    status: "confirmed",
  });
  expect(DEFAULT_CATALOG.menu2["4"]).toEqual({
    name: "Tournament",
    status: "deduced",
  });
  expect(DEFAULT_CATALOG.menu2["66"]).toEqual({
    name: "The Hole",
    status: "confirmed",
  });
  expect(DEFAULT_CATALOG.menu["0.1"]?.name).toBe("Quik Ref shortcut (Anvil)");
});
