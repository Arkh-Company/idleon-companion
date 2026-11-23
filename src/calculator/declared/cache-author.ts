// A read of a cache built before the root (spec 010, T166; spec, Open Questions 23/11): it ties to the block that wrote
// it by the recorded write, never by value or order. The write the read saw (the last of its path up to the number the
// read keeps) and the builders' pass's writes of the path, which explain an earlier read of the running game's cache,
// are the candidates; a write of the root's own calls is a passage, no cache. One block is the author; more than one,
// or a write outside a block, is refused with the reason. The cache never becomes a leaf: the tree goes down through
// the expression that gave the write, in the author's turn since its write before it.
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import type { BlockSteps, Expr, LoopTurn } from "../recorded/steps.ts";
import { callRef, near } from "./answer-key-pool.ts";
import type { AnswerPool } from "./answer-key.ts";

export const isCacheRead = (path: string): boolean => path.startsWith("DNSM.");

export type Author = { node: RecNode; write: RecWrite } | { refused: string };

/** The number of the last write the reader's read of `path` saw: its last logged read with the value, or its first. */
function seenSeq(
  reader: RecNode,
  path: string,
  value: unknown,
): number | undefined {
  const log = (reader.rx ?? []).findLast(
    ([p, v, , s]) => p === path && s !== undefined && near(v, value),
  );
  return log?.[3] ?? reader.r?.find(([p]) => p === path)?.[2];
}

/** The block that wrote the cache `path` the reader read (worth `value`, when known); null with none. */
export function cacheAuthor(
  rec: Recording,
  path: string,
  reader: RecNode,
  value?: unknown,
): Author | null {
  if (!isCacheRead(path)) return null;
  const seq = seenSeq(reader, path, value);
  const inRoot = (id: number | null) => {
    for (let n = id; n !== null; n = rec.nodes[n]?.p ?? null)
      if (n === reader.id || n === rec.root) return true;
    return false;
  };
  const writes = rec.writes.filter((w) => w.path === path);
  const seen =
    seq === undefined ? undefined : writes.findLast((w) => w.seq <= seq);
  if (seen && inRoot(seen.node)) return null;
  const pass = writes.filter((w) => w.seq > (rec.bpStart ?? Infinity));
  // the last write of each writer
  const by = new Map<number | null, RecWrite>();
  for (const w of [...(seen ? [seen] : []), ...pass]) by.set(w.node, w);
  const name = (w: RecWrite) => {
    const n = rec.nodes[w.node ?? -1];
    return `${n ? callRef(n) : "fora de um bloco"} seq ${String(w.seq)}`;
  };
  if (by.size > 1)
    return {
      refused: `a leitura de ${path} tem mais de um autor possível (${[...by.values()].map(name).join("; ")})`,
    };
  const [write] = by.values();
  if (!write) return null;
  const node = rec.nodes[write.node ?? -1];
  if (!node || node.b.startsWith("("))
    return { refused: `o cache ${path} foi escrito fora de um bloco` };
  return { node, write };
}

/** The expression that gave the author's write: its last step in its turn (since its write before it), with the value. */
export function writeExpr(
  rec: Recording,
  { node, write }: { node: RecNode; write: RecWrite },
  turnOf: (n: RecNode, range: LoopTurn) => BlockSteps,
): Expr | null {
  // shortcut: a write of a call's value with no step of its own gives none; take the call when a cache needs it
  const from =
    [...rec.writes, ...rec.spliced].findLast(
      (w) => w.node === node.id && w.seq < write.seq,
    )?.xi ?? 0;
  const last = turnOf(node, { from, to: write.xi - 1 }).steps.at(-1);
  return last && near(last.v, write.v) ? last.e : null;
}

/** The answer key's refusal of a cache read among its terms that has more than one possible author, or null. */
export function refusedAuthor(
  rec: Recording,
  top: RecNode,
  pools: readonly AnswerPool[],
): string | null {
  for (const t of pools.flatMap((p) => p.terms))
    for (const [i, ref] of t.refs.entries()) {
      if (t.nodes[i] !== null) continue;
      const a = cacheAuthor(
        rec,
        ref,
        top,
        t.refs.length === 1 ? t.value : undefined,
      );
      if (a && "refused" in a) return a.refused;
    }
  return null;
}
