// A node's model child in the lock (spec 010, T202; spec, Open Questions 24/11): a recipe's node with `each` and no
// `combine` has its model once per part of its level the list's `[*]` matches, in the parts' order, the item the
// part's index in the path and its place `<model>-<item>`; a part the list does not match stays undeclared.
import type { BlueprintNode } from "./blueprint.ts";
import { fill } from "./pieces.ts";
import { eachNames, eachPattern, parseKey } from "./refs.ts";

export function modelChildren(
  children: readonly BlueprintNode[],
  each: BlueprintNode["each"] | undefined,
  parts: readonly string[],
  { character }: { character: number },
): readonly BlueprintNode[] {
  const [model] = children;
  if (!each || !model) return children;
  if ("calls" in each) return callChildren(model, each, parts);
  const names = eachNames(each.as);
  const path = eachPattern(each.list, character);
  return parts.flatMap((p) => {
    const idx = path.exec(p)?.slice(1);
    if (!idx) return [];
    const item = Object.fromEntries(names.map((a, k) => [a, Number(idx[k])]));
    return [{ ...fill(model, item), key: `${model.key}-${idx.join("-")}` }];
  });
}

/**
 * A list of calls' model (T205): once per part that is a call of the block whose other arguments are the model's, the
 * part's own argument in place of `{as}`; that argument is its turn's (no mark to check), its key the model's and it.
 */
function callChildren(
  model: BlueprintNode,
  each: { calls: string; as: string },
  parts: readonly string[],
): BlueprintNode[] {
  const ref = model.ref && "call" in model.ref ? model.ref : null;
  const k = ref ? ref.args.indexOf(`{${each.as}}`) : -1;
  if (!ref || k < 0) return [];
  return parts.flatMap((p) => {
    const got = parseKey(p);
    const fits =
      got?.call === each.calls &&
      got.args.length === ref.args.length &&
      ref.args.every(
        (a, i) =>
          i === k ||
          a === "*" ||
          JSON.stringify(a) === JSON.stringify(got.args[i]),
      );
    if (!got || !fits) return [];
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
