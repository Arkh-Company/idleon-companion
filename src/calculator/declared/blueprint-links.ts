// The nodes that stand for another body in a blueprint's check on load (spec 010, contracts/blueprint.md; moved out of
// blueprint.ts as it was, T200): a recipe piece's call (T169), its body come in its place.
import { IDENT, isObj, no, obj } from "./blueprint-root.ts";
import type { BlueprintPiece, PieceArgs } from "./blueprint-types.ts";
import { pieceBody } from "./pieces.ts";
import { ARG_TEXT_MAX } from "./refs.ts";

export const SLUG = /^[a-z0-9-]{1,60}$/;

const isArg = (v: unknown): boolean =>
  (typeof v === "number" && Number.isFinite(v)) ||
  (typeof v === "string" && v.length <= ARG_TEXT_MAX && !v.includes("{"));

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
