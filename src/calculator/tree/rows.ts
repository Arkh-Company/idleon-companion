// The rows of one level before they have a place (spec 008): a row of the game and the curve block as a branch, each with
// its share in the parent; the parts at 0 and at ×1 stay in their places (spec 009, FR-016).
import type { RecNode, RecValue } from "../recording.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import {
  curveConstants,
  curveFormula,
  curveText,
  maxReachedOf,
} from "./curves.ts";
import type { Curve } from "./curves.ts";
import { classify } from "./kinds.ts";
import { leafPasses } from "./leaf-passes.ts";
import { levelRenames } from "./level-renames.ts";
import { formulaOut } from "./math.ts";
import { isGeneric, nameOf } from "./names.ts";
import { kidShares, termOf } from "./share.ts";

/** The generic name of a part with no proven name (design.md C7, FR-012a). */
export const GENERIC_NAME = "Game value";

export type Node = Omit<CalcTreeNode, "id">;
/**
 * A cache read that opens into the rows its writer gave it (pieces.cjs `cacheRows`): the writer found for it, and the
 * loop entry being walked and the bubble entries being opened when the row was made (pieces.cjs ENTRY_P, OPUS4_OPEN).
 */
export interface CacheOpen {
  path: string;
  value: number | boolean | null;
  writer: number;
  entry: string | null;
  opening: readonly string[];
}
/**
 * A row before it has its place: `open` is the call, or the cache, whose rows are its children; `group` its rows built
 * already; `seen` the calls above its own rows when they are not its place's (a cache's rows are its writer's).
 */
export interface Row {
  node: Node;
  open: number | CacheOpen | null;
  seen?: readonly number[];
  group?: Row[];
  /** pieces.cjs "Value from an earlier step": a value of a step the recording did not link. */
  earlier?: boolean;
  /** A Condition's comparison, written with the terms of its sides (pieces.cjs condRows). */
  test?: string;
  /**
   * The ⓘ before the row's own rows exist (tree/formulas.ts): the game's expression around the row, its parts as tokens
   * (pieces.cjs `xformula`, and `xweak` when it names the row alone), or its finished pair (`f`, a curve's).
   */
  xf?: [names: string, numbers: string];
  xweak?: [names: string, numbers: string];
  f?: [names: string, numbers: string];
  /** A cache row that takes its writer's ⓘ only when it gives the row's value, or never (tree/cache-formulas.ts). */
  writerF?: "sameValue" | "never";
  /** formulas.cjs `r1src`: the name of the first source of a branch around a call, which tells two such branches apart. */
  r1src?: string;
}

/** A row with no rows under it, built (a group) or to build (an opening). */
export const bare = (r: Row): boolean => r.open === null && !r.group?.length;

/** pieces.cjs "Value from an earlier step": an earlier value no rule named. */
export const unlinked = (r: Row): boolean =>
  !!r.earlier && !!r.node.flags.unnamed;

/** Row `r` with the name `name`, its flags as they are (a name changed from another proven one). */
export const named = (r: Row, name: string): Row =>
  name === r.node.name ? r : { ...r, node: { ...r.node, name } };

export const valueOf = (v: RecValue | undefined): number | boolean | null =>
  typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))
    ? v
    : null;

export const callText = (n: RecNode): string =>
  `${n.b}(${n.a.map((a) => JSON.stringify(a)).join(", ")})`;

/** A row with its name, or named by its code (tree/names.ts); with no name, the generic one and `unnamed`. */
export function row(
  fields: Pick<CalcTreeNode, "pieceKey" | "value" | "code"> & Partial<Node>,
): Node {
  const name =
    fields.name ?? (fields.code === null ? null : nameOf(fields.code));
  // a name by shape only (tree/names.ts) is shown, and still counts as no name yet
  const generic =
    fields.name === undefined &&
    (fields.code === null || isGeneric(fields.code));
  return {
    name: name ?? GENERIC_NAME,
    fmt: null,
    leaf: null,
    condition: null,
    why: null,
    formula: null,
    role: "piece",
    share: null,
    shareMode: null,
    flags: {
      ...(name === null || generic ? { unnamed: true } : {}),
      ...(fields.value === null ? { unavailable: true } : {}),
    },
    kids: [],
    ...fields,
  };
}

