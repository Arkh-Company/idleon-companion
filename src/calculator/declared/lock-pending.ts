// A draft in the lock (spec 010, T199, Open Questions 23/11, night): what is closed is checked, and what is pending is
// listed as pending, never failed by. A pending place covers only what its kind still lacks (r1): a name, nothing; a
// group's system, its pool's group order; a node's system (a termPart), its part undeclared at the parent; a leaf's
// kind, the node's own errors; a descent, the node's and those below it. The node's value at the parent's level
// (childNoValue, extraSource, missingSource, sourceOrder, classMismatch) is never covered.
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import type { LockError, LockErrorKind } from "./lock.ts";
import { keyMatches, nodeId } from "./refs.ts";

const PLACE =
  /^pools\/(\d+)\/groups\/(\d+)(?:\/sources\/(\d+)((?:\/children\/\d+)*))?$/;

const AT_PARENT: ReadonlySet<LockErrorKind> = new Set([
  "childNoValue",
  "extraSource",
  "missingSource",
  "sourceOrder",
  "classMismatch",
]);

const under = (where: string, id: string): boolean =>
  where === id || where.startsWith(`${id}/`);

type Cover = (e: LockError) => boolean;
const none: Cover = () => false;

/** A pending place's node: its id, its parent's id and whether it is a pool source's model child; null out of the forms. */
function placeOf(bp: Blueprint, where: string) {
  const m = PLACE.exec(where);
  const pool = Number(m?.[1]);
  const g = bp.pools[pool]?.groups[Number(m?.[2])];
  if (!m || !g) return null;
  const idOf = (keys: readonly string[]) => nodeId(bp.id, pool, g.system, keys);
  if (m[3] === undefined) return { pool, group: true as const };
  const path: BlueprintNode[] = [];
  const kids = (m[4] ?? "").split("/children/").slice(1).map(Number);
  let n = g.sources[Number(m[3])];
  if (n) path.push(n);
  for (const i of kids) {
    n = n?.children?.[i];
    if (n) path.push(n);
  }
  const node = path.at(-1);
  if (!node || path.length !== 1 + kids.length) return null;
  const parent = path.at(-2);
  return {
    pool,
    group: false as const,
    node,
    id: idOf(path.map((x) => x.key)),
    parentId: idOf(path.slice(0, -1).map((x) => x.key)),
    // a pool source's model child stands for one node per item, `<source>/<model>-<item>`
    model: parent?.each !== undefined && !parent.combine && path.length === 2,
  };
}

/** The node ids of the draft's pending places (a group's place has none). */
export const pendingIds = (bp: Blueprint): Set<string> =>
  new Set(
    (bp.pending ?? []).flatMap((p) => {
      const at = placeOf(bp, p.where);
      return at && !at.group ? [at.id] : [];
    }),
  );

/** Whether an error comes from what one of the draft's pending places still lacks. */
export function pendingCover(bp: Blueprint, character: number): Cover {
  const covers = (bp.pending ?? []).map((p): Cover => {
    const at = placeOf(bp, p.where);
    if (!at || p.kind === "name") return none;
    if (at.group)
      return p.kind === "system"
        ? (e) =>
            e.kind === "groupOrder" && e.where === `pool:${String(at.pool)}`
        : none;
    const { node, id, parentId, model } = at;
    if (p.kind === "system") {
      const { ref } = node;
      return ref
        ? (e) =>
            e.kind === "undeclaredPart" &&
            e.where === parentId &&
            typeof e.got === "string" &&
            keyMatches(ref, e.got, character)
        : none;
    }
    // a model's node per item is `<id>-<item>`
    const item = (w: string) => model && w.startsWith(`${id}-`);
    const self = (w: string) =>
      w === id || (item(w) && !w.slice(id.length).includes("/"));
    const below = (w: string) => under(w, id) || item(w);
    const own = p.kind === "descend" ? below : self;
    return (e) => !AT_PARENT.has(e.kind) && own(e.where);
  });
  return (e) => covers.some((c) => c(e));
}
