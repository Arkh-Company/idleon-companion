// The version band (spec 008 FR-018; design.md C18): the names and tags of the trees were checked on one game's code,
// the N.js, known by its sha256 as the keeper's update watch hashes it. Another code shows one band over the tree; the
// values stay live.
import { createHash } from "node:crypto";

/**
 * The sha256 of the N.js the name and type rules were checked on: the bench's BASELINE-4, the version of its 007 index
 * the names table was exported over (T023, names-static.json `njsIndex`). Null would show the band on every tree.
 */
export const RULES_GAME_SHA: string | null =
  "0e47e87bbe36198cbecc41943ea3cd8949f51e9350a4c125d67e3b7de9771ba4";

export function versionBand(rulesSha: string | null = RULES_GAME_SHA): {
  /** The game's code, as the tree host read it. */
  /** The game's code, as the tree host read it; gives its sha256. */
  read(code: Uint8Array): string;
  checked: () => boolean;
} {
  let gameSha: string | null = null;
  return {
    read(code) {
      const sha = createHash("sha256").update(code).digest("hex");
      gameSha = sha;
      return sha;
    },
    checked: () => gameSha !== null && gameSha === rulesSha,
  };
}
