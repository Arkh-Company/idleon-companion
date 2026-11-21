// The blueprint of a number (spec 010, FR-002–FR-007, contracts/blueprint.md): its declared shape, with references, the
// game's names, leaf kinds and keys; never a value, a formula or the game's code. `parseBlueprint` is the check on load:
// a blueprint outside these rules answers `unknownNumber` for its number. A draft (research R7) says in `pending` where
// a name, a system, a leaf or a descent is still missing; only there may it be null or absent.
import { CALC_CONDITION_KINDS, CALC_LEAF_KINDS } from "../tree-contract.ts";
import { hasRawCharacterIndex, isPathRead } from "./refs.ts";
import type { Ref } from "./refs.ts";

export type LeafKind = Exclude<(typeof CALC_LEAF_KINDS)[number], "unknown">;
export type ConditionKind = (typeof CALC_CONDITION_KINDS)[number];
export type NameProof =
  { table: string; row: number | string } | { names: string };

export interface BlueprintNode {
  key: string;
  /** In a draft, null where `pending` says `name`. */
  name: string;
  nameProof?: NameProof;
  ref?: Ref;
  /** A loose constant of a pool (the `+ 2`, the `× 1.2`): no `ref`, leaf `fixedValue`. */
  constant?: number;
  weight?: number;
  classes?: readonly number[];
  condition?: BlueprintNode;
  termPart?: { system: string };
  children?: readonly BlueprintNode[];
  leaf?: LeafKind;
  conditionKind?: ConditionKind;
}
export interface BlueprintGroup {
  /** In a draft, null where `pending` says `system`. */
  system: string;
  sources: readonly BlueprintNode[];
}
export interface BlueprintPool {
  kind: "additive" | "multi";
  weight?: 1 | 0.01;
  groups: readonly BlueprintGroup[];
}
export interface BlueprintPending {
  /** The place in the file: `pools/0/groups/1/sources/2/children/0`. */
  where: string;
  kind: "name" | "system" | "leaf" | "descend";
}
export interface Blueprint {
  id: string;
  root: {
    name: string;
    nameProof?: NameProof;
    ref: Extract<Ref, { call: string }>;
  };
  /** Empty in a sketch. */
  pools: readonly BlueprintPool[];
  pending?: readonly BlueprintPending[];
}
export type BlueprintStage = "sketch" | "draft" | "complete";

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
];
const SLUG = /^[a-z0-9-]{1,60}$/;
const IDENT = /^[A-Za-z_$][\w$]*$/;
const NO_NAME = /^(?:no name yet|game value)$/i;

class Refused extends Error {}
const no = (where: string, why: string): never => {
  throw new Refused(`${where || "receita"}: ${why}`);
};
const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
function obj(
  x: unknown,
  allowed: readonly string[],
  where: string,
): Record<string, unknown> {
  if (!isObj(x)) return no(where, "não é um objeto");
  for (const k of Object.keys(x))
    if (!allowed.includes(k)) no(where, `chave fora das listadas: ${k}`);
  return x;
}
const list = (x: unknown, where: string, what: string): unknown[] =>
  Array.isArray(x) && x.length > 0 ? x : no(where, `${what} vazio`);

function checkName(x: unknown, where: string): void {
  if (typeof x !== "string" || x.trim() === "" || NO_NAME.test(x.trim()))
    no(where, "name vazio, no name yet ou Game value");
}

function checkProof(x: unknown, where: string): void {
  const p = obj(x, ["table", "row", "names"], `${where}/nameProof`);
  const ok =
    "names" in p
      ? Object.keys(p).length === 1 && typeof p.names === "string"
      : typeof p.table === "string" &&
        IDENT.test(p.table) &&
        (typeof p.row === "string" ||
          (typeof p.row === "number" && Number.isInteger(p.row)));
  if (!ok) no(where, "nameProof é { table, row } ou { names }");
}

function checkRef(x: unknown, where: string): void {
  if (isObj(x) && "call" in x) {
    const r = obj(x, ["call", "args"], `${where}/ref`);
    if (typeof r.call !== "string" || !IDENT.test(r.call))
      no(where, "ref.call não é um identificador");
    if (
      !Array.isArray(r.args) ||
      !r.args.every(
        (a) =>
          (typeof a === "number" && Number.isFinite(a)) ||
          (typeof a === "string" && a.length <= 60),
      )
    )
      no(where, "ref.args só leva números e textos curtos");
    return;
  }
  const r = obj(x, ["read"], `${where}/ref`);
  if (typeof r.read !== "string" || !isPathRead(r.read))
    no(where, "ref.read não é um caminho de nomes e índices");
  else if (hasRawCharacterIndex(r.read))
    no(where, "índice de personagem por extenso no ref.read");
}

type Level = "source" | "child" | "condition";
interface Walk {
  systems: ReadonlySet<string>;
  pending: (kind: BlueprintPending["kind"], where: string) => boolean;
  places: Set<string>;
}

function uniqueKeys(nodes: unknown[], where: string): void {
  const keys = nodes.map((n) => (isObj(n) ? n.key : undefined));
  if (new Set(keys).size !== keys.length)
    no(where, "key repetida entre irmãos");
}

function checkNode(x: unknown, where: string, level: Level, w: Walk): void {
  w.places.add(where);
  const n = obj(x, NODE_KEYS, where);
  if (typeof n.key !== "string" || !SLUG.test(n.key))
    no(where, "key fora do slug");
  if (n.name !== null || !w.pending("name", where)) checkName(n.name, where);
  if (n.nameProof !== undefined) checkProof(n.nameProof, where);
  if ((n.ref === undefined) === (n.constant === undefined))
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
  const siblings: unknown[] = [];
  if (n.children !== undefined) {
    if (n.leaf !== undefined) no(where, "leaf com children");
    list(n.children, where, "children").forEach((c, i) => {
      checkNode(c, `${where}/children/${String(i)}`, "child", w);
      siblings.push(c);
    });
  } else if (
    n.leaf === undefined &&
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

function checkPools(raw: unknown, w: Walk): void {
  let prev: unknown = null;
  list(raw, "pools", "pools").forEach((x, i) => {
    const where = `pools/${String(i)}`;
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
        checkNode(s, `${gw}/sources/${String(k)}`, "source", w);
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
  ctx: { fileId: string; systemIds: ReadonlySet<string> },
):
  | { ok: true; stage: BlueprintStage; blueprint: Blueprint }
  | { ok: false; reason: string } {
  try {
    const bp = obj(raw, ["id", "root", "pools", "pending"], "");
    if (bp.id !== ctx.fileId) no("id", "id diferente do nome do arquivo");
    const root = obj(bp.root, ["name", "nameProof", "ref"], "root");
    checkName(root.name, "root");
    if (root.nameProof !== undefined) checkProof(root.nameProof, "root");
    if (!isObj(root.ref) || !("call" in root.ref))
      no("root", "a raiz é uma chamada (ref.call)");
    checkRef(root.ref, "root");
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
    };
    checkPools(bp.pools, w);
    for (const p of pending)
      if (!w.places.has(p.where)) no(p.where, "pendência fora da receita");
    return {
      ok: true,
      stage: pending.length > 0 ? "draft" : "complete",
      blueprint: bp as unknown as Blueprint,
    };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.message };
    throw e;
  }
}
