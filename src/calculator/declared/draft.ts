// The draft of a blueprint (spec 010, research R7, FR-004, FR-009): what the machine proves of a number from its
// answer key and its recording, for an agent to finish. The pools in the game's order; each source and constant in a
// group of its own, by its structured reference; below each source, the parts the lock asks for (lock-levels.ts
// callParts), level by level, down to the leaves the recording shows. A name only with its proof in the names table, a
// talent's class only from the game's talent order; anything else is pending (`name`, `system`, `leaf`, `descend`),
// never guessed. The draft carries no value, count or expression, and its JSON is already as prettier leaves it.
import type { Context } from "../boot.ts";
import { askNames } from "../game-names.ts";
import type { Op } from "../instrument.ts";
import { STATIC_NAMES } from "../names/names-table.ts";
import { nameOf, recipeName } from "../names/names.ts";
import { renameOf } from "../names/renames.ts";
import { STATE_NAMES } from "../names/state-names.ts";
import type { RecNode, Recording } from "../recording.ts";
import { makeSteps } from "../recorded/steps.ts";
import type { Expr } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import { topOf } from "./answer-key.ts";
import type { AnswerKey, AnswerTerm, PoolKind } from "./answer-key.ts";
import type {
  Blueprint,
  BlueprintNode,
  BlueprintPending,
} from "./blueprint.ts";
import { isObj } from "./blueprint-root.ts";
import { onlyRead } from "./cache-author.ts";
import { openingOf } from "./level-openings.ts";
import { callParts } from "./lock-levels.ts";
import type { LevelContext } from "./lock-levels.ts";
import { returnOf, saveChild, termExpr } from "./lock-parts.ts";
import { CALL } from "./not-leaves.ts";
import { hasRawCharacterIndex } from "./refs.ts";
import type { Ref, RefArg } from "./refs.ts";

export interface DraftContext {
  /** The recorded character: a read of its own is `{character}`, another's `*` (research R5). */
  character: number;
  /** The game's `CustomLists.TalentOrder`, for a talent source's class; empty gives none. */
  talentOrder: readonly unknown[];
}
export const NO_CONTEXT: DraftContext = { character: 0, talentOrder: [] };

/** A list of the game's tables (`CustomLists.TalentOrder`), read in the recorder's context (names-reader.js); empty
 * when it is none or the reading fails. */
