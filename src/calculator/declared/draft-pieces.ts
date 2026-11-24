// A common branch as a piece in the draft (spec 010, T203; spec, Open Questions 24/11): a declared list of branches
// several sources or recipes call. Where the draft meets one, the subtree below it is the piece's body, each param's
// arg written `{param}` (a read's index, or a call's arg of the same kind; the lock checks each line with its args); a
// node whose reference takes a param waits for its name (one name for every arg is the agent's), and the body's keys are
// short (the gitleaks reads a long `key` as a secret). The first occurrence the draft closes writes the piece; an
// occurrence with the same body is a line with `piece: { name, args }`, and one the game ran another way is written as
// the draft gives it, never as the piece.
import type { BlueprintPending, CallRef } from "./blueprint.ts";
import type { DraftNode } from "./draft.ts";
import { slug } from "./draft-names.ts";
import type { Ref } from "./refs.ts";

/** A branch several sources or recipes call: its piece's name and its ref, a `{param}` for each arg it takes. */
export interface CommonBranch {
  name: string;
  ref: CallRef;
}
/** A piece the draft writes once (`pieces/<name>.piece.json`). */
export interface DraftPiece {
  id: string;
  params: string[];
  children: DraftNode[];
}
type Args = Record<string, string | number>;

/** The common branches (Vinicius, 24/11): the all-talent levels of a talent, the talents', vials' and meals' caches. */
export const COMMON_BRANCHES: readonly CommonBranch[] = [
  {
    name: "all-talent-lv",
    ref: {
      call: "RunCodeOfTypeXforThingY",
      args: ["AllTalentLV", "{talent}"],
    },
  },
  { name: "talent-calc-2", ref: { call: "TalentCalc", args: [-2] } },
  { name: "talent-calc-4", ref: { call: "TalentCalc", args: [-4] } },
  { name: "talent-calc-6", ref: { call: "TalentCalc", args: [-6] } },
  { name: "star-signs-0", ref: { call: "StarSigns", args: [0] } },
];

const PARAM = /^\{([A-Za-z_$][\w$]*)\}$/;

/** The branch a ref calls, with each param's arg; none for an arg from the character or the save. */
export function branchOf(
  ref: Ref,
  branches: readonly CommonBranch[],
): { name: string; params: string[]; args: Args } | null {
  if (!("call" in ref)) return null;
  for (const b of branches) {
    if (b.ref.call !== ref.call || b.ref.args.length !== ref.args.length)
      continue;
    const args: Args = {};
    const fits = b.ref.args.every((a, i) => {
      const got = ref.args[i];
      const param = typeof a === "string" ? PARAM.exec(a)?.[1] : undefined;
      if (param === undefined) return JSON.stringify(a) === JSON.stringify(got);
      if (typeof got === "number") args[param] = got;
      else if (typeof got === "string" && !/[{*]/.test(got)) args[param] = got;
      else return false;
      return true;
    });
    if (fits) return { name: b.name, params: Object.keys(args), args };
  }
  return null;
}

/** A key of at most 7 letters, unique among its siblings: the slug's start, then a cut start and -2, -3… */
export function shortKey(taken: Set<string>, text: string): string {
  const cut = (s: string, n: number) => s.slice(0, n).replace(/-+$/, "");
  const base = cut(slug(text), 7) || "part";
  let k = base;
  for (let n = 2; taken.has(k); n++) k = `${cut(base, 4)}-${String(n)}`;
  taken.add(k);
  return k;
}

/** A ref with each arg's value as its `{param}`: a read's whole index, a call's arg of the same kind. */
function refWith(ref: Ref, args: Args): Ref {
  const params = Object.entries(args);
  if ("read" in ref)
    return {
      read: ref.read.replace(/\[([^\]]+)\]/g, (m, i: string) => {
        const p = params.find(([, v]) => String(v) === i);
        return p ? `[{${p[0]}}]` : m;
      }),
    };
  return {
    ...ref,
    args: ref.args.map((a) => {
      const p = params.find(([, v]) => v === a);
      return p ? `{${p[0]}}` : a;
    }),
  };
}

/** The body of a piece from an occurrence's children and their pending places, relative to the occurrence. */
function bodyOf(
  children: readonly DraftNode[],
  args: Args,
  pending: readonly BlueprintPending[],
): { children: DraftNode[]; pending: BlueprintPending[] } {
  const waits = [...pending];
  const walk = (ns: readonly DraftNode[], at: string): DraftNode[] => {
    const taken = new Set<string>();
    return ns.map((n, i) => {
      const where = `${at}/children/${String(i)}`;
      const ref = n.ref && refWith(n.ref, args);
      const own = JSON.stringify(ref) !== JSON.stringify(n.ref);
      if (own && !waits.some((p) => p.where === where && p.kind === "name"))
        waits.push({ where, kind: "name" });
      const { key, name, nameProof, children: kids, ...rest } = n;
      const text = !ref
        ? key
        : "call" in ref
          ? ref.call + JSON.stringify(ref.args)
          : ref.read;
      return {
        key: shortKey(taken, text),
        name: own ? null : name,
        ...(!own && nameProof && { nameProof }),
        ...rest,
        ...(ref && { ref }),
        ...(kids && { children: walk(kids, where) }),
      };
    });
  };
  const body = walk(children, "");
  const order = ["name", "system", "leaf", "descend"];
  return {
    children: body,
    pending: waits.sort(
      (a, b) =>
        a.where.localeCompare(b.where) ||
        order.indexOf(a.kind) - order.indexOf(b.kind),
    ),
  };
}

/** The pieces a draft writes, with each one's pending places relative to the line that calls it. */
export type DraftPieces = Map<
  string,
  DraftPiece & { pending: BlueprintPending[] }
>;

/**
 * An occurrence of a branch at `where`: the line's piece and the pending places its body has there, when its body is the
 * piece's (the first one writes it); null when the game ran it another way.
 */
export function pieceUse(
  pieces: DraftPieces,
  branch: { name: string; params: string[]; args: Args },
  children: readonly DraftNode[],
  mine: readonly BlueprintPending[],
  where: string,
): {
  piece: { name: string; args: Args };
  pending: BlueprintPending[];
} | null {
  const rel = mine.map((p) => ({ ...p, where: p.where.slice(where.length) }));
  const body = bodyOf(children, branch.args, rel);
  const known = pieces.get(branch.name);
  if (!known)
    pieces.set(branch.name, {
      id: branch.name,
      params: branch.params,
      ...body,
    });
  else if (
    JSON.stringify([known.children, known.pending]) !==
    JSON.stringify([body.children, body.pending])
  )
    return null;
  return {
    piece: { name: branch.name, args: branch.args },
    pending: body.pending.map((p) => ({ ...p, where: where + p.where })),
  };
}
