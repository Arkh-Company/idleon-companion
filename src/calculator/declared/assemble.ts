// The assembly of a declared tree (spec 010, FR-002, FR-002a, FR-002b, FR-012-FR-016, research R11, R12): the
// blueprint read as it is, its values filled from the lock's run over the recording, in the spec 009's CalcTreeNode.
// It never guesses a shape (FR-012): the pools, the groups by system, the sources and their children are the
// blueprint's, in its order; a model child is one row per recorded item. The values: a pool's and a source's from the
// answer key, a child's from its reference in the recording, a source the game did not use 0 in an Additive and 1 in a
// Multi; a level that does not close still shows the game's values (FR-015). A source of another class leaves, and a
// group only when all of its sources do (FR-002a). The ⓘ is made from each level's recorded expression
// (how-it-adds-up.ts), never kept. A draft assembles too, its pending places flagged `unknown`.
import type { Expr } from "../recorded/steps.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import type { BlueprintNode, BlueprintPool } from "./blueprint.ts";
import { curveFormula, howItAddsUp, rootFormula } from "./how-it-adds-up.ts";
import { keyOfLeaf } from "./lock-parts.ts";
import { pendingIds } from "./lock-pending.ts";
import type { Seen } from "./lock-seen.ts";
import { refCovers } from "./lock-values.ts";
import { lockBlueprint } from "./lock.ts";
import type { LockInput } from "./lock.ts";
import { notLeafOf } from "./not-leaves.ts";
import type { NotLeaf } from "./not-leaves.ts";
import { nodeId, pieceKeyOf, refKey } from "./refs.ts";
import { systemLabel } from "./systems.ts";
import type { SystemEntry } from "./systems.ts";

type Node = CalcTreeNode;
export interface AssembledTree {
  /** The first answer: the root and its pools, each pool's level lazy (FR-013). */
  root: Node;
  /** A node of the tree kept, with its level; null for an id it does not have. */
  expand(nodeId: string): Node | null;
  /** The whole tree, open down to the leaves (the gallery's, FR-023). */
  whole(): Node;
}

/** A part that is no row (research R6), in the ⓘ by its role. */
const ROLE: Readonly<Record<NotLeaf["role"], string>> = {
  curve: "Curve",
  log: "Logarithm",
  context: "Where the character is",
  loopCounter: "Loop count",
  otherCharacter: "Another character's",
};
const PENDING_NAME = "Pending name";
const PENDING_SYSTEM = "Pending system";

/** A node's name; in a draft, null where its pending says `name` (blueprint-types.ts). */
const nameOf = (n: BlueprintNode): string | null =>
  (n as { name: string | null }).name;
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
/** A row's part in its parent's count: a row in % adds a hundredth. */
const partOf = (k: Node): number | null =>
  isNum(k.value) ? (k.fmt === "%" ? k.value / 100 : k.value) : null;
const combined = (parts: readonly (number | null)[], product: boolean) =>
  parts.every(isNum)
    ? parts.reduce((a, x) => (product ? a * x : a + x), product ? 1 : 0)
    : null;
/** A level's ⓘ from its rows: their names joined by + or ×, with their parts. */
function rowsFormula(
  kids: readonly Node[],
  product: boolean,
  v: Node["value"],
): Node["formula"] {
  const parts = kids.map(partOf);
  if (!isNum(v) || kids.length === 0 || !parts.every(isNum)) return null;
  const terms = kids.flatMap((k, i) =>
    i === 0 ? [k.name] : [product ? "×" : "+", k.name],
  );
  return [terms, [...parts, v]];
}

