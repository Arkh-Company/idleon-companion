// The draft over each character run (spec 010, T207, T208; spec, Open Questions 24/11): the active character's draft,
// each class source its class has not taken from the run of a class that has it (FR-002a: the source is in that
// character's tree only), with its pending places and its pieces, and each cache's author whose call changes between the runs written as `any` (any call of its block; its name waits
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

const under = (w: string, p: string) => w === p || w.startsWith(`${p}/`);
const piecesIn = (n: DraftNode): string[] => [
  ...(n.piece ? [n.piece.name] : []),
  ...(n.children ?? []).flatMap(piecesIn),
];

/** The source as the first run of a class that has it drafted it (T207), or as it is. */
function classSource(
  s: DraftNode,
  where: string,
  pool: number,
  active: DraftRun,
  others: readonly DraftRun[],
  out: Required<Pick<DraftBlueprint, "pending" | "pieces" | "notes">>,
): DraftNode {
  const own = s.classes;
  const has = (c: number | null) => c !== null && own?.includes(c) === true;
  if (!own || has(active.characterClass)) return s;
  const run = others.find((r) => has(r.characterClass));
  const groups = run?.draft.pools[pool]?.groups ?? [];
  for (const [j, g] of groups.entries())
    for (const [k, x] of g.sources.entries()) {
      if (x.key !== s.key || !run) continue;
      const from = `pools/${String(pool)}/groups/${String(j)}/sources/${String(k)}`;
      const kept = out.pending.filter((p) => !under(p.where, where));
      const moved = run.draft.pending
        .filter((p) => under(p.where, from))
        .map((p) => ({ ...p, where: where + p.where.slice(from.length) }));
      out.pending.splice(0, out.pending.length, ...kept, ...moved);
      for (const id of new Set(piecesIn(x))) {
        const theirs = run.draft.pieces?.find((p) => p.id === id);
        const mine = out.pieces.find((p) => p.id === id);
        if (theirs && !mine) out.pieces.push(theirs);
        else if (theirs && JSON.stringify(theirs) !== JSON.stringify(mine))
          out.notes.push(
            `o pedaço ${id} da rodada da classe ${String(run.characterClass)} difere do da rodada ativa: ${where} usa o da rodada ativa`,
          );
      }
      return x;
    }
  return s;
}

export function joinDrafts(
  active: DraftRun,
  others: readonly DraftRun[],
): DraftBlueprint {
  const { draft } = active;
  const out = {
    pending: [...draft.pending],
    pieces: [...(draft.pieces ?? [])],
    notes: [...(draft.notes ?? [])],
  };
  const { pending } = out;
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
        const mine = classSource(s, where, i, active, others, out);
        return withAny(mine, theirs, where, pending);
      }),
    })),
  }));
  return {
    ...draft,
    pools,
    pending,
    ...(out.pieces.length > 0 && { pieces: out.pieces }),
    ...(out.notes.length > 0 && { notes: out.notes }),
  };
}
