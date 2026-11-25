// The tree worker's copy of the game's code (spec 008, research R2, ADR 0008): each step of a `_customBlock_`'s
// arithmetic becomes `__X(id, value)`, with `__X` defined inside the context by the recorder. Ported from the bench's
// instrument.cjs at BASELINE-4 (`build`, `marks`, `assignments`, `rewrite`). In memory only (FR-011): this file reads
// and writes no file, and `ops[].fnText` and the AST never leave the worker.
import { parse } from "acorn";
import {
  at,
  children,
  isBlockCall,
  isNode,
  methodName,
  noted,
  returnKind,
  returnNotes,
} from "./instrument-returns.ts";
import type { AnyNode, Defs } from "./instrument-returns.ts";

export interface Op {
  block: string;
  kind: "op" | "leaf" | "assign" | "cmp" | "test";
  node: AnyNode;
  /** The step this one is inside of, by id; undefined at the top of the block. */
  parent: number | undefined;
  /** For a leaf that is a variable: the expression that last set it before this read (data flow). */
  def: AnyNode | null;
  /**
   * For a leaf, or an assignment's prevDef (spec 010, T177 r4, r5): the block's calls its value comes from by data flow,
   * bare, through `asNumber(…)`, another variable or a side of a `? :`, each with the sides on its way; absent with none.
   */
  defCalls?: DefCall[];
  /** The leaf, or the assignment's prevDef, has a block's call anywhere in its value (T177 r5): never a read by value. */
  callIn?: true;
  /** With callIn: the sides of each `? :` on the way to a part of the value with no block's call (T177 r6). */
  freeSides?: DefCall["sides"][];
  /** For an assignment: the expression that set its variable before it. */
  prevDef: AnyNode | null;
  /** For a leaf that is a variable: every expression that sets it in the block, a loop's later ones too (T232). */
  writes?: AnyNode[];
  /** For a test: the `if` or the `? :` it decides (the answer key reads what its branch runs first). */
  owner?: AnyNode;
  /** The block's function text; the node ranges count from 1 inside it (it was parsed as `(text)`). */
  fnText: string;
}

/** A block's call a value comes from, and each `? :` on its way with the side it sits on (true: the consequent). */
export interface DefCall {
  call: AnyNode;
  sides: [AnyNode, boolean][];
}

interface Mark {
  node: AnyNode;
  kind: Op["kind"];
  incr?: boolean;
  owner?: AnyNode;
  s: number;
  e: number;
}

