// The steps and the checks of each block (spec 008, T022): the port of build-tree.cjs step 8d (`stepsOf`, with the
// checks it keeps in `checksFor`, "q2") and of the `rl` of step 9, from the bench at BASELINE-4. Each top step of a
// block's arithmetic becomes an expression tree whose leaves are a call of the block, a read, a number of the code or a
// value with no source; each node carries the value it took. Steps live only in the worker: a step names a method only
// when it is one of the closed MATH list, and a text literal of the code is kept only as empty or not (FR-010).
// Step 8c (`formulaOf`, the text of the validation page) has no reader in pieces.cjs and is not ported.
import type { Op } from "../instrument.ts";
import type { RecNode, Recording, RecValue } from "../recording.ts";
import { astPattern, at, CUSTOM, MATH, matchPattern, methodOf } from "./ast.ts";
import type { AstNode } from "./ast.ts";
import { near } from "./math.ts";

type StepValue = number | boolean | null | undefined;
export type Expr =
  | { t: "num"; v: number | string | boolean | null }
  | { t: "val"; v: StepValue }
  | { t: "call"; id: number; v: StepValue }
  | { t: "read"; p: string; v: StepValue }
  | { t: "def"; e: Expr; v: StepValue }
  | { t: "op"; o: string; l: Expr; r: Expr; v: StepValue }
  | { t: "fn"; name: string | null; args: Expr[]; v: StepValue }
  | { t: "not"; a: Expr; v: StepValue };
export interface Step {
  v: number;
  e: Expr;
}
export interface Check {
  v: boolean;
  e: Expr;
}
export interface BlockSteps {
  steps: Step[];
  checks: Check[];
  /** Any recorded step of the block (by its op id) as an expression, as the steps build it (spec 010, T151). */
  exprOf?: (op: number) => Expr | null;
  /** Where each step was last recorded in the call's step log (spec 010, T162: a write comes after its step). */
  stepAt?: number[];
}

/** The game's own definition tables are game data, not the player's (build-tree.cjs GAME_TABLE). */
export const GAME_TABLE: readonly { test: RegExp; proof: string }[] = [
  {
    test: /^(CustomLists|CustomMaps|ItemDefinitionsGET|MonsterDefinitionsGET|DialogueDefGET)\b/,
    proof: "bench build-tree.cjs GAME_TABLE",
  },
];
/** Step 9's `rl`: a path the call read with several numbers, with the last one (the state the call ended with). */
export function lastReads(n: Pick<RecNode, "rx">): Map<string, number> {
  const seen = new Map<string, { last: number; changed: boolean }>();
  for (const [p, v] of n.rx ?? [])
    if (typeof v === "number") {
      const x = seen.get(p);
      seen.set(p, { last: v, changed: !!x && (x.changed || v !== x.last) });
    }
  return new Map(
    [...seen].filter(([, x]) => x.changed).map(([p, x]) => [p, x.last]),
  );
}

type Reads = [string, RecValue][];
/** A loop turn's place in the writer's step log: from its previous write to this one. */
export interface LoopTurn {
  from: number;
  to: number;
}

export function makeSteps(rec: Recording, ops: readonly Op[]) {
  const { nodes } = rec;
  const opIndex = new Map(ops.map((o, i) => [o.node, i]));
  const memo = new Map<number, BlockSteps>();

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
    if (!xs) return { steps: [], checks: [] };
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
      const callee = methodOf(node);
      if (callee?.startsWith(CUSTOM)) {
        const k = kids.find(
          (x) =>
            !used.has(x.id) && x.b === callee.slice(CUSTOM.length) && x.v === v,
        );
        if (k) {
          used.add(k.id);
          return { t: "call", id: k.id, v };
        }
      }
      if (typeof v !== "number") return defOrVal(node, v);
      const pool = poolFor(node);
      // C (inv-2): the read whose path the code's own text names, when only one is; before the match by value.
      const pat = astPattern(node);
      if (pat) {
        const cand = pool.filter(
          ([p, val]) =>
            (val === v ||
              (typeof val === "string" &&
                val.trim() !== "" &&
                Number(val) === v)) &&
            matchPattern(p, pat) &&
            !rxs.some((x) => x[0] === p && Number(x[1]) !== v),
        );
        const [only] = cand;
        if (only && cand.length === 1) {
          // AUDIT-D R1: a converted text cell is used up, so a later bare number is not bound to it.
          if (typeof only[1] === "string") usedR.add(only[0]);
          return read(only[0], v);
        }
      }
      const same = pool.filter(
        ([p, val]) =>
          val === v &&
          !GAME_TABLE.some((r) => r.test.test(p)) &&
          !p.endsWith(".length"),
      );
      if (same.length === 1 && same[0] && !usedR.has(same[0][0])) {
        usedR.add(same[0][0]);
        return read(same[0][0], v);
      }
      // a number the game read as text and converted (a card's per-star value "6", a table constant)
      const txt = pool.filter(
        ([p, val]) =>
          typeof val === "string" &&
          val.trim() !== "" &&
          Number(val) === v &&
          !/.length$/.test(p),
      );
      if (txt.length === 1 && txt[0] && !usedR.has(txt[0][0])) {
        usedR.add(txt[0][0]);
        return read(txt[0][0], v);
      }
      return defOrVal(node, v);
    }
    // the expression that set the variable, when it gave this same value in this turn
    function defOrVal(node: AstNode, v: StepValue): Expr {
      const id = opIndex.get(node);
      const def = id === undefined ? null : (ops[id]?.def ?? null);
      if (def && !defStack.has(def) && defStack.size < 6) {
        const did = opIndex.get(def);
        const callee = methodOf(def);
        if (callee?.startsWith(CUSTOM)) {
          const r = leaf(def, v);
          if (r.t !== "val") return r;
        } else if (did !== undefined && vals.get(did) === v) {
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
          const r0 = leaf(pd, lv);
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
    return { steps, checks, exprOf, stepAt };
  }

  return {
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
        out = n ? stepsOf(n) : { steps: [], checks: [] };
        memo.set(id, out);
      }
      return out;
    },
  };
}
