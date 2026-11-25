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
export function guardOf(step: number, ops: readonly Op[]): number {
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

const isRound = (n: AnyNode) => {
  const c = n.type === "CallExpression" ? at(n, "callee") : null;
  return (
    c?.type === "MemberExpression" &&
    at(c, "object").name === "Math" &&
    at(c, "property").name === "round"
  );
};

/**
 * The count's step in the author's code when no turn ran it (r1, r2 of part V): a `+ 1` onto the path past its first
 * name as the code writes it (`d.X`, `h.Acc.v`), under a test of its loop's turn, the right side (bare or in
 * `Math.round`) of a write of that same text; null with no `+ 1` onto it, the reason when not exactly one is that step.
 */
export function codeStep(
  author: RecNode,
  path: string,
  ops: readonly Op[],
): number | string | null {
  const rest = /^[^.]+\.(.+)$/.exec(path)?.[1];
  if (!rest) return null;
  const own = new RegExp(`\\.${rest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  const found = ops.flatMap((o, i) => {
    if (o.block !== author.b || o.kind !== "op" || o.node.operator !== "+")
      return [];
    const f = fnFor(o.fnText);
    const n = f?.all.find((m) => sameRange(m, o.node));
    if (!f || !n) return [];
    const src = (m: AnyNode) => f.text.slice(...m.range);
    const l = src(at(n, "left"));
    const r = at(n, "right");
    if (r.type !== "Literal" || r.value !== 1 || !own.test(l)) return [];
    if (guardOf(i, ops) < 0) return [];
    const up = f.up.get(n);
    const value =
      up && isRound(up) && (up.arguments as AnyNode[]).length === 1 ? up : n;
    const w = f.up.get(value);
    const writes =
      w?.type === "AssignmentExpression" &&
      w.operator === "=" &&
      w.right === value &&
      src(at(w, "left")) === l;
    return [{ i, writes }];
  });
  if (found.length === 0) return null;
  const steps = found.filter((s) => s.writes);
  const head = `o laço de ${callRef(author)} conta ${path}, mas`;
  const tail = "não é a forma do contador (T215)";
  if (steps.length === 0)
    return `${head} o passo de 1 sobre o próprio valor no código escreve outro caminho: ${tail}`;
  if (steps.length > 1)
    return `${head} o código tem mais de um passo de 1 sobre o próprio valor (${String(steps.length)}): ${tail}`;
  return steps[0]?.i ?? null;
}

/** The turns of the count of `path` whose step is the op `step`, or the reason the form does not hold. */
export function countTurns(
  author: RecNode,
  step: number,
  path: string,
  ctx: LevelContext,
): Opening[] | string {
  const name = callRef(author);
  const test = ctx.ops ? guardOf(step, ctx.ops) : -1;
  if (test < 0)
    return `o laço de ${name} soma 1 a volta fora de um teste: não é a forma do contador (T215)`;
  const xs = author.x ?? [];
  const places = xs.flatMap(([o], j) => (o === test ? [j] : []));
  if (places.length === 0)
    return `o laço de ${name} conta ${path}: nenhuma volta foi testada`;
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
