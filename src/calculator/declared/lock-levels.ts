// The lock below the pools (spec 010, FR-010, FR-002b, FR-005, FR-016, research R2-R6): each level is the recorded
// expression that gave a node its value; the declared children are its parts, each reference of the expression swapped
// for its child's recorded value and evaluated again here, in memory only. A part with no child, a child out of the
// expression or with no value, a level that does not close, a condition that does not agree and a leaf with no kind are
// refused with their place. A part of NOT_LEAVES (a curve, a log, a context read) is no child: a curve whose numeric
// arguments differ is counted again from its own steps, and one with a repeated argument closes by its recorded value,
// counted apart. A level the recording opens (level-openings.ts: a cache's author, a loop's turns) has those parts as
// its children and closes by their sum; a refused opening is an openingRefused with its reason. A line that calls a
// recipe piece closes by the piece's count or its recipe instead (lock-pieces.ts).
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import type { BlockSteps, Expr, LoopTurn } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import type { AnswerTerm } from "./answer-key.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { onlyRead } from "./cache-author.ts";
import { levelOfOpening, openingOf } from "./level-openings.ts";
import type { Opening } from "./level-openings.ts";
import { partsOf } from "./level-parts.ts";
import {
  leafCheck,
  leavesOf,
  num,
  returnOf,
  saveChild,
  termExpr,
} from "./lock-parts.ts";
import { listCalls, modelChildren } from "./lock-each.ts";
import { closeLevel } from "./lock-close.ts";
import { lockConstants } from "./lock-constants.ts";
import { lockPiece } from "./lock-pieces.ts";
import type { LockError, LockInput, LockResult } from "./lock.ts";
import { keyMatches, savedTwice } from "./refs.ts";
import { writtenArgs } from "./save-args.ts";
import { callIn, covers, valueIn } from "./lock-values.ts";

export interface LevelContext {
  rec: Recording;
  /** The recorded steps of a call (`makeSteps(rec, ops).of`). */
  stepsOf: (id: number) => BlockSteps;
  /** The steps of a turn of a call (`makeSteps(rec, ops).turnOf`). */
  turnOf: (n: RecNode, range: LoopTurn) => BlockSteps;
  /** The tree's character, for `{character}` and the reads of the other characters. */
  character: number;
  /** The node's id (refs.ts, nodeId). */
  where: string;
  /** Below a piece's call level (lock-pieces.ts): a level closes by its own count, never by an opening. */
  noOpen?: true;
  /** The game's code and the character's class, for a piece with the form of a recipe (lock-piece-recipe.ts). */
  ops?: LockInput["ops"];
  characterClass?: LockInput["characterClass"];
}
export interface LevelOut {
  errors: LockError[];
  counts: LockResult["counts"];
  /** Each place that closed or is a typed leaf, once per time (the tally counts it once). */
  closedAt: string[];
  /**
   * Each child refused that the run did not reach: under a level its code's gate gave 0 before its count (T210), or of
   * another member's descent than the chosen one (T212); the joined runs keep the refusal only when no run reached it.
   */
  unreached?: string[];
}
/** A level: the expression that gave the value, the call whose reads and calls it lives in, and the value. */
export interface Level {
  expr: Expr | null;
  scope: RecNode;
  value: number | null;
  /** In a two-source term, the references only a `termPart` child may give. */
  termParts?: ReadonlySet<string>;
  /** A level that opens by the recording (level-openings.ts): its parts, in place of its expression's. */
  open?: Opening[];
  /** The cache's write the level's call made (level-openings.ts): its turns open it; `steps`, its turn's. */
  write?: RecWrite;
  steps?: BlockSteps | undefined;
}

export const emptyOut = (): LevelOut => ({
  errors: [],
  counts: { closed: 0, closedByRecorded: 0, leaves: 0, branches: 0 },
  closedAt: [],
});

/**
 * A declared condition (research R3): its reading is in the level, and it is on when the game used the node, off when
 * it did not.
 */
export function checkCondition(
  node: BlueprintNode,
  present: boolean,
  scope: RecNode,
  ctx: LevelContext,
  out: LevelOut,
): void {
  const c = node.condition;
  if (!c?.ref) return;
  const where = `${ctx.where}/${c.key}`;
  const v = valueIn(c.ref, scope, [], ctx);
  const expected = present ? "on" : "off";
  if (v === null)
    out.errors.push({ kind: "conditionMismatch", where, expected });
  else if ((v !== 0) !== present)
    out.errors.push({ kind: "conditionMismatch", where, expected, got: v });
  else if (present) leafCheck(c, where, out);
}

