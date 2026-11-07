import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  forgetAccount,
  loadSetup,
  recordSetup,
  saveSetup,
} from "./setup-store.ts";
import type { SteamSetupFile, SteamSetupRecord } from "./setup-store.ts";

const tempFile = () =>
  join(mkdtempSync(join(tmpdir(), "setup-store-")), "steam-setup.json");

const rec: SteamSetupRecord = {
  inserted: '"C:\\x\\IdleOn Companion.exe" --keeper ',
  before: "-windowed",
  backupFile: "C:\\data\\steam-backup\\102-localconfig.vdf",
  setAt: 1000,
};

test("a missing file gives no accounts", () => {
  expect(loadSetup(tempFile())).toEqual({ accounts: {} });
});

test.each([
  ["invalid JSON", "{"],
  ["JSON that is not an object", "[1]"],
  ["accounts that is not an object", '{"accounts":[]}'],
])(
  "%s gives no accounts and is kept as steam-setup.json.bad",
  (_name, content) => {
    const file = tempFile();
    writeFileSync(file, content);
    expect(loadSetup(file)).toEqual({ accounts: {} });
    expect(existsSync(file)).toBe(false);
    expect(readFileSync(join(file, "..", "steam-setup.json.bad"), "utf8")).toBe(
      content,
    );
  },
);

test("an account id that is not digits, or a record of the wrong shape, is dropped on load", () => {
  const file = tempFile();
  writeFileSync(
    file,
    JSON.stringify({
      accounts: { "102": rec, "..\\x": rec, "103": { ...rec, setAt: "now" } },
    }),
  );
  expect(loadSetup(file)).toEqual({ accounts: { "102": rec } });
});

test("save then load gives the same file, also in a folder that did not exist", () => {
  const file = join(tempFile(), "..", "new", "steam-setup.json");
  const s: SteamSetupFile = { accounts: { "102": rec } };
  saveSetup(file, s);
  expect(loadSetup(file)).toEqual(s);
  expect(existsSync(`${file}.tmp`)).toBe(false);
});

test("save writes through .tmp: when .tmp cannot be written, the file already there stays whole", () => {
  const file = tempFile();
  const old: SteamSetupFile = { accounts: { "102": rec } };
  saveSetup(file, old);
  mkdirSync(`${file}.tmp`); // a folder where the temporary file should go

  expect(() => {
    saveSetup(file, { accounts: {} });
  }).toThrow();
  expect(loadSetup(file)).toEqual(old);
});

test("a second setup of the same account keeps the first before and backupFile (FR-027)", () => {
  const first = recordSetup({ accounts: {} }, "102", rec);
  const second = recordSetup(first, "102", {
    inserted: '"C:\\y\\IdleOn Companion.exe" --keeper ',
    before: "changed",
    backupFile: "C:\\other.vdf",
    setAt: 2000,
  });
  expect(second.accounts["102"]).toEqual({
    ...rec,
    inserted: '"C:\\y\\IdleOn Companion.exe" --keeper ',
    setAt: 2000,
  });
  expect(first.accounts["102"]).toEqual(rec); // the earlier value is not changed
});

test("forgetting an account removes only it", () => {
  const s = recordSetup(recordSetup({ accounts: {} }, "102", rec), "103", rec);
  expect(forgetAccount(s, "102")).toEqual({ accounts: { "103": rec } });
  expect(Object.keys(s.accounts)).toEqual(["102", "103"]);
});

test("the saved JSON has no name field anywhere (FR-028)", () => {
  const file = tempFile();
  const withName = { ...rec, name: "Test Two" }; // as if a caller passed the account along
  writeFileSync(
    file,
    JSON.stringify({ name: "x", accounts: { "102": withName } }),
  );
  saveSetup(file, recordSetup(loadSetup(file), "103", withName));
  expect(readFileSync(file, "utf8")).not.toContain("name");
});
