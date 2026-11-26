// A common branch as a piece in the draft (spec 010, T203; spec, Open Questions 24/11): a declared list of branches
// several sources or recipes call. A branch is a piece where at least two occurrences run one body, with other args when
// it takes a param; one with no param is a piece from its first occurrence, and one whose piece is already written is
// called where it has its body (planPieces, piecePasses). A place is `{param}` where it changes between occurrences along
// with the arg (a read's index, or a call's arg of the same kind; the lock checks each line with its args), never by its
// value alone. A node whose reference takes a param waits for its name (one name for every arg is the agent's), and the
// body's keys are short (the gitleaks reads a long `key` as a secret). Those occurrences are lines with
// `piece: { name, args }`; any other is written as the draft gives it, never as the piece, with why in the guide.
import type { BlueprintPending, CallRef } from "./blueprint.ts";
import type { DraftNode } from "./draft.ts";
import { knownUse } from "./draft-known-pieces.ts";
import type { KnownPieces } from "./draft-known-pieces.ts";
import { slug } from "./draft-names.ts";
import type { Ref, RefArg } from "./refs.ts";

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
interface Branch {
  name: string;
  params: string[];
  args: Args;
}
type Places = ReadonlyMap<string, string>;

/**
 * The common branches (Vinicius, 24/11): the all-talent levels of a talent, the talents', vials' and meals' caches; the
 * skills' general bonuses (part R), which each skill's own stats call.
 */
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
  {
    name: "all-base-skill-eff",
    ref: { call: "SkillStats", args: ["AllBaseSkillEff"] },
  },
  {
    name: "all-efficiencies",
    ref: { call: "SkillStats", args: ["AllEfficiencies"] },
  },
];

const PARAM = /^\{([A-Za-z_$][\w$]*)\}$/;

/** The branch a ref calls, with each param's arg; none for an arg from the character or the save. */
export function branchOf(
  ref: Ref,
  branches: readonly CommonBranch[],
): Branch | null {
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

/**
 * A key of at most 7 letters, unique among its siblings: the slug's start with no digit, then a cut start and -b, -c…
 * (letters: a number in a key reads as one of the call's arguments).
 */
export function shortKey(taken: Set<string>, text: string): string {
  const cut = (s: string, n: number) => s.slice(0, n).replace(/-+$/, "");
  const base = cut(slug(text.replace(/\d/g, "")), 7);
  // the n-th of a, b, …, z, aa, ab…
  const letters = (n: number): string =>
    (n > 26 ? letters(Math.floor((n - 1) / 26)) : "") +
    String.fromCharCode(97 + ((n - 1) % 26));
  let k = base;
  for (let n = 2; taken.has(k); n++) k = `${cut(base, 4)}-${letters(n)}`;
  taken.add(k);
  return k;
}

const INDEX = /\[([^\]]+)\]/g;
/** A ref's places, by their order: a read's whole indices (text), a call's args. */
const placesOf = (ref: Ref): RefArg[] =>
  "read" in ref
    ? [...ref.read.matchAll(INDEX)].map((m) => m[1] ?? "")
    : [...ref.args];

/** A ref with the param of each place `at` gives written `{param}`: a place is `<node's where>#<its order>`. */
function refWith(ref: Ref, where: string, at: Places): Ref {
  const p = (i: number) => at.get(`${where}#${String(i)}`);
  let i = 0;
  if ("read" in ref)
    return {
      read: ref.read.replace(INDEX, (m) => {
        const q = p(i++);
        return q ? `[{${q}}]` : m;
      }),
    };
  return {
    ...ref,
    args: ref.args.map((a, j) => {
      const q = p(j);
      return q ? `{${q}}` : a;
    }),
  };
}