/** The level a declared node opens into: a call's returned expression, or a read standing for itself. */
function levelOfChild(
  child: BlueprintNode,
  parent: Level,
  leaves: readonly Expr[],
  ctx: LevelContext,
  only?: ReadonlySet<string>,
): Level {
  const { ref } = child;
  const n =
    ref && "call" in ref
      ? callIn(ref, parent.scope, leaves, ctx, only)
      : undefined;
  if (n) return { expr: returnOf(n, ctx), scope: n, value: num(n.v) };
  const p =
    ref && "read" in ref
      ? ref.read.replaceAll("{character}", String(ctx.character))
      : "";
  const value = ref ? valueIn(ref, parent.scope, leaves, ctx) : null;
  // the read at its place in the parent's expression (one only), for a cache's author (cache-author.ts)
  const at = onlyRead(parent.expr, p);
  const expr: Expr = at ?? { t: "read", p, v: value };
  return { expr, scope: parent.scope, value, steps: parent.steps };
}

/**
 * The parts the lock asks a declared call to have as children: its level's references, without the not-leaves, or the
 * parts the recording opens it into (level-openings.ts); the refusal's reason when that opening is refused.
 */
export function callParts(
  n: RecNode,
  ctx: LevelContext,
  expr = returnOf(n, ctx),
  write?: RecWrite,
): string[] | string {
  const level = { expr, scope: n, value: num(n.v), ...(write && { write }) };
  // a level the recording opens gives its own parts; a refused one, none (the agent descends)
  const open = openingOf(level, ctx);
  if (typeof open === "string") return open;
  return open
    ? open.map((o) => o.part)
    : partsOf(level, expr ? leavesOf(expr) : [], ctx);
}

/** One level: its children's coverage and values, the descent into each, and the closing of the remounted count. */
export function lockLevel(
  declared: readonly BlueprintNode[],
  level: Level,
  ctx: LevelContext,
  out: LevelOut,
  each?: BlueprintNode["each"],
): void {
  const leaves = level.expr ? leavesOf(level.expr) : [];
  const { open } = level;
  const parts = open ? open.map((o) => o.part) : partsOf(level, leaves, ctx);
  // a model child stands for one child per part its list matches (T202), or per call of its block (T205)
  const listed =
    each && "calls" in each
      ? listCalls(declared, each, level.scope, ctx.rec)
      : { times: new Map<string, number>(), refused: [] };
  const children = modelChildren(declared, each, parts, ctx, listed.times);
  const twice = listed.refused;
  for (const k of twice)
    out.errors.push({
      kind: "rootForm",
      where: ctx.where,
      got: `duas chamadas ${k} no nível, e o lugar não as separa`,
    });
  const covered = new Set<string>();
  // the calls a child's `*` may stand for: two of them are refused, never tied by order (refs.ts savedTwice)
  // an author that overwrote the cache in more than one turn (T212): the cache is the best member's, by its turn
  const choice =
    !open &&
    ctx.rec.writes.filter(
      (w) => w.node === level.scope.id && w.path === level.write?.path,
    ).length > 1;
  // in an author's write's turn, one write or more, a child's `*` stands for that turn's calls only, its parts
  const turn = !open && level.write !== undefined;
  const chosen = turn ? new Set(parts) : undefined;
  const made = level.scope.c.flatMap((id) => ctx.rec.nodes[id] ?? []);
  const calls = turn ? parts : [...parts, ...made.map(callRef)];
  // a call's constants with the conditions that apply them (T209, form 3)
  const consts = lockConstants(children, level, leaves, ctx, out);
  for (const p of consts?.covered ?? []) covered.add(p);
  let whole = consts?.value !== null && twice.length === 0;
  for (const child of children) {
    if (child.constant !== undefined) continue;
    const where = `${ctx.where}/${child.key}`;
    const inner = { ...ctx, where };
    // a part of the chosen turn ties to its calls only; another member's child stays outside (below)
    const only = parts.some((p) => covers(child, p, ctx)) ? chosen : undefined;
    const twice = child.ref && savedTwice(child.ref, calls, ctx.character);
    if (twice) {
      out.errors.push({ kind: "rootForm", where, got: twice });
      whole = false;
      continue;
    }
    // a child only some classes have (T211, FR-002a): in another class's run it is absent, or there at its neutral value
    const cls = ctx.characterClass;
    if (child.classes && (cls == null || !child.classes.includes(cls))) {
      const at = parts.filter((p) => covers(child, p, ctx));
      for (const p of at) covered.add(p);
      // shortcut: neutral is 0 or 1, whichever the part's role is; read the role off the count if a case needs it
      const v =
        at.length > 0 && child.ref
          ? valueIn(child.ref, level.scope, leaves, ctx)
          : 0;
      if (v !== 0 && v !== 1)
        out.errors.push({
          kind: "classMismatch",
          where,
          expected: child.classes.join(", "),
          got: cls ?? "",
        });
      continue;
    }
    const hit = open?.find((o) => covers(child, o.part, ctx));
    if (open && !hit) {
      out.errors.push({ kind: "childOutside", where });
      continue;
    }
    if (
      !child.ref ||
      (hit ? hit.value : valueIn(child.ref, level.scope, leaves, ctx, only)) ===
        null
    ) {
      out.errors.push({ kind: "childNoValue", where });
      // the code's gate gave 0 before its count (T183): the run did not reach the child, the level still closes
      if (level.expr?.t === "num" && level.expr.v === 0 && level.value === 0)
        (out.unreached ??= []).push(where);
      else whole = false;
      continue;
    }
    const hits = parts.filter((p) => covers(child, p, ctx));
    if (hits.length === 0) out.errors.push({ kind: "childOutside", where });
    // the best of the members (T212): a child of another member's descent is one this run's chosen one did not reach
    if (hits.length === 0 && choice) {
      (out.unreached ??= []).push(where);
      continue;
    }
    // the other references of a two-source term are only a termPart child's (research R4)
    for (const p of hits)
      if (level.termParts?.has(p) !== (child.termPart === undefined))
        covered.add(p);
    checkCondition(child, true, level.scope, inner, out);
    const below = hit
      ? levelOfOpening(hit, level.scope, ctx)
      : levelOfChild(child, level, leaves, ctx, only);
    descend(child, below, inner, out);
  }
  for (const p of parts)
    if (!covered.has(p)) {
      out.errors.push({ kind: "undeclaredPart", where: ctx.where, got: p });
      whole = false;
    }
  if (!whole) return;
  closeLevel(level, leaves, ctx, out, consts);
}

