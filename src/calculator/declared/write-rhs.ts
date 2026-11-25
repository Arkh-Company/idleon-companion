// The source a write with no step of its own names in the code (spec 010, Fase 4 q, step 3; the session's rule: the
// recorded place decides): the assignment that made it is the first to the written key after the step the call's log
// recorded right before the write (and before the one right after, unless a loop went back), its left side the write's
// path (r1 of parts P and Q), and its right side, through the variables that set it on every way there, is a block's
// call or a read the code names (the game's TalentCalc(-2) writes a bubble as `A = CauldronStats(…), t.h[R] = A`). Null
// when the place gives none, a variable has a set off some way there, or the right side is else.
import type { Op } from "../instrument.ts";
import type { RecNode, RecWrite } from "../recording.ts";
import {
  astPattern,
  CUSTOM,
  matchPattern,
  methodOf,
  unwrap,
} from "../recorded/ast.ts";
import type { AstNode } from "../recorded/ast.ts";
import { at } from "./character-args.ts";
import type { AnyNode } from "./character-args.ts";
import { defOf, fnOf, onTheWay } from "./code-fn.ts";
import type { Fn } from "./code-fn.ts";

export type RhsSource =
  { call: string } | { read: NonNullable<ReturnType<typeof astPattern>> };
type Pattern = NonNullable<ReturnType<typeof astPattern>>;

const fns = new Map<string, Fn | null>();
const fnFor = (text: string): Fn | null => {
  if (!fns.has(text)) fns.set(text, fnOf(text));
  return fns.get(text) ?? null;
};

/** A write's place in its call's code: the text, from the end of the step before it to the step after it; null with none. */
export function writeSpan(
  node: RecNode,
  write: RecWrite,
  ops: readonly Op[],
): { text: string; from: number; to: number } | null {
  const xs = node.x ?? [];
  const before = ops[xs[write.xi - 1]?.[0] ?? -1];
  const after = ops[xs[write.xi]?.[0] ?? -1];
  const text = (before ?? after)?.fnText;
  if (text === undefined) return null;
  const from = before?.node.range[1] ?? 0;
  // the step after the write bounds it, unless the code went back to it (a loop's next turn)
  const next = after?.node.range[0] ?? Infinity;
  return { text, from, to: next >= from ? next : Infinity };
}

/** What the assignment at the write's place gives, or null. */
export function rhsSources(
  node: RecNode,
  write: RecWrite,
  ops: readonly Op[],
): RhsSource[] | null {
  const span = writeSpan(node, write, ops);
  const f = span ? fnFor(span.text) : null;
  if (!span || !f) return null;
  const { from, to } = span;
  // the variable's value on every way to `pos`; none when a set of it off some way, after that one, may be the one
  const valueOf = (name: string, pos: number): AnyNode | undefined => {
    const def = defOf(f, name, pos);
    const off = f.all.some((n) => {
      const set =
        (n.type === "AssignmentExpression" && at(n, "left").name === name) ||
        (n.type === "VariableDeclarator" && at(n, "id").name === name);
      return (
        set &&
        n.range[1] <= pos &&
        (!def || n.range[0] > def.range[1]) &&
        !onTheWay(f, n, pos)
      );
    });
    return off ? undefined : def;
  };
  // the keys a left side writes, its base through the variable that set it (`t.h[R]`, t a map of the state)
  const patternOf = (e: AnyNode, depth = 0): Pattern | null => {
    const own = astPattern(e as AstNode);
    if (own?.root) return own;
    const toks: (string | null)[] = [];
    let n = e;
    for (; n.type === "MemberExpression"; n = at(n, "object")) {
      const prop = at(n, "property");
      if (n.computed)
        toks.unshift(prop.type === "Literal" ? String(prop.value) : null);
      else if (prop.name !== "h") toks.unshift(prop.name as string);
    }
    const d =
      n.type === "Identifier" && depth < 4
        ? valueOf(n.name as string, n.range[0])
        : undefined;
    const base = d ? patternOf(d, depth + 1) : null;
    return base
      ? { toks: [...base.toks, ...toks], root: base.root }
      : { toks, root: false };
  };
  const resolve = (e: AnyNode | null, depth = 0): RhsSource | null => {
    if (!e) return null;
    const n = unwrap(e as AstNode) as AnyNode;
    if (n.type === "Identifier") {
      const d = depth < 4 ? valueOf(n.name as string, n.range[0]) : undefined;
      return d ? resolve(d, depth + 1) : null;
    }
    const m = methodOf(n as AstNode);
    if (m?.startsWith(CUSTOM)) return { call: m.slice(CUSTOM.length) };
    const read = astPattern(n as AstNode);
    return read ? { read } : null;
  };
  // the first assignment to the written key after the step before the write: no step ran between them
  const [first] = f.all
    .filter((a) => {
      if (a.type !== "AssignmentExpression" || a.operator !== "=") return false;
      const left = at(a, "left");
      const pat = left.type === "MemberExpression" ? patternOf(left) : null;
      return (
        pat !== null &&
        matchPattern(write.path, pat) &&
        a.range[0] >= from &&
        a.range[1] <= to
      );
    })
    .sort((a, b) => a.range[0] - b.range[0]);
  const src = first ? resolve(at(first, "right")) : null;
  return src ? [src] : null;
}
