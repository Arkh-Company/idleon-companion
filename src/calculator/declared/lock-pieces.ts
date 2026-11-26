// A line that calls a recipe piece, in the lock (spec 010, T170, T171; spec, Open Questions 23/11): the line takes the
// value of its reference (the call or the cache the game read, as any node) and closes by the count of its piece's
// children: each level by its declared combine, a leaf by its recorded value, tied by its place: below the call of its
// level (a call's line, the line's call), or anywhere in the recording for a cache's read; a key or a path the place
// recorded with two values is refused with both. An `each` node has one child per item of the recorded list, its size
// from the recording. A call's level with no combine (the Seraph) closes by its own recorded count, as a level of
// lock-levels.ts, with no opening. Here the engine does not open a cache into its author nor a sum into its loop's
// turns: the piece says the count. A level that does not close, or whose call gives no number, is a notClosing with the
// two values; a part the place lacks, a childNoValue; a leaf whose call reads the save, a leafHasChildren.
import type { RecNode } from "../recording.ts";
import { callRef, relDiff } from "./answer-key-pool.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { lockLevel } from "./lock-levels.ts";
import { lockRecipePiece } from "./lock-piece-recipe.ts";
import { see } from "./lock-seen.ts";
import type { Level, LevelContext, LevelOut } from "./lock-levels.ts";
import {
  leafCheck,
  num,
  returnOf,
  saveChild,
  TOLERANCE,
} from "./lock-parts.ts";
import { fill } from "./pieces.ts";
import {
  eachNames,
  eachPattern,
  keyMatches,
  matchRead,
  savedTwice,
} from "./refs.ts";

type Ctx = Pick<LevelContext, "rec" | "character">;
type Ref = NonNullable<BlueprintNode["ref"]>;
/** Two values one key or one path has in a place: the place does not decide between them. */
export interface TwoValues {
  two: [number | string, number | string];
}
/** What a place recorded for a reference: nothing, two values, two calls its `*` takes, or its one value (and call). */
type Found =
  | "none"
  | TwoValues
  | { twice: string }
  | { v: unknown; call?: RecNode | undefined };

const shown = (v: unknown): number | string =>
  typeof v === "number" || typeof v === "string" ? v : JSON.stringify(v);
const same = (a: unknown, b: unknown): boolean => {
  const [x, y] = [num(a), num(b)];
  return a === b || (x !== null && y !== null && relDiff(x, y) <= TOLERANCE);
};
/** The one value of a place's occurrences (one at least), or the first two that differ. */
function oneOf(vs: readonly unknown[]): TwoValues | { v: unknown } {
  const [first] = vs;
  const other = vs.findIndex((v) => !same(v, first));
  return other < 0 ? { v: first } : { two: [shown(first), shown(vs[other])] };
}

/** Every read a call made, each time: its first reads and its step log (a later read with another value is there). */
const readsOf = (n: RecNode): [string, unknown][] => [
  ...(n.r ?? []).map(([p, v]): [string, unknown] => [p, v]),
  ...(n.rx ?? []).map(([p, v]): [string, unknown] => [p, v]),
];

/** A call and every call below it, in the recording's order: the place of the call's parts. */
function below(n: RecNode, ctx: Ctx): RecNode[] {
  const out: RecNode[] = [];
  const todo = [n];
  for (let x = todo.pop(); x; x = todo.pop()) {
    out.push(x);
    for (const id of x.c.toReversed()) {
      const k = ctx.rec.nodes[id];
      if (k) todo.push(k);
    }
  }
  return out;
}

/** A reference's value in a place: its calls, or its reads (`*` takes the first path that matches). */
function recordedIn(ref: Ref, nodes: readonly RecNode[], ctx: Ctx): Found {
  if ("call" in ref) {
    const calls = nodes.filter((n) =>
      keyMatches(ref, callRef(n), ctx.character),
    );
    if (calls.length === 0) return "none";
    const twice = savedTwice(ref, calls.map(callRef), ctx.character);
    if (twice !== null) return { twice };
    const f = oneOf(calls.map((n) => n.v));
    return "v" in f ? { ...f, call: calls[0] } : f;
  }
  const reads = nodes.flatMap(readsOf);
  const m = matchRead(
    ref.read,
    reads.map(([p]) => p),
    ctx.character,
  );
  const vs = m ? reads.filter(([p]) => p === m.path).map(([, v]) => v) : [];
  return vs.length === 0 ? "none" : oneOf(vs);
}

/**
 * A piece's node's children in a place (the whole recording by default): an each's model once per item of the recorded
 * list, in the list's order, the item in place of its name and the place in the list in its key; an item the place
 * recorded with two values gives them.
 */
