// The returns of a block's function (spec 010, Fase 4 r2): each one that gives a block's call or a read gets
// `__R("call")` or `__R("read")` before its value, and the recorder notes the one that ran (RecNode.rt). With acorn's
// nodes as instrument.ts walks them.
import type { Node } from "acorn";

/** acorn's nodes, read by field name: the walk visits every child, whatever its type. */
export type AnyNode = Node &
  Record<string, unknown> & { range: [number, number] };

export const isNode = (v: unknown): v is AnyNode =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { type?: unknown }).type === "string";
export const at = (n: AnyNode, k: string) => n[k] as AnyNode;

export function children(node: AnyNode): AnyNode[] {
  const out: AnyNode[] = [];
  for (const [k, v] of Object.entries(node)) {
    if (k === "parent") continue;
    const list: unknown[] = Array.isArray(v) ? v : [v];
    out.push(...list.filter(isNode));
  }
  return out;
}

/** A function's assignments by variable: where each one ends and the value it set (instrument.ts `assignments`). */
export type Defs = Map<string, { end: number; rhs: AnyNode }[]>;

export const methodName = (n: AnyNode): unknown =>
  n.type === "CallExpression" && at(n, "callee").type === "MemberExpression"
    ? at(at(n, "callee"), "property").name
    : undefined;

export const isBlockCall = (n: AnyNode) => {
  const name = methodName(n);
  return typeof name === "string" && name.startsWith("_customBlock_");
};

type Kind = "call" | "read";
const one = (n: AnyNode): AnyNode | null => {
  const args = (n.arguments as AnyNode[] | undefined) ?? [];
  return methodName(n) === "asNumber" && args.length === 1
    ? (args[0] ?? null)
    : null;
};
/** A block's call written in place: bare, by `asNumber(…)` or by a `? :` of such calls only; the last call it makes. */
const directCall = (n: AnyNode | null): boolean =>
  !!n &&
  (isBlockCall(n) ||
    directCall(one(n)) ||
    (n.type === "ConditionalExpression" &&
      directCall(at(n, "consequent")) &&
      directCall(at(n, "alternate"))));
/** A member read of a variable written in place (`s.k`), bare or by `asNumber(…)`: the last read it makes. */
function directRead(n: AnyNode | null): boolean {
  if (!n) return false;
  const inner = one(n);
  if (inner) return directRead(inner);
  let o = n;
  while (o.type === "MemberExpression") o = at(o, "object");
  return o !== n && o.type === "Identifier";
}

/** A block's call or event (each a call of the recording), or a member read other than a block call's callee, inside
 * the text from `from` to `to`. */
function other(fn: AnyNode, kind: Kind, from: number, to: number): boolean {
  return (function walk(n: AnyNode, callee: boolean): boolean {
    if (n.range[1] <= from || n.range[0] >= to) return false;
    const inside = n.range[0] >= from && n.range[1] <= to;
    const name = methodName(n);
    const isCall = typeof name === "string" && name.startsWith("_custom");
    if (
      inside &&
      (kind === "call" ? isCall : !callee && n.type === "MemberExpression")
    )
      return true;
    return children(n).some((c) => walk(c, isCall && c === n.callee));
  })(fn, false);
}

/** The variables `fn` declares (`var r`), its parameters not: a parameter or an outer variable holds a value before any
 * assignment. */
function declared(fn: AnyNode): Set<string> {
  const out = new Set<string>();
  (function walk(n: AnyNode) {
    if (n.type === "VariableDeclarator" && at(n, "id").type === "Identifier")
      out.add(at(n, "id").name as string);
    children(n).forEach(walk);
  })(fn);
  for (const p of (fn.params as AnyNode[] | undefined) ?? [])
    if (p.type === "Identifier") out.delete(p.name as string);
  return out;
}

/**
 * What a return gives by its place (Fase 4 r3), only in its direct forms: the call or the read written in the return,
 * the last call or the last read of the recording; or a variable of `fn` with one assignment in the whole function,
 * before the return, of a direct form (or another such variable), and no other call (for a call) or read (for a read)
 * from that assignment to the return. Else none.
 */
export function returnKind(fn: AnyNode, defs: Defs, arg: AnyNode): Kind | null {
  const own = declared(fn);
  const until = arg.range[0];
  return (function kindOf(n: AnyNode, depth: number): Kind | null {
    if (depth > 6) return null;
    if (directCall(n)) return "call";
    if (n.type !== "Identifier") return directRead(n) ? "read" : null;
    const all = defs.get(n.name as string) ?? [];
    const d = all[0];
    if (all.length !== 1 || !d || d.end > until || !own.has(n.name as string))
      return null;
    const k = kindOf(d.rhs, depth + 1);
    return k && !other(fn, k, d.end, until) ? k : null;
  })(arg, 0);
}

/** The notes of the returns of `fn`'s own body (none of a function inside it), by their place in its text. */
export function returnNotes(
  fn: AnyNode,
  kindOf: (arg: AnyNode) => "call" | "read" | null,
): [number, string][] {
  const out: [number, string][] = [];
  (function walk(n: AnyNode, top: boolean) {
    if (!top && n.type.includes("Function")) return;
    const arg =
      n.type === "ReturnStatement" && isNode(n.argument)
        ? at(n, "argument")
        : null;
    const kind = arg && kindOf(arg);
    // the ranges count from 1 inside the text (instrument.ts parses it as `(text)`); the space keeps `return(a)?…` of
    // the minified code from becoming `return__R(…)`
    if (arg && kind) out.push([arg.range[0] - 1, ` __R("${kind}"), `]);
    children(n).forEach((c) => {
      walk(c, false);
    });
  })(fn, true);
  return out.sort((a, b) => a[0] - b[0]);
}

/** `text` from a to b with each note at its place; a return is a statement, so no marked node holds one. */
export const noted =
  (text: string, notes: readonly [number, string][]) =>
  (a: number, b: number): string => {
    let out = "";
    let from = a;
    for (const [p, note] of notes)
      if (p > a && p <= b) {
        out += text.slice(from, p) + note;
        from = p;
      }
    return out + text.slice(from, b);
  };
