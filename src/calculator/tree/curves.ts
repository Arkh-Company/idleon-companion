// The game's curve block (`ArbitraryCode5Inputs(kind, x1, x2, x3)`) as a branch (spec 008, FR-015a): the port of
// pieces.cjs `fx3` [F5-NUM], `curve`, `curveFormula`, `CURVE_PART_F5` [F5-CURVE] and `curveRow0`, from the bench at
// BASELINE-4. A curve is the calculation, not a value: its two constants are fixed values named by their role, and the
// value it curves is the caller's read with the same value. The share of the maximum (FR-015a) is new in the app: only
// the two decay curves have a maximum.
import { num } from "./math.ts";

/** [F5-NUM] 3 decimals, or 3 significant digits below 0.01, so the ⓘ's line of numbers recomputes (rule 160). */
export const fx3 = (v: number): string =>
  v !== 0 && Math.abs(v) < 0.01
    ? String(+v.toPrecision(3))
    : String(+v.toFixed(3));

export type Curve = [kind: string, x1: number, x2: number, x3: number];

/** The curve's call, from its recorded arguments; null when it is not one. */
export function curveOf(block: string, args: readonly unknown[]): Curve | null {
  if (block !== "ArbitraryCode5Inputs") return null;
  const [kind, x1, x2, x3] = args;
  return typeof kind === "string" &&
    [x1, x2, x3].every((x) => typeof x === "number" && Number.isFinite(x))
    ? [kind, x1 as number, x2 as number, x3 as number]
    : null;
}

/** pieces.cjs `curve`: the curve written with its numbers ("1 + 2 × 802 ÷ (802 + 200)"). */
export function curveText([k, x1, x2, x3]: Curve): string {
  if (k === "decay")
    return `${num(x1)} × ${num(x3)} ÷ (${num(x3)} + ${num(x2)})`;
  if (k === "decayMulti")
    return `1 + ${num(x1)} × ${num(x3)} ÷ (${num(x3)} + ${num(x2)})`;
  if (k === "intervalAdd") return `${num(x1)} + floor(${num(x3)} ÷ ${num(x2)})`;
  if (k === "add")
    return x2 === 0
      ? `${num(x1)} × ${num(x3)}`
      : `${num(x3)} × (${num(x1)} + ${num(x2)} × (${num(x3)} + 1) ÷ 2)`;
  if (k === "bigBase") return `${num(x1)} + ${num(x2)} × ${num(x3)}`;
  if (k === "reduce") return `${num(x1)} − ${num(x2)} × ${num(x3)}`;
  if (k === "addDECAY")
    return x3 < 50001
      ? `${num(x1)} × ${num(x3)}`
      : `${num(x1)} × min(50000, ${num(x3)}) + (${num(x3)} − 50000) ÷ (${num(x3)} + 100000) × ${num(x1)} × 50000`;
  return k;
}

/**
 * pieces.cjs `curveFormula`: [the curve with the input's name, the curve with its numbers = value], when it gives v; with
 * `consts`, its two constants by those names too (spec 009, FR-018), else by their numbers.
 */
export function curveFormula(
  c: Curve,
  v: number,
  input: string,
  consts?: readonly [string, string],
): [string, string] | null {
  const [k, x1, x2, x3] = c;
  const L = input;
  const [A, B] = consts ?? [fx3(x1), fx3(x2)];
  const forms: Record<string, [number, string] | undefined> = {
    decay: [(x1 * x3) / (x3 + x2), `${A} × ${L} ÷ (${L} + ${B})`],
    decayMulti: [1 + (x1 * x3) / (x3 + x2), `1 + ${A} × ${L} ÷ (${L} + ${B})`],
    intervalAdd: [x1 + Math.floor(x3 / x2), `${A} + floor(${L} ÷ ${B})`],
    add:
      x2 === 0
        ? [x1 * x3, `${A} × ${L}`]
        : [
            x3 * (x1 + (x2 * (x3 + 1)) / 2),
            `${L} × (${A} + ${B} × (${L} + 1) ÷ 2)`,
          ],
    bigBase: [x1 + x2 * x3, `${A} + ${B} × ${L}`],
    reduce: [x1 - x2 * x3, `${A} − ${B} × ${L}`],
    addDECAY:
      x3 < 50001
        ? [x1 * x3, `${A} × ${L}`]
        : [
            x1 * Math.min(5e4, x3) +
              ((x3 - 5e4) / (x3 - 5e4 + 15e4)) * x1 * 5e4,
            `${A} × min(50000, ${L}) + (${L} − 50000) ÷ (${L} + 100000) × ${A} × 50000`,
          ],
  };
  const form = Object.hasOwn(forms, k) ? forms[k] : undefined;
  if (!form || !(Math.abs(form[0] - v) <= 1e-6 * Math.max(1, Math.abs(v))))
    return null;
  return [form[1], `${curveText(c)} = ${fx3(v)}`];
}

/** [F5-CURVE] the curve's two constants by their role in the game's curve (rule 159). */
const PARTS: Readonly<Record<string, readonly [string, string]>> = {
  decay: ["Max bonus of the curve", "Level at half of the max"],
  decayMulti: ["Max bonus of the curve", "Level at half of the max"],
  intervalAdd: ["Base of the curve", "Levels for each +1"],
  add: ["Per-level bonus of the curve", "Growth of the per-level bonus"],
  bigBase: ["Base of the curve", "Per-level bonus of the curve"],
  reduce: ["Base of the curve", "Per-level reduction of the curve"],
};
export const curvePart = (kind: string, i: 1 | 2): string =>
  (Object.hasOwn(PARTS, kind) ? PARTS[kind]?.[i - 1] : undefined) ??
  `Curve constant ${String(i)}`;

/** The curve's constants as fixed-value rows: the second one is left out of an `add` that does not grow. */
export const curveConstants = ([k, x1, x2]: Curve): [string, number][] => [
  [curvePart(k, 1), x1],
  ...(k === "add" && x2 === 0
    ? []
    : [[curvePart(k, 2), x2] as [string, number]]),
];

/**
 * FR-015a: how much of a decay curve's maximum the value reached, and that maximum, from the curve's own constant (the
 * first one, the maximum the curve tends to). Any other curve, or a constant that is no maximum, has none.
 */
export function maxReachedOf(
  [k, x1]: Curve,
  v: number,
): { share: number; max: number } | null {
  if (!(x1 > 0)) return null;
  const share =
    k === "decay" ? v / x1 : k === "decayMulti" ? (v - 1) / x1 : NaN;
  if (!(share >= 0 && share <= 1)) return null;
  return { share, max: k === "decay" ? x1 : 1 + x1 };
}

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
