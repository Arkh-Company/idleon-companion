// The blueprint of a number (spec 010, FR-002–FR-007, contracts/blueprint.md): its declared shape, with references, the
// game's names, leaf kinds and keys; never a value, a formula or the game's code. `parseBlueprint` is the check on load:
// a blueprint outside these rules answers `unknownNumber` for its number. A draft (research R7) says in `pending` where
// a name, a system, a leaf or a descent is still missing; only there may it be null or absent.
import { CALC_CONDITION_KINDS, CALC_LEAF_KINDS } from "../tree-contract.ts";
import {
  checkName,
  checkProof,
  checkRef,
  checkRoot,
  isObj,
  list,
  no,
  obj,
  Refused,
  texts,
  uniqueKeys,
} from "./blueprint-root.ts";
import { checkTree, pieceOf, SLUG } from "./blueprint-links.ts";
import type {
  Blueprint,
  BlueprintPending,
  BlueprintStage,
} from "./blueprint-types.ts";
import { fill, inlinePieces } from "./pieces.ts";
import { ANY_CALL, eachNames } from "./refs.ts";
import { checkPieceLevel } from "./blueprint-walk.ts";
import type { Level, Walk } from "./blueprint-walk.ts";
export type {
  LeafKind,
  ConditionKind,
  NameProof,
  BlueprintNode,
  BlueprintGroup,
  BlueprintPool,
  BlueprintPending,
  CallRef,
  BlueprintRoot,
  RoutineStep,
  Blueprint,
  BlueprintStage,
} from "./blueprint-types.ts";

const LEAF_KINDS: readonly string[] = CALC_LEAF_KINDS.filter(
  (k) => k !== "unknown",
);
const PENDING_KINDS = ["name", "system", "leaf", "descend"];
const NODE_KEYS = [
  "key",
  "name",
  "nameProof",
  "ref",
  "constant",
  "weight",
  "classes",
  "condition",
  "termPart",
  "children",
  "leaf",
  "conditionKind",
  "piece",
  "combine",
  "each",
  "pools",
  "tree",
];