/** The body of a piece from an occurrence's children and their pending places, relative to the occurrence. */
function bodyOf(
  children: readonly DraftNode[],
  at: Places,
  pending: readonly BlueprintPending[],
): { children: DraftNode[]; pending: BlueprintPending[] } {
  const waits = [...pending];
  const walk = (ns: readonly DraftNode[], above: string): DraftNode[] => {
    const taken = new Set<string>();
    return ns.map((n, i) => {
      const where = `${above}/children/${String(i)}`;
      const ref = n.ref && refWith(n.ref, where, at);
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

/** An occurrence of a common branch, as the draft's first pass writes it: whole. */
export interface Occurrence {
  where: string;
  branch: Branch;
  children: readonly DraftNode[];
  /** Its pending places, from the draft's root. */
  pending: readonly BlueprintPending[];
}
/** By an occurrence's `where`: the param of each place of its piece, or why its line is written whole. */
export type PiecePlan = Map<string, Places | string>;

const ONCE = "uma ocorrência só";
const ALONE = "nenhuma outra ocorrência com o mesmo corpo e outro argumento";
const OTHER = "o corpo difere do pedaço";

const rel = (o: Occurrence) =>
  o.pending.map((p) => ({ ...p, where: p.where.slice(o.where.length) }));

/** Each place of a body's refs, by its id, with whether it is a read's index (text) or a call's arg. */
function placeValues(children: readonly DraftNode[]) {
  const out = new Map<string, { v: RefArg; read: boolean }>();
  const walk = (ns: readonly DraftNode[], above: string) => {
    ns.forEach((n, i) => {
      const where = `${above}/children/${String(i)}`;
      if (n.ref) {
        const read = "read" in n.ref;
        placesOf(n.ref).forEach((v, k) =>
          out.set(`${where}#${String(k)}`, { v, read }),
        );
      }
      if (n.children) walk(n.children, where);
    });
  };
  walk(children, "");
  return out;
}

/**
 * The params of occurrences that run one body (CODING_STANDARDS: by the place, never by the value alone): a place is a
 * param's where its value changes between them along with that arg; one that never changes stays written. Null when
 * a place changes apart from every arg, or their bodies differ.
 */
function fit(set: readonly Occurrence[]): Places | null {
  const [first] = set;
  if (!first) return null;
  const values = set.map((o) => placeValues(o.children));
  const at = new Map<string, string>();
  for (const id of values[0]?.keys() ?? []) {
    const vs = values.map((m) => m.get(id));
    const text = vs.map((x) => JSON.stringify(x?.v));
    if (text.every((t) => t === text[0])) continue;
    const p = first.branch.params.find((q) =>
      set.every((o, j) => {
        const x = vs[j];
        const a = o.branch.args[q];
        return x !== undefined && (x.read ? x.v === String(a) : x.v === a);
      }),
    );
    if (p === undefined) return null;
    at.set(id, p);
  }
  const bodies = set.map((o) => JSON.stringify(bodyOf(o.children, at, rel(o))));
  return bodies.every((b) => b === bodies[0]) ? at : null;
}

/**
 * Which occurrences are a piece (Revisor r1 and r2 of part O): a branch is one only where it runs one body at least
 * twice, with other args when it takes a param; the first occurrence, in order, whose body some other shares wins. One
 * with no param and no body shared is a piece from its first occurrence (part R: the first draft that meets it writes the
 * piece the next ones call). Each other line is written whole, and why goes to the guide.
 */
export function planPieces(occurrences: readonly Occurrence[]): PiecePlan {
  const plan: PiecePlan = new Map();
  for (const name of new Set(occurrences.map((o) => o.branch.name))) {
    const all = occurrences.filter((o) => o.branch.name === name);
    let chosen: { set: Occurrence[]; at: Places } | null = null;
    for (const seed of all) {
      let set = [seed];
      let at: Places = new Map();
      for (const o of all) {
        const got = o === seed ? null : fit([...set, o]);
        if (got) [set, at] = [[...set, o], got];
      }
      // other args only where the branch takes a param; one with none is a piece at two occurrences of one body
      const twice =
        seed.branch.params.length === 0
          ? set.length > 1
          : new Set(set.map((o) => JSON.stringify(o.branch.args))).size > 1;
      if (twice) {
        chosen = { set, at };
        break;
      }
    }
    const [first] = all;
    if (!chosen && first?.branch.params.length === 0)
      chosen = { set: [first], at: new Map() };
    for (const o of all)
      plan.set(
        o.where,
        chosen?.set.includes(o)
          ? chosen.at
          : chosen
            ? OTHER
            : all.length === 1
              ? ONCE
              : ALONE,
      );
  }
  return plan;
}

/**
 * The draft's two passes over its common branches: the first writes each whole and sees its occurrences; `plan` decides
 * the pieces, and the second gives each occurrence its piece's line, or none with why in `notes` (for the guide). A
 * branch whose piece is `known` (already written) is no plan's: each occurrence calls it where it has its body.
 */
export function piecePasses(known: KnownPieces = new Map()) {
  const occurrences: Occurrence[] = [];
  const pieces: DraftPieces = new Map();
  const notes: string[] = [];
  let plan: PiecePlan | null = null;
  return {
    pieces,
    notes,
    plan: () => {
      plan = planPieces(occurrences.filter((o) => !known.has(o.branch.name)));
    },
    meet: (o: Occurrence) => {
      if (!plan) {
        occurrences.push(o);
        return null;
      }
      const name = o.branch.name;
      const got = known.has(name)
        ? knownUse(known.get(name), { ...o, pending: rel(o) })
        : pieceUse(pieces, plan, o);
      if (typeof got !== "string") return got;
      notes.push(
        `galho comum ${name} em ${o.where}: escrito por inteiro (${got})`,
      );
      return null;
    },
  };
}

/**
 * An occurrence of a branch, by the plan: the line's piece and the pending places its body has there (the first one
 * writes the piece); or why its line is written whole.
 */
function pieceUse(
  pieces: DraftPieces,
  plan: PiecePlan,
  o: Occurrence,
):
  | { piece: { name: string; args: Args }; pending: BlueprintPending[] }
  | string {
  const at = plan.get(o.where) ?? ONCE;
  if (typeof at === "string") return at;
  const body = bodyOf(o.children, at, rel(o));
  const known = pieces.get(o.branch.name);
  if (!known)
    pieces.set(o.branch.name, {
      id: o.branch.name,
      params: o.branch.params,
      ...body,
    });
  // shortcut: a branch inside another's body is planned whole and may differ here by its own piece's line; the plan
  // would have to run until no piece changes, when a game's common branch calls another
  else if (
    JSON.stringify([known.children, known.pending]) !==
    JSON.stringify([body.children, body.pending])
  )
    return OTHER;
  return {
    piece: { name: o.branch.name, args: o.branch.args },
    pending: body.pending.map((p) => ({ ...p, where: o.where + p.where })),
  };
}
