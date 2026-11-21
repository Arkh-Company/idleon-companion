// Each multiplier is one × row with its source's name (fix tree-shape-091, rule 2; spec 009, FR-018: each multiplier is
// its own × row and opens in its children; audit family 7: the parent has the source's name, the child its role): a
// factor of one source in a Multi pool, 1 + x ÷ 100, 1 + k × x ÷ 100, with a floor, a cap or a check, is the row of its
// source's name, its value the factor. Its parts are its rows: the source by its role ("Bonus", "Level"), which its ⓘ
// writes too and which no merge below takes away (tree/rows.ts `role`), and the code's constants ("Base 1", "÷ 100",
// "× 5", "Minimum", "Cap") as they are (the Open Questions' constants of the code, Vinicius, 18/11); its checks, a
// companion owned, in its ⓘ only (FR-018). A bonus times a count (a talent times a count, a bonus per green sigil) is
// the row of the bonus, the count its row by its own name, in a sum too (round 1). A row with a name of its own keeps
// it; the name a shape gives the row ("Multiplier", "Multiplier (Swingy O' Sword)") is none (FR-007).
import { citing } from "./build-up.ts";
import { byShapeOnly } from "./flatten.ts";
import { isCond, isConstant } from "./formulas.ts";
import { inlined, roleOf } from "./inline.ts";
import { untagged as brief } from "../names/name-text.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";
import { scaledTalent } from "./systems.ts";

/** The name of a multiplier by its shape with its first source after it, to tell two apart (tree/rows.ts `bySource`). */
const BY_SHAPE_SOURCE = /^Multiplier \(.+\)$/;

/** The constants of 1 + x ÷ 100, which make x a bonus in %. */
const PERCENT = ["Base 1", "Percent to number (÷ 100)"];

/** A count a bonus is multiplied by: a quantity, a level, or a total by its name. */
const isCount = (r: Row) =>
  r.node.leaf === "quantity" ||
  r.node.leaf === "level" ||
  r.node.name.startsWith("Total ");

/** The bonus of two sources, one of them a count (the talent of a talent times a count, 009 T029); else null. */
function bonusOf(sources: readonly Row[]): Row | null {
  const talent = scaledTalent(sources);
  if (talent) return talent;
  const bonuses = sources.filter((k) => !isCount(k));
  const [only] = bonuses;
  return bonuses.length === 1 && only ? only : null;
}

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

/**
 * Row `r` as the row of its multiplier, by its source's name (`times`: of a product, a × row), or of a bonus times a
 * count, by the bonus's name; else `r`.
 */
export function multiplierRow(r: Row, times = true): Row {
  const n = r.node;
  const parts = r.group ?? [];
  if (
    r.open !== null ||
    n.code !== null ||
    n.role !== "piece" ||
    isCond(r) ||
    r.clamp ||
    r.capped ||
    r.factorPool ||
    !parts.some((k) => isConstant(k.node))
  )
    return r;
  // its whole math, the unnamed steps inside it taken in (tree/inline.ts), closing on its value
  const w = inlined(r, parts);
  if (!Array.isArray(w.formula)) return r;
  // a check of a branch is no source: its ⓘ says it, it is no row (FR-018); a yes/no the game multiplies by is a source
  const checks = w.rows.filter((k) => isCond(k) && k.node.code === null);
  const sources = w.rows.filter(
    (k) => !isConstant(k.node) && !checks.includes(k),
  );
  const [only] = sources;
  const head = sources.length === 1 ? (only ?? null) : bonusOf(sources);
  // in a sum, only a bonus times a count
  if (!head || (!times && sources.length !== 2)) return r;
  const vague =
    !!n.flags.unnamed || byShapeOnly(n.name) || BY_SHAPE_SOURCE.test(n.name);
  const name = vague ? head.node.name : n.name;
  const flags = { ...n.flags };
  delete flags.unnamed;
  // a source with no proven name leaves its row with none (FR-012a)
  if (vague && head.node.flags.unnamed) flags.unnamed = true;
  // the source that says the row's name again is its role, in its row and in the ⓘ (family 7); a yes/no is its bonus,
  // and its check (a companion owned) is said in the ⓘ
  const renamed = vague || brief(head.node.name) === brief(name);
  const role = roleOf(head);
  const owned =
    renamed && isCond(head) && head.node.condition === "owned"
      ? [
          {
            node: row({
              pieceKey: null,
              value: head.node.value,
              code: null,
              name: "Owned",
              leaf: "condition",
              condition: "owned",
              flags: {},
            }),
            open: null,
          },
        ]
      : [];
  const asRole = (k: Row): Row => {
    const f = { ...k.node.flags };
    delete f.unnamed;
    const yesNo = owned.length > 0;
    return {
      ...k,
      node: {
        ...k.node,
        name: role,
        flags: f,
        ...(yesNo ? { leaf: "rawBonus", condition: null, kids: [] } : {}),
      },
      ...(yesNo ? { open: null, group: [] } : {}),
      role: true,
    };
  };
  const others = w.rows.filter((k) => k !== head);
  const terms = new Set(
    [termOf(head.node), head.node.name, brief(head.node.name)].filter(
      (t) => !others.some((k) => k.node.name === t || termOf(k.node) === t),
    ),
  );
  const [atoms, numbers] = w.formula;
  const formula = renamed
    ? citing(
        [atoms.map((t) => (terms.has(t) ? role : t)), numbers],
        [...checks, ...owned],
      )
    : citing(w.formula, checks);
  // 1 + x ÷ 100: x is a bonus in %
  const constants = w.rows.filter((k) => isConstant(k.node));
  const pct =
    sources.length === 1 &&
    constants.length === PERCENT.length &&
    constants.every((k) => PERCENT.includes(k.node.name));
  return {
    ...r,
    node: {
      ...n,
      name,
      ...(times ? { fmt: "x" as const } : {}),
      flags,
      formula,
    },
    group: w.rows
      .filter((k) => !checks.includes(k))
      .map((k) => {
        if (k !== head) return k;
        const h = renamed ? asRole(k) : k;
        return pct ? { ...h, node: { ...h.node, fmt: "%" as const } } : h;
      }),
    head,
  };
}
