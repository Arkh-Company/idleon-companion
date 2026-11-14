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
import { formulaAtoms } from "./math.ts";
import { kidShares, termOf } from "./share.ts";

/** The generic name of a part with no proven name (design.md C7, FR-012a). */
export const GENERIC_NAME = "Game value";

export type Node = Omit<CalcTreeNode, "id">;
/** A row before it has its place: `open` is the call whose rows are its children; `group` its rows built already. */
export interface Row {
  node: Node;
  open: number | null;
  group?: Row[];
}

export const valueOf = (v: RecValue | undefined): number | boolean | null =>
  typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))
    ? v
    : null;

export const callText = (n: RecNode): string =>
  `${n.b}(${n.a.map((a) => JSON.stringify(a)).join(", ")})`;

export function row(
  fields: Pick<CalcTreeNode, "pieceKey" | "value" | "code"> & Partial<Node>,
): Node {
  return {
    name: GENERIC_NAME,
    fmt: null,
    leaf: null,
    condition: null,
    why: null,
    formula: null,
    role: "piece",
    share: null,
    shareMode: null,
    flags:
      fields.value === null
        ? { unnamed: true, unavailable: true }
        : { unnamed: true },
    kids: [],
    ...fields,
  };
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

/** pieces.cjs `tidy`, for a product: the parts at ×1 go under one closed row, at the end, when there are two or more. */
export function timesOne(rows: Row[]): Row[] {
  const one = rows.filter((r) => {
    const v = number(r.node.value);
    return v !== null && Math.abs(v - 1) < 1e-9;
  });
  if (one.length < 2) return rows;
  const shared = withShares({ name: "", value: 1 }, null, one).rows;
  return [
    ...rows.filter((r) => !one.includes(r)),
    group("atOne", `At ×1 (${String(one.length)})`, 1, shared),
  ];
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
      formula: text ? formulaAtoms(text) : null,
      ...(reached ? { maxReached: reached } : {}),
    }),
    open: null,
    group: withShares({ name, value: fields.value }, text, [...parts, last])
      .rows,
  };
}
