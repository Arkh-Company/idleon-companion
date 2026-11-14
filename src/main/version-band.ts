// The version band (spec 008 FR-018; design.md C18): the names and tags of the trees were checked on one game's code,
// the N.js, known by its sha256 as the keeper's update watch hashes it. Another code shows one band over the tree; the
// values stay live.
import { createHash } from "node:crypto";

/**
 * The sha256 of the N.js the name and type rules were checked on. Null until the rules carry it (the names table of
 * the bench's BASELINE-4, T023): with no checked version, every tree shows the band.
 */
export const RULES_GAME_SHA: string | null = null;

export function versionBand(rulesSha: string | null = RULES_GAME_SHA): {
  /** The game's code, as the tree host read it. */
  read(code: Uint8Array): void;
  checked: () => boolean;
} {
  let gameSha: string | null = null;
  return {
    read(code) {
      gameSha = createHash("sha256").update(code).digest("hex");
    },
    checked: () => gameSha !== null && gameSha === rulesSha,
  };
}
