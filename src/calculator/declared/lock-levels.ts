// The lock below the pools (spec 010, FR-010, FR-002b, FR-005, FR-016, research R2-R6): each level is the recorded
// expression that gave a node its value; the declared children are its parts, each reference of the expression swapped
// for its child's recorded value and evaluated again here, in memory only. A part with no child, a child out of the
// expression or with no value, a level that does not close, a condition that does not agree and a leaf with no kind are
// refused with their place. A part of NOT_LEAVES (a curve, a log, a context read) is no child: a curve whose numeric
// arguments differ is counted again from its own steps, and one with a repeated argument closes by its recorded value,
// counted apart. A level the recording opens (level-openings.ts: a cache's author, a loop's turns) has those parts as
// its children and closes by their sum; a refused opening is an openingRefused with its reason. A line that calls a
// recipe piece closes by the piece's count instead (lock-pieces.ts).
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import type { BlockSteps, Expr, LoopTurn } from "../recorded/steps.ts";
import { callRef, relDiff } from "./answer-key-pool.ts";
import type { AnswerTerm } from "./answer-key.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { evalExpr } from "./expr-eval.ts";
import { onlyRead } from "./cache-author.ts";
import { levelOfOpening, openingOf } from "./level-openings.ts";
import type { Opening } from "./level-openings.ts";
import {
  keyOfLeaf,
  leafCheck,
  leavesOf,
  num,
  returnOf,
  saveChild,
  termExpr,
  TOLERANCE,
  transparentValue,
} from "./lock-parts.ts";
import { lockPiece } from "./lock-pieces.ts";
import type { LockError, LockResult } from "./lock.ts";
import { notLeafOf } from "./not-leaves.ts";
import { matchRead, refKey } from "./refs.ts";

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
}
export interface LevelOut {
  errors: LockError[];
  counts: LockResult["counts"];
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
});

type Ref = NonNullable<BlueprintNode["ref"]>;
/** The recorded call a call reference stands for in a level: one of its expression's, or one the level made. */
function callIn(
  ref: Extract<Ref, { call: string }>,
  scope: RecNode,
  leaves: readonly Expr[],
  ctx: LevelContext,
): RecNode | undefined {
  const key = refKey(ref, ctx.character);
  return [...leaves.flatMap((l) => (l.t === "call" ? [l.id] : [])), ...scope.c]
    .map((id) => ctx.rec.nodes[id])
    .find((n) => n !== undefined && callRef(n) === key);
}

