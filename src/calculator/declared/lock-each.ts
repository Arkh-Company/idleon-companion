// A node's model child in the lock (spec 010, T202; spec, Open Questions 24/11): a recipe's node with `each` and no
// `combine` has its model once per part of its level the list's `[*]` matches, in the parts' order, the item the
// part's index in the path and its place `<model>-<item>`; a part the list does not match stays undeclared.
import type { BlueprintNode } from "./blueprint.ts";
import { fill } from "./pieces.ts";
import { eachNames, eachPattern } from "./refs.ts";

export function modelChildren(
  children: readonly BlueprintNode[],
  each: BlueprintNode["each"] | undefined,
  parts: readonly string[],
  { character }: { character: number },
): readonly BlueprintNode[] {
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