export function pieceChildren(
  node: BlueprintNode,
  ctx: Ctx,
  nodes: readonly RecNode[] = ctx.rec.nodes,
): BlueprintNode[] | TwoValues {
  const [model] = node.children ?? [];
  if (!node.each || !("list" in node.each) || !model)
    return [...(node.children ?? [])];
  const { list } = node.each;
  // a piece's list has one [*] (blueprint.ts): one name
  const [as = ""] = eachNames(node.each.as);
  const path = eachPattern(list, ctx.character);
  const items = new Map<number, unknown[]>();
  for (const n of nodes)
    for (const [p, v] of readsOf(n)) {
      const at = path.exec(p)?.[1];
      if (at !== undefined)
        items.set(Number(at), [...(items.get(Number(at)) ?? []), v]);
    }
  const kids: BlueprintNode[] = [];
  for (const [i, [, vs]] of [...items]
    .toSorted(([a], [b]) => a - b)
    .entries()) {
    const f = oneOf(vs);
    if ("two" in f) return f;
    const item = f.v;
    kids.push({
      ...fill(model, { [as]: typeof item === "number" ? item : String(item) }),
      key: `${model.key}-${String(i)}`,
    });
  }
  return kids;
}

/** A part of a piece's level in its place: a level's remounted value, or a leaf's recorded one; null with none. */
function lockPart(
  child: BlueprintNode,
  nodes: readonly RecNode[],
  ctx: LevelContext,
  out: LevelOut,
): number | null {
  const { where } = ctx;
  const f: Found = child.ref ? recordedIn(child.ref, nodes, ctx) : "none";
  if (f !== "none" && "twice" in f) {
    out.errors.push({ kind: "rootForm", where, got: f.twice });
    return null;
  }
  if (f === "none" || "two" in f) {
    if (!child.children) leafCheck(child, where, out);
    out.errors.push(
      f === "none"
        ? { kind: "childNoValue", where }
        : { kind: "childNoValue", where, expected: f.two[0], got: f.two[1] },
    );
    return null;
  }
  const own = num(f.v);
  see(out, where, { value: own });
  if (child.combine)
    return pieceLevel(
      child,
      own,
      f.call ? below(f.call, ctx) : nodes,
      ctx,
      out,
    );
  if (child.children && f.call) {
    // a call's level with no combine (the Seraph): its own recorded count, its parts by their place in it, no opening
    out.counts.branches++;
    const level = { expr: returnOf(f.call, ctx), scope: f.call, value: own };
    lockLevel(child.children, level, { ...ctx, noOpen: true }, out);
    return own;
  }
  leafCheck(child, where, out);
  // a leaf is the end of the descent: below its own call, the recording reads nothing of the save
  const first = f.call ? saveChild(f.call, ctx) : null;
  if (first !== null)
    out.errors.push({ kind: "leafHasChildren", where, got: first });
  if (own === null) out.errors.push({ kind: "childNoValue", where });
  return own;
}

function pieceLevel(
  node: BlueprintNode,
  value: number | null,
  nodes: readonly RecNode[],
  ctx: LevelContext,
  out: LevelOut,
): number | null {
  out.counts.branches++;
  const kids = pieceChildren(node, ctx, nodes);
  if (!Array.isArray(kids)) {
    const [expected, got] = kids.two;
    out.errors.push({ kind: "childNoValue", where: ctx.where, expected, got });
    return null;
  }
  see(out, ctx.where, { kids });
  const parts = kids.map((child) =>
    lockPart(child, nodes, { ...ctx, where: `${ctx.where}/${child.key}` }, out),
  );
  const values = parts.filter((p) => p !== null);
  if (values.length < parts.length) return null;
  const got =
    node.combine === "product"
      ? values.reduce((a, p) => a * p, 1)
      : values.reduce((a, p) => a + p, 0);
  if (value !== null && relDiff(got, value) <= TOLERANCE) {
    out.counts.closed++;
    out.closedAt.push(ctx.where);
  } else
    out.errors.push({
      kind: "notClosing",
      where: ctx.where,
      expected: value ?? Number.NaN,
      got,
    });
  return got;
}

/**
 * A piece's line: its children down to the leaves, then its combine over their values against the line's value. A
 * call's line reads its parts below its own call; a cache's read, anywhere in the recording. A piece with the form of a
 * recipe closes by the root's engine instead (lock-piece-recipe.ts).
 */
export function lockPiece(
  node: BlueprintNode,
  level: Level,
  ctx: LevelContext,
  out: LevelOut,
): void {
  if (node.pools) {
    lockRecipePiece(node, node.pools, level, ctx, out);
    return;
  }
  const { ref } = node;
  const own =
    ref &&
    "call" in ref &&
    keyMatches(ref, callRef(level.scope), ctx.character);
  const nodes = own ? below(level.scope, ctx) : ctx.rec.nodes;
  pieceLevel(node, level.value, nodes, ctx, out);
}
