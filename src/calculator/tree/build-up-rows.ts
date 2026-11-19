// The rows the full build-up of a bonus makes (spec 009, FR-018; tree/build-up.ts): a constant by its role, a row
// renamed, a branch of its parts with its ⓘ, and the level built up with its row's new ⓘ.
import type { RecNode } from "../recording.ts";
import { curveOf } from "./curves.ts";
import type { Curve } from "./curves.ts";
import { isCond, near, vOf } from "./formulas.ts";
import type { Pair } from "./formulas.ts";
import type { Level } from "./places.ts";
import { withName } from "./row-checks.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";

/** A level built up: its row with the ⓘ (`f`) and its rows, and whether the ⓘ is said as a rule ("(capped)"). */
export interface BuiltUp {
  level: Level;
  rule?: true;
  /** How much of its maximum the curve reached, when the row's value is the curve's own (spec 008, FR-015a). */
  maxReached?: { share: number; max: number };
}
export interface BuildUpContext {
  nodes: readonly RecNode[];
  /** The level under a row of `lv` (tree/places.ts `levelOf`). */
  under(r: Row, lv: Level): Level | null;
  /** The name the level's row has where it is placed (a cache that is one curve keeps its own). */
  name?: string;
  /** The piece key of a call (tree/places.ts). */
  keyOf?: (n: RecNode) => string;
}

/** The two constants of a curve by their role in the game's curve (FR-018: "Max bonus", "Level at half"). */
const ROLES: Readonly<Record<string, readonly [string, string]>> = {
  decay: ["Max bonus", "Level at half"],
  decayMulti: ["Max bonus", "Level at half"],
  intervalAdd: ["Start value", "Levels per +1"],
  add: ["Bonus per level", "Bonus growth per level"],
  bigBase: ["Start value", "Bonus per level"],
  reduce: ["Start value", "Reduction per level"],
};
export const rolesOf = (c: Curve): readonly [string, string] | null =>
  Object.hasOwn(ROLES, c[0]) ? (ROLES[c[0]] ?? null) : null;

export const fixedRow = (
  name: string,
  value: number,
  code: string | null = null,
): Row => ({
  node: row({
    pieceKey: null,
    value,
    code,
    name,
    leaf: "fixedValue",
    flags: {},
  }),
  open: null,
});
export function renamed(r: Row, name: string, leaf?: Row["node"]["leaf"]): Row {
  const n = withName(r, name);
  return leaf ? { ...n, node: { ...n.node, leaf } } : n;
}
export const groupRow = (
  name: string,
  value: number,
  group: Row[],
  f?: Pair,
): Row => ({
  node: row({ pieceKey: null, value, code: null, name, flags: {} }),
  open: null,
  group,
  ...(f ? { f } : {}),
});
/** The curve's constants as rows, by their role; an `add` that does not grow has one. */
export const constRows = (
  c: Curve,
  [a, b]: readonly [string, string],
): Row[] => [
  fixedRow(a, c[1]),
  ...(c[0] === "add" && c[2] === 0 ? [] : [fixedRow(b, c[2])]),
];
export const codeOf = (r: Row): string => r.node.code ?? "";
const CURVE_CALL = /^ArbitraryCode5Inputs\((.*)\)$/;
/** A curve row's curve, from its call (N.js ArbitraryCode5Inputs); null for any other row. */
export function curveIn(r: Row) {
  const args = CURVE_CALL.exec(codeOf(r))?.[1];
  try {
    return args
      ? curveOf("ArbitraryCode5Inputs", JSON.parse(`[${args}]`) as unknown[])
      : null;
  } catch {
    return null;
  }
}

/** A branch of the code with one row of its value is that row (the merge tree/one-child.ts makes once it is placed). */
export function unwrap(r: Row): Row {
  const one = r.group?.length === 1 ? r.group[0] : undefined;
  return r.node.code === null && one && near(vOf(one), vOf(r))
    ? unwrap(one)
    : r;
}
/** The rows that are no check. */
export const parts = (rows: readonly Row[]): Row[] =>
  rows.filter((r) => !isCond(r));
export const product = (rows: readonly Row[]): number =>
  rows.reduce((a, r) => a * vOf(r), 1);

/** The level with its new rows and its row's ⓘ (the row's own ⓘ, built before, gives way). */
export const built = (
  lv: Level,
  rows: Row[],
  f: Pair,
  rule = false,
): BuiltUp => ({
  level: {
    ...lv,
    row: { ...lv.row, node: { ...lv.row.node, formula: null }, f },
    rows,
  },
  ...(rule ? { rule: true as const } : {}),
});