/** The rows with their share in a parent of value `value` (tree/share.ts), the parent's formula given. */
export function withShares(
  parent: Pick<CalcTreeNode, "name" | "value">,
  formula: [string, string] | null,
  rows: Row[],
): { rows: Row[]; mode: CalcTreeNode["shareMode"] } {
  const shared = kidShares(
    parent,
    formula,
    rows.map((r) => ({ id: "", ...r.node })),
  );
  return {
    rows: rows.map((r, i) => {
      const s = shared[i];
      if (!s) return r;
      const { share, shareMode, cap } = s;
      return {
        ...r,
        node: { ...r.node, share, shareMode, ...(cap ? { cap } : {}) },
      };
    }),
    mode: shared[0]?.shareMode ?? null,
  };
}

/**
 * formulas.cjs `r1src`: a branch with the name of another part of its level takes its first source's name after it,
 * in order (the bench renames as it goes, so the last of two same names keeps its own).
 */
function bySource(rows: Row[]): Row[] {
  const out = [...rows];
  out.forEach((r, i) => {
    const src = r.r1src;
    if (
      src &&
      out.some((o) => o !== r && o.node.name === r.node.name) &&
      !r.node.name.includes(src)
    )
      out[i] = { ...r, node: { ...r.node, name: `${r.node.name} (${src})` } };
  });
  return out;
}

/**
 * A level's rows with its context reads gone and its proven leaves named (tree/level-renames.ts), typed, through the
 * passes after the types (tree/leaf-passes.ts), with their shares; every part in its place, at 0 or at ×1 too (spec
 * 009, FR-016: no group "At 0" nor "At ×1").
 */
export function finish(v: unknown, rows: Row[]): Row[] {
  // A leaf gets its type and the reason of a "?" (pieces.cjs classify); a branch or a typed leaf keeps its own.
  const typed = bySource(levelRenames(rows)).map((r) =>
    r.node.kids === "lazy" || r.node.leaf || r.group
      ? r
      : { ...r, node: { ...r.node, ...classify(r.node) } },
  );
  return withShares(
    { name: "", value: valueOf(v as RecValue) },
    null,
    leafPasses(typed),
  ).rows;
}

/**
 * pieces.cjs `curveRow`: the curve block as a branch of its constants, named by their role, and of its input, the
 * caller's read with the same value or "Level the curve uses"; with the curve's formula and, for a decay, the share of
 * its maximum (FR-015a).
 */
export function curveRow(
  c: Curve,
  fields: Pick<CalcTreeNode, "pieceKey" | "code"> & { value: number },
  input: Row | null,
): Row {
  const parts: Row[] = curveConstants(c).map(([name, v]) => ({
    node: row({
      pieceKey: null,
      value: v,
      code: null,
      name,
      leaf: "fixedValue",
      flags: {},
    }),
    open: null,
  }));
  const last: Row = input ?? {
    node: row({
      pieceKey: null,
      value: c[3],
      code: null,
      name: "Level the curve uses",
      leaf: "level",
      flags: {},
    }),
    open: null,
  };
  const name = `Curve: ${curveText(c)}`;
  const text = curveFormula(c, fields.value, termOf(last.node));
  const reached = maxReachedOf(c, fields.value);
  return {
    node: row({
      ...fields,
      name,
      flags: {},
      formula: text
        ? formulaOut(
            text,
            [...parts, last].map((r) => termOf(r.node)),
          )
        : null,
      ...(reached ? { maxReached: reached } : {}),
    }),
    open: null,
    group: withShares({ name, value: fields.value }, text, [...parts, last])
      .rows,
    ...(text ? { f: text } : {}),
  };
}
