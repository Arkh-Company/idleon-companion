// The site of a recorded call among its caller's calls of the block (spec 010, group 5 of part P; the session's rule:
// the recorded place decides): a site on a side of a `? :`, an `if` or an `&&`/`||` that its caller's step log shows
// was not taken when the call began is not the call's. Never by value or order: by the side each test recorded.
import type { Op } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import { sideAt } from "../recorded/sides.ts";
import type { AnyNode } from "./character-args.ts";

const sameRange = (a: AnyNode | undefined, b: AnyNode) =>
  a?.range[0] === b.range[0] && a.range[1] === b.range[1];

// each block's ops by their index, once per op list: the sides are looked up on every call's site
const byBlock = new WeakMap<readonly Op[], Map<string, number[]>>();
function opsOf(ops: readonly Op[], block: string): number[] {
  let m = byBlock.get(ops);
  if (!m) {
    m = new Map();
    for (const [i, o] of ops.entries())
      m.set(o.block, [...(m.get(o.block) ?? []), i]);
    byBlock.set(ops, m);
  }
  return m.get(block) ?? [];
}

/** The op of the caller's block whose node is at `node`'s place, of the given kinds. */
function opAt(
  ops: readonly Op[],
  block: string,
  node: AnyNode,
  kinds: readonly Op["kind"][],
): number | undefined {
  return opsOf(ops, block).find((i) => {
    const o = ops[i];
    return (
      o !== undefined &&
      kinds.includes(o.kind) &&
      sameRange(o.kind === "test" ? o.owner : o.node, node)
    );
  });
}

/**
 * Whether the site ran when the call began, by each side it sits on: false when a test took the other side, null when a
 * side it sits on (a loop's, a case's included) has no recorded test there.
 */
export function ran(
  site: AnyNode,
  up: ReadonlyMap<AnyNode, AnyNode>,
  caller: RecNode,
  ops: readonly Op[],
  pos: number,
): boolean | null {
  let open = false;
  for (let c = site, p = up.get(c); p; c = p, p = up.get(p)) {
    if (/^(For|ForIn|ForOf|While|DoWhile)Statement$|^SwitchCase$/.test(p.type))
      open ||= p.type === "SwitchCase" || p.body === c;
    let want: boolean | undefined;
    let test: number | undefined;
    if (p.type === "ConditionalExpression" || p.type === "IfStatement") {
      if (p.consequent === c) want = true;
      else if (p.alternate === c) want = false;
      if (want !== undefined) test = opAt(ops, caller.b, p, ["test"]);
    } else if (p.type === "LogicalExpression" && p.right === c) {
      want = p.operator === "&&";
      test = opAt(ops, caller.b, p.left as AnyNode, ["cmp", "leaf", "op"]);
    }
    if (want === undefined) continue;
    const side = test === undefined ? null : sideAt(test, caller.x, pos);
    if (typeof side === "boolean" && side !== want) return false;
    open ||= typeof side !== "boolean";
  }
  return open ? null : true;
}

/** The sites that ran when the call `n` began, by its caller's recorded sides; all of them when none is decided. */
export function ranSites(
  sites: readonly AnyNode[],
  up: ReadonlyMap<AnyNode, AnyNode>,
  caller: RecNode,
  ops: readonly Op[],
  n: RecNode,
): AnyNode[] {
  if (sites.length < 2) return [...sites];
  const kept = sites.filter(
    (s) => ran(s, up, caller, ops, n.pxi - 1) !== false,
  );
  return kept.length > 0 ? kept : [...sites];
}
