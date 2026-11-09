// Shape checks of what reaches the main process: the window's IPC payloads and the keeper's link readings. Nothing
// from either is used before it passes here. No electron import, so tests can load it.
import { win32 } from "node:path";
import { isObject, toReading } from "../shared/index.ts";
import type {
  GameTables,
  Reading,
  Settings,
  StatePath,
  StateSlice,
  Status,
} from "../shared/index.ts";

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

/** A channel without a body (`settings:get`, `reader:confirm-attach`, `steam:state`, `steam:setup`,
 * `reader:release`, `reader:reconnect`, `update:install`): only a missing body or an empty object passes. */
export function emptyPayload(v: unknown): boolean {
  return v === undefined || (isObject(v) && Object.keys(v).length === 0);
}

/** The body of a `reading` link message, with the keeper's time; null when its shape is not a Reading's. */
export function linkReading(v: unknown): Reading | null {
  return isObject(v) && typeof v.t === "number" ? toReading(v, v.t) : null;
}

const isText = (x: unknown) => typeof x === "string";

/** The body of a `tables` link message: a table out of shape counts as unread (null), for that table only. */
export function linkTables(v: unknown): GameTables {
  const body = isObject(v) ? v : {};
  const { maps, monsters } = body;
  return {
    maps: Array.isArray(maps) && maps.every(isText) ? maps : null,
    monsters:
      isObject(monsters) && Object.values(monsters).every(isText)
        ? (monsters as Record<string, string>)
        : null,
  };
}

// Tied to Status: a new game or reader state fails to compile until it is listed here.
const GAMES = {
  running: true,
  closed: true,
  "not-launched": true,
} satisfies Record<Status["game"], true>;
const READERS = {
  attached: true,
  connecting: true,
  error: true,
  released: true,
} satisfies Record<Status["reader"], true>;
const oneOf = (set: object, v: unknown) =>
  typeof v === "string" && Object.hasOwn(set, v);

/** The body of a `status` link message with only the Status fields; null when one is out of shape. */
export function linkStatus(v: unknown): Status | null {
  if (!isObject(v) || !oneOf(GAMES, v.game) || !oneOf(READERS, v.reader))
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

const isPath = (x: unknown): x is StatePath =>
  Array.isArray(x) && (x.length === 1 || x.length === 2) && x.every(isText);

/** The body of a `state` link message with only the slice's fields; null when one is out of shape. The `value` of a
 * piece is not inspected: it is only data for the calculator. */
export function linkState(v: unknown): StateSlice | null {
  if (!isObject(v)) return null;
  const { sentinel, pieces, at, cycles } = v;
  if (!isObject(sentinel) || !isObject(cycles) || !Array.isArray(pieces))
    return null;
  const { char, map } = sentinel;
  const { formula, all } = cycles;
  if (
    (char !== null && typeof char !== "string") ||
    typeof map !== "number" ||
    typeof at !== "number" ||
    typeof formula !== "number" ||
    typeof all !== "number" ||
    !pieces.every((p: unknown) => isObject(p) && isPath(p.path))
  )
    return null;
  return {
    sentinel: { char, map },
    pieces: (pieces as StateSlice["pieces"]).map(({ path, value }) => ({
      path,
      value,
    })),
    at,
    cycles: { formula, all },
  };
}

/** The body of a `gameFiles` link message: an absolute path to a folder named `resources`, else null. */
export function linkGameFiles(v: unknown): string | null {
  return typeof v === "string" &&
    win32.isAbsolute(v) &&
    win32.basename(v).toLowerCase() === "resources"
    ? v
    : null;
}
