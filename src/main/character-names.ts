// The characters' names of a mosaic, and whether a text holds one: what a saved file, a log or a test must never get
// (spec 008 FR-010a). No electron import, so tests can load it.
import { isObject } from "../shared/index.ts";

/** The mosaic's active character and list of characters' names, with its attrs; null when it has neither. */
export function players(mosaicJson: string): {
  info: unknown[];
  names: unknown[];
  attrs: Record<string, unknown>;
} | null {
  try {
    const parsed: unknown = JSON.parse(mosaicJson);
    const attrs = isObject(parsed) ? parsed.attrs : null;
    if (!isObject(attrs)) return null;
    const { UserInfo: info, GetPlayersUsernames: names } = attrs;
    return Array.isArray(info) && Array.isArray(names)
      ? { info, names, attrs }
      : null;
  } catch {
    return null;
  }
}

/** The characters' names of the mosaic: what a saved file must never get (FR-010a). */
export const namesOf = (mosaicJson: string): string[] =>
  (players(mosaicJson)?.names ?? []).filter(
    (n): n is string => typeof n === "string",
  );

/** Whether `text` holds a character's name anywhere, any case: what a saved file must never get (FR-010a). */
export const holdsName = (text: string, names: readonly string[]) => {
  const lower = text.toLowerCase();
  return names.some((n) => n !== "" && lower.includes(n.toLowerCase()));
};

/** Whether `text` has a character's name as a whole word, any case. */
export const hasName = (text: string, names: readonly string[]) => {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}_]+/u);
  return names.some((n) => words.includes(n.toLowerCase()));
};
