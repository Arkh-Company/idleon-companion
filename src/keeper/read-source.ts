// Loads read.js as the text the reader sends to the game (Runtime.callFunctionOn's functionDeclaration).
import { readFileSync } from "node:fs";

/**
 * The file without its whole-line `//` comments and its final `;` (Prettier adds it; Runtime.callFunctionOn wraps
 * the declaration in parentheses, where it is a syntax error), trimmed.
 */
export function loadReadSource(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim()
    .replace(/;$/, "");
}
