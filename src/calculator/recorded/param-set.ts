// Whether a block's parameter may have been set before a place of a call (spec 010, T209 form 1; Fase 4 q): each
// assignment of it the code has before that place sits on a side of an `if` or a `? :` whose test the call's step log
// shows took only the other side up to there (the game's ArcaneType sets its t in the branch of another name). By the
// recorded side, never by value; an assignment no such test rules out may have run.
import { parse } from "acorn";
import type { Op } from "../instrument.ts";
import { children } from "../instrument-returns.ts";
import type { RecNode } from "../recording.ts";
import type { AstNode } from "./ast.ts";

const inside = (n: AstNode | undefined, x: AstNode) =>
  !!n && n.range[0] <= x.range[0] && x.range[1] <= n.range[1];

// each function's assignments and declarations, parsed once (the ranges as the instrument's: the text inside `( )`)
const assigns = new Map<string, AstNode[]>();
export function assignsOf(fnText: string): AstNode[] {
  let out = assigns.get(fnText);
  if (out) return out;
  out = [];
  try {
    const all = [parse(`(${fnText})`, { ecmaVersion: 2022, ranges: true })];
    for (let n = all.pop(); n; n = all.pop()) {
      const node = n as unknown as AstNode;
      if (
        node.type === "AssignmentExpression" ||
        node.type === "UpdateExpression" ||
        node.type === "VariableDeclarator"
      )
        out.push(node);
      all.push(...(children(node) as never[]));
    }
  } catch {
    // a text that does not parse rules nothing out
  }
  assigns.set(fnText, out);
  return out;
}

// each block's tests of an `if` or a `? :`, by op id, once per op list
const testsBy = new WeakMap<readonly Op[], Map<string, number[]>>();
function testsOf(ops: readonly Op[], block: string): number[] {
  let m = testsBy.get(ops);
  if (!m) {
    m = new Map();
    for (const [i, o] of ops.entries())
      if (o.kind === "test" && o.owner)
        m.set(o.block, [...(m.get(o.block) ?? []), i]);
    testsBy.set(ops, m);
  }
  return m.get(block) ?? [];
}

/** Whether the parameter `leaf` reads may have been set before it in the call `n`, up to its place `pos` in the log. */
export function maySet(
  leaf: Op,
  ops: readonly Op[],
  n: RecNode,
  pos: number,
): boolean {
  const name = leaf.node.name;
  const xs = (n.x ?? []).slice(0, pos + 1);
  const target = (a: AstNode) =>
    (a.type === "UpdateExpression"
      ? a.argument
      : a.type === "VariableDeclarator"
        ? a.id
        : a.left) as AstNode;
  const before = assignsOf(leaf.fnText).filter(
    (a) => target(a).name === name && a.range[1] <= leaf.node.range[0],
  );
  // ruled out: on a side that does not hold the leaf, whose test recorded only the other side
  const ruledOut = (a: AstNode) =>
    testsOf(ops, leaf.block).some((t) => {
      const owner = ops[t]?.owner;
      const yes = owner?.consequent as AstNode | undefined;
      const no = owner?.alternate as AstNode | undefined;
      const want = inside(yes, a) ? true : inside(no, a) ? false : undefined;
      const side = want ? yes : no;
      if (want === undefined || inside(side, leaf.node)) return false;
      const took = xs.filter(([i]) => i === t).map(([, v]) => !!v);
      return took.length > 0 && !took.includes(want);
    });
  return !before.every(ruledOut);
}