function descend(
  node: BlueprintNode,
  level: Level,
  ctx: LevelContext,
  out: LevelOut,
): void {
  const { ref } = node;
  // a call's argument the game gave from the character's index or the save is never written out (save-args.ts)
  out.errors.push(...writtenArgs(ref, level.scope, ctx, node.itemArg));
  // a line with a link (T200): its value came by its ref, its tree is the other number's; the descent ends here
  if (node.tree !== undefined) {
    out.counts.leaves++;
    out.closedAt.push(ctx.where);
    return;
  }
  // a piece's line closes by the piece's count or recipe (lock-pieces.ts), never by an opening of the recording
  if (node.combine || node.pools) {
    lockPiece(node, level, ctx, out);
    return;
  }
  const children = node.children ?? [];
  // a level the recording opens (level-openings.ts); a cache's read opens as a leaf too: the cache is never a leaf
  const open =
    !ctx.noOpen && (children.length > 0 || (ref && "read" in ref))
      ? openingOf(level, ctx)
      : null;
  if (typeof open === "string") {
    out.errors.push({ kind: "openingRefused", where: ctx.where, got: open });
    return;
  }
  if (children.length === 0) {
    leafCheck(node, ctx.where, out);
    // a leaf is the end of the descent: below its own call, the recording reads nothing of the save
    const child = open
      ? (open[0]?.part ?? null)
      : ref &&
          "call" in ref &&
          keyMatches(ref, callRef(level.scope), ctx.character)
        ? saveChild(level.scope, ctx)
        : null;
    if (child !== null)
      out.errors.push({
        kind: "leafHasChildren",
        where: ctx.where,
        got: child,
      });
    return;
  }
  out.counts.branches++;
  lockLevel(children, open ? { ...level, open } : level, ctx, out, node.each);
}

/** The descent below a declared node whose value is a recorded call: each level down to the leaves. */
export function lockLevels(
  node: BlueprintNode,
  recorded: RecNode,
  ctx: LevelContext,
): LevelOut {
  const out = emptyOut();
  descend(
    node,
    { expr: returnOf(recorded, ctx), scope: recorded, value: num(recorded.v) },
    ctx,
    out,
  );
  return out;
}

/** The descent below a pool's source, from the answer key's term: the term's own expression, or its call's. */
export function lockSource(
  node: BlueprintNode,
  term: AnswerTerm,
  top: RecNode,
  ctx: LevelContext,
  out: LevelOut,
): void {
  checkCondition(node, true, top, ctx, out);
  const children = node.children ?? [];
  // the other references of a two-source term; the same call read again (a curve's, the LUK's) is no other source
  if (children.length === 0 && term.refs.length > 1)
    for (const r of term.refs.slice(1).filter((x) => x !== term.ref))
      out.errors.push({ kind: "undeclaredPart", where: ctx.where, got: r });
  const call = ctx.rec.nodes[term.nodes[0] ?? -1];
  const at = call ? null : termExpr(term, top, ctx);
  // the read at its place: its value is the read's, not the factor a Multi pool multiplies by (1 + x / 100)
  const read = call ? undefined : onlyRead(at, term.ref);
  const level: Level =
    term.refs.length > 1
      ? {
          expr: termExpr(term, top, ctx),
          scope: top,
          value: term.value,
          termParts: new Set(term.refs.slice(1)),
        }
      : call
        ? { expr: returnOf(call, ctx), scope: call, value: num(call.v) }
        : {
            // the term's read at its place in the root's steps, when it is in one only
            expr: read ?? { t: "read", p: term.ref, v: term.value },
            scope: top,
            value: num(read?.v) ?? term.value,
          };
  descend(node, level, ctx, out);
}
