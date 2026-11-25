// The steps and the checks of each block (spec 008, T022): the port of build-tree.cjs step 8d (`stepsOf`, with the
// checks it keeps in `checksFor`, "q2") and of the `rl` of step 9, from the bench at BASELINE-4. Each top step of a
// block's arithmetic becomes an expression tree whose leaves are a call of the block, a read, a number of the code or a
// value with no source; each node carries the value it took. Steps live only in the worker: a step names a method only
// when it is one of the closed MATH list, and a text literal of the code is kept only as empty or not (FR-010).
// Step 8c (`formulaOf`, the text of the validation page) has no reader in pieces.cjs and is not ported.
import type { DefCall, Op } from "../instrument.ts";
import type { RecNode, Recording, RecValue } from "../recording.ts";
import {
  astPattern,
  at,
  CUSTOM,
  MATH,
  blockParams,
  methodOf,
  ownRead,
  unwrap,
} from "./ast.ts";
import type { AstNode } from "./ast.ts";
import { emptyKeyAt, readOfLeaf } from "./leaf-reads.ts";
import { near } from "./math.ts";
import { maySet } from "./param-set.ts";
import { byCalls as callsBySide, sideAt, sideState } from "./sides.ts";
import type {
  AmbiguousCall,
  BlockSteps,
  Check,
  Expr,
  LoopTurn,
  Reads,
  Step,
  StepValue,
} from "./step-types.ts";

export { GAME_TABLE, lastReads } from "./step-types.ts";
export type {
  AmbiguousCall,
  BlockSteps,
  Check,
  Expr,
  LoopTurn,
  Step,
} from "./step-types.ts";

