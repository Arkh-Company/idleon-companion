// A common branch whose piece is already written (spec 010, part R; spec, Open Questions 24/11: nothing written twice):
// in `blueprints/pieces/`, or by an earlier draft of the same run. An occurrence calls it where the piece, filled with
// the occurrence's args at the piece's own `{param}` places, has the occurrence's body (the lock's form: references,
// links, pieces, lists and constants, level by level); names, kinds and systems are the agent's. Any other body is
// written whole, with why in the guide. The line keeps the pending places the piece still has open, never the ones
// already filled in its file.
import type { BlueprintPending } from "./blueprint.ts";
import { isObj } from "./blueprint-root.ts";
import type { DraftNode } from "./draft.ts";
import { fill } from "./pieces.ts";

/** The pieces already written, raw, by their id. */
export type KnownPieces = ReadonlyMap<string, unknown>;

/** Why a line is written whole when its piece is already written with another body. */
export const KNOWN_OTHER = "o corpo difere do pedaço já escrito";

/** A body's form, level by level: what the lock checks, never what the agent fills. */
const formOf = (ns: unknown): unknown =>
  Array.isArray(ns)
    ? ns.map((n) =>
        isObj(n)
          ? [n.ref, n.piece, n.tree, n.each, n.constant, formOf(n.children)]
          : null,
      )
    : null;

/** The node at a pending place relative to the line (`/children/0/children/1`), or undefined. */
function nodeAt(
  children: unknown,
  where: string,
): Record<string, unknown> | undefined {
  let at: unknown = { children };
  for (const k of where.split("/").filter(Boolean))
    at =
      isObj(at) || Array.isArray(at)
        ? (at as Record<string, unknown>)[k]
        : undefined;
  return isObj(at) ? at : undefined;
}

/** A pending place the piece's file still has open: its name null, no kind and no children, no term's system. */
function stillOpen(
  piece: Record<string, unknown>,
  p: BlueprintPending,
): boolean {
  const own = Array.isArray(piece.pending) ? piece.pending : [];
  // a place the piece's own pending holds is the piece's, never written again in the recipe (T216)
  if (
    own.some(
      (x) => isObj(x) && x.where === p.where.slice(1) && x.kind === p.kind,
    )
  )
    return false;
  const n = nodeAt(piece.children, p.where);
  if (!n) return true;
  const bare =
    n.leaf === undefined &&
    !(Array.isArray(n.children) && n.children.length > 0);
  if (p.kind === "name") return n.name === null;
  if (p.kind === "system") return !(isObj(n.termPart) && n.termPart.system);
  return bare;
}

/**
 * The line of an occurrence of a branch whose piece is written: the piece's name and args, and the pending places the
 * piece still has open there (`pending` relative to the line, the result's from the draft's root); or why its line is
 * written whole.
 */
export function knownUse(
  raw: unknown,
  o: {
    where: string;
    branch: {
      name: string;
      params: string[];
      args: Record<string, string | number>;
    };
    children: readonly DraftNode[];
    pending: readonly BlueprintPending[];
  },
):
  | {
      piece: { name: string; args: Record<string, string | number> };
      pending: BlueprintPending[];
    }
  | string {
  const { branch } = o;
  if (
    !isObj(raw) ||
    !Array.isArray(raw.children) ||
    JSON.stringify(raw.params) !== JSON.stringify(branch.params)
  )
    return KNOWN_OTHER;
  const filled: unknown = fill(raw.children, branch.args);
  if (JSON.stringify(formOf(filled)) !== JSON.stringify(formOf(o.children)))
    return KNOWN_OTHER;
  return {
    piece: { name: branch.name, args: branch.args },
    pending: o.pending
      .filter((p) => stillOpen(raw, p))
      .map((p) => ({ ...p, where: o.where + p.where })),
  };
}
