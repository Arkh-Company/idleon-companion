// The root of a blueprint, and the checks of a name, a proof and a reference a node shares with it (spec 010,
// FR-002–FR-007, contracts/blueprint.md; moved out of blueprint.ts as they were): a call, a sum of calls, a part of a
// call, a marker on the recording's copy, or a routine with the state path it sums. A check that fails throws Refused,
// which parseBlueprint turns into the blueprint's reason.
import { ARG_TEXT_MAX, hasRawCharacterIndex, isPathRead } from "./refs.ts";

export const IDENT = /^[A-Za-z_$][\w$]*$/;
const NO_NAME = /^(?:no name yet|game value)$/i;

export class Refused extends Error {}
export const no = (where: string, why: string): never => {
  throw new Refused(`${where || "receita"}: ${why}`);
};
export const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
export function obj(
  x: unknown,
  allowed: readonly string[],
  where: string,
): Record<string, unknown> {
  if (!isObj(x)) return no(where, "não é um objeto");
  for (const k of Object.keys(x))
    if (!allowed.includes(k)) no(where, `chave fora das listadas: ${k}`);
  return x;
}
export const list = (x: unknown, where: string, what: string): unknown[] =>
  Array.isArray(x) && x.length > 0 ? x : no(where, `${what} vazio`);

export function checkName(x: unknown, where: string): void {
  if (typeof x !== "string" || x.trim() === "" || NO_NAME.test(x.trim()))
    no(where, "name vazio, no name yet ou Game value");
}

export function checkProof(x: unknown, where: string): void {
  const p = obj(x, ["table", "row", "names"], `${where}/nameProof`);
  const ok =
    "names" in p
      ? Object.keys(p).length === 1 && typeof p.names === "string"
      : typeof p.table === "string" &&
        // a game table by its path of names (`CustomLists.StarSigns`, T176)
        p.table.split(".").every((s) => IDENT.test(s)) &&
        (typeof p.row === "string" ||
          (typeof p.row === "number" && Number.isInteger(p.row)));
  if (!ok) no(where, "nameProof é { table, row } ou { names }");
}

/** A path through a helper names its behavior (`….getBehavior(ActorEvents_1)._GenINFO[8]`): checked without the name. */
const throughHelper = (p: string): string =>
  p.replace(/\.getBehavior\([A-Za-z_$][\w$]*\)/g, ".getBehavior");

export function checkRef(x: unknown, where: string, list = false): void {
  if (isObj(x) && "call" in x) {
    const r = obj(x, ["call", "args"], `${where}/ref`);
    if (typeof r.call !== "string" || !IDENT.test(r.call))
      no(where, "ref.call não é um identificador");
    if (
      !Array.isArray(r.args) ||
      !r.args.every(
        (a) =>
          (typeof a === "number" && Number.isFinite(a)) ||
          (typeof a === "string" && a.length <= ARG_TEXT_MAX) ||
          (list &&
            Array.isArray(a) &&
            a.length > 0 &&
            a.length <= 8 &&
            a.every((x) => typeof x === "number" && Number.isFinite(x))),
      )
    )
      no(
        where,
        "ref.args só leva números e textos curtos; uma lista de até 8 números só no ref da raiz",
      );
    return;
  }
  const r = obj(x, ["read"], `${where}/ref`);
  const read = typeof r.read === "string" ? throughHelper(r.read) : null;
  if (read === null || !isPathRead(read))
    no(where, "ref.read não é um caminho de nomes e índices");
  else if (hasRawCharacterIndex(read))
    no(where, "índice de personagem por extenso no ref.read");
}

const isCall = (x: unknown): boolean => isObj(x) && "call" in x;
/** A state path of the root (branch, sum): the ref.read's checks, a character's index never written out. */
const isStatePath = (p: unknown): boolean =>
  typeof p === "string" && isPathRead(p) && !hasRawCharacterIndex(p);

export function checkRoot(raw: unknown): void {
  const root = obj(
    raw,
    [
      "name",
      "nameProof",
      "ref",
      "combine",
      "calls",
      "part",
      "branch",
      "scratch",
      "routine",
      "sum",
      "item",
    ],
    "root",
  );
  checkName(root.name, "root");
  if (root.nameProof !== undefined) checkProof(root.nameProof, "root");
  if (
    root.item !== undefined &&
    (!Number.isInteger(root.item) ||
      (root.item as number) < 0 ||
      root.ref === undefined)
  )
    no("root", "item é o índice de um item da lista que a chamada ref devolve");
  if (root.item !== undefined && root.part !== undefined)
    no("root", "item não vai junto com part");
  if (typeof root.branch === "string" && hasRawCharacterIndex(root.branch))
    no("root", "índice de personagem por extenso no branch");
  if (
    root.branch !== undefined &&
    (root.part === undefined || !isStatePath(root.branch))
  )
    no("root", "branch é o caminho da lista que o ramo procura, só com part");
  if (root.routine !== undefined) {
    checkRoutine(root);
    return;
  }
  if (root.sum !== undefined) no("root", "sum só com routine");
  if (root.combine !== undefined) {
    if (root.combine !== "sum") no("root", "combine só é sum");
    if (
      root.ref !== undefined ||
      root.part !== undefined ||
      root.scratch !== undefined
    )
      no("root", "a soma de chamadas não tem ref, part nem scratch");
    list(root.calls, "root", "calls").forEach((c, i) => {
      if (!isCall(c)) no("root", "calls só tem chamadas");
      checkRef(c, `root/calls/${String(i)}`);
    });
    return;
  }
  if (root.calls !== undefined) no("root", "calls só com combine: sum");
  if (!isCall(root.ref)) no("root", "a raiz é uma chamada (ref.call)");
  checkRef(root.ref, "root", true);
  if (root.part !== undefined) {
    if (!Array.isArray(root.part) || root.part.length === 0)
      no("root", "part é uma lista de referências");
    (root.part as unknown[]).forEach((r, i) => {
      if (!isObj(r) || !("call" in r || "read" in r))
        no("root", "part só tem referências (call ou read)");
      checkRef(r, `root/part/${String(i)}`);
    });
  }
  if (root.scratch !== undefined) {
    if (!isObj(root.scratch))
      no("root", "scratch é { atributo: texto curto ou número }");
    const m = obj(
      root.scratch,
      Object.keys(root.scratch as object),
      "root/scratch",
    );
    const entries = Object.entries(m);
    if (
      entries.length === 0 ||
      !entries.every(
        ([k, v]) =>
          IDENT.test(k) &&
          ((typeof v === "string" && v.length <= 60) ||
            (typeof v === "number" && Number.isFinite(v))),
      )
    )
      no("root", "scratch é { atributo: texto curto ou número }");
  }
}

