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
): readonly BlueprintNode[] {
  // a list of calls (T205): its model is the child that calls the block with `{as}`, the others stay as they are
  if (each && "calls" in each) {
    const isModel = modelOf(each);
    const m = children.find(isModel);
    const rest = children.filter((c) => !isModel(c));
    return m ? [...rest, ...callChildren(m, each, parts)] : children;
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

/**
 * The keys of the model's calls a level made twice with no turn of a loop between them (no step of the call ran twice
 * there): the place does not separate them (T205).
 */
export function sameCalls(
  children: readonly BlueprintNode[],
  each: Calls,
  scope: RecNode,
  rec: Recording,
): string[] {
  const ref = children.find(modelOf(each))?.ref;
  if (!ref || !("call" in ref)) return [];
  const k = ref.args.indexOf(`{${each.as}}`);
  const calls = scope.c.flatMap((id) => {
    const n = rec.nodes[id];
    return n && fits(callRef(n), ref, k) ? [n] : [];
  });
  const turned = (a: number, b: number) => {
    const seen = new Set<number>();
    for (const [op] of (scope.x ?? []).slice(a, b)) {
      if (seen.has(op)) return true;
      seen.add(op);
    }
    return false;
  };
  const out = new Set<string>();
  calls.forEach((n, i) => {
    for (const m of calls.slice(i + 1))
      if (callRef(n) === callRef(m) && !turned(n.pxi, m.pxi))
        out.add(callRef(n));
  });
  return [...out];
}

/**
 * A list of calls' model (T205): once per part that is a call of the block whose other arguments are the model's, the
 * part's own argument in place of `{as}`; that argument is its turn's (no mark to check), its key the model's and it.
 */
function callChildren(
  model: BlueprintNode,
  each: Calls,
  parts: readonly string[],
): BlueprintNode[] {
  const ref = model.ref && "call" in model.ref ? model.ref : null;
  const k = ref ? ref.args.indexOf(`{${each.as}}`) : -1;
  if (!ref || k < 0) return [];
  return parts.flatMap((p) => {
    const got = fits(p, ref, k);
    if (!got) return [];
    const item = got.args[k];
    if (typeof item !== "number" && typeof item !== "string") return [];
    return [
      {
        ...fill(model, { [each.as]: item }),
        key: `${model.key}-${String(item)}`,
        itemArg: k,
      },
    ];
  });
}
