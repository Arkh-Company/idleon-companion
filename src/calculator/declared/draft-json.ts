// The draft's JSON (spec 010, research R7): already as prettier leaves it, so a draft written to TREES_OUT needs no
// format before an agent reads or copies it.
import type { DraftPiece } from "./draft-pieces.ts";
import type { DraftBlueprint } from "./draft.ts";

const flat = (v: unknown): boolean =>
  v === null || typeof v !== "object" || (Array.isArray(v) && v.every(flat));
const flatText = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(flatText).join(", ")}]` : JSON.stringify(v);

/**
 * The JSON as prettier leaves it: every object open, one key a line; a list of plain values on one line (shortcut:
 * prettier wraps such a list past 80 columns; a draft's are short, a reference's arguments or a source's classes).
 */
function pretty(v: unknown, indent: string): string {
  if (flat(v)) return flatText(v);
  const inner = `${indent}  `;
  if (Array.isArray(v))
    return `[\n${v.map((x) => inner + pretty(x, inner)).join(",\n")}\n${indent}]`;
  const entries = Object.entries(v as object).filter(
    ([, x]) => x !== undefined,
  );
  if (entries.length === 0) return "{}";
  const lines = entries.map(
    ([k, x]) => `${inner}${JSON.stringify(k)}: ${pretty(x, inner)}`,
  );
  return `{\n${lines.join(",\n")}\n${indent}}`;
}
/** The draft's own JSON: its pieces go apart (`pieceJson`, T203). */
export const draftJson = (d: DraftBlueprint): string =>
  `${pretty({ ...d, pieces: undefined }, "")}\n`;
export const pieceJson = (p: DraftPiece): string => `${pretty(p, "")}\n`;
