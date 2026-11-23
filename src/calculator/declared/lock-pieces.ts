// A line that calls a recipe piece, in the lock (spec 010, T170, T171; spec, Open Questions 23/11): the line takes the
// value of its reference (the call or the cache the game read, as any node) and closes by the count of its piece's
// children: each level by its declared combine, a leaf by its recorded value, read anywhere in the recording. An `each`
// node has one child per item of the recorded list, its size from the recording. Here the engine does not open a cache
// into its author nor a sum into its loop's turns: the piece says the count. A level that does not close is a
// notClosing with the two values; a leaf the recording lacks, a childNoValue.
import { callRef, relDiff } from "./answer-key-pool.ts";
import type { BlueprintNode } from "./blueprint.ts";
import type { LevelContext, LevelOut } from "./lock-levels.ts";
import { leafCheck, num, TOLERANCE } from "./lock-parts.ts";
import { fill } from "./pieces.ts";
import { matchRead, refKey, starPattern } from "./refs.ts";

type Ctx = Pick<LevelContext, "rec" | "character">;
type Ref = NonNullable<BlueprintNode["ref"]>;

/** A reference's recorded value anywhere in the recording: the first call made with its key, or the first read. */
function recordedValue(ref: Ref, ctx: Ctx): number | null {
  if ("call" in ref) {
    const key = refKey(ref, ctx.character);
    return num(ctx.rec.nodes.find((n) => callRef(n) === key)?.v);
  }
  for (const n of ctx.rec.nodes) {
    const reads = n.r ?? [];
    const m = matchRead(
      ref.read,
      reads.map(([p]) => p),
      ctx.character,
    );
    if (m) return num(reads.find(([p]) => p === m.path)?.[1]);
  }
  return null;
}

/**
 * A piece's node's children in the recording: an each's model once per item of the recorded list, in the list's order,
 * the item in place of its name and the place in the list in its key.
 */
export function pieceChildren(node: BlueprintNode, ctx: Ctx): BlueprintNode[] {
  const [model] = node.children ?? [];
  if (!node.each || !model) return [...(node.children ?? [])];
  const { list, as } = node.each;
  const path = new RegExp(
    `^${starPattern(list.replaceAll("{character}", String(ctx.character)))}$`,
  );
  const items = new Map<number, unknown>();
  for (const n of ctx.rec.nodes)
    for (const [p, v] of n.r ?? []) {
      const at = path.exec(p)?.[1];
      if (at !== undefined && !items.has(Number(at))) items.set(Number(at), v);
    }
  return [...items]
    .toSorted(([a], [b]) => a - b)
    .map(([, item], i) => ({
      ...fill(model, { [as]: typeof item === "number" ? item : String(item) }),
      key: `${model.key}-${String(i)}`,
    }));
}

/**
 * A piece's level: its children down to the leaves, then its combine over their values against `value` (null: a level
 * with no recorded value of its own, not checked). Gives the remounted value, null when a part has none.
 */
export function lockPiece(
  node: BlueprintNode,
  value: number | null,
  ctx: LevelContext,
  out: LevelOut,
): number | null {
  out.counts.branches++;
  const parts = pieceChildren(node, ctx).map((child) => {
    const inner = { ...ctx, where: `${ctx.where}/${child.key}` };
    const own = child.ref ? recordedValue(child.ref, ctx) : null;
    if (child.combine) return lockPiece(child, own, inner, out);
    leafCheck(child, inner.where, out);
    if (own === null)
      out.errors.push({ kind: "childNoValue", where: inner.where });
    return own;
  });
  const values = parts.filter((p) => p !== null);
  if (values.length < parts.length) return null;
  const got =
    node.combine === "product"
      ? values.reduce((a, p) => a * p, 1)
      : values.reduce((a, p) => a + p, 0);
  if (value === null) return got;
  if (relDiff(got, value) <= TOLERANCE) out.counts.closed++;
  else
    out.errors.push({
      kind: "notClosing",
      where: ctx.where,
      expected: value,
      got,
    });
  return got;
}