export function makeSteps(rec: Recording, ops: readonly Op[]) {
  const { nodes } = rec;
  const opIndex = new Map(ops.map((o, i) => [o.node, i]));
  const memo = new Map<number, BlockSteps>();
  // T209, form 1: a value that is the block's own argument keeps its place, `arg` (the 008 tree reads a loose value)
  const params = blockParams(ops);
  // a builder's scratch (a variable of its own) is among the spliced writes: the call's own variable all the same
  const allWrites = [...rec.writes, ...rec.spliced];
  const ambiguous = new Set<AmbiguousCall>();
  // each if's and ? :'s test op, by the node it decides (Op.owner)
  const testOf = new Map(
    ops.flatMap((o, i) => (o.kind === "test" && o.owner ? [[o.owner, i]] : [])),
  );

  /**
   * stepsOf(n, xs, range) and its checks; for a loop turn of a cache writer (step 8d2), `xs` is the slice of the step
   * log since the writer's previous write and `range` its place, so the turn's reads and calls are its own.
   */
  function stepsOf(n: RecNode, xs = n.x, range?: LoopTurn): BlockSteps {
    const rxs = n.rx ?? [];
    const inTurn = (i: number) => !range || (i >= range.from && i <= range.to);
    const turnReads: Reads | null = range
      ? [...new Map(rxs.filter((x) => inTurn(x[2])).map((x) => [x[0], x[1]]))]
      : null;
    if (!xs) return { steps: [], checks: [], ambiguous };
    const vals = new Map<number, StepValue>();
    const order: number[] = [];
    for (const [i, v] of xs) {
      if (!vals.has(i)) order.push(i);
      vals.set(i, v);
    }
    // A number of a step is matched with the value each path had at that point of the call (the last read before it).
    const base = range ? range.from : 0;
    const lastPos = new Map<number, number>();
    xs.forEach(([i], j) => lastPos.set(i, base + j));
    const atCache = new Map<number, Reads>();
    const readsAt = (pos: number): Reads => {
      const hit = atCache.get(pos);
      if (hit) return hit;
      const m = new Map<string, RecValue>();
      for (const x of rxs) {
        if (x[2] > pos) break;
        if (range && x[2] < range.from) continue;
        m.set(x[0], x[1]);
      }
      const out = [...m];
      atCache.set(pos, out);
      return out;
    };
    const ownReads = (n.r ?? []).map(([p, v]): [string, RecValue] => [p, v]);
    const poolFor = (node: AstNode): Reads => {
      const id = opIndex.get(node);
      const pos = id === undefined ? undefined : lastPos.get(id);
      return pos !== undefined ? readsAt(pos) : (turnReads ?? ownReads);
    };
    const defStack = new Set<AstNode>();
    const used = new Set<number>();
    const usedR = new Set<string>();
    const kids = n.c
      .map((c) => nodes[c])
      .filter((k): k is RecNode => !!k && inTurn(k.pxi));
    const valOf = (node: AstNode): StepValue => {
      const id = opIndex.get(node);
      return id !== undefined ? vals.get(id) : undefined;
    };
    // inv-2: the same node of the code, evaluated again with the same value in this call, is the same link.
    const leafMemo = new Map<AstNode, Expr>();
    function leaf(node: AstNode, v: StepValue): Expr {
      const hit = leafMemo.get(node);
      if (hit && hit.v === v) return hit;
      const r = leaf0(node, v);
      if (r.t !== "val") leafMemo.set(node, r);
      return r;
    }
    const read = (p: string, v: StepValue): Expr => ({ t: "read", p, v });
    function leaf0(node: AstNode, v: StepValue): Expr {
      // a block's call, bare or through asNumber right in the step (T177 r4)
      const callee = methodOf(unwrap(node));
      const id = opIndex.get(node);
      if (callee?.startsWith(CUSTOM)) {
        const fits = (x: RecNode) =>
          !used.has(x.id) && x.b === callee.slice(CUSTOM.length) && x.v === v;
        // the call that returned at the step's place (its value recorded where it began, spec 010 T177 r1); with no
        // place, the only call of that value; two or more are ambiguous, a loose value that never ties to a read either
        const at = id === undefined ? undefined : lastPos.get(id);
        const all = kids.filter(fits);
        const k =
          at !== undefined
            ? all.find((x) => x.pxi === at)
            : all.length === 1
              ? all[0]
              : undefined;
        if (all.length > 1 && at === undefined) {
          ambiguous.add({ block: callee.slice(CUSTOM.length), v });
          return { t: "val", v };
        }
        if (k) {
          used.add(k.id);
          return { t: "call", id: k.id, v };
        }
        // a block's call with no call of its own here is a loose value: never a read with its value (T177 r4)
        return { t: "val", v };
      }
      // the block's own argument (T209, form 1): its parameter, set by nothing before in the call, by its place (an
      // assignment of it on a side its test did not take is none: param-set.ts)
      const self = ops[id ?? -1];
      const here = lastPos.get(id ?? -1);
      const k =
        node.type === "Identifier" && self
          ? (params.get(n.b) ?? []).indexOf(String(node.name))
          : -1;
      if (
        k >= 0 &&
        typeof v === "number" &&
        n.a[k] === v &&
        self &&
        here !== undefined &&
        !maySet(self, ops, n, here)
      )
        return { t: "val", v, arg: k };
      // a value from a block's call, through asNumber, a variable or a ? : (Op.defCalls), or with a call anywhere in it
      // (Op.callIn): the data flow decides, never a read with its value (T177 r3 to r5)
      const op = ops[id ?? -1];
      const pos = lastPos.get(id ?? -1);
      if (op && (op.defCalls || op.callIn) && !ranFree(op, pos))
        return op.defCalls ? byCalls(op.defCalls, v, pos) : defOrVal(node, v);
      if (typeof v !== "number") return defOrVal(node, v);
      // a working map's key not yet set, read at the leaf's own place: the 0 where its sum starts (T194)
      if (v === 0 && emptyKeyAt(rxs, here)) return { t: "val", v };
      const pool = poolFor(node);
      // the read the leaf's own text names, or its value names among the call's reads (leaf-reads.ts)
      const pat = astPattern(node);
      const p = readOfLeaf(node, v, pool, rxs, usedR, pat, here);
      if (typeof p === "string") return read(p, v);
      if (p) return { t: "val", v, why: p.why };
      // a loose value of the call's own variable, written before here, keeps its path (T209, form 3)
      const loose = defOrVal(node, v);
      const at0 = lastPos.get(id ?? -1);
      const own = pat ? ownRead(pat, pool, v, allWrites, n.id, at0) : null;
      return own === null || loose.t !== "val" ? loose : { ...loose, own };
    }
    // the call a value comes from, on the side each ? : on its way took at `pos` (sides.ts)
    const took = (pos?: number) => (o: AstNode) =>
      sideAt(testOf.get(o), n.x, pos ?? base + xs.length - 1);
    const byCalls = (calls: DefCall[], v: StepValue, pos?: number): Expr =>
      callsBySide(calls, v, took(pos), leaf, ambiguous);
    // no call's side ran and a side with none did: a read like any other (Op.freeSides, T177 r6)
    const ranFree = (op: Op, pos?: number) =>
      (op.defCalls ?? []).every(
        (c) => sideState(c.sides, took(pos)) === "off",
      ) && (op.freeSides ?? []).some((s) => sideState(s, took(pos)) === "on");
    // the expression that set the variable, when it gave this same value in this turn
    function defOrVal(node: AstNode, v: StepValue): Expr {
      const id = opIndex.get(node);
      const def = id === undefined ? null : (ops[id]?.def ?? null);
      if (def && !defStack.has(def) && defStack.size < 6) {
        const did = opIndex.get(def);
        if (did !== undefined && vals.get(did) === v) {
          defStack.add(def);
          try {
            return { t: "def", e: e(def), v };
          } finally {
            defStack.delete(def);
          }
        }
      }
      return { t: "val", v };
    }
    function assign(node: AstNode, op: Op): Expr {
      // inv-2: "x *= y" is x (what it was) * y; what it was is the step that set x before, when the numbers agree.
      const o = (node.operator as string)[0] ?? "";
      const nv = valOf(node);
      const rt: Expr =
        node.type === "UpdateExpression"
          ? { t: "val", v: 1 }
          : e(at(node, "right"));
      const rv = rt.v;
      let lv: number | undefined;
      if (typeof nv === "number" && typeof rv === "number")
        lv =
          o === "*"
            ? rv !== 0
              ? nv / rv
              : undefined
            : o === "+"
              ? nv - rv
              : o === "-"
                ? nv + rv
                : o === "/"
                  ? nv * rv
                  : undefined;
      let l: Expr = { t: "val", v: lv };
      const pd = op.prevDef;
      if (pd && lv !== undefined) {
        const pid = opIndex.get(pd);
        const pv = pid !== undefined ? vals.get(pid) : undefined;
        if (pid !== undefined && typeof pv === "number" && near(pv, lv))
          l = { t: "def", e: e(pd), v: pv };
        else if (pid === undefined) {
          // what set it has a block's call in it (Op.callIn): only its calls tie it, never a read by value (T177 r5)
          const r0 = op.callIn
            ? byCalls(
                op.defCalls ?? [],
                lv,
                lastPos.get(opIndex.get(node) ?? -1),
              )
            : leaf(pd, lv);
          if (r0.t !== "val") l = r0;
        }
      }
      return { t: "op", o, l, r: rt, v: nv };
    }
    function e(node: AstNode): Expr {
      if (node.type === "Literal") {
        const v = node.value;
        // FR-010: a text of the code stays in the game; only whether it is empty counts (joining text is no step).
        if (typeof v === "string")
          return { t: "num", v: v === "" ? "" : "(text)" };
        return {
          t: "num",
          v: typeof v === "number" || typeof v === "boolean" ? v : null,
        };
      }
      // a negative number of the code (-1) is a constant too, never a read that happens to hold the same value
      const arg = node.argument as AstNode | undefined;
      if (
        node.type === "UnaryExpression" &&
        node.operator === "-" &&
        arg?.type === "Literal" &&
        typeof arg.value === "number"
      )
        return { t: "num", v: -arg.value };
      const id = opIndex.get(node);
      const op = id !== undefined ? ops[id] : undefined;
      if (op?.kind === "leaf") return leaf(node, vals.get(id ?? -1));
      if (
        op?.kind === "assign" &&
        (node.type === "UpdateExpression" ||
          (node.type === "AssignmentExpression" && node.operator !== "="))
      )
        return assign(node, op);
      if (node.type === "BinaryExpression" || node.type === "LogicalExpression")
        return {
          t: "op",
          o: node.operator as string,
          l: e(at(node, "left")),
          r: e(at(node, "right")),
          v: valOf(node),
        };
      if (
        node.type === "CallExpression" &&
        at(node, "callee").type === "MemberExpression"
      )
        return {
          t: "fn",
          name: MATH.has(methodOf(node) ?? "") ? methodOf(node) : null,
          args: (node.arguments as AstNode[]).map(e),
          v: valOf(node),
        };
      if (node.type === "UnaryExpression" && node.operator === "-" && arg) {
        const a = e(arg);
        return {
          t: "op",
          o: "-",
          l: { t: "num", v: 0 },
          r: a,
          v: typeof a.v === "number" ? -a.v : undefined,
        };
      }
      if (node.type === "UnaryExpression" && node.operator === "!" && arg)
        return { t: "not", a: e(arg), v: valOf(node) };
      return { t: "val", v: valOf(node) };
    }
    const isTop = (i: number) => {
      for (let p = ops[i]?.parent; p !== undefined; p = ops[p]?.parent)
        if (vals.has(p) && ops[p]?.kind !== "assign") return false;
      return true;
    };
    // The conditions the block checked (each if and each a ? b : c), only those on the player's state (a value read or
    // another block's result): a test of the block's own argument only routes the code.
    const checks: Check[] = [];
    for (const i of order) {
      const op = ops[i];
      if (op?.kind !== "test") continue;
      const ex = e(op.node);
      if (!/"t":"(call|read)"/.test(JSON.stringify(ex))) continue;
      checks.push({ v: !!vals.get(i), e: ex });
      if (checks.length >= 8) break;
    }
    const steps: Step[] = [];
    const stepAt: number[] = [];
    for (const i of order) {
      const op = ops[i];
      const v = vals.get(i);
      if (op?.kind !== "op" || !isTop(i) || typeof v !== "number") continue;
      const ex = e(op.node);
      if (JSON.stringify(ex).includes('"v":""')) continue;
      steps.push({ v, e: ex });
      stepAt.push(lastPos.get(i) ?? -1);
    }
    const exprOf = (op: number): Expr | null => {
      const o = ops[op];
      return o && vals.has(op) ? e(o.node) : null;
    };
    return {
      steps,
      checks,
      exprOf,
      stepAt,
      ambiguous,
      ...(range && { range }),
    };
  }

  return {
    /** Every step's call of this recording that tied to none (BlockSteps.ambiguous). */
    ambiguous: ambiguous as ReadonlySet<AmbiguousCall>,
    /** The steps of one loop turn of `n` (step 8d2): `xs` the turn's slice of its step log, at `range`. */
    turn: (n: RecNode, xs: RecNode["x"], range: LoopTurn): Step[] =>
      stepsOf(n, xs, range).steps,
    /** The steps of one loop turn of `n`, with where each was recorded (spec 010, T161: a part in each turn). */
    turnOf: (n: RecNode, range: LoopTurn): BlockSteps =>
      stepsOf(n, n.x?.slice(range.from, range.to + 1), range),
    /** The steps and checks of call `id` (none for a call with no steps). */
    of(id: number): BlockSteps {
      let out = memo.get(id);
      if (!out) {
        const n = nodes[id];
        out = n ? stepsOf(n) : { steps: [], checks: [], ambiguous };
        memo.set(id, out);
      }
      return out;
    },
  };
}
