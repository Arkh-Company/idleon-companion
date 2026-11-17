// [F3-R1] the root is never a silent leaf (spec 008, T022, bench rule 147): the port of tree-of.cjs at BASELINE-4. A
// root whose rows are only reads of its last step with its value, or that has none, shows that step: its ⓘ, one row per
// read and one per argument of the call the step uses. The root's value does not change; its numbers have 3 significant
// digits, as every ⓘ. Left out: the bench's test that every read has a name (in the app a read with no name yet is
// written by its path, FR-012a), its root of a cache read (`@read`: the app's root is always a call) and the writer's ⓘ
// of a cache read here (pieceOfRead: its rows here are the root's own, which open to nothing). A read opens as any read
// of the root does, under the root (the bench opens it with nothing above it).
import type { RecNode } from "../recording.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { fx3 } from "./curves.ts";
import { termsOf } from "./formulas.ts";
import { formulaOut, near } from "./math.ts";
import { finish, row, withShares } from "./rows.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";
import type { Expr, Step } from "./steps.ts";

const OP: Readonly<Record<string, string>> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};
const ARG_WHY = "the screen that asks for this number chooses it";

/**
 * The root call `top`'s rows and ⓘ from its last step with its value, when its own `rows` are only reads of that step
 * (none opens); else null. `read` makes a read's row, `opens` tells whether a row opens into rows.
 */
export function rootStep(
  top: RecNode,
  steps: readonly Step[],
  rows: readonly Row[],
  parent: Pick<CalcTreeNode, "name" | "value">,
  ctx: { read(path: string, v: number): Row; opens(r: Row): boolean },
): { rows: Row[]; formula: CalcTreeNode["formula"] } | null {
  if (rows.some((r) => ctx.opens(r))) return null;
  const st = [...steps].reverse().find((x) => near(x.v, top.v));
  if (!st) return null;
  const argAt = (v: unknown) =>
    top.a.findIndex((x) => typeof x === "number" && near(x, v));
  const reads = new Map<string, number>();
  const args = new Map<number, number>();
  (function scan(e: Expr) {
    // a step's read always has a number (steps.ts leaf)
    if (e.t === "read") reads.set(e.p, Number(e.v));
    if (e.t === "val" && argAt(e.v) >= 0) args.set(argAt(e.v), Number(e.v));
    if (e.t === "op") [e.l, e.r].forEach(scan);
    if (e.t === "fn") e.args.forEach(scan);
  })(st.e);
  if (!reads.size && !args.size) return null;
  // the rows it shows are reads of the step (a row with no code is none)
  if (!rows.every((r) => reads.has(r.node.code ?? ""))) return null;
  const readRows = new Map(
    [...reads].map(([p, v]) => [p, ctx.read(p, v)] as const),
  );
  const argName = (i: number) => `Argument ${String(i + 1)} of the call`;
  // a math name of the step is one of the instrumentation's closed list (instrument.ts MATH)
  function show(e: Expr, byName: boolean): string | null {
    if (e.t === "num") return fx3(Number(e.v));
    if (e.t === "read") {
      const r = readRows.get(e.p);
      return byName && r ? termOf(r.node) : fx3(Number(e.v));
    }
    if (e.t === "val")
      return byName && argAt(e.v) >= 0 ? argName(argAt(e.v)) : fx3(Number(e.v));
    if (e.t === "op" && OP[e.o]) {
      const [l, r] = [show(e.l, byName), show(e.r, byName)];
      return l && r ? `(${l} ${String(OP[e.o])} ${r})` : null;
    }
    if (e.t === "fn") {
      const xs = e.args.map((a) => show(a, byName));
      return xs.every((x) => x !== null)
        ? `${String(e.name)}(${xs.join(", ")})`
        : null;
    }
    return null;
  }
  const names = show(st.e, true);
  const numbers = show(st.e, false);
  if (!names || !numbers) return null;
  // an operation is written in brackets; the step's own are not
  const whole = (s: string) => (st.e.t === "op" ? s.slice(1, -1) : s);
  const pair: [string, string] = [
    whole(names),
    `${whole(numbers)} = ${fx3(Number(top.v))}`,
  ];
  const argRows = [...args].map(([i, v]): Row => ({
    node: row({
      pieceKey: null,
      value: v,
      code: null,
      name: argName(i),
      leaf: "choice",
      why: ARG_WHY,
      flags: {},
    }),
    open: null,
  }));
  const all = finish(top.v, [...readRows.values(), ...argRows]);
  return {
    rows: withShares(parent, pair, all).rows,
    formula: formulaOut(pair, termsOf(all)),
  };
}
