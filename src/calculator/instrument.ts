// The tree worker's copy of the game's code (spec 008, research R2, ADR 0008): each step of a `_customBlock_`'s
// arithmetic becomes `__X(id, value)`, with `__X` defined inside the context by the recorder. Ported from the bench's
// instrument.cjs at BASELINE-4 (`build`, `marks`, `assignments`, `rewrite`). In memory only (FR-011): this file reads
// and writes no file, and `ops[].fnText` and the AST never leave the worker.
import { parse } from "acorn";
import type { Node } from "acorn";

export interface Op {
  block: string;
  kind: "op" | "leaf" | "assign" | "cmp" | "test";
  node: AnyNode;
  /** The step this one is inside of, by id; undefined at the top of the block. */
  parent: number | undefined;
  /** For a leaf that is a variable: the expression that last set it before this read (data flow). */
  def: AnyNode | null;
  /** For an assignment: the expression that set its variable before it. */
  prevDef: AnyNode | null;
  /** The block's function text; the node ranges count from 1 inside it (it was parsed as `(text)`). */
  fnText: string;
}

/** acorn's nodes, read by field name: the walk visits every child, whatever its type. */
type AnyNode = Node & Record<string, unknown> & { range: [number, number] };
interface Mark {
  node: AnyNode;
  kind: Op["kind"];
  incr?: boolean;
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
const BLOCK = /_customBlock_(\w+)\s*=\s*function\s*\(/g;

const isNode = (v: unknown): v is AnyNode =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { type?: unknown }).type === "string";
const at = (n: AnyNode, k: string) => n[k] as AnyNode;

function children(node: AnyNode): AnyNode[] {
  const out: AnyNode[] = [];
  for (const [k, v] of Object.entries(node)) {
    if (k === "parent") continue;
    const list: unknown[] = Array.isArray(v) ? v : [v];
    out.push(...list.filter(isNode));
  }
  return out;
}
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
      out.push({ node: at(n, "test"), kind: "test" });
    children(n).forEach(walk);
  })(fn);
  return out;
}

type Defs = Map<string, { end: number; rhs: AnyNode }[]>;

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

function defOf(node: AnyNode | undefined, defs: Defs): AnyNode | null {
  if (node?.type !== "Identifier") return null;
  let best: { end: number; rhs: AnyNode } | null = null;
  for (const d of defs.get(node.name as string) ?? [])
    if (d.end <= node.range[0] && (!best || d.end > best.end)) best = d;
  return best ? best.rhs : null;
}

/** One function's text with every marked node as `(__X(id,(node)))`; the ids continue from `ops.length`. */
function rewrite(text: string, fn: AnyNode, block: string, ops: Op[]): string {
  const defs = assignments(fn);
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
      out += text.slice(from, m.s);
      const id = ops.length;
      const target =
        m.kind === "assign"
          ? at(m.node, isIncr(m.node) ? "argument" : "left")
          : undefined;
      ops.push({
        block,
        kind: m.kind,
        node: m.node,
        parent,
        def: m.kind === "leaf" ? defOf(m.node, defs) : null,
        prevDef: defOf(target, defs),
        fnText: text,
      });
      const name = m.incr ? (at(m.node, "argument").name as string) : "";
      out += m.incr
        ? `(__X(${String(id)},(${name}${m.node.operator === "++" ? "+=1" : "-=1"})))`
        : `(__X(${String(id)},(${emit(m.s, m.e, top, id)})))`;
      from = m.e;
    }
    return out + text.slice(from, e);
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

/** The game's code with each block's steps noted. A block the parser refuses keeps its own text. */
export function instrument(source: string): { source: string; ops: Op[] } {
  const ops: Op[] = [];
  const pieces: string[] = [];
  let copied = 0;
  for (const m of source.matchAll(BLOCK)) {
    if (m.index < copied) continue; // a match inside a block already rewritten
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
    pieces.push(
      source.slice(copied, fnStart),
      rewrite(text, fn, m[1] ?? "", ops),
    );
    copied = end;
  }
  pieces.push(source.slice(copied));
  return { source: pieces.join(""), ops };
}
