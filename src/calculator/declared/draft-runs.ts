// The draft over each character run (spec 010, T207, T208; spec, Open Questions 24/11): the active character's draft,
// with each cache's author whose call changes between the runs written as `any` (any call of its block; its name waits
// for the agent, as no one call's name is its own). A node of another run stands for one of the active run's by its
// place: the same pool and source key, then the same key below; a cache's author by its block, the one call of it there.
import type { BlueprintPending } from "./blueprint.ts";
import type { DraftBlueprint, DraftNode } from "./draft.ts";
import { codeOf, keyIn } from "./draft-names.ts";
import { ANY_CALL } from "./refs.ts";

export interface DraftRun {
  draft: DraftBlueprint;
  characterClass: number | null;
}

const isCacheRead = (n: DraftNode): boolean =>
  n.ref !== undefined && "read" in n.ref && n.ref.read.startsWith("DNSM.");
const blockOf = (n: DraftNode | undefined): string | null =>
  n?.ref && "call" in n.ref ? n.ref.call : null;

/** The child of `o` that stands for `c`, a child of `n`: a cache's author by its block, any other by its key. */
function counterpart(
  n: DraftNode,
  c: DraftNode,
  o: DraftNode | undefined,
): DraftNode | undefined {
  const kids = o?.children ?? [];
  const block = blockOf(c);
  if (!isCacheRead(n) || block === null)
    return kids.find((k) => k.key === c.key);
  const same = kids.filter((k) => blockOf(k) === block);
  return same.length === 1 ? same[0] : undefined;
}

/** The node with each cache's author below it written as `any` where another run's call differs. */
function withAny(
  n: DraftNode,
  theirs: readonly (DraftNode | undefined)[],
  where: string,
  pending: BlueprintPending[],
): DraftNode {
  if (!n.children) return n;
  const siblings = new Set(n.children.map((c) => c.key));
  const children = n.children.map((c, i) => {
    const at = `${where}/children/${String(i)}`;
    const mine = theirs.map((o) => counterpart(n, c, o));
    const block = blockOf(c);
    const changes =
      isCacheRead(n) &&
      block !== null &&
      mine.some((k) => k && JSON.stringify(k.ref) !== JSON.stringify(c.ref));
    if (!changes) return withAny(c, mine, at, pending);
    const rest: DraftNode = { ...c };
    delete rest.nameProof;
    siblings.delete(c.key);
    const ref = { call: block, args: [ANY_CALL] };
    if (!pending.some((p) => p.where === at && p.kind === "name"))
      pending.push({ where: at, kind: "name" });
    const any: DraftNode = {
      ...rest,
      key: keyIn(siblings, codeOf(ref, "")),
      name: null,
      ref,
    };
    return withAny(any, mine, at, pending);
  });
  return { ...n, children };
}

export function joinDrafts(
  active: DraftRun,
  others: readonly DraftRun[],
): DraftBlueprint {
  const { draft } = active;
  const pending = [...draft.pending];
  const pools = draft.pools.map((p, i) => ({
    ...p,
    groups: p.groups.map((g, j) => ({
      ...g,
      sources: g.sources.map((s, k) => {
        const theirs = others.map(({ draft: o }) =>
          o.pools[i]?.groups
            .flatMap((x) => x.sources)
            .find((x) => x.key === s.key),
        );
        const where = `pools/${String(i)}/groups/${String(j)}/sources/${String(k)}`;
        return withAny(s, theirs, where, pending);
      }),
    })),
  }));
  return { ...draft, pools, pending };
}