function checkNode(x: unknown, where: string, level: Level, w: Walk): void {
  w.places.add(where);
  const n = obj(x, NODE_KEYS, where);
  if (n.tree !== undefined) checkTree(n, where, w.trees);
  if (n.piece !== undefined) {
    // the node with the piece's body in place of the call, as the load puts it (pieces.ts, inlinePieces)
    const { name, body, pending } = pieceOf(n, where, w.stack, w.pieces);
    const stack = [...w.stack, name];
    // its pending places (T216), at their place below the line that calls it
    const own =
      pending === undefined
        ? []
        : pendingOf(pending, `pedaço ${name}/pending`).map((x) => ({
            ...x,
            where: `${where}/${x.where}`,
          }));
    w.piecePending.push(...own);
    checkNode({ ...n, piece: undefined, ...body }, where, level, {
      ...w,
      stack,
      pending: (kind, at) =>
        w.pending(kind, at) ||
        own.some((x) => x.kind === kind && x.where === at),
    });
    return;
  }
  // a list of calls (T205), or any list below a source that is a call (T213: the slots of its level), is a node's, in a
  // pool's source too: never the answer key's items
  const calls = isObj(n.each) && "calls" in n.each;
  const ofCall = calls || (isObj(n.ref) && "call" in n.ref);
  const poolEach =
    level === "source" &&
    n.each !== undefined &&
    n.combine === undefined &&
    !ofCall;
  // a recipe's node with a long list below it (T202): one model child, one child per part of its level the list matches
  const nodeEach =
    (level === "child" || ofCall) &&
    n.each !== undefined &&
    n.combine === undefined;
  checkPieceLevel(n, where, w, poolEach, poolEach || nodeEach);
  // after the args and the items are in, a `{name}` left is one nothing declares; a `{` of a key's name is none (T197)
  const left = Object.entries(n)
    .flatMap(([k, v]) =>
      ["children", "condition", "pools"].includes(k) ? [] : texts(v),
    )
    .find((s) => /\{[A-Za-z_$][\w$]*\}/.test(s.replaceAll("{character}", "")));
  if (left !== undefined) no(where, `{nome} não declarado: ${left}`);
  if (level === "piece" && n.condition !== undefined)
    no(where, "condition não vai dentro de pedaço");
  if (typeof n.key !== "string" || !SLUG.test(n.key))
    no(where, "key fora do slug");
  if (n.name !== null || !w.pending("name", where)) checkName(n.name, where);
  if (n.nameProof !== undefined) checkProof(n.nameProof, where);
  if (poolEach) {
    if (n.ref !== undefined || n.constant !== undefined)
      no(where, "a fonte com each vai sem ref nem constant");
    // its items are the answer key's terms, the condition left out (T174): a class or a condition would go unread
    if (n.classes !== undefined || n.condition !== undefined)
      no(where, "a fonte com each vai sem classes nem condition");
  } else if (w.eachModel && n.ref === undefined && n.constant === undefined) {
    // a fixed base of the code the game picks by a test (T176), or the item a game table's value was read by (T179,
    // a choice): its item ties it, its name is proved at the item's row
    if (n.leaf !== "fixedValue" && n.leaf !== "choice")
      no(where, "o filho-modelo sem ref é folha fixedValue ou choice");
  } else if ((n.ref === undefined) === (n.constant === undefined))
    no(where, "ref ou constant: um dos dois, nunca os dois");
  if (n.ref !== undefined) checkRef(n.ref, where);
  // any call of the block (T208): the whole args of a cache's author only
  const args: unknown = isObj(n.ref) ? n.ref.args : undefined;
  if (
    Array.isArray(args) &&
    args.includes(ANY_CALL) &&
    !(level === "child" && w.author && args.length === 1)
  )
    no(where, "any só no autor de um cache, e sozinho nos args");
  if (n.constant !== undefined) {
    // in a call's level, a number of the code with the conditions that apply it as its children (T209, form 3)
    const applied =
      level === "child" &&
      Array.isArray(n.children) &&
      n.children.length > 0 &&
      n.children.every((c) => isObj(c) && c.leaf === "condition");
    if (level !== "source" && !applied)
      no(
        where,
        "constant só em fonte de pool, ou numa chamada com as suas condições",
      );
    if (typeof n.constant !== "number" || !Number.isFinite(n.constant))
      no(where, "constant não é um número");
    if (n.leaf !== "fixedValue" && !applied)
      no(where, "constant pede leaf fixedValue");
  }
  if (n.weight !== undefined && level !== "source")
    no(where, "weight só em fonte de pool");
  if (n.classes !== undefined) {
    // a call's child only some classes have (T211), as a pool's source
    if (level !== "source" && level !== "child")
      no(where, "classes só em fonte de pool ou em filho de chamada");
    if (
      !Array.isArray(n.classes) ||
      !n.classes.every((c) => Number.isInteger(c) && (c as number) >= 0)
    )
      no(where, "classes é uma lista de ids de classe");
  }
  if (n.termPart !== undefined) {
    if (level !== "child") no(where, "termPart só em filho");
    const t = obj(n.termPart, ["system"], `${where}/termPart`);
    if (typeof t.system !== "string" || !w.systems.has(t.system))
      no(where, "termPart.system fora de systems.json");
  }
  if (n.pools !== undefined) {
    // a piece with the form of a recipe (T173): its pools in place of its count and its children
    if (w.stack.length === 0) no(where, "pools só em pedaço");
    if (w.combined) no(where, "pools não vai dentro de combine");
    if (["children", "leaf", "combine", "each"].some((k) => n[k] !== undefined))
      no(where, "pools vai no lugar de children, leaf, combine e each");
    checkPools(n.pools, w, `${where}/pools`);
  }
  const siblings: unknown[] = [];
  if (n.children !== undefined) {
    // a count (T215): a quantity line, its one child the model each item's condition is, over the list its turns test
    const count =
      n.leaf === "quantity" &&
      isObj(n.each) &&
      "list" in n.each &&
      Array.isArray(n.children) &&
      n.children.length === 1 &&
      isObj(n.children[0]) &&
      n.children[0].leaf === "condition";
    if (n.leaf !== undefined && !count) no(where, "leaf com children");
    // an each's model is checked with its items' names as indices (`[{as}]` as `[0]`)
    const as: Record<string, number> | null = isObj(n.each)
      ? Object.fromEntries(
          eachNames(n.each.as as string | string[]).map((a) => [a, 0]),
        )
      : null;
    list(n.children, where, "children").forEach((c, i) => {
      checkNode(
        as === null ? c : fill(c, as),
        `${where}/children/${String(i)}`,
        n.combine === undefined && (w.stack.length === 0 || w.recipe)
          ? "child"
          : "piece",
        {
          ...w,
          combined: n.combine !== undefined,
          eachModel: poolEach,
          recipe: !!w.recipe && n.combine === undefined,
          author:
            isObj(n.ref) &&
            typeof n.ref.read === "string" &&
            n.ref.read.startsWith("DNSM."),
        },
      );
      siblings.push(c);
    });
  } else if (
    n.leaf === undefined &&
    n.pools === undefined &&
    n.tree === undefined &&
    !w.pending("leaf", where) &&
    !w.pending("descend", where)
  )
    no(where, "sem leaf nem children");
  if (n.leaf !== undefined && !LEAF_KINDS.includes(n.leaf as string))
    no(where, "leaf fora dos 9 tipos");
  if (n.conditionKind !== undefined) {
    if (n.leaf !== "condition") no(where, "conditionKind sem leaf condition");
    if (!(CALC_CONDITION_KINDS as readonly unknown[]).includes(n.conditionKind))
      no(where, "conditionKind desconhecido");
  }
  if (n.condition !== undefined) {
    checkNode(n.condition, `${where}/condition`, "condition", w);
    if (isObj(n.condition) && n.condition.leaf !== "condition")
      no(where, "a condição é uma folha condition");
    siblings.push(n.condition);
  }
  uniqueKeys(siblings, where);
}

