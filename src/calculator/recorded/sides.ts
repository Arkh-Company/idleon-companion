// The side each ? : took and the call a value comes from on those sides (spec 010, T177 r5; moved out of steps.ts, r6).
import type { DefCall } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import { CUSTOM, methodOf } from "./ast.ts";
import type { AstNode } from "./ast.ts";
import type { AmbiguousCall, Expr, StepValue } from "./step-types.ts";

/**
 * The side a ? : took for the value recorded at `pos`: its test's (op `test`) last record up to there, in the call's
 * whole step log `log` (the ? : may have run before the turn); null (open) with a record of no number or yes/no;
 * undefined with no record (the ? : did not run there: no side is taken, T177 r6).
 */
export function sideAt(
  test: number | undefined,
  log: RecNode["x"],
  pos: number,
): boolean | null | undefined {
  const xs = log ?? [];
  const at = test === undefined ? undefined : placesOf(xs).get(test);
  // the last of its places up to `pos`, by halves (they are in the log's order)
  const end = Math.min(pos, xs.length - 1);
  let [lo, hi] = [0, (at?.length ?? 0) - 1];
  while (at && lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((at[mid] ?? Infinity) <= end) lo = mid + 1;
    else hi = mid - 1;
  }
  const j = at?.[hi];
  if (j === undefined) return undefined;
  const tv = xs[j]?.[1];
  return tv === null || tv === undefined ? null : !!tv;
}

type Log = NonNullable<RecNode["x"]>;
const places = new WeakMap<Log, Map<number, number[]>>();
/** Each op's places in a step log, once per log (spec 010, part R: a scan back per call site was most of a draft's time). */
function placesOf(xs: Log): Map<number, number[]> {
  let m = places.get(xs);
  if (!m) {
    m = new Map();
    for (const [j, [i]] of xs.entries()) {
      const at = m.get(i);
      if (at) at.push(j);
      else m.set(i, [j]);
    }
    places.set(xs, m);
  }
  return m;
}

/** Whether a way through ? : sides ran ("on"), did not ("off") or has a side the step log does not give ("open"). */
export function sideState(
  sides: DefCall["sides"],
  took: (owner: AstNode) => boolean | null | undefined,
): "on" | "off" | "open" {
  for (const [o, s] of sides) {
    const side = took(o);
    if (side !== s) return side === null ? "open" : "off";
  }
  return "on";
}

/**
 * The call a value comes from (Op.defCalls), on the side each ? : on its way took (`took`): a ? : whose test recorded
 * no side (null) is ambiguous, one never recorded there is off; no call or two on the sides taken, a loose value; never a read.
 */
export function byCalls(
  calls: DefCall[],
  v: StepValue,
  took: (owner: AstNode) => boolean | null | undefined,
  leaf: (node: AstNode, v: StepValue) => Expr,
  ambiguous: Set<AmbiguousCall>,
): Expr {
  const st = calls.map((c) => sideState(c.sides, took));
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
