// Shape checks of what reaches the main process: the window's IPC payloads and the keeper's link readings. Nothing
// from either is used before it passes here. No electron import, so tests can load it.
import { win32 } from "node:path";
import {
  isCatalogId,
  isObject,
  MAX_PINS,
  toReading,
  TREE_CATALOG,
} from "../shared/index.ts";
import { MAX_NODE_ID } from "./tree-check.ts";
import type {
  GameTables,
  Pin,
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

/** `formula:request` (contracts/ipc.md): a catalog number, for the active character (null) or one by its number. */
export type FormulaRequest =
  { id: string; character: number | null } | { treeId: string; nodeId: string };

const onlyKeys = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
const isNodeId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= MAX_NODE_ID;

/** A character's number: whole, not negative, and written whole as a key of a saved file. */
const isCharacter = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0;

/** `formula:request`: the id is checked against the catalog before anything reaches a worker (CHK015). */
export function formulaRequestPayload(v: unknown): FormulaRequest | null {
  if (!isObject(v)) return null;
  if (onlyKeys(v, ["id", "character"])) {
    const { id, character } = v;
    if (!isCatalogId(id)) return null;
    if (character === undefined) return { id, character: null };
    return isCharacter(character) ? { id, character } : null;
  }
  if (onlyKeys(v, ["treeId", "nodeId"])) {
    const { treeId, nodeId } = v;
    return isNodeId(treeId) && isNodeId(nodeId) ? { treeId, nodeId } : null;
  }
  return null;
}

/** `formula:values` (contracts/ipc.md): what is in view, catalog ids each once, at most the whole catalog (CHK015). */
export function formulaValuesPayload(v: unknown): { ids: string[] } | null {
  if (!isObject(v) || !onlyKeys(v, ["ids"])) return null;
  const { ids } = v;
  return Array.isArray(ids) &&
    ids.length <= TREE_CATALOG.length &&
    new Set(ids).size === ids.length &&
    ids.every(isCatalogId)
    ? { ids }
    : null;
}

/** `feeds:list` (FR-027): only `{ pieceKey }`, a key as long as a node's id at most. */
export function feedsListPayload(v: unknown): { pieceKey: string } | null {
  return isObject(v) && onlyKeys(v, ["pieceKey"]) && isNodeId(v.pieceKey)
    ? { pieceKey: v.pieceKey }
    : null;
}

/** The longest name of a mark (FR-037). */
export const MAX_MARK_NAME = 40;

/** `marks:list`: only `{ character }`. */
export function marksListPayload(v: unknown): { character: number } | null {
  return isObject(v) && onlyKeys(v, ["character"]) && isCharacter(v.character)
    ? { character: v.character }
    : null;
}

/** `marks:save` and `marks:clear` (contracts/ipc.md): a character's number and a name of 1 to 40 characters, trimmed. */
export function markPayload(
  v: unknown,
): { character: number; name: string } | null {
  if (!isObject(v) || !onlyKeys(v, ["character", "name"])) return null;
  const { character, name } = v;
  if (!isCharacter(character) || typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_MARK_NAME
    ? { character, name: trimmed }
    : null;
}

/**
 * `pins:set` (contracts/ipc.md), and each pin read from `pins.json`: up to 5 catalog numbers, each once, nothing else in
 * a pin (never a value).
 */
export function pinsPayload(v: unknown): Pin[] | null {
  if (!Array.isArray(v) || v.length > MAX_PINS) return null;
  const pins: Pin[] = [];
  for (const p of v) {
    // ponytail: numbers only; a leaf's `nodeId` once the tree has a Pin per row (FR-026).
    if (
      !isObject(p) ||
      !onlyKeys(p, ["treeId", "nodeId"]) ||
      !isCatalogId(p.treeId) ||
      p.nodeId !== null
    )
      return null;
    pins.push({ treeId: p.treeId, nodeId: null });
  }
  return new Set(pins.map((p) => p.treeId)).size === pins.length ? pins : null;
}

/** `window:sidePanel` (contracts/ipc.md): only `{ open }`, a yes or no. */
export function sidePanelPayload(v: unknown): { open: boolean } | null {
  if (!isObject(v) || !onlyKeys(v, ["open"]) || typeof v.open !== "boolean")
    return null;
  return { open: v.open };
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

/** One or two levels, or the third of a character's subkey, the only one that has it. */
const isPath = (x: unknown): x is StatePath =>
  Array.isArray(x) &&
  (x.length === 1 ||
    x.length === 2 ||
    (x.length === 3 && x[0] === "PlayerDATABASE")) &&
  x.every(isText);

/** The body of a `state` link message with only the slice's fields; null when one is out of shape. The `value` of a
 * piece is not inspected: it is only data for the calculator. */
export function linkState(v: unknown): StateSlice | null {
  if (!isObject(v)) return null;
  const { sentinel, pieces, at, cycles } = v;
  if (!isObject(sentinel) || !isObject(cycles) || !Array.isArray(pieces))
    return null;
  const { char, map } = sentinel;
  const { fast, all } = cycles;
  if (
    (char !== null && typeof char !== "string") ||
    typeof map !== "number" ||
    typeof at !== "number" ||
    typeof fast !== "number" ||
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
    cycles: { fast, all },
  };
}

/** The body of a `gameFiles` link message: a path on a drive to a folder named `resources`, else null. */
export function linkGameFiles(v: unknown): string | null {
  return typeof v === "string" &&
    /^[a-z]:[\\/]/i.test(v) &&
    win32.basename(v).toLowerCase() === "resources"
    ? v
    : null;
}
