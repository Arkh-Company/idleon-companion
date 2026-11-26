// The game's curve block (`ArbitraryCode5Inputs(kind, x1, x2, x3)`) as a branch (spec 008, FR-015a): its pure formulas
// live in recorded/curves.ts, shared with the declared trees (spec 010); here the port of pieces.cjs `curveRow0`, the
// caller's read with the same value as the curve's input, from the bench at BASELINE-4.
export {
  curveConstants,
  curveFormula,
  curveOf,
  curvePart,
  curveText,
  fx3,
  maxReachedOf,
} from "../recorded/curves.ts";
export type { Curve } from "../recorded/curves.ts";

/**
 * pieces.cjs `curveRow0` with `valName`: the caller's read that holds the curve's input. Nothing names it (null) when the
 * caller's own working value holds it (DEEP3-FIX-1b), or when several of the other reads hold it, counted before
 * `valName` leaves out the ` contains ` and RANDOlist[53] reads.
 */
export function inputRead(
  x3: number,
  reads: readonly (readonly [string, unknown, ...unknown[]])[],
  own: ReadonlySet<string>,
): string | null {
  const holds = (x: unknown) =>
    typeof x === "number" &&
    Math.abs(x - x3) <= 1e-9 * Math.max(1, Math.abs(x3));
  if (reads.some(([p, x]) => own.has(p) && holds(x))) return null;
  const hits = reads.filter(
    ([p, x]) => !own.has(p) && holds(x) && !p.endsWith(".length"),
  );
  if (hits.length > 1) return null;
  const pick = hits.find(
    ([p]) =>
      !p.includes(" contains ") && !/^(CustomLists\.)?RANDOlist\[53\]/.test(p),
  );
  return pick?.[0] ?? null;
}
