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
  IDENT,
  isObj,
  list,
  no,
  obj,
  Refused,
  texts,
  uniqueKeys,
} from "./blueprint-root.ts";
import type {
  Blueprint,
  BlueprintPending,
  BlueprintPiece,
  BlueprintStage,
  PieceArgs,
} from "./blueprint-types.ts";
import { fill, inlinePieces, pieceBody } from "./pieces.ts";
import { ARG_TEXT_MAX, hasRawCharacterIndex } from "./refs.ts";
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
];
const SLUG = /^[a-z0-9-]{1,60}$/;

/** `piece`: a child of a node with `combine`, inside a recipe piece. */
type Level = "source" | "child" | "condition" | "piece";
interface Walk {
  systems: ReadonlySet<string>;
  pending: (kind: BlueprintPending["kind"], where: string) => boolean;
  places: Set<string>;
  pieces: ReadonlyMap<string, unknown>;
  /** The pieces whose body is being checked, the outermost first: a call of one of them again is a cycle. */
  stack: readonly string[];
  /** The node is a part of a count (a child of a combine), the piece it calls included. */
  combined?: boolean;
  /** The node is the model child of a pool's source with `each` (T174, T176). */
  eachModel?: boolean;
  /** The node is below a pool's source, out of any combine: a piece's pools have a root's children (T172). */
  recipe?: boolean;
}

const isArg = (v: unknown): boolean =>
  (typeof v === "number" && Number.isFinite(v)) ||
  (typeof v === "string" && v.length <= ARG_TEXT_MAX && !v.includes("{"));

/** A piece's call checked (T169): the piece exists, is no cycle, and has an arg for each param, none more. */
function pieceOf(
  n: Record<string, unknown>,
  where: string,
  w: Walk,
): { name: string; body: object } {
  if (["children", "leaf", "combine", "each"].some((k) => n[k] !== undefined))
    no(where, "piece vai no lugar de children, leaf, combine e each");
  const c = obj(n.piece, ["name", "args"], `${where}/piece`);
  const name = typeof c.name === "string" && SLUG.test(c.name) ? c.name : null;
  if (name === null) return no(where, "piece.name fora do slug");
  if (w.stack.includes(name)) no(where, `pedaço que chama a si mesmo: ${name}`);
  if (!w.pieces.has(name)) no(where, `pedaço que não existe: ${name}`);
  const at = `pedaço ${name}`;
  const p = obj(
    w.pieces.get(name),
    ["id", "params", "combine", "each", "children", "pools"],
    at,
  );
  if (p.id !== name) no(at, "id diferente do nome do arquivo");
  if (
    p.pools !== undefined &&
    ["combine", "each", "children"].some((k) => p[k] !== undefined)
  )
    no(at, "pools vai no lugar de children, leaf, combine e each");
  const badParams = "params é uma lista de nomes, sem repetir e sem character";
  const params = Array.isArray(p.params)
    ? (p.params as unknown[])
    : no(at, badParams);
  if (
    new Set(params).size !== params.length ||
    !params.every((k) => typeof k === "string" && IDENT.test(k)) ||
    params.includes("character")
  )
    no(at, badParams);
  const args = isObj(c.args) ? c.args : no(where, "piece.args não é um objeto");
  for (const k of Object.keys(args))
    if (!params.includes(k)) no(where, `parâmetro que sobra: ${k}`);
  for (const k of params)
    if (args[k as string] === undefined)
      no(where, `parâmetro que falta: ${String(k)}`);
  if (!Object.values(args).every(isArg))
    no(where, "piece.args leva números e textos curtos, sem {");
  return {
    name,
    body: pieceBody(p as unknown as BlueprintPiece, args as PieceArgs),
  };
}

/**
 * A piece's count and list (T170, T171): `combine` and `each` only inside a piece, the list a path with one `[*]`; a
 * pool's source with `each` and no `combine` (`poolEach`, T174) takes its items from the answer key, in any recipe.
 */
function checkPieceLevel(
  n: Record<string, unknown>,
  where: string,
  w: Walk,
  poolEach: boolean,
): void {
  if (!poolEach && (n.combine !== undefined || n.each !== undefined)) {
    if (w.stack.length === 0) no(where, "combine e each só em pedaço");
    if (n.combine !== "sum" && n.combine !== "product")
      no(where, "combine é sum ou product");
  }
  // a call's level closes by its own recorded count (the Seraph); a read's has none of its own
  const call = isObj(n.ref) && "call" in n.ref;
  if (
    !poolEach &&
    !w.recipe &&
    w.stack.length > 0 &&
    n.children !== undefined &&
    n.combine === undefined &&
    !call
  )
    no(
      where,
      "nó com children num pedaço pede combine, menos o de uma chamada",
    );
  if (n.each === undefined) return;
  const e = obj(n.each, ["list", "as"], `${where}/each`);
  if (typeof e.as !== "string" || !IDENT.test(e.as) || e.as === "character")
    no(where, "each.as é um nome, nunca character");
  if (typeof e.list !== "string" || e.list.split("[*]").length !== 2)
    no(where, "each.list é um caminho com um [*]");
  checkRef({ read: e.list }, `${where}/each`);
  if (hasRawCharacterIndex((e.list as string).replace("[*]", "[0]")))
    no(where, "each.list nunca percorre os personagens");
  if (!Array.isArray(n.children) || n.children.length !== 1)
    no(where, "each tem um filho-modelo só");
}

