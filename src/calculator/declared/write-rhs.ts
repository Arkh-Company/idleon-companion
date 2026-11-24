// The source a write with no step of its own names in the code (spec 010, Fase 4 q, step 3; the session's rule: the
// recorded place decides): the assignment that made it lies in the code between the steps the call's log recorded
// right before and right after the write, and its right side, through the variables that set it, is a block's call or
// a read the code names (the game's TalentCalc(-2) writes a bubble as `A = CauldronStats(…), t.h[R] = A`). Null when
// the place gives no such assignment, or one whose right side is something else.
import type { Op } from "../instrument.ts";
import type { RecNode, RecWrite } from "../recording.ts";
import { astPattern, CUSTOM, methodOf, unwrap } from "../recorded/ast.ts";
import type { AstNode } from "../recorded/ast.ts";
import { assignsOf } from "../recorded/param-set.ts";

export type RhsSource =
  { call: string } | { read: NonNullable<ReturnType<typeof astPattern>> };

const sets = (a: AstNode) =>
  a.type === "AssignmentExpression" && a.operator === "=";
const leftOf = (a: AstNode) =>
  (a.type === "VariableDeclarator" ? a.id : a.left) as AstNode;
const rightOf = (a: AstNode) =>
  (a.type === "VariableDeclarator" ? a.init : a.right) as AstNode | null;

/** What each assignment the code has at the write's place gives: null when one gives something else, or there is none. */
export function rhsSources(
  node: RecNode,
  write: RecWrite,
  ops: readonly Op[],
): RhsSource[] | null {
  const xs = node.x ?? [];
  const before = ops[xs[write.xi - 1]?.[0] ?? -1];
  const after = ops[xs[write.xi]?.[0] ?? -1];
  const text = (before ?? after)?.fnText;
  const from = before?.node.range[1] ?? 0;
  const to = after?.node.range[0] ?? Infinity;
  if (text === undefined || from > to) return null;
  const all = assignsOf(text);
  // the variable's last value before `pos` in the text (as the instrument's defOf)
  const defOf = (name: unknown, pos: number) =>
    all
      .filter(
        (a) =>
          (sets(a) || (a.type === "VariableDeclarator" && a.init)) &&
          leftOf(a).type === "Identifier" &&
          leftOf(a).name === name &&
          a.range[1] <= pos,
      )
      .sort((a, b) => b.range[1] - a.range[1])[0];
  const resolve = (e: AstNode | null, depth = 0): RhsSource | null => {
    if (!e) return null;
    const n = unwrap(e);
    if (n.type === "Identifier") {
      const d = depth < 4 ? defOf(n.name, n.range[0]) : undefined;
      return d ? resolve(rightOf(d), depth + 1) : null;
    }
    const m = methodOf(n);
    if (m?.startsWith(CUSTOM)) return { call: m.slice(CUSTOM.length) };
    const read = astPattern(n);
    return read ? { read } : null;
  };
  const here = all.filter(
    (a) =>
      sets(a) &&
      leftOf(a).type === "MemberExpression" &&
      a.range[0] >= from &&
      a.range[1] <= to,
  );
  const out = here.map((a) => resolve(rightOf(a)));
  return out.length > 0 && out.every((s) => s !== null) ? out : null;
}
