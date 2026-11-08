// steam-setup.json (data-model.md SteamSetupRecord): what the companion added to each account's launch option, so
// the uninstaller takes out only that. Only the numeric account id is kept, never a name (FR-028).
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export interface SteamSetupRecord {
  /** The exact text the companion added to the option. */
  inserted: string;
  /** The option before the first setup ("" when empty), for "Details". */
  before: string;
  /** The copy of localconfig.vdf from before the companion, made once (FR-027). */
  backupFile: string;
  /** ms since 1970, of the last setup. */
  setAt: number;
}
/** Keyed by the 32-bit account id, digits only (the `userdata\<id>` folder). */
export interface SteamSetupFile {
  accounts: Record<string, SteamSetupRecord>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Only the four known fields: anything else a caller or an old file carries is not kept. */
function pick(v: unknown): SteamSetupRecord | null {
  if (!isObject(v)) return null;
  const { inserted, before, backupFile, setAt } = v;
  if (
    typeof inserted !== "string" ||
    typeof before !== "string" ||
    typeof backupFile !== "string"
  )
    return null;
  if (typeof setAt !== "number") return null;
  return { inserted, before, backupFile, setAt };
}

/** The records, or none when the file is missing or invalid (an invalid file is kept as `.bad`). A record with an id
 * that is not digits, or of the wrong shape, is dropped. */
export function loadSetup(file: string): SteamSetupFile {
  if (!existsSync(file)) return { accounts: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    parsed = undefined;
  }
  if (!isObject(parsed) || !isObject(parsed.accounts)) {
    try {
      renameSync(file, `${file}.bad`);
    } catch {
      // a locked file stays where it is: the app goes on with no records
    }
    return { accounts: {} };
  }
  const accounts: Record<string, SteamSetupRecord> = {};
  for (const [id, v] of Object.entries(parsed.accounts)) {
    const r = pick(v);
    if (/^\d+$/.test(id) && r) accounts[id] = r;
  }
  return { accounts };
}

/** Writes to `.tmp` and renames it over the file, so a failed write never leaves half a file. */
export function saveSetup(file: string, s: SteamSetupFile): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(s, null, 2)}\n`);
  renameSync(tmp, file);
}

/** A copy with the account's setup; a later setup keeps the first `before` and `backupFile` (FR-027). */
export function recordSetup(
  s: SteamSetupFile,
  accountId: string,
  rec: SteamSetupRecord,
): SteamSetupFile {
  const r = pick(rec);
  if (!r) throw new TypeError("invalid setup record");
  const prev = s.accounts[accountId];
  const next = prev
    ? { ...r, before: prev.before, backupFile: prev.backupFile }
    : r;
  return { accounts: { ...s.accounts, [accountId]: next } };
}

/** A copy without the account (its removal is done). */
export function forgetAccount(
  s: SteamSetupFile,
  accountId: string,
): SteamSetupFile {
  return {
    accounts: Object.fromEntries(
      Object.entries(s.accounts).filter(([id]) => id !== accountId),
    ),
  };
}

/** The records and copies of the companion's data folder, for the setup and removal flows. */
export function setupStoreIn(dataDir: string) {
  const file = join(dataDir, "steam-setup.json");
  return {
    load: () => loadSetup(file),
    save: (s: SteamSetupFile) => {
      saveSetup(file, s);
    },
    backupPath: (id: string) =>
      join(dataDir, "steam-backup", `${id}-localconfig.vdf`),
  };
}