function checkNode(x: unknown, where: string, level: Level, w: Walk): void {
  w.places.add(where);
  const n = obj(x, NODE_KEYS, where);
  if (n.piece !== undefined) {
    // the node with the piece's body in place of the call, as the load puts it (pieces.ts, inlinePieces)
    const { name, body } = pieceOf(n, where, w);
    const stack = [...w.stack, name];
    checkNode({ ...n, piece: undefined, ...body }, where, level, {
      ...w,
      stack,
    });
    return;
  }
  const poolEach =
    level === "source" && n.each !== undefined && n.combine === undefined;
  checkPieceLevel(n, where, w, poolEach);
  // after the args and the items are in, a `{name}` left is one nothing declares
  const left = Object.entries(n)
    .flatMap(([k, v]) =>
      ["children", "condition", "pools"].includes(k) ? [] : texts(v),
    )
    .find((s) => s.replaceAll("{character}", "").includes("{"));
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
    // a fixed base of the code the game picks by a test (T176): its item ties it, its name is proved at the item's row
    if (n.leaf !== "fixedValue")
      no(where, "o filho-modelo sem ref é folha fixedValue");
  } else if ((n.ref === undefined) === (n.constant === undefined))
    no(where, "ref ou constant: um dos dois, nunca os dois");
  if (n.ref !== undefined) checkRef(n.ref, where);
  if (n.constant !== undefined) {
    if (level !== "source") no(where, "constant só em fonte de pool");
    if (typeof n.constant !== "number" || !Number.isFinite(n.constant))
      no(where, "constant não é um número");
    if (n.leaf !== "fixedValue") no(where, "constant pede leaf fixedValue");
  }
  if (n.weight !== undefined && level !== "source")
    no(where, "weight só em fonte de pool");
  if (n.classes !== undefined) {
    if (level !== "source") no(where, "classes só em fonte de pool");
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
    if (n.leaf !== undefined) no(where, "leaf com children");
    // an each's model is checked with its item's name as an index (`[{as}]` as `[0]`)
    const as = isObj(n.each) ? (n.each.as as string) : null;
    list(n.children, where, "children").forEach((c, i) => {
      checkNode(
        as === null ? c : fill(c, { [as]: 0 }),
        `${where}/children/${String(i)}`,
        n.combine === undefined && (w.stack.length === 0 || w.recipe)
          ? "child"
          : "piece",
        {
          ...w,
          combined: n.combine !== undefined,
          eachModel: poolEach,
          recipe: !!w.recipe && n.combine === undefined,
        },
      );
      siblings.push(c);
    });
  } else if (
    n.leaf === undefined &&
    n.pools === undefined &&
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

export function parseBlueprint(
  raw: unknown,
  ctx: {
    fileId: string;
    systemIds: ReadonlySet<string>;
    /** The recipe pieces by their id (T169): a node may call one. */
    pieces?: ReadonlyMap<string, unknown>;
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
      bp.pending === undefined
        ? []
        : list(bp.pending, "pending", "pending").map((x, i) => {
            const p = obj(x, ["where", "kind"], `pending/${String(i)}`);
            if (
              typeof p.where !== "string" ||
              !PENDING_KINDS.includes(p.kind as string)
            )
              no(
                `pending/${String(i)}`,
                "pendência é { where, kind: name | system | leaf | descend }",
              );
            return p as unknown as BlueprintPending;
          });
    const w: Walk = {
      systems: ctx.systemIds,
      pending: (kind, where) =>
        pending.some((p) => p.kind === kind && p.where === where),
      places: new Set(),
      pieces: ctx.pieces ?? new Map(),
      stack: [],
    };
    checkPools(bp.pools, w);
    for (const p of pending)
      if (!w.places.has(p.where)) no(p.where, "pendência fora da receita");
    return {
      ok: true,
      stage: pending.length > 0 ? "draft" : "complete",
      blueprint: inlinePieces(bp as unknown as Blueprint, w.pieces),
    };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.message };
    throw e;
  }
}
