// A node's model child in the lock (spec 010, T202; spec, Open Questions 24/11): a recipe's node with `each` and no
// `combine` has its model once per part of its level the list's `[*]` matches, in the parts' order, the item the
// part's index in the path and its place `<model>-<item>`; a part the list does not match stays undeclared.
import type { RecNode, Recording } from "../recording.ts";
import { callRef } from "./answer-key-pool.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { fill } from "./pieces.ts";
import { eachNames, eachPattern, parseKey } from "./refs.ts";

export function modelChildren(
  children: readonly BlueprintNode[],
  each: BlueprintNode["each"] | undefined,
  parts: readonly string[],
  { character }: { character: number },
  /** A list of calls' lines per key (listCalls), one per call. */
  times: ReadonlyMap<string, number> = new Map(),
): readonly BlueprintNode[] {
  // a list of calls (T205): its model is the child that calls the block with `{as}`, the others stay as they are
  if (each && "calls" in each) {
    const isModel = modelOf(each);
    const m = children.find(isModel);
    const rest = children.filter((c) => !isModel(c));
    return m ? [...rest, ...callChildren(m, each, parts, times)] : children;
  }
  const [model] = children;
  if (!each || !model) return children;
  const names = eachNames(each.as);
  const path = eachPattern(each.list, character);
  return parts.flatMap((p) => {
    const idx = path.exec(p)?.slice(1);
    if (!idx) return [];
    const item = Object.fromEntries(names.map((a, k) => [a, Number(idx[k])]));
    return [{ ...fill(model, item), key: `${model.key}-${idx.join("-")}` }];
  });
}

interface Calls {
  calls: string;
  as: string;
}
const modelOf = (each: Calls) => (c: BlueprintNode) =>
  c.ref !== undefined &&
  "call" in c.ref &&
  c.ref.call === each.calls &&
  c.ref.args.includes(`{${each.as}}`);

/** Whether a recorded key is a call of the model's block with the model's arguments, but for `{as}`'s (at `k`). */
function fits(
  key: string,
  ref: { call: string; args: readonly unknown[] },
  k: number,
): { args: unknown[] } | null {
  const got = parseKey(key);
  const ok =
    got?.call === ref.call &&
    got.args.length === ref.args.length &&
    ref.args.every(
      (a, i) =>
        i === k ||
        a === "*" ||
        JSON.stringify(a) === JSON.stringify(got.args[i]),
    );
  return ok ? got : null;
}

/** Whether two recorded calls are the same node by node: key, value, reads and the calls below. */
function sameDescent(n: RecNode, m: RecNode, rec: Recording): boolean {
  if (callRef(n) !== callRef(m) || JSON.stringify(n.v) !== JSON.stringify(m.v))
    return false;
  if (JSON.stringify(n.r ?? []) !== JSON.stringify(m.r ?? [])) return false;
  if (n.c.length !== m.c.length) return false;
  return n.c.every((id, k) => {
    const a = rec.nodes[id];
    const b = rec.nodes[m.c[k] ?? -1];
    return a !== undefined && b !== undefined && sameDescent(a, b, rec);
  });
}

/**
 * The model's calls of a level by their key (T205): how many lines each key is, one per call; and the keys of two calls
 * the place does not separate: no turn of a loop between them (no step of the call ran twice there) and not the same
 * node by node. Identical calls are no tie: each is its own line, as the game counts each.
 */
export function listCalls(
  children: readonly BlueprintNode[],
  each: Calls,
  scope: RecNode,
  rec: Recording,
): { times: Map<string, number>; refused: string[] } {
  const times = new Map<string, number>();
  const ref = children.find(modelOf(each))?.ref;
  if (!ref || !("call" in ref)) return { times, refused: [] };
  const k = ref.args.indexOf(`{${each.as}}`);
  const calls = scope.c.flatMap((id) => {
    const n = rec.nodes[id];
    return n && fits(callRef(n), ref, k) ? [n] : [];
  });
  for (const n of calls)
    times.set(callRef(n), (times.get(callRef(n)) ?? 0) + 1);
  const turned = (a: number, b: number) => {
    const seen = new Set<number>();
    for (const [op] of (scope.x ?? []).slice(a, b)) {
      if (seen.has(op)) return true;
      seen.add(op);
    }
    return false;
  };
  const refused = new Set<string>();
  calls.forEach((n, i) => {
    for (const m of calls.slice(i + 1))
      if (
        callRef(n) === callRef(m) &&
        !turned(n.pxi, m.pxi) &&
        !sameDescent(n, m, rec)
      )
        refused.add(callRef(n));
  });
  return { times, refused: [...refused] };
}

/**
 * A list of calls' model (T205): once per part that is a call of the block whose other arguments are the model's, the
 * part's own argument in place of `{as}`; that argument is its turn's (no mark to check), its key the model's and it.
 */
function callChildren(
  model: BlueprintNode,
  each: Calls,
  parts: readonly string[],
  times: ReadonlyMap<string, number>,
): BlueprintNode[] {
  const ref = model.ref && "call" in model.ref ? model.ref : null;
  const k = ref ? ref.args.indexOf(`{${each.as}}`) : -1;
  if (!ref || k < 0) return [];
  return parts.flatMap((p) => {
    const got = fits(p, ref, k);
    if (!got) return [];
    const item = got.args[k];
    if (typeof item !== "number" && typeof item !== "string") return [];
    // one line per call of that key: the game counts each
    const line = { ...fill(model, { [each.as]: item }), itemArg: k };
    const key = `${model.key}-${String(item)}`;
    return Array.from({ length: Math.max(1, times.get(p) ?? 1) }, (_, t) => ({
      ...line,
      key: t === 0 ? key : `${key}-${String(t + 1)}`,
    }));
  });
}
