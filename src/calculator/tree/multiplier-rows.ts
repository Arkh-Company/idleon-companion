// Each multiplier is one × row with its source's name (fix tree-shape-091, rule 2; spec 009, FR-018: each multiplier is
// its own × row and opens in its children; audit family 7: the parent has the source's name, the child its role): a
// factor of one source in a Multi pool, 1 + x ÷ 100, 1 + k × x ÷ 100, with a floor, a cap or a check, is the row of its
// source's name, its value the factor; its parts by their role ("Bonus", "Level"), and its math, the code's constants
// ("Base 1", "÷ 100", "× 5", "Minimum", "Cap") too, in its ⓘ only. A row with a name of its own keeps it. The name a
// shape gives the row ("Multiplier", "Multiplier (Swingy O' Sword)") is none (FR-007), so the row never stays unnamed.
import { byShapeOnly } from "./flatten.ts";
import { isCond, isConstant } from "./formulas.ts";
import { byRole, inlined } from "./inline.ts";
import type { Row } from "./rows.ts";

/** The name of a multiplier by its shape with its first source after it, to tell two apart (tree/rows.ts `bySource`). */
const BY_SHAPE_SOURCE = /^Multiplier \(.+\)$/;

/** The constants of 1 + x ÷ 100, which make x a bonus in %. */
const PERCENT = ["Base 1", "Percent to number (÷ 100)"];

/**
 * Row `r` of a product with each multiplier in it as its × row (`multiplierRow`), down through the unnamed steps that
 * only multiply (a part of a working value the game multiplies in several steps, as the max damage's third part).
 */
export function multipliersIn(r: Row): Row {
  const unnamed = !!r.node.flags.unnamed || byShapeOnly(r.node.name);
  return r.op === "*" &&
    r.node.code === null &&
    r.open === null &&
    unnamed &&
    r.group
    ? { ...r, group: r.group.map(multipliersIn) }
    : multiplierRow(r);
}

/** Row `r` of a Multi pool as its multiplier's × row, when it is a factor of one source with the code's constants; else `r`. */
export function multiplierRow(r: Row): Row {
  const n = r.node;
  const parts = r.group ?? [];
  if (
    r.open !== null ||
    n.code !== null ||
    n.role !== "piece" ||
    isCond(r) ||
    r.clamp ||
    !parts.some((k) => isConstant(k.node))
  )
    return r;
  // its whole math, the unnamed steps inside it taken in (tree/inline.ts), closing on its value
  const w = inlined(r, parts);
  if (!Array.isArray(w.formula)) return r;
  const constants = w.rows.filter((k) => isConstant(k.node));
  const kept = w.rows.filter((k) => !isConstant(k.node));
  // its sources: a yes/no the game multiplies by is one too (a companion owned), a check of a branch is none
  const sources = kept.filter((k) => !isCond(k) || k.node.code !== null);
  const [only] = sources;
  const vague =
    !!n.flags.unnamed || byShapeOnly(n.name) || BY_SHAPE_SOURCE.test(n.name);
  if (!only || (vague && sources.length !== 1)) return r;
  const name = vague ? only.node.name : n.name;
  const flags = { ...n.flags };
  delete flags.unnamed;
  // a source with no proven name leaves its row with none (FR-012a)
  if (vague && only.node.flags.unnamed) flags.unnamed = true;
  const own = byRole(name, { formula: w.formula, rows: kept });
  // 1 + x ÷ 100: x is a bonus in %
  const pct =
    sources.length === 1 &&
    constants.length === PERCENT.length &&
    constants.every((k) => PERCENT.includes(k.node.name));
  return {
    ...r,
    node: { ...n, name, fmt: "x", flags, formula: own.formula },
    group: own.rows.map((k) =>
      pct && !isCond(k) ? { ...k, node: { ...k.node, fmt: "%" } } : k,
    ),
  };
}