export function assembleTree(
  input: LockInput & { systems: readonly SystemEntry[] },
): AssembledTree {
  const { blueprint: bp, rec, character, characterClass, systems } = input;
  const seen = new Map<string, Seen>();
  lockBlueprint(input, seen);
  const waits = pendingIds(bp);
  const systemOf = (id: string | null) => systems.find((s) => s.id === id);
  const visible = (n: BlueprintNode) =>
    !n.classes ||
    (characterClass !== null && n.classes.includes(characterClass));
  const label = (n: BlueprintNode): string => {
    const name = nameOf(n);
    const sys = n.termPart && systemOf(n.termPart.system);
    if (name === null) return PENDING_NAME;
    return sys ? `${sys.emoji} ${name}` : name;
  };
  const make = (
    id: string,
    name: string,
    value: Node["value"],
    more: Partial<Node>,
  ): Node => ({
    id,
    pieceKey: null,
    name,
    value,
    fmt: null,
    leaf: null,
    condition: null,
    why: null,
    formula: null,
    code: null,
    role: "row",
    share: null,
    shareMode: null,
    flags: waits.has(id) ? { unknown: true } : {},
    kids: [],
    ...more,
  });
  const refFields = (n: BlueprintNode) =>
    n.ref
      ? {
          pieceKey: pieceKeyOf(n.ref, character),
          code: refKey(n.ref, character),
        }
      : {};

  /** A part of a level's expression by the name of the child that stands for it, or by its role; null with neither. */
  const nameIn =
    (kids: readonly BlueprintNode[]) =>
    (e: Expr): string | null => {
      const key = keyOfLeaf(e, rec);
      if (key === null) return null;
      const kid = kids.find(
        (k) => k.ref !== undefined && refCovers(k.ref, key, character),
      );
      if (kid) return label(kid);
      const role = notLeafOf(key, character)?.role;
      return role === undefined ? null : ROLE[role];
    };
  /** A level's ⓘ: a lone curve's with its constants named (FR-016), else its expression's. */
  const formulaOf = (
    e: Expr,
    kids: readonly BlueprintNode[],
  ): Node["formula"] => {
    let x = e;
    while (x.t === "def") x = x.e;
    const n = x.t === "call" ? rec.nodes[x.id] : undefined;
    const [kind, x1, x2, x3] = n?.a ?? [];
    if (
      n?.b === "ArbitraryCode5Inputs" &&
      typeof kind === "string" &&
      isNum(x1) &&
      isNum(x2) &&
      isNum(x3) &&
      isNum(x.v)
    ) {
      // shortcut: the input goes by its role, "Level"; name it by the child the lock ties to the curve's argument
      // (lock-parts.ts transparentValue) when a tree needs it
      return curveFormula(kind, x1, x2, x3, x.v, "Level");
    }
    return howItAddsUp(e, nameIn(kids));
  };

  const conditionRow = (c: BlueprintNode, id: string): Node => {
    const v = seen.get(id)?.value;
    return make(id, label(c), isNum(v) ? v !== 0 : null, {
      ...refFields(c),
      leaf: "condition",
      condition: c.conditionKind ?? null,
    });
  };

  /** A row and its children; `neutral`, a pool source's value when the game did not use it (0 or 1). */
  function row(
    n: BlueprintNode,
    id: string,
    fmt: Node["fmt"],
    neutral?: 0 | 1,
  ): Node {
    const s = seen.get(id);
    const kids = (s?.kids ?? n.children ?? []).filter(visible);
    const below: Node[] = n.pools
      ? n.pools.map((_, i) =>
          pool(n.pools ?? [], i, id, `${id}/pool:${String(i)}`),
        )
      : kids.map((k) => row(k, `${id}/${k.key}`, null));
    // a pool's source with a model child (T174) is its items' sum or product
    const items =
      n.each && !n.ref && neutral !== undefined
        ? combined(
            below.map((k) => (isNum(k.value) ? k.value : null)),
            neutral === 1,
          )
        : null;
    const value =
      s?.value !== undefined
        ? s.value
        : (items ?? n.constant ?? neutral ?? null);
    const name = nameOf(n);
    return make(id, label(n), value, {
      ...refFields(n),
      fmt,
      leaf: n.leaf ?? null,
      condition: n.conditionKind ?? null,
      formula: kids.length > 0 && s?.expr ? formulaOf(s.expr, kids) : null,
      flags: {
        ...(waits.has(id) && { unknown: true }),
        ...(name === null && { unnamed: true }),
        ...(value === null && { unavailable: true }),
      },
      kids: [
        ...(n.condition
          ? [conditionRow(n.condition, `${id}/${n.condition.key}`)]
          : []),
        ...below,
      ],
    });
  }

  /** A pool of `pools` with its groups; `base` is the number's id or a piece's line, `place` the lock's place of it. */
  function pool(
    pools: readonly BlueprintPool[],
    i: number,
    base: string,
    place: string,
  ): Node {
    const p = pools[i];
    if (!p) throw new Error(`no pool ${String(i)}`);
    const product = p.kind === "multi";
    const groups = p.groups.flatMap((g) => {
      const sources = g.sources.filter(visible);
      if (sources.length === 0) return [];
      const rows = sources.map((s) => {
        const weight = s.weight ?? p.weight ?? 1;
        const fmt = product ? "x" : weight === 0.01 ? "%" : "+";
        return row(s, nodeId(base, i, g.system, [s.key]), fmt, product ? 1 : 0);
      });
      const value = combined(
        rows.map((r) => (isNum(r.value) ? r.value : null)),
        product,
      );
      const sys = systemOf(g.system);
      const id = nodeId(base, i, g.system, []);
      return [
        make(id, sys ? systemLabel(sys) : PENDING_SYSTEM, value, {
          role: "system",
          combine: product ? "product" : "sum",
          poolKind: null,
          fmt: rows[0]?.fmt ?? null,
          // the rows of a group are in one unit: its ⓘ is their own values
          formula: rowsFormula(
            rows.map((r) => ({ ...r, fmt: null })),
            product,
            value,
          ),
          ...(!sys && {
            flags: { ...(waits.has(id) && { unknown: true }), unnamed: true },
          }),
          kids: rows,
        }),
      ];
    });
    const same = pools.filter((x) => x.kind === p.kind);
    const name = `${product ? "Multi pool" : "Additive pool"}${same.length > 1 ? ` ${String(same.indexOf(p) + 1)}` : ""}`;
    const kept = seen.get(place)?.value;
    const value =
      kept !== undefined ? kept : combined(groups.map(partOf), product);
    return make(`${base}/${String(i)}`, name, value, {
      role: "pool",
      poolKind: p.kind,
      combine: product ? "product" : p.weight === 0.01 ? "percent" : "sum",
      fmt: product ? "x" : null,
      formula: rowsFormula(groups, product, value),
      kids: groups,
    });
  }

  const pools = bp.pools.map((_, i) =>
    pool(bp.pools, i, bp.id, `pool:${String(i)}`),
  );
  const shown = pools.flatMap((p) =>
    isNum(p.value) && p.poolKind
      ? [{ name: p.name, value: p.value, kind: p.poolKind }]
      : [],
  );
  const ref = bp.root.ref;
  const whole = make(bp.id, bp.root.name, input.key.final, {
    role: "root",
    ...(ref && {
      pieceKey: pieceKeyOf(ref, character),
      code: refKey(ref, character),
    }),
    formula: shown.length === pools.length ? rootFormula(shown) : null,
    kids: pools,
  });
  const byId = new Map<string, Node>();
  const index = (n: Node) => {
    byId.set(n.id, n);
    if (Array.isArray(n.kids)) n.kids.forEach(index);
  };
  index(whole);
  const root = {
    ...whole,
    kids: pools.map((p) => ({ ...p, kids: "lazy" as const })),
  };
  return {
    root,
    expand: (id) => byId.get(id) ?? null,
    whole: () => whole,
  };
}
