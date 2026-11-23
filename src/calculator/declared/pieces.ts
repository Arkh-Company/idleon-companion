// The recipe pieces (spec 010, T169, T170; spec, Open Questions 23/11): a part several blueprints share, written once in
// `blueprints/pieces/<id>.piece.json` with its params and called by a node with `piece: { name, args }`. `fill` puts a
// value in place of `{name}` (a param's arg, or an item of an `each` list in the lock); after the check, the load puts
// each piece's body, filled in, in the node that calls it, so the lock and the assembly read plain nodes.
import type {
  Blueprint,
  BlueprintNode,
  BlueprintPiece,
  PieceArgs,
} from "./blueprint-types.ts";

/** `x` with `{name}` filled in by each value: a whole text `"{name}"` takes the value itself, a number staying one. */
export function fill<T>(x: T, values: PieceArgs): T {
  let s = JSON.stringify(x);
  for (const [k, v] of Object.entries(values))
    s = s
      .replaceAll(JSON.stringify(`{${k}}`), JSON.stringify(v))
      .replaceAll(`{${k}}`, JSON.stringify(String(v)).slice(1, -1));
  return JSON.parse(s) as T;
}

/** What a piece puts in the node that calls it: its count, its list and its children, with the args filled in. */
export const pieceBody = (
  p: BlueprintPiece,
  args: PieceArgs,
): Pick<BlueprintNode, "combine" | "each" | "children"> =>
  fill(
    {
      combine: p.combine,
      ...(p.each && { each: p.each }),
      children: p.children,
    },
    args,
  );

/** A checked blueprint with each piece's body in the node that calls it, down to the pieces a piece calls. */
export function inlinePieces(
  bp: Blueprint,
  pieces: ReadonlyMap<string, unknown>,
): Blueprint {
  const node = (n: BlueprintNode): BlueprintNode => {
    const p = n.piece && (pieces.get(n.piece.name) as BlueprintPiece);
    const own = p && n.piece ? { ...n, ...pieceBody(p, n.piece.args) } : n;
    return own.children ? { ...own, children: own.children.map(node) } : own;
  };
  return {
    ...bp,
    pools: bp.pools.map((p) => ({
      ...p,
      groups: p.groups.map((g) => ({ ...g, sources: g.sources.map(node) })),
    })),
  };
}
