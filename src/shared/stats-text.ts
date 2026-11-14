// How the Stats writes each of its numbers, as the game writes it: the Stats tab (main) and the Formulas tab (window)
// show the same text (FR-019 and FR-002 of 008).
import type { CalcNumbers } from "./state.ts";

const TRILLION = 1e12;
const E_FROM = 1e15;
const separated = (n: number) => n.toLocaleString("en-US");

/** The mantissa is cut, not rounded: the game shows 1.499e33 as 1.49E33. */
function eNotation(n: number): string {
  const [mantissa = "", exponent] = n.toExponential().split("e");
  const [whole, decimals = ""] = mantissa.split(".");
  return `${whole ?? ""}.${decimals.padEnd(2, "0").slice(0, 2)}E${String(Number(exponent))}`;
}

/** Rounds up by default; `round` is for the numbers the game cuts instead (Drop Rate). */
export function formatNumber(
  n: number,
  round: (x: number) => number = Math.ceil,
): string {
  if (n >= E_FROM) return eNotation(n);
  if (n >= TRILLION) return `${separated(round(n / TRILLION))}T`;
  return separated(round(n));
}

/** Each number as its Stats row writes it: the tree's root uses the same text (FR-019 of 008). */
export const STATS_NUMBERS: Record<
  keyof CalcNumbers,
  { label: string; text: (v: number) => string }
> = {
  // The game cuts it: 2,797,522.9 shows as 2,797,522x.
  dropRate: {
    label: "Drop Rate",
    text: (v) => `${formatNumber(v, Math.trunc)}x`,
  },
  damageMin: { label: "Damage (min)", text: (v) => formatNumber(v) },
  damageMax: { label: "Damage (max)", text: (v) => formatNumber(v) },
  hp: { label: "HP", text: (v) => formatNumber(v) },
  mp: { label: "MP", text: (v) => formatNumber(v) },
  str: { label: "STR", text: (v) => formatNumber(v) },
  agi: { label: "AGI", text: (v) => formatNumber(v) },
  wis: { label: "WIS", text: (v) => formatNumber(v) },
  luk: { label: "LUK", text: (v) => formatNumber(v) },
  accuracy: { label: "Accuracy", text: (v) => eNotation(v) },
  afkGains: {
    label: "AFK Gains",
    // toFixed: 1.1 * 100 is 110.00000000000001, which would round up to 111.
    text: (v) => `${formatNumber(Number((v * 100).toFixed(6)))}%`,
  },
};

/** The label and the text of one Stats number; null for an id that is not one of them. */
export function statsNumber(
  id: string,
): { label: string; text: (v: number) => string } | null {
  return Object.hasOwn(STATS_NUMBERS, id)
    ? STATS_NUMBERS[id as keyof CalcNumbers]
    : null;
}

/** A catalog number as its tree's root writes it: the Stats row's text, or the number itself (FR-019 of 008). */
export function rootText(id: string, v: number): string {
  return statsNumber(id)?.text(v) ?? String(v);
}
