// The rows of one level before they have a place (spec 008): a row of the game, the curve block as a branch, the group
// of the parts at ×1 (pieces.cjs `tidy`) and the group of the parts at 0 (FR-014), each with its share in the parent.
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

/** A row with no rows under it: built with none, and none to open later. */
export const isLeaf = (r: Row): boolean =>
  Array.isArray(r.node.kids) && !r.node.kids.length;

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

/** Row `r` named `name`, a name of its own (no longer `unnamed`); null leaves it as it is. */
export function withName(r: Row, name: string | null): Row {
  if (name === null) return r;
  const flags = { ...r.node.flags };
  delete flags.unnamed;
  return { ...r, node: { ...r.node, name, flags } };
}

const number = (v: CalcTreeNode["value"]) =>
  typeof v === "boolean" ? Number(v) : v;

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

/** A group row of the tree's mould (no piece of its own), closed at first (FR-014). */
function group(
  role: "atZero" | "atOne",
  name: string,
  value: number,
  rows: Row[],
): Row {
  return {
    node: row({
      pieceKey: null,
      value,
      code: null,
      name,
      role,
      fmt: role === "atOne" ? "x" : null,
      flags: { closed: true },
    }),
    open: null,
    group: rows,
  };
}

/**
 * pieces.cjs `tidy`, in a product (FR-014: multipliers at ×1): the parts at ×1 go under one closed row, at the end, when
 * there are two or more; the row weighs what they weighed in the parent.
 */
export function timesOne(rows: Row[], mode: CalcTreeNode["shareMode"]): Row[] {
  if (mode !== "product" && mode !== "productZero") return rows;
  const one = rows.filter((r) => {
    const v = number(r.node.value);
    return v !== null && Math.abs(v - 1) < 1e-9;
  });
  if (one.length < 2) return rows;
  const shared = withShares({ name: "", value: 1 }, null, one).rows;
  const g = group("atOne", `At ×1 (${String(one.length)})`, 1, shared);
  g.node.share = one.reduce((s, r) => s + (r.node.share ?? 0), 0);
  g.node.shareMode = mode;
  return [...rows.filter((r) => !one.includes(r)), g];
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
 * passes after the types (tree/leaf-passes.ts), with their shares; then a product's parts at ×1 (when `ones`) and a
 * sum's parts at 0.
 */
export function finish(v: unknown, rows: Row[], ones: boolean): Row[] {
  // A leaf gets its type and the reason of a "?" (pieces.cjs classify); a branch or a typed leaf keeps its own.
  const typed = bySource(levelRenames(rows)).map((r) =>
    r.node.kids === "lazy" || r.node.leaf || r.group
      ? r
      : { ...r, node: { ...r.node, ...classify(r.node) } },
  );
  const shared = withShares(
    { name: "", value: valueOf(v as RecValue) },
    null,
    leafPasses(typed),
  );
  return atZero(
    ones ? timesOne(shared.rows, shared.mode) : shared.rows,
    shared.mode,
  );
}

/** FR-014: in a sum, the parts at 0 go under one closed row at the end; a Condition that is "no" stays in the list. */
export function atZero(rows: Row[], mode: CalcTreeNode["shareMode"]): Row[] {
  if (mode !== "sum") return rows;
  const zero = rows.filter(
    (r) =>
      r.node.value === 0 &&
      r.node.leaf !== "condition" &&
      r.node.role === "piece",
  );
  if (!zero.length) return rows;
  return [
    ...rows.filter((r) => !zero.includes(r)),
    group("atZero", `At 0 (${String(zero.length)})`, 0, zero),
  ];
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