/** The recorded value of a reference in a level: a call it made, or a path it read (`*` takes the first reading). */
function valueIn(
  ref: Ref,
  scope: RecNode,
  leaves: readonly Expr[],
  ctx: LevelContext,
): number | null {
  if ("call" in ref) return num(callIn(ref, scope, leaves, ctx)?.v);
  const reads = new Map<string, unknown>();
  for (const l of leaves) if (l.t === "read") reads.set(l.p, l.v);
  for (const [p, v] of scope.r ?? []) reads.set(p, v);
  const m = matchRead(ref.read, [...reads.keys()], ctx.character);
  return m ? num(reads.get(m.path)) : null;
}

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
): Level {
  const { ref } = child;
  const n =
    ref && "call" in ref ? callIn(ref, parent.scope, leaves, ctx) : undefined;
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
 * The parts of a level: its expression's references; with a curve or a log in it, also what builds their arguments
 * (the level's other steps, its numeric reads and its calls), which are the parent's children (research R6).
 */
function partsOf(level: Level, leaves: readonly Expr[], ctx: LevelContext) {
  const transparent = (k: string) => notLeafOf(k, ctx.character) !== null;
  const keys = (es: readonly Expr[]) =>
    es.flatMap((e) => keyOfLeaf(e, ctx.rec) ?? []);
  const own = keys(leaves);
  const fed = own.some((k) => {
    const role = notLeafOf(k, ctx.character)?.role;
    return role === "curve" || role === "log";
  });
  if (!fed) return [...new Set(own)].filter((k) => !transparent(k));
  const { scope } = level;
  const others = ctx
    .stepsOf(scope.id)
    .steps.flatMap((s) => (s.e === level.expr ? [] : leavesOf(s.e)));
  const reads = (scope.r ?? []).flatMap(([p, v]) =>
    num(v) === null ? [] : [p],
  );
  const calls = scope.c.flatMap((c) => {
    const n = ctx.rec.nodes[c];
    return n ? [callRef(n)] : [];
  });
  return [...new Set([...own, ...keys(others), ...reads, ...calls])].filter(
    (k) => !transparent(k),
  );
}

/**
 * The parts the lock asks a declared call to have as children: its level's references, without the not-leaves, or the
 * parts the recording opens it into (level-openings.ts); null when that opening is refused.
 */
export function callParts(
  n: RecNode,
  ctx: LevelContext,
  expr = returnOf(n, ctx),
  write?: RecWrite,
): string[] | null {
  const level = { expr, scope: n, value: num(n.v), ...(write && { write }) };
  // a level the recording opens gives its own parts; a refused one, none (the agent descends)
  const open = openingOf(level, ctx);
  if (typeof open === "string") return null;
  return open
    ? open.map((o) => o.part)
    : partsOf(level, expr ? leavesOf(expr) : [], ctx);
}

function covers(child: BlueprintNode, part: string, ctx: LevelContext) {
  const { ref } = child;
  if (!ref) return false;
  return "call" in ref
    ? refKey(ref, ctx.character) === part
    : matchRead(ref.read, [part], ctx.character) !== null;
}

/** One level: its children's coverage and values, the descent into each, and the closing of the remounted count. */
export function lockLevel(
  children: readonly BlueprintNode[],
  level: Level,
  ctx: LevelContext,
  out: LevelOut,
): void {
  const leaves = level.expr ? leavesOf(level.expr) : [];
  const { open } = level;
  const parts = open ? open.map((o) => o.part) : partsOf(level, leaves, ctx);
  const covered = new Set<string>();
  let whole = true;
  for (const child of children) {
    const where = `${ctx.where}/${child.key}`;
    const inner = { ...ctx, where };
    const hit = open?.find((o) => covers(child, o.part, ctx));
    if (open && !hit) {
      out.errors.push({ kind: "childOutside", where });
      continue;
    }
    if (
      !child.ref ||
      (hit ? hit.value : valueIn(child.ref, level.scope, leaves, ctx)) === null
    ) {
      out.errors.push({ kind: "childNoValue", where });
      whole = false;
      continue;
    }
    const hits = parts.filter((p) => covers(child, p, ctx));
    if (hits.length === 0) out.errors.push({ kind: "childOutside", where });
    // the other references of a two-source term are only a termPart child's (research R4)
    for (const p of hits)
      if (level.termParts?.has(p) !== (child.termPart === undefined))
        covered.add(p);
    checkCondition(child, true, level.scope, inner, out);
    const below = hit
      ? levelOfOpening(hit, level.scope, ctx)
      : levelOfChild(child, level, leaves, ctx);
    descend(child, below, inner, out);
  }
  for (const p of parts)
    if (!covered.has(p)) {
      out.errors.push({ kind: "undeclaredPart", where: ctx.where, got: p });
      whole = false;
    }
  if (!whole) return;
  closeLevel(level, leaves, ctx, out);
}

function closeLevel(
  level: Level,
  leaves: readonly Expr[],
  ctx: LevelContext,
  out: LevelOut,
): void {
  const { expr, scope, value } = level;
  const expected = value ?? Number.NaN;
  if (!expr) {
    out.errors.push({ kind: "notClosing", where: ctx.where, expected });
    return;
  }
  const reads = new Map((scope.r ?? []).map(([p, v]) => [p, v]));
  const by = { recorded: false };
  const { open } = level;
  const got = open
    ? open.reduce<number | null>(
        (s, o) => (s === null || o.value === null ? null : s + o.value),
        0,
      )
    : evalExpr(expr, (e) => {
        if (!leaves.includes(e)) return undefined;
        const k = keyOfLeaf(e, ctx.rec);
        const n = e.t === "call" ? ctx.rec.nodes[e.id] : undefined;
        if (n && k !== null && notLeafOf(k, ctx.character)) {
          const t = transparentValue(n, ctx);
          by.recorded ||= t.byRecorded;
          return t.v ?? undefined;
        }
        if (n) return num(n.v) ?? undefined;
        // a value with no source (an Expr makeSteps could not tie) gives no number: the level does not close (R2)
        return e.t === "read"
          ? (num(reads.get(e.p) ?? e.v) ?? undefined)
          : undefined;
      });
  if (got !== null && value !== null && relDiff(got, value) <= TOLERANCE) {
    if (by.recorded) out.counts.closedByRecorded++;
    else out.counts.closed++;
  } else
    out.errors.push({
      kind: "notClosing",
      where: ctx.where,
      expected,
      ...(got === null ? {} : { got }),
    });
}

function descend(
  node: BlueprintNode,
  level: Level,
  ctx: LevelContext,
  out: LevelOut,
): void {
  // a piece's line closes by the piece's count (lock-pieces.ts), never by an opening of the recording
  if (node.combine) {
    lockPiece(node, level, ctx, out);
    return;
  }
  const children = node.children ?? [];
  const { ref } = node;
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
          callRef(level.scope) === refKey(ref, ctx.character)
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
  lockLevel(children, open ? { ...level, open } : level, ctx, out);
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
  if (children.length === 0 && term.refs.length > 1)
    for (const r of term.refs.slice(1))
      out.errors.push({ kind: "undeclaredPart", where: ctx.where, got: r });
  const call = ctx.rec.nodes[term.nodes[0] ?? -1];
  const at = call ? null : termExpr(term, top, ctx);
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
            expr: onlyRead(at, term.ref) ?? {
              t: "read",
              p: term.ref,
              v: term.value,
            },
            scope: top,
            value: term.value,
          };
  descend(node, level, ctx, out);
}
