// The turns of a count (spec 010, T215; decided by Vinicius 25/11): an author that adds 1 to a cache a turn its test
// passes (`if (test) n = round(n + 1)`, or the game's `test && (n = round(n + 1))`). The count's test is the one whose
// `if` or `&&` holds the count's step in the code, inside its loop: never the first or the last test of the turn. Each
// record of that test in the author's step log ends a turn; the turn's item is what the test read there, and its value
// 1 when the recording saw the test true, 0 when false. The line closes by their sum (lock-close.ts).
import type { Op } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import { callRef } from "./answer-key-pool.ts";
import { at } from "./character-args.ts";
import type { AnyNode } from "./character-args.ts";
import type { Opening } from "./level-openings.ts";
import type { LevelContext } from "./lock-levels.ts";
import { keyOfLeaf, leavesOf } from "./lock-parts.ts";
import { fnFor } from "./write-rhs.ts";

const LOOPS = new Set([
  "ForStatement",
  "ForInStatement",
  "WhileStatement",
  "DoWhileStatement",
]);
const sameRange = (a: AnyNode, b: AnyNode) =>
  a.range[0] === b.range[0] && a.range[1] === b.range[1];

/** The op of the test whose `if`, `? :` or `&&` holds the step `step` in its loop's turn; -1 with none. */
function guardOf(step: number, ops: readonly Op[]): number {
  const op = ops[step];
  const f = op ? fnFor(op.fnText) : null;
  let c = op && f?.all.find((n) => sameRange(n, op.node));
  for (let p = c && f?.up.get(c); c && p; c = p, p = f?.up.get(p)) {
    if (LOOPS.has(p.type)) return -1;
    const test =
      (p.type === "IfStatement" || p.type === "ConditionalExpression") &&
      p.consequent === c
        ? at(p, "test")
        : p.type === "LogicalExpression" && p.operator === "&&" && p.right === c
          ? at(p, "left")
          : null;
    if (test)
      return ops.findIndex(
        (o) =>
          o.block === op?.block &&
          (o.kind === "test" || o.kind === "cmp") &&
          sameRange(o.node, test),
      );
  }
  return -1;
}

/** The turns of the count whose step is the op `step`, or the reason the form does not hold. */
export function countTurns(
  author: RecNode,
  step: number,
  ctx: LevelContext,
): Opening[] | string {
  const name = callRef(author);
  const test = ctx.ops ? guardOf(step, ctx.ops) : -1;
  if (test < 0)
    return `o laço de ${name} soma 1 a volta fora de um teste: não é a forma do contador (T215)`;
  const xs = author.x ?? [];
  const places = xs.flatMap(([o], j) => (o === test ? [j] : []));
  const out: Opening[] = [];
  for (const [k, to] of places.entries()) {
    const from = k === 0 ? 0 : (places[k - 1] ?? 0) + 1;
    const steps = ctx.turnOf(author, { from, to });
    const e = steps.exprOf?.(test);
    const leaves = (e ? leavesOf(e) : []).filter(
      (l) => keyOfLeaf(l, ctx.rec) !== null,
    );
    const parts = new Set(leaves.map((l) => keyOfLeaf(l, ctx.rec)));
    const [part] = parts;
    const turn = `a volta ${String(k + 1)} da contagem de ${name}`;
    // an item that is a call would need its descent below a condition: the form waits for a real case
    if (parts.size !== 1 || !part || leaves[0]?.t !== "read")
      return `o teste d${turn} não lê um só item da lista`;
    if (out.some((o) => o.part === part))
      return `${turn} testa o mesmo item de outra volta (${part})`;
    const passed = xs[to]?.[1] === true;
    out.push({ part, call: null, value: passed ? 1 : 0, steps, passed });
  }
  return out;
}
