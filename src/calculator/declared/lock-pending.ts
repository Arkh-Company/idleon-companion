// A draft in the lock (spec 010, T199, Open Questions 23/11, night): what is closed is checked, and what is pending is
// listed as pending, never failed by. A pending place covers only what its kind still lacks (r1, r2): a name, nothing;
// a group's system, its pool's group order; a node's system (a termPart), its part undeclared at the parent, when no
// other part its `*` takes is there too; a leaf's kind, its leafType; a descent, what is below the node and, at the
// node, only what its children would give. What the recipe already declares is never covered: the node's value at the
// parent's level (childNoValue, extraSource, missingSource, sourceOrder, classMismatch), its place there
// (childOutside) and its ref's arguments (characterWritten, saveWritten, rootForm).
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import type { LockError, LockErrorKind } from "./lock.ts";
import { keyMatches, nodeId, savedTwice } from "./refs.ts";

const PLACE =
  /^pools\/(\d+)\/groups\/(\d+)(?:\/sources\/(\d+)((?:\/children\/\d+)*))?$/;

const AT_PARENT: ReadonlySet<LockErrorKind> = new Set([
  "childNoValue",
  "extraSource",
  "missingSource",
  "sourceOrder",
  "classMismatch",
]);

const DECLARED: ReadonlySet<LockErrorKind> = new Set([
  "childOutside",
  "characterWritten",
  "saveWritten",
  "rootForm",
]);

// at a descent's own node: what its children, still to come, would give
const DESCENT_OWN: ReadonlySet<LockErrorKind> = new Set([
  "notClosing",
  "undeclaredPart",
  "leafType",
  "leafHasChildren",
  "openingRefused",
]);

/** Whether an error is covered, among all the lock's errors. */
type Cover = (e: LockError, all: readonly LockError[]) => boolean;
const none: Cover = () => false;

/** A pending place's node: its id, its parent's id and whether it is a pool source's model child; null out of the forms. */
function placeOf(bp: Blueprint, where: string) {
  const m = PLACE.exec(where);
  const pool = Number(m?.[1]);
  const g = bp.pools[pool]?.groups[Number(m?.[2])];
  if (!m || !g) return null;
  const idOf = (keys: readonly string[]) => nodeId(bp.id, pool, g.system, keys);
  if (m[3] === undefined) return { pool, group: true as const, id: idOf([]) };
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

/** The node ids of the draft's pending places, a group's as `<number>/<pool>/<system>`. */
export const pendingIds = (bp: Blueprint): Set<string> =>
  new Set(
    (bp.pending ?? []).flatMap((p) => {
      const at = placeOf(bp, p.where);
      return at ? [at.id] : [];
    }),
  );

/** Every node id of the blueprint, a group's as `<number>/<pool>/<system>`. */
export function nodeIds(bp: Blueprint): Set<string> {
  const ids = new Set<string>();
  const add = (at: string, n: BlueprintNode): void => {
    ids.add(`${at}/${n.key}`);
    n.children?.forEach((c) => {
      add(`${at}/${n.key}`, c);
    });
  };
  bp.pools.forEach((p, i) => {
    p.groups.forEach((g) => {
      const at = nodeId(bp.id, i, g.system, []);
      ids.add(at);
      g.sources.forEach((s) => {
        add(at, s);
      });
    });
  });
  return ids;
}

/** A place's node id: itself, or a model child's item `<id>-<item>` (and below it) as the model's; none out of the nodes. */
export function nodeOf(
  ids: ReadonlySet<string>,
  where: string,
): string | undefined {
  let at = "";
  for (const part of where.split("/")) {
    let next = at ? `${at}/${part}` : part;
    for (let k = part; !ids.has(next) && /-\d+$/.test(k);) {
      k = k.replace(/-\d+$/, "");
      if (ids.has(`${at}/${k}`)) next = `${at}/${k}`;
    }
    at = next;
  }
  return ids.has(at) ? at : undefined;
}

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
      const part = (e: LockError): e is LockError & { got: string } =>
        e.kind === "undeclaredPart" &&
        e.where === parentId &&
        typeof e.got === "string";
      // two parts its `*` takes: the tie would be by order (refs.ts savedTwice)
      return ref
        ? (e, all) =>
            part(e) &&
            keyMatches(ref, e.got, character) &&
            savedTwice(
              ref,
              all.filter(part).map((x) => x.got),
              character,
            ) === null
        : none;
    }
    // a model's node per item is `<id>-<item>`
    const item = (w: string) => model && w.startsWith(`${id}-`);
    const self = (w: string) =>
      w === id || (item(w) && !w.slice(id.length).includes("/"));
    const below = (w: string) =>
      !self(w) && (w.startsWith(`${id}/`) || item(w));
    if (p.kind === "leaf") return (e) => e.kind === "leafType" && self(e.where);
    return (e) =>
      !DECLARED.has(e.kind) &&
      ((below(e.where) && !AT_PARENT.has(e.kind)) ||
        (self(e.where) && DESCENT_OWN.has(e.kind)));
  });
  return (e, all) => covers.some((c) => c(e, all));
}
