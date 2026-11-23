// A read of a cache built before the root (spec 010, T166; spec, Open Questions 23/11): it ties to the block that wrote
// it by the recorded write, never by value or order. The write a read saw is the last of its path up to the number the
// read keeps, at the place of the step that uses the read; reads that saw no write read the running game's cache, which
// the builders' pass's writes of the path explain. A write of the root's own calls is a passage, no cache. One block is
// the author; writes of more than one block the place does not decide between are refused with the reason, and so are
// a write outside a block, no write at all and a cache its author sums over its own value. The cache never becomes a
// leaf: the tree goes down through the expression that gave the write, in the author's turn since its write before it.
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import type { BlockSteps, Expr, LoopTurn } from "../recorded/steps.ts";
import { callRef, near } from "./answer-key-pool.ts";
import type { AnswerPool } from "./answer-key.ts";
import { leavesOf } from "./lock-parts.ts";

export const isCacheRead = (path: string): boolean => path.startsWith("DNSM.");

/** The author, or the refusal's reason; `ambiguous` when the place does not decide between writes of different blocks. */
export type Author =
  { node: RecNode; write: RecWrite } | { refused: string; ambiguous?: true };

type Steps = Pick<BlockSteps, "steps"> & { stepAt?: number[] | undefined };

/**
 * The numbers the reader's reads of `path` kept (the last write before each): the last read at or before the place of
 * each step that uses the read; with no such step, every read of its step log; with no log, its first read's.
 */
function seenSeqs(
  reader: RecNode,
  path: string,
  { steps, stepAt }: Steps,
): (number | undefined)[] {
  const first = reader.r?.find(([p]) => p === path)?.[2];
  const log = (reader.rx ?? []).filter(
    ([p, , , s]) => p === path && s !== undefined,
  );
  const places = steps.flatMap((s, k) => {
    const at = stepAt?.[k];
    const uses = leavesOf(s.e).some((l) => l.t === "read" && l.p === path);
    return uses && at !== undefined ? [at] : [];
  });
  if (places.length === 0) return log.length ? log.map((x) => x[3]) : [first];
  return places.map((at) => log.findLast((x) => x[2] <= at)?.[3] ?? first);
}

/** The block that wrote the cache `path` the reader read, in its steps; null with no cache or a passage of the root. */
export function cacheAuthor(
  rec: Recording,
  path: string,
  reader: RecNode,
  steps: Steps,
): Author | null {
  if (!isCacheRead(path)) return null;
  const under = (id: number | null, top: number | null) => {
    for (let n = id; n !== null; n = rec.nodes[n]?.p ?? null)
      if (n === top) return true;
    return false;
  };
  const writes = rec.writes.filter((w) => w.path === path);
  const name = (w: RecWrite | undefined) => {
    const n = rec.nodes[w?.node ?? -1];
    if (!w) return "o cache do jogo";
    return `${n ? callRef(n) : "fora de um bloco"} seq ${String(w.seq)}`;
  };
  /** One write of each writer, or a refusal when there are more. */
  const one = (
    ws: (RecWrite | undefined)[],
  ): { write: RecWrite | undefined } | { refused: string; ambiguous: true } => {
    const by = new Map(ws.map((w) => [w?.node, w]));
    if (by.size < 2) return { write: [...by.values()][0] };
    const all = [...by.values()].map(name).join("; ");
    const refused = `a leitura de ${path} tem mais de um autor possível (${all})`;
    return { refused, ambiguous: true };
  };
  const seen = one(
    seenSeqs(reader, path, steps).map((s) =>
      s === undefined ? undefined : writes.findLast((w) => w.seq <= s),
    ),
  );
  if ("refused" in seen) return seen;
  // the reader's own write, outside the root: the author reads the cache it sums (one turn would hide the others)
  if (seen.write?.node === reader.id && !under(reader.id, rec.root))
    return { refused: `o cache ${path} é somado em voltas pelo autor` };
  if (
    seen.write &&
    (under(seen.write.node, reader.id) || under(seen.write.node, rec.root))
  )
    return null;
  // the running game's cache: the last write of each writer of the builders' pass
  const pass = writes.filter((w) => w.seq > (rec.bpStart ?? Infinity));
  const by = seen.write ? seen : one(pass);
  if ("refused" in by) return by;
  const { write } = by;
  if (!write)
    return {
      refused: `o cache ${path} não tem escrita gravada: falta o builder na receita ou o builder deu outro valor`,
    };
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
  const before = [...rec.writes, ...rec.spliced].filter(
    (w) => w.node === node.id && w.seq < write.seq,
  );
  const from = before.reduce<RecWrite | null>(
    (a, w) => (a && a.seq > w.seq ? a : w),
    null,
  );
  const last = turnOf(node, { from: from?.xi ?? 0, to: write.xi - 1 }).steps.at(
    -1,
  );
  return last && near(last.v, write.v) ? last.e : null;
}

/** The answer key's refusal of a cache read among its terms whose writes the place does not decide between, or null. */
export function refusedAuthor(
  rec: Recording,
  top: RecNode,
  steps: Steps,
  ...lists: (readonly AnswerPool[])[]
): string | null {
  for (const t of lists.flat().flatMap((p) => p.terms))
    for (const [i, ref] of t.refs.entries()) {
      if (t.nodes[i] !== null) continue;
      const a = cacheAuthor(rec, ref, top, steps);
      if (a && "ambiguous" in a) return a.refused;
    }
  return null;
}
