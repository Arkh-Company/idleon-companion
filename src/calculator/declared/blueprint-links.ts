// The nodes that stand for another body in a blueprint's check on load (spec 010, contracts/blueprint.md): a recipe
// piece's call (T169, moved out of blueprint.ts as it was), its body come in its place, and a line with a link to
// another number's tree (T200), which stays a link.
import { IDENT, isObj, no, obj } from "./blueprint-root.ts";
import type { BlueprintPiece, PieceArgs } from "./blueprint-types.ts";
import { SHAPED } from "./draft-link.ts";
import { pieceBody } from "./pieces.ts";
import { ARG_TEXT_MAX, callKey } from "./refs.ts";

export const SLUG = /^[a-z0-9-]{1,60}$/;

const isArg = (v: unknown): boolean =>
  (typeof v === "number" && Number.isFinite(v)) ||
  (typeof v === "string" && v.length <= ARG_TEXT_MAX && !v.includes("{"));

/** The blueprints a link may name (T200): the one being checked, and each blueprint file's id with its root's text. */
export interface Trees {
  own: string;
  roots: ReadonlyMap<string, string | null>;
}

/** A ref's text as the file writes it: `Block(args in JSON)`, or the path. */
const refText = (r: unknown): string | null =>
  !isObj(r)
    ? null
    : typeof r.call === "string" && Array.isArray(r.args)
      ? callKey(r.call, r.args)
      : typeof r.read === "string"
        ? r.read
        : null;

/** A recipe's root as the number a link opens (T200 r1): its call's text; null for a root that is not the call's value. */
export function rootText(raw: unknown): string | null {
  const root = isObj(raw) && isObj(raw.root) ? raw.root : null;
  if (!root || SHAPED.some((f) => root[f] !== undefined)) return null;
  return isObj(root.ref) && typeof root.ref.call === "string"
    ? refText(root.ref)
    : null;
}

/**
 * A line with a link checked (T200): a ref, a blueprint's id that is not its own, no descent of its own, and (r1) the
 * line is that blueprint's root: its ref has the root's text.
 */
export function checkTree(
  n: Record<string, unknown>,
  where: string,
  trees: Trees,
): void {
  if (
    ["children", "leaf", "combine", "each", "piece", "pools"].some(
      (k) => n[k] !== undefined,
    )
  )
    no(where, "tree vai no lugar de children, leaf, combine, each e piece");
  if (typeof n.tree !== "string" || !SLUG.test(n.tree))
    return no(where, "tree fora do slug");
  if (n.tree === trees.own)
    no(where, `a linha com link aponta para a própria receita: ${n.tree}`);
  if (!trees.roots.has(n.tree))
    no(where, `árvore que não existe em blueprints/: ${n.tree}`);
  if (n.ref === undefined) no(where, "a linha com link pede ref");
  const root = trees.roots.get(n.tree) ?? null;
  const line = refText(n.ref);
  if (line !== root)
    no(
      where,
      `a linha não é a raiz de ${n.tree}: ${line ?? "?"}; a raiz é ${root ?? "um valor que não é o da chamada"}`,
    );
}

/**
 * A piece's call checked (T169): the piece exists, is no cycle (`stack`, the pieces whose body is being checked), and
 * has an arg for each param, none more.
 */
export function pieceOf(
  n: Record<string, unknown>,
  where: string,
  stack: readonly string[],
  pieces: ReadonlyMap<string, unknown>,
): { name: string; body: object } {
  if (["children", "leaf", "combine", "each"].some((k) => n[k] !== undefined))
    no(where, "piece vai no lugar de children, leaf, combine e each");
  const c = obj(n.piece, ["name", "args"], `${where}/piece`);
  const name = typeof c.name === "string" && SLUG.test(c.name) ? c.name : null;
  if (name === null) return no(where, "piece.name fora do slug");
  if (stack.includes(name)) no(where, `pedaço que chama a si mesmo: ${name}`);
  if (!pieces.has(name)) no(where, `pedaço que não existe: ${name}`);
  const at = `pedaço ${name}`;
  const p = obj(
    pieces.get(name),
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
