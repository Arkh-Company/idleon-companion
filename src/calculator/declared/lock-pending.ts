// A draft in the lock (spec 010, T199, Open Questions 23/11, night): what is closed is checked, and what is pending is
// listed as pending, never failed by. An error the lock gives at a pending place's node, or below it, comes from what the
// place still lacks (a leaf's kind, a descent, a system, a termPart): it is left out, and the place is a `pending` entry.
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import type { LockError } from "./lock.ts";
import { nodeId, refKey } from "./refs.ts";

const PLACE =
  /^pools\/(\d+)\/groups\/(\d+)(?:\/sources\/(\d+)((?:\/children\/\d+)*))?$/;

const under = (where: string, id: string): boolean =>
  where === id || where.startsWith(`${id}/`);

/** Whether an error comes from one of the draft's pending places; a place out of these forms covers nothing. */
export function pendingCover(
  bp: Blueprint,
  character: number,
): (e: LockError) => boolean {
  const covers = (bp.pending ?? []).map((p): ((e: LockError) => boolean) => {
    const m = PLACE.exec(p.where);
    const pool = Number(m?.[1]);
    const g = bp.pools[pool]?.groups[Number(m?.[2])];
    if (!m || !g) return () => false;
    const idOf = (keys: readonly string[]) =>
      nodeId(bp.id, pool, g.system, keys);
    if (m[3] === undefined) {
      // a group's system: its sources' places, and the order of the groups of its pool
      const ids = g.sources.map((s) => idOf([s.key]));
      return (e) =>
        ids.some((id) => under(e.where, id)) ||
        (e.kind === "groupOrder" && e.where === `pool:${String(pool)}`);
    }
    const path: BlueprintNode[] = [];
    const kids = (m[4] ?? "").split("/children/").slice(1).map(Number);
    let n = g.sources[Number(m[3])];
    if (n) path.push(n);
    for (const i of kids) {
      n = n?.children?.[i];
      if (n) path.push(n);
    }
    const node = path.at(-1);
    if (!node || path.length !== 1 + kids.length) return () => false;
    const id = idOf(path.map((x) => x.key));
    const parent = path.at(-2);
    const parentId = idOf(path.slice(0, -1).map((x) => x.key));
    // a pool source's model child stands for one node per item, `<source>/<model>-<item>`
    const model =
      parent?.each !== undefined && !parent.combine && path.length === 2;
    // a termPart still missing leaves its part undeclared at the parent
    const part =
      p.kind === "system" && node.ref ? refKey(node.ref, character) : null;
    return (e) =>
      under(e.where, id) ||
      (model && e.where.startsWith(`${id}-`)) ||
      (part !== null &&
        e.kind === "undeclaredPart" &&
        e.where === parentId &&
        e.got === part);
  });
  return (e) => covers.some((c) => c(e));
}