export function gameList(
  context: Pick<Context, "run" | "sandbox">,
  id: string,
  ms: number,
): unknown[] {
  const read = askNames(context, { cells: [], tables: [id] }, ms);
  const form: unknown =
    isObj(read) && Array.isArray(read.forms) ? read.forms[0] : null;
  try {
    const list: unknown = typeof form === "string" ? JSON.parse(form) : null;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export type DraftNode = Omit<BlueprintNode, "name" | "children"> & {
  /** Null where `pending` says `name`. */
  name: string | null;
  children?: DraftNode[];
};
export interface DraftBlueprint {
  id: string;
  root: Blueprint["root"];
  pools: {
    kind: PoolKind;
    weight?: 0.01;
    groups: { system: string | null; sources: DraftNode[] }[];
  }[];
  pending: BlueprintPending[];
}

/** A part as the recording shows it: its reference key, its recorded call, and what is below it. */
export interface Walked {
  key: string;
  call: RecNode | null;
  below: Walked[] | "leaf" | "descend";
  /** The second source of a two-source term, and on (research R4): its system is the agent's. */
  termPart?: true;
}

// shortcut: the descent stops 12 levels down, pending `descend`; raise it when a number of the game goes deeper
const MAX_DEPTH = 12;

/**
 * A part down to its leaves; a read the recording opens (level-openings.ts: a cache's author) opens into its parts, and a
 * refused one waits for the agent's descent. `reader` is the call that read it, `expr` what gave a call's value, or the
 * read itself at its place (one only) in what its reader's level is.
 */
function walkPart(
  key: string,
  call: RecNode | null,
  ctx: LevelContext,
  depth: number,
  reader: RecNode | null = null,
  expr?: Expr | null,
): Walked {
  if (!call) {
    const level = {
      expr:
        expr?.t === "read" ? expr : ({ t: "read", p: key, v: null } as const),
      value: null,
    };
    const open = reader ? openingOf({ ...level, scope: reader }, ctx) : null;
    if (open === null)
      return { key, call, below: CALL.test(key) ? "descend" : "leaf" };
    if (typeof open === "string" || depth >= MAX_DEPTH)
      return { key, call, below: "descend" };
    return {
      key,
      call,
      below: open.map((o) =>
        walkPart(o.part, o.call, ctx, depth + 1, reader, o.expr),
      ),
    };
  }
  const parts = depth < MAX_DEPTH ? callParts(call, ctx, expr) : null;
  if (parts === null) return { key, call, below: "descend" };
  // no part the recording ties: a leaf, unless the call reads the save below it (then the agent descends)
  if (parts.length === 0)
    return {
      key,
      call,
      below: saveChild(call, ctx) === null ? "leaf" : "descend",
    };
  const kid = (p: string) =>
    call.c
      .map((id) => ctx.rec.nodes[id])
      .find((k) => k !== undefined && callRef(k) === p) ?? null;
  const level = expr === undefined ? returnOf(call, ctx) : expr;
  return {
    key,
    call,
    below: parts.map((p) =>
      walkPart(p, kid(p), ctx, depth + 1, call, onlyRead(level, p)),
    ),
  };
}

/** A source's parts: its call or read down to the leaves; a two-source term opens into each of its references. */
export function walkTerm(t: AnswerTerm, ctx: LevelContext): Walked {
  const { nodes } = ctx.rec;
  const top = topOf(ctx.rec) ?? null;
  // the term's place in the root's steps, for the place of a read among its references
  const at = top ? termExpr(t, top, ctx) : null;
  const parts = t.refs.map((r, i) => {
    const call = nodes[t.nodes[i] ?? -1] ?? null;
    return walkPart(r, call, ctx, 0, top, call ? undefined : onlyRead(at, r));
  });
  const [first, ...rest] = parts;
  if (!first) return { key: t.ref, call: null, below: "leaf" };
  if (rest.length === 0) return first;
  return {
    key: t.ref,
    call: first.call,
    below: [first, ...rest.map((p) => ({ ...p, termPart: true as const }))],
  };
}

/** A path with each character's index as its marker: the recorded character `{character}`, any other `*`. */
export const marked = (path: string, character: number): string =>
  path.replace(
    /\bPlayerDATABASE\[(\d+)\]/g,
    (_, i: string) =>
      `PlayerDATABASE[${Number(i) === character ? "{character}" : "*"}]`,
  );

function refOf(w: Walked, character: number): Ref {
  // shortcut: a call's arguments are taken as the recorder kept them (numbers and short texts)
  if (w.call) return { call: w.call.b, args: w.call.a as RefArg[] };
  const m = CALL.exec(w.key);
  return m
    ? {
        call: m[1] ?? "",
        args: JSON.parse(`[${m[2] ?? ""}]`) as RefArg[],
      }
    : { read: marked(w.key, character) };
}

/** The code the names table goes by: a call as the tree writes it, `Block(a, b)`, or the recorded path. */
const codeOf = (ref: Ref, key: string): string =>
  "call" in ref
    ? `${ref.call}(${ref.args.map((a) => JSON.stringify(a)).join(", ")})`
    : key;

/** A name with its proof: the names table's own (a rename, a static name, a recipe over the game, a state rule). */
export function provenName(
  code: string,
): { name: string; nameProof: { names: string } } | null {
  if (hasRawCharacterIndex(code)) return null;
  const proven =
    renameOf(code) !== null ||
    STATIC_NAMES.has(code) ||
    recipeName(code) !== null ||
    STATE_NAMES.some((r) => r.test.test(code) && r.name(code) !== null);
  const name = proven ? nameOf(code) : null;
  return name ? { name, nameProof: { names: code } } : null;
}
export const partName = (w: Walked, character: number) =>
  provenName(codeOf(refOf(w, character), w.key));

/** 008 catalogo-de-arvores.md (provada): class c's tab is TalentOrder[15×(c−1)..+14]; the star talents [615..679]. */
const TAB = 15;
const STAR = 615;
export function talentClass(
  order: readonly unknown[],
  talent: number,
): number | null {
  const at = order.flatMap((t, i) =>
    (typeof t === "number" || typeof t === "string") && Number(t) === talent
      ? [i]
      : [],
  );
  const [i] = at;
  // a talent in two places, or a star talent (any class), has no class of its own: never one by the order
  return at.length === 1 && i !== undefined && i < STAR
    ? Math.floor(i / TAB) + 1
    : null;
}
/** The class of a source whose call is a talent (N.js GetTalentNumber(mode, talent)), or null. */
export function sourceClass(
  call: RecNode | undefined,
  order: readonly unknown[],
): number | null {
  const talent = call?.b === "GetTalentNumber" ? call.a[1] : undefined;
  return typeof talent === "number" ? talentClass(order, talent) : null;
}

const slug = (text: string): string =>
  text
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 56)
    .replace(/^-+|-+$/g, "") || "part";
/** A key unique among its siblings (research R12): the reference's slug, then -2, -3… */
function keyIn(taken: Set<string>, text: string): string {
  const base = slug(text);
  let k = base;
  for (let n = 2; taken.has(k); n++) k = `${base}-${String(n)}`;
  taken.add(k);
  return k;
}

export function draftBlueprint(
  id: string,
  root: Blueprint["root"],
  key: AnswerKey,
  rec: Recording,
  ops: readonly Op[],
  dc: DraftContext = NO_CONTEXT,
): DraftBlueprint {
  const made = makeSteps(rec, ops);
  const ctx: LevelContext = {
    rec,
    stepsOf: (n) => made.of(n),
    turnOf: made.turnOf,
    character: dc.character,
    where: id,
  };
  const pending: BlueprintPending[] = [];
  const wait = (where: string, kind: BlueprintPending["kind"]) => {
    pending.push({ where, kind });
  };

  const node = (
    w: Walked,
    where: string,
    taken: Set<string>,
    extra: Partial<DraftNode> = {},
  ): DraftNode => {
    const ref = refOf(w, dc.character);
    const named = provenName(codeOf(ref, w.key));
    if (!named) wait(where, "name");
    if (w.termPart) wait(where, "system");
    const own = new Set<string>();
    const out: DraftNode = {
      key: keyIn(taken, "call" in ref ? codeOf(ref, w.key) : ref.read),
      name: named?.name ?? null,
      ...(named ? { nameProof: named.nameProof } : {}),
      ref,
      ...extra,
      ...(Array.isArray(w.below)
        ? {
            children: w.below.map((c, i) =>
              node(c, `${where}/children/${String(i)}`, own),
            ),
          }
        : {}),
    };
    if (!Array.isArray(w.below)) wait(where, w.below);
    // an argument equal to the character's index may be the character or a number that happens to be it: the agent
    // writes `{character}` or keeps it (research R5); the draft does not decide by the value
    if (
      w.below !== "descend" &&
      "call" in ref &&
      ref.args.includes(dc.character)
    )
      wait(where, "descend");
    return out;
  };

  const pools = key.pools.map((p, i) => {
    const weight =
      p.kind === "additive" && p.terms.some((t) => t.weight === 0.01)
        ? 0.01
        : 1;
    const taken = new Set<string>();
    const groups = p.terms.map((t, j) => {
      const gw = `pools/${String(i)}/groups/${String(j)}`;
      wait(gw, "system");
      const sw = `${gw}/sources/0`;
      // a source's own weight only where it differs from its pool's (the curve of the LUK at 1 in a pool of 0.01)
      const own = p.kind === "additive" && t.weight !== weight;
      const extra = own ? { weight: t.weight } : {};
      if (t.kind === "constant") {
        wait(sw, "name");
        const constant: DraftNode = {
          key: keyIn(taken, `constant ${String(t.value)}`),
          name: null,
          constant: t.value,
          ...extra,
          leaf: "fixedValue",
        };
        return { system: null, sources: [constant] };
      }
      const c = sourceClass(rec.nodes[t.nodes[0] ?? -1], dc.talentOrder);
      const classes = c === null ? {} : { classes: [c] };
      return {
        system: null,
        sources: [node(walkTerm(t, ctx), sw, taken, { ...extra, ...classes })],
      };
    });
    return {
      kind: p.kind,
      ...(weight === 0.01 ? { weight: 0.01 as const } : {}),
      groups,
    };
  });
  return { id, root, pools, pending };
}

const flat = (v: unknown): boolean =>
  v === null || typeof v !== "object" || (Array.isArray(v) && v.every(flat));
const flatText = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(flatText).join(", ")}]` : JSON.stringify(v);

/**
 * The JSON as prettier leaves it: every object open, one key a line; a list of plain values on one line (shortcut:
 * prettier wraps such a list past 80 columns; a draft's are short, a reference's arguments or a source's classes).
 */
function pretty(v: unknown, indent: string): string {
  if (flat(v)) return flatText(v);
  const inner = `${indent}  `;
  if (Array.isArray(v))
    return `[\n${v.map((x) => inner + pretty(x, inner)).join(",\n")}\n${indent}]`;
  const entries = Object.entries(v as object).filter(
    ([, x]) => x !== undefined,
  );
  if (entries.length === 0) return "{}";
  const lines = entries.map(
    ([k, x]) => `${inner}${JSON.stringify(k)}: ${pretty(x, inner)}`,
  );
  return `{\n${lines.join(",\n")}\n${indent}}`;
}
export const draftJson = (d: DraftBlueprint): string => `${pretty(d, "")}\n`;
