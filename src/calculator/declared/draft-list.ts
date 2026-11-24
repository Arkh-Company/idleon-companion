// A long list as one model child in the draft (spec 010, T202; spec, Open Questions 24/11): a node's children that are
// reads of one path, only one index changing, each a leaf, are one model child with `each`, never one child per item.
// The index is the read's own place in the path, never its value; a path through the characters is no list. The
// model's name is the items' names with that index as `{item}`, only when it gives back each item's own name.
import type { DraftNode, Walked } from "./draft.ts";
import { codeOf, keyIn, marked } from "./draft-names.ts";
import type { BlueprintPending } from "./blueprint.ts";
import type { RefArg } from "./refs.ts";
import { CALL } from "./not-leaves.ts";

/** The name of the item in a model child's references: `[{item}]`. */
export const ITEM = "item";
// shortcut: a list is long from 8 items; lower it when a shorter list of the game repeats
const MIN_LIST = 8;
const INDEX = /\[(\d+)\]/;

/** A list of reads: the path with `[*]`, the model's path with `[{item}]`, and each item's index, in order. */
export interface ListModel {
  list: string;
  read: string;
  items: readonly Walked[];
  indices: readonly number[];
}

/** The children as one list, or null: leaves that read one path whose one index changes, each item once. */
export function listOf(
  below: readonly Walked[],
  character: number,
): ListModel | null {
  if (below.length < MIN_LIST) return null;
  if (
    below.some(
      (w) =>
        w.call !== null ||
        w.below !== "leaf" ||
        w.termPart !== undefined ||
        CALL.test(w.key),
    )
  )
    return null;
  // a split path: its texts at the even places, its indices at the odd ones; a character's index is a marker, a text
  const split = below.map((w) => marked(w.key, character).split(INDEX));
  const [first] = split;
  if (!first || split.some((s) => s.length !== first.length)) return null;
  const changing = first.flatMap((x, k) =>
    split.every((s) => s[k] === x) ? [] : [k],
  );
  const [at] = changing;
  if (at === undefined || changing.length > 1 || at % 2 === 0) return null;
  const indices = split.map((s) => Number(s[at]));
  if (new Set(indices).size !== indices.length) return null;
  const path = (index: string) =>
    first
      .map((x, k) => (k % 2 === 0 ? x : `[${k === at ? index : x}]`))
      .join("");
  const list = path("*");
  // a `*` the draft wrote for another character is a list's index too: no list
  if (list.split("[*]").length !== 2) return null;
  return { list, read: path(`{${ITEM}}`), items: below, indices };
}

/**
 * The model's name: an item's name with its index as `{item}` (a whole number of its text), when it gives back every
 * item's own name; null when one has none or none gives them all.
 */
export function modelName(
  names: readonly (string | null)[],
  indices: readonly number[],
): string | null {
  const all = names.filter((n) => n !== null);
  if (all.length !== names.length) return null;
  const fits = (t: string) =>
    all.every(
      (n, k) => t.replaceAll(`{${ITEM}}`, String(indices[k] ?? "")) === n,
    );
  for (const [k, n] of all.entries()) {
    const own = new RegExp(`(?<![\\w.])${String(indices[k])}(?![\\w.])`, "g");
    const t = n.replace(own, `{${ITEM}}`);
    if (fits(t)) return t;
  }
  return null;
}

/** A list of calls of one block (T205): the block and the place of the one argument its turns change. */
export interface CallList {
  block: string;
  at: number;
}

/**
 * The children as one list of calls, or null: a long list (as T202's) of calls of one block, the same arguments but for one place,
 * each item once (T205). The item's place is the argument's, never a value.
 */
export function callListOf(below: readonly Walked[]): CallList | null {
  const calls = below.map((w) => w.call);
  const [first] = calls;
  if (below.length < MIN_LIST || !first || calls.some((c) => c?.b !== first.b))
    return null;
  const args = calls.map((c) => (c?.a ?? []).map((a) => JSON.stringify(a)));
  if (args.some((a) => a.length !== first.a.length)) return null;
  const changing = first.a.flatMap((_, k) =>
    args.every((a) => a[k] === args[0]?.[k]) ? [] : [k],
  );
  const [at] = changing;
  if (at === undefined || changing.length > 1) return null;
  const items = args.map((a) => a[at]);
  return new Set(items).size === items.length ? { block: first.b, at } : null;
}

/** A list of calls' model (T205): the first call with `{item}` at the turn's argument; its name and descent wait. */
export function callModel(
  below: readonly Walked[],
  l: CallList,
  wait: (kind: BlueprintPending["kind"]) => void,
): DraftNode {
  const args = [...(below[0]?.call?.a ?? [])] as RefArg[];
  args[l.at] = `{${ITEM}}`;
  wait("name");
  wait("descend");
  const ref = { call: l.block, args };
  return { key: keyIn(new Set(), codeOf(ref, "")), name: null, ref };
}