function checkRoutine(root: Record<string, unknown>): void {
  if (
    Object.keys(root).some(
      (k) => !["name", "nameProof", "routine", "sum"].includes(k),
    )
  )
    no("root", "a raiz routine só tem name, nameProof, routine e sum");
  const steps = Array.isArray(root.routine)
    ? list(root.routine, "root", "routine")
    : [root.routine];
  steps.forEach(checkRoutineStep);
  const sum = typeof root.sum === "string" ? throughHelper(root.sum) : null;
  if (sum !== null && hasRawCharacterIndex(sum))
    no("root", "índice de personagem por extenso no sum");
  if (sum === null || !isStatePath(sum))
    no("root", "sum é um caminho do estado");
}

const isShort = (a: unknown) =>
  (typeof a === "number" && Number.isFinite(a)) ||
  (typeof a === "string" && a.length <= 60);

function checkRoutineStep(r: unknown): void {
  if (isCall(r)) checkRef(r, "root/routine");
  else {
    const e = obj(
      r,
      ["slot", "behavior", "event", "args", "set"],
      "root/routine",
    );
    const okArgs =
      e.args === undefined || (Array.isArray(e.args) && e.args.every(isShort));
    const okSet =
      e.set === undefined ||
      (Array.isArray(e.set) &&
        e.set.length === 2 &&
        typeof e.set[0] === "string" &&
        IDENT.test(e.set[0]) &&
        isShort(e.set[1]));
    if (
      !Number.isInteger(e.slot) ||
      (e.slot as number) < 0 ||
      typeof e.behavior !== "string" ||
      !IDENT.test(e.behavior) ||
      typeof e.event !== "string" ||
      !IDENT.test(e.event) ||
      !okArgs ||
      !okSet
    )
      no(
        "root",
        "routine é uma chamada ou { slot, behavior, event, args, set }, ou uma lista deles",
      );
  }
}

/** Every text inside a value, at any depth. */
export const texts = (x: unknown): string[] =>
  typeof x === "string"
    ? [x]
    : Array.isArray(x)
      ? x.flatMap(texts)
      : isObj(x)
        ? Object.values(x).flatMap(texts)
        : [];

export function uniqueKeys(nodes: unknown[], where: string): void {
  const keys = nodes.map((n) => (isObj(n) ? n.key : undefined));
  if (new Set(keys).size !== keys.length)
    no(where, "key repetida entre irmãos");
}

/**
 * An `each`'s list and names (T170, T174): the list a path with one `[*]`, never through the characters; two only in a
 * pool's source (T179, the equipment's rows and slots), `as` then naming one index per `[*]`.
 */
export function checkEach(x: unknown, where: string, poolEach: boolean): void {
  // a list of calls of one block (T205): the block's name and the item's
  if (isObj(x) && "calls" in x) {
    const c = obj(x, ["calls", "as"], `${where}/each`);
    if (typeof c.calls !== "string" || !IDENT.test(c.calls))
      no(where, "each.calls é o nome de um bloco");
    if (typeof c.as !== "string" || !IDENT.test(c.as) || c.as === "character")
      no(where, "each.as é um nome, nunca character");
    return;
  }
  const e = obj(x, ["list", "as"], `${where}/each`);
  const names: unknown[] = Array.isArray(e.as) ? e.as : [e.as];
  const bad = (a: unknown) =>
    typeof a !== "string" || !IDENT.test(a) || a === "character";
  if (names.some(bad) || new Set(names).size !== names.length)
    no(where, "each.as é um nome, nunca character");
  const stars = typeof e.list === "string" ? e.list.split("[*]").length - 1 : 0;
  if (stars < 1 || stars > (poolEach ? 2 : 1))
    no(where, "each.list é um caminho com um [*]");
  if (names.length !== stars)
    no(where, "each.as tem um nome por [*] de each.list");
  checkRef({ read: e.list }, `${where}/each`);
  if (hasRawCharacterIndex((e.list as string).replaceAll("[*]", "[0]")))
    no(where, "each.list nunca percorre os personagens");
}
