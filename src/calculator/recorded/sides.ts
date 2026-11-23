// The side each ? : took and the call a value comes from on those sides (spec 010, T177 r5; moved out of steps.ts, r6).
import type { DefCall } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import { CUSTOM, methodOf } from "./ast.ts";
import type { AstNode } from "./ast.ts";
import type { AmbiguousCall, Expr, StepValue } from "./step-types.ts";

/**
 * The side a ? : took for the value recorded at `pos`: its test's (op `test`) last record up to there, in the call's
 * whole step log `log` (the ? : may have run before the turn); undefined with no record, or with a test of no number
 * or yes/no.
 */
export function sideAt(
  test: number | undefined,
  log: RecNode["x"],
  pos: number,
): boolean | undefined {
  const tv = log?.slice(0, pos + 1).findLast(([i]) => i === test)?.[1];
  return tv === null || tv === undefined ? undefined : !!tv;
}

/**
 * The call a value comes from (Op.defCalls), on the side each ? : on its way took (`took`): a ? : whose side the step
 * log does not give is ambiguous; no call or two on the sides taken, a loose value; never a read.
 */
export function byCalls(
  calls: DefCall[],
  v: StepValue,
  took: (owner: AstNode) => boolean | undefined,
  leaf: (node: AstNode, v: StepValue) => Expr,
  ambiguous: Set<AmbiguousCall>,
): Expr {
  const state = ({ sides }: DefCall) => {
    for (const [o, s] of sides) {
      const side = took(o);
      if (side !== s) return side === undefined ? "open" : "off";
    }
    return "on";
  };
  const st = calls.map(state);
  const open = calls[st.indexOf("open")];
  if (open) {
    const block = (methodOf(open.call) ?? "").slice(CUSTOM.length);
    ambiguous.add({
      block,
      v,
      why: "está num ? : cujo lado o lugar não decide",
    });
    return { t: "val", v };
  }
  const on = calls.filter((_, i) => st[i] === "on");
  return on.length === 1 && on[0] ? leaf(on[0].call, v) : { t: "val", v };
}
