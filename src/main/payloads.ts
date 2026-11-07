// Shape checks of what reaches the main process: the window's IPC payloads and the keeper's link readings. Nothing
// from either is used before it passes here. No electron import, so tests can load it.
import { toReading } from "../shared/index.ts";
import type {
  CatalogTable,
  Reading,
  Settings,
  Status,
} from "../shared/index.ts";
import { catalogKey } from "./catalog/catalog.ts";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const TABLES: readonly unknown[] = ["menu", "menu2", "codex"];

/** `catalog:name`: a known table, the catalog key of a finite number, a non-blank name (trimmed). */
export function namePayload(
  v: unknown,
): { table: CatalogTable; key: string; name: string } | null {
  if (!isObject(v) || !TABLES.includes(v.table)) return null;
  const { key, name } = v;
  if (typeof key !== "string" || typeof name !== "string") return null;
  const n = Number(key);
  if (!Number.isFinite(n) || catalogKey(n) !== key) return null;
  if (name.trim() === "") return null;
  return { table: v.table as CatalogTable, key, name: name.trim() };
}

/** `settings:set`: the three booleans, nothing else kept. */
export function settingsPayload(v: unknown): Settings | null {
  if (!isObject(v)) return null;
  const { showWindowOnGameStart, closeWithGame, alwaysOnTop } = v;
  if (
    typeof showWindowOnGameStart !== "boolean" ||
    typeof closeWithGame !== "boolean" ||
    typeof alwaysOnTop !== "boolean"
  )
    return null;
  return { showWindowOnGameStart, closeWithGame, alwaysOnTop };
}

/** The body of a `reading` link message, with the keeper's time; null when its shape is not a Reading's. */
export function linkReading(v: unknown): Reading | null {
  return isObject(v) && typeof v.t === "number" ? toReading(v, v.t) : null;
}

const GAMES: readonly unknown[] = ["running", "closed", "not-launched"];
const READERS: readonly unknown[] = ["attached", "connecting", "error"];

/** The body of a `status` link message with only the Status fields; null when one is out of shape. */
export function linkStatus(v: unknown): Status | null {
  if (!isObject(v) || !GAMES.includes(v.game) || !READERS.includes(v.reader))
    return null;
  const { message, lastReadingAt } = v;
  if (message !== undefined && typeof message !== "string") return null;
  if (lastReadingAt !== undefined && typeof lastReadingAt !== "number")
    return null;
  const s: Status = {
    game: v.game as Status["game"],
    reader: v.reader as Status["reader"],
  };
  if (message !== undefined) s.message = message;
  if (lastReadingAt !== undefined) s.lastReadingAt = lastReadingAt;
  return s;
}