function checkPools(raw: unknown, w: Walk, at = "pools"): void {
  let prev: unknown = null;
  list(raw, at, "pools").forEach((x, i) => {
    const where = `${at}/${String(i)}`;
    const p = obj(x, ["kind", "weight", "groups"], where);
    if (p.kind !== "additive" && p.kind !== "multi")
      no(where, "kind é additive ou multi");
    if (p.kind === prev) no(where, "dois pools seguidos do mesmo kind");
    prev = p.kind;
    if (
      p.weight !== undefined &&
      (p.kind !== "additive" || ![1, 0.01].includes(p.weight as number))
    )
      no(where, "weight do pool é 1 ou 0.01, só no additive");
    const all: unknown[] = [];
    list(p.groups, where, "groups").forEach((gx, j) => {
      const gw = `${where}/groups/${String(j)}`;
      w.places.add(gw);
      const g = obj(gx, ["system", "sources"], gw);
      if (g.system !== null || !w.pending("system", gw))
        if (
          typeof g.system !== "string" ||
          !w.systems.has(g.system) ||
          /^other$/i.test(g.system)
        )
          no(gw, "system fora de systems.json");
      const weights = new Set<unknown>();
      list(g.sources, gw, "sources").forEach((s, k) => {
        checkNode(s, `${gw}/sources/${String(k)}`, "source", {
          ...w,
          recipe: true,
        });
        const own = isObj(s) ? s.weight : undefined;
        if (own !== undefined && p.kind !== "additive")
          no(gw, "weight de fonte só no additive");
        weights.add(own ?? p.weight ?? 1);
        all.push(s);
      });
      if (weights.size > 1) no(gw, "grupo com peso misturado");
    });
    uniqueKeys(all, where);
  });
}

/** A list of pending places: `{ where, kind }`, the kind one of PENDING_KINDS (T199, T216). */
function pendingOf(raw: unknown, at: string): BlueprintPending[] {
  return list(raw, at, at).map((x, i) => {
    const p = obj(x, ["where", "kind"], `${at}/${String(i)}`);
    if (
      typeof p.where !== "string" ||
      !PENDING_KINDS.includes(p.kind as string)
    )
      no(
        `${at}/${String(i)}`,
        "pendência é { where, kind: name | system | leaf | descend }",
      );
    return p as unknown as BlueprintPending;
  });
}

export function parseBlueprint(
  raw: unknown,
  ctx: {
    fileId: string;
    systemIds: ReadonlySet<string>;
    /** The recipe pieces by their id (T169): a node may call one. */
    pieces?: ReadonlyMap<string, unknown>;
    /** Each blueprint file's id with its root's text (T200, blueprint-links.ts rootText): a line may link to its tree. */
    trees?: ReadonlyMap<string, string | null>;
  },
):
  | { ok: true; stage: BlueprintStage; blueprint: Blueprint }
  | { ok: false; reason: string } {
  try {
    const bp = obj(raw, ["id", "root", "pools", "pending"], "");
    if (bp.id !== ctx.fileId) no("id", "id diferente do nome do arquivo");
    checkRoot(bp.root);
    if (bp.pools === undefined && bp.pending === undefined)
      return {
        ok: true,
        stage: "sketch",
        blueprint: { ...(bp as unknown as Blueprint), pools: [] },
      };
    const pending =
      bp.pending === undefined ? [] : pendingOf(bp.pending, "pending");
    const w: Walk = {
      systems: ctx.systemIds,
      pending: (kind, where) =>
        pending.some((p) => p.kind === kind && p.where === where),
      places: new Set(),
      pieces: ctx.pieces ?? new Map(),
      trees: { own: ctx.fileId, roots: ctx.trees ?? new Map() },
      stack: [],
      piecePending: [],
    };
    checkPools(bp.pools, w);
    for (const p of pending)
      if (!w.places.has(p.where)) no(p.where, "pendência fora da receita");
    for (const p of w.piecePending)
      if (!w.places.has(p.where)) no(p.where, "pendência fora do pedaço");
    const all = [...pending, ...w.piecePending];
    const inlined = inlinePieces(bp as unknown as Blueprint, w.pieces);
    return {
      ok: true,
      stage: all.length > 0 ? "draft" : "complete",
      // a piece's pending places are the recipe's, at their place (T216)
      blueprint:
        w.piecePending.length > 0 ? { ...inlined, pending: all } : inlined,
    };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.message };
    throw e;
  }
}