const ARITH = new Set(["+", "-", "*", "/", "%"]);
const CMP = new Set(["==", "===", "!=", "!==", "<", ">", "<=", ">="]);
const MATH = new Set([
  "min",
  "max",
  "pow",
  "floor",
  "ceil",
  "round",
  "abs",
  "log",
  "sqrt",
]);
const COMPOUND = new Set(["+=", "-=", "*=", "/=", "%="]);
// a block, a helper's event (spec 010, T168; spec, Open Questions 23/11): a method of its class, named whole, and an
// actor's init among its prototype's methods (T189), named by the class whose name the code gave last before it
const BLOCK =
  /(?:_customBlock_(\w+)\s*=|(_customEvent_\w+)\s*[=:]|[{,]\s*(init)\s*:)\s*function\s*\(/g;
// any class's name, so an init after a class of another package (`com.stencyl.*`, `openfl.*`) is none of the actor's
const CLASS_NAME = /__name__\s*=\s*"([\w.]+)"/g;
const ACTOR = /^scripts\.ActorEvents_\d+$/;

const isMathCall = (n: AnyNode) => {
  if (n.type !== "CallExpression") return false;
  const callee = at(n, "callee");
  return (
    callee.type === "MemberExpression" &&
    at(callee, "object").type === "Identifier" &&
    at(callee, "object").name === "Math" &&
    at(callee, "property").type === "Identifier" &&
    MATH.has(at(callee, "property").name as string)
  );
};
const isArith = (n: AnyNode) =>
  n.type === "BinaryExpression" && ARITH.has(n.operator as string);
const isCompound = (n: AnyNode) =>
  n.type === "AssignmentExpression" &&
  COMPOUND.has(n.operator as string) &&
  at(n, "left").type === "Identifier";
const isIncr = (n: AnyNode) =>
  n.type === "UpdateExpression" && at(n, "argument").type === "Identifier";
const isTarget = (n: AnyNode) => isArith(n) || isMathCall(n) || isCompound(n);
const isLeaf = (n: AnyNode) => !isTarget(n) && n.type !== "Literal";

/** The nodes to wrap, in the bench's order (the first mark of a range wins). */
function marks(fn: AnyNode): Omit<Mark, "s" | "e">[] {
  const out: Omit<Mark, "s" | "e">[] = [];
  const leaves = (sides: AnyNode[]) => {
    for (const side of sides)
      if (isLeaf(side)) out.push({ node: side, kind: "leaf" });
  };
  (function walk(n: AnyNode) {
    if (isArith(n)) {
      out.push({ node: n, kind: "op" });
      leaves([at(n, "left"), at(n, "right")]);
    } else if (isMathCall(n)) {
      out.push({ node: n, kind: "op" });
      leaves(n.arguments as AnyNode[]);
    } else if (isCompound(n)) {
      // `x *= y` sets a variable: its value reaches the later steps that read x, but it is no top step of its own.
      out.push({ node: n, kind: "assign" });
      leaves([at(n, "right")]);
    } else if (n.type === "BinaryExpression" && CMP.has(n.operator as string)) {
      out.push({ node: n, kind: "cmp" });
      leaves([at(n, "left"), at(n, "right")]);
    }
    // A statement `x++` sets x like `x += 1` (a for-loop update is no statement: loop counters stay out).
    if (n.type === "ExpressionStatement" && isIncr(at(n, "expression")))
      out.push({ node: at(n, "expression"), kind: "assign", incr: true });
    if (n.type === "ConditionalExpression" || n.type === "IfStatement")
      out.push({ node: at(n, "test"), kind: "test", owner: n });
    children(n).forEach(walk);
  })(fn);
  return out;
}

/** The assignments of a function by variable, so a value taken from a variable opens into what set it. */
function assignments(fn: AnyNode): Defs {
  const out: Defs = new Map();
  const add = (name: string, end: number, rhs: AnyNode) => {
    const list = out.get(name) ?? [];
    list.push({ end, rhs });
    out.set(name, list);
  };
  (function walk(n: AnyNode) {
    if (
      n.type === "AssignmentExpression" &&
      n.operator === "=" &&
      at(n, "left").type === "Identifier"
    )
      add(at(n, "left").name as string, n.range[1], at(n, "right"));
    if (isCompound(n)) add(at(n, "left").name as string, n.range[1], n);
    if (n.type === "ExpressionStatement" && isIncr(at(n, "expression"))) {
      const x = at(n, "expression");
      add(at(x, "argument").name as string, x.range[1], x);
    }
    if (
      n.type === "VariableDeclarator" &&
      at(n, "id").type === "Identifier" &&
      isNode(n.init)
    )
      add(at(n, "id").name as string, n.range[1], at(n, "init"));
    children(n).forEach(walk);
  })(fn);
  return out;
}

/** `asNumber(x)` is x. */
const bare = (n: AnyNode): AnyNode => {
  const args = (n.arguments as AnyNode[] | undefined) ?? [];
  return methodName(n) === "asNumber" && args.length === 1 && args[0]
    ? bare(args[0])
    : n;
};

function defOf(node: AnyNode | undefined, defs: Defs): AnyNode | null {
  if (node?.type !== "Identifier") return null;
  let best: { end: number; rhs: AnyNode } | null = null;
  for (const d of defs.get(node.name as string) ?? [])
    if (d.end <= node.range[0] && (!best || d.end > best.end)) best = d;
  return best ? best.rhs : null;
}

/** The block calls an expression's value comes from: see Op.defCalls; the ways to a part with none go in `free`. */
function callsOf(
  rhs: AnyNode | null,
  defs: Defs,
  memo: CallMemo,
  free: DefCall["sides"][],
  depth = 0,
  sides: DefCall["sides"] = [],
): DefCall[] {
  if (!rhs || depth > 6) return [];
  if (isBlockCall(rhs)) return [{ call: rhs, sides }];
  const args = (rhs.arguments as AnyNode[] | undefined) ?? [];
  const next = (n: AnyNode | null, s = sides) =>
    callsOf(n, defs, memo, free, depth + 1, s);
  if (methodName(rhs) === "asNumber" && args.length === 1)
    return next(args[0] ?? null);
  if (rhs.type === "Identifier") return next(defOf(rhs, defs));
  if (rhs.type === "ConditionalExpression")
    return [
      ...next(at(rhs, "consequent"), [...sides, [rhs, true]]),
      ...next(at(rhs, "alternate"), [...sides, [rhs, false]]),
    ];
  if (!hasCall(rhs, defs, memo)) free.push(sides);
  return [];
}

/** A block's call anywhere in an expression's value, through the variables it reads (Op.callIn). A member is a read of
 * the game's memory, whatever names its place: its object and its key are no part of its value. */
function hasCall(
  n: AnyNode | null,
  defs: Defs,
  memo: CallMemo,
  depth = 0,
): boolean {
  if (!n || depth > 6 || n.type === "MemberExpression") return false;
  // a yes holds from anywhere; a no, met with fewer hops left, only for as few or fewer (T177 r6)
  const hit = memo.get(n);
  if (hit && (hit.out || depth >= hit.depth)) return hit.out;
  const out =
    isBlockCall(n) ||
    (n.type === "Identifier"
      ? hasCall(defOf(n, defs), defs, memo, depth + 1)
      : children(n).some((c) => hasCall(c, defs, memo, depth)));
  memo.set(n, { out, depth });
  return out;
}
type CallMemo = Map<AnyNode, { out: boolean; depth: number }>;

/** One function's text with every marked node as `(__X(id,(node)))`; the ids continue from `ops.length`. */
function rewrite(text: string, fn: AnyNode, block: string, ops: Op[]): string {
  const defs = assignments(fn);
  const callMemo: CallMemo = new Map(); // the variables' defs are walked once per function, not once per leaf
  const copy = noted(
    text,
    returnNotes(fn, (arg) => returnKind(fn, defs, arg)),
  );
  const byRange = new Map<string, Mark>();
  for (const m of marks(fn)) {
    const s = m.node.range[0] - 1;
    const e = m.node.range[1] - 1;
    const key = `${String(s)}:${String(e)}`;
    if (!byRange.has(key)) byRange.set(key, { ...m, s, e });
  }
  const all = [...byRange.values()].sort((a, b) => a.s - b.s || b.e - a.e);
  function emit(
    s: number,
    e: number,
    inside: Mark[],
    parent: number | undefined,
  ): string {
    let out = "";
    let from = s;
    const top = inside.filter(
      (m) => m.s >= s && m.e <= e && !(m.s === s && m.e === e),
    );
    const outer = top.filter(
      (m) =>
        !top.some(
          (o) =>
            o !== m &&
            o.s <= m.s &&
            o.e >= m.e &&
            !(o.s === m.s && o.e === m.e),
        ),
    );
    for (const m of outer) {
      out += copy(from, m.s);
      const id = ops.length;
      const target =
        m.kind === "assign"
          ? at(m.node, isIncr(m.node) ? "argument" : "left")
          : undefined;
      // a variable leaf, bare or through asNumber(…) as callsOf reads it (T232 r1)
      const v0 = m.kind === "leaf" ? bare(m.node) : null;
      const def = v0 ? defOf(v0, defs) : null;
      const writes =
        v0?.type === "Identifier"
          ? (defs.get(v0.name as string) ?? []).map((d) => d.rhs)
          : [];
      const prevDef = defOf(target, defs);
      // a leaf's value is the leaf (a variable opens into its def); an assignment's, what set it before
      const value = m.kind === "leaf" ? m.node : prevDef;
      const free: DefCall["sides"][] = [];
      const calls = callsOf(value, defs, callMemo, free);
      const callIn = hasCall(value, defs, callMemo);
      ops.push({
        block,
        kind: m.kind,
        node: m.node,
        parent,
        def,
        ...(calls.length > 0 && { defCalls: calls }),
        ...(callIn && { callIn: true as const }),
        ...(callIn && free.length > 0 && { freeSides: free }),
        prevDef,
        ...(writes.length > 0 && { writes }),
        fnText: text,
        ...(m.owner ? { owner: m.owner } : {}),
      });
      const name = m.incr ? (at(m.node, "argument").name as string) : "";
      out += m.incr
        ? `(__X(${String(id)},(${name}${m.node.operator === "++" ? "+=1" : "-=1"})))`
        : `(__X(${String(id)},(${emit(m.s, m.e, top, id)})))`;
      from = m.e;
    }
    return out + copy(from, e);
  }
  return emit(0, text.length, all, undefined);
}

/** Where the function that starts at `start` ends (its last `}`), skipping quoted text; -1 when it never closes. */
function functionEnd(src: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let j = src.indexOf("{", start); j >= 0 && j < src.length; j++) {
    const ch = src[j];
    if (quote) {
      if (ch === "\\") j++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return j + 1;
  }
  return -1;
}

/**
 * The game's code with each block's, each helper's event's and each actor's init's steps noted, and the classes of those
 * inits (`scripts.ActorEvents_577`), for the recorder to wrap. A block the parser refuses keeps its text.
 */
export function instrument(source: string): {
  source: string;
  ops: Op[];
  inits: string[];
} {
  const ops: Op[] = [];
  const pieces: string[] = [];
  const inits: string[] = [];
  const classes = [...source.matchAll(CLASS_NAME)];
  let copied = 0;
  for (const m of source.matchAll(BLOCK)) {
    if (m.index < copied) continue; // a match inside a block already rewritten
    const cls = m[3]
      ? classes.findLast((c) => c.index < m.index)?.[1]
      : undefined;
    if (m[3] && (!cls || !ACTOR.test(cls))) continue; // the init of no actor
    const fnStart = m.index + m[0].lastIndexOf("function");
    const end = functionEnd(source, fnStart);
    if (end < 0) continue;
    const text = source.slice(fnStart, end);
    let fn: AnyNode;
    try {
      const program = parse(`(${text})`, {
        ecmaVersion: 2022,
        ranges: true,
      }) as unknown as AnyNode;
      const [statement] = program.body as [AnyNode];
      fn = at(statement, "expression");
    } catch {
      continue;
    }
    const block = cls ? `${cls.slice(8)}_init` : (m[1] ?? m[2] ?? "");
    pieces.push(source.slice(copied, fnStart), rewrite(text, fn, block, ops));
    if (cls) inits.push(cls);
    copied = end;
  }
  pieces.push(source.slice(copied));
  // a class with two inits is wrapped once (recorder.js wraps its prototype's init)
  return { source: pieces.join(""), ops, inits: [...new Set(inits)] };
}
