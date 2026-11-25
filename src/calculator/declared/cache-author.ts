// A read of a cache built before the root (spec 010, T166; spec, Open Questions 23/11): it ties to the block that wrote
// it by the recorded write, never by value or order. The write a read saw is the last of its path up to the number the
// read keeps, at the place of the read opened (T168), else of each step that uses the read; reads that saw no write read
// the running game's cache, which the builders' pass's writes of the path explain. A write under the reader or the root
// is a passage, no cache, and does not decide the author. One block is the author; writes of more than one block the
// places do not decide between are refused with the reason, and so are a write outside a block, no write at all and the
// author's read of its one write. The cache never becomes a leaf: the tree goes down through the expression that gave
// the write, in the author's turn since its write before it; an author that summed it in turns opens one a line.
import type { Op } from "../instrument.ts";
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import { matchPattern } from "../recorded/ast.ts";
import type { BlockSteps, Expr, LoopTurn } from "../recorded/steps.ts";
import { callRef, near } from "./answer-key-pool.ts";
import type { RawTerm } from "./answer-key-pool.ts";
import { leavesOf, num } from "./lock-parts.ts";
import { rhsSources } from "./write-rhs.ts";

export const isCacheRead = (path: string): boolean => path.startsWith("DNSM.");

/** The author, or the refusal's reason; `ambiguous` when the place does not decide between writes of different blocks. */
export type Author =
  { node: RecNode; write: RecWrite } | { refused: string; ambiguous?: true };

type Steps = Pick<BlockSteps, "steps"> & {
  stepAt?: number[] | undefined;
  range?: LoopTurn | undefined;
};

/**
 * The numbers the reader's reads of `path` kept (the last write before each): the last read at or before the place of
 * each step that holds the read opened (`leaf`, that very object), else of each step that uses the path; with no such
 * step, every read of its step log (of the turn, for a turn's steps); with no log, its first read's.
 */
export function seenSeqs(
  reader: RecNode,
  path: string,
  { steps, stepAt, range }: Steps,
  leaf?: Expr,
): (number | undefined)[] {
  const first = reader.r?.find(([p]) => p === path)?.[2];
  // the steps of a turn (T212): only the reads of that turn, with one after its last step, at its write's place
  const log = (reader.rx ?? []).filter(
    ([p, , xi, s]) =>
      p === path &&
      typeof s === "number" &&
      (!range || (xi >= range.from && xi <= range.to + 1)),
  );
  const placesOf = (uses: (l: Expr) => boolean) =>
    steps.flatMap((s, k) => {
      const at = stepAt?.[k];
      return at !== undefined && leavesOf(s.e).some(uses) ? [at] : [];
    });
  const exact = leaf ? placesOf((l) => l === leaf) : [];
  const places = exact.length
    ? exact
    : placesOf((l) => l.t === "read" && l.p === path);
  if (places.length === 0)
    return log.length ? log.map((x) => x[3] ?? undefined) : [first];
  return places.map((at) => log.findLast((x) => x[2] <= at)?.[3] ?? first);
}

/**
 * The block that wrote the cache `path` the reader read, in its steps, at the place of `leaf` (the read opened) when a
 * step holds it; null with no cache or a passage of the root.
 */
export function cacheAuthor(
  rec: Recording,
  path: string,
  reader: RecNode,
  steps: Steps,
  leaf?: Expr,
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
    return `${n ? callRef(n) : "fora de um bloco ou evento"} seq ${String(w.seq)}`;
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
  const saw = seenSeqs(reader, path, steps, leaf).map((s) =>
    s === undefined ? undefined : writes.findLast((w) => w.seq <= s),
  );
  // the reader's own write, outside the root: the author reads the cache it wrote; summed in turns, it is its own
  // author at that write, and its turns open it (loop-turns.ts writeTurns)
  const own = saw.find((w) => w?.node === reader.id);
  if (own && !under(reader.id, rec.root))
    return writes.filter((w) => w.node === reader.id).length > 1
      ? { node: reader, write: own }
      : {
          refused: `o cache ${path} é lido pelo próprio autor depois de escrevê-lo`,
        };
  // a place whose read saw a write under the reader or the root is a passage: it does not decide the author
  const kept = saw.filter(
    (w) => !w || !(under(w.node, reader.id) || under(w.node, rec.root)),
  );
  if (kept.length === 0) return null;
  const seen = one(kept);
  if ("refused" in seen) return seen;
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
    return {
      refused: `o cache ${path} foi escrito fora de um bloco ou evento`,
    };
  return { node, write };
}

type TurnOf = (n: RecNode, range: LoopTurn) => BlockSteps;

/** The author's write before `write`, on any path, or null. */
const writeBefore = (
  rec: Recording,
  { node, write }: { node: RecNode; write: RecWrite },
): RecWrite | null =>
  [...rec.writes, ...rec.spliced]
    .filter((w) => w.node === node.id && w.seq < write.seq)
    .reduce<RecWrite | null>((a, w) => (a && a.seq > w.seq ? a : w), null);

/** The place of the author's turn that gave its write in its step log: since its write before it. */
export function writeRange(
  rec: Recording,
  a: { node: RecNode; write: RecWrite },
): LoopTurn {
  const from = writeBefore(rec, a);
  return { from: from?.xi ?? 0, to: a.write.xi - 1 };
}

/** The steps of the author's turn that gave its write: since its write before it. */
export function writeTurn(
  rec: Recording,
  a: { node: RecNode; write: RecWrite },
  turnOf: TurnOf,
): BlockSteps {
  return turnOf(a.node, writeRange(rec, a));
}

/** The expression that gave the author's write: the last step of its turn (`turn`), with the value. */
export function writeExpr(
  rec: Recording,
  a: { node: RecNode; write: RecWrite },
  turnOf: TurnOf,
  turn = writeTurn(rec, a, turnOf),
): Expr | null {
  // shortcut: a write of a call's value with no step of its own gives none; take the call when a cache needs it
  const last = turn.steps.at(-1);
  return last && near(last.v, a.write.v) ? last.e : null;
}

/**
 * What gave the author's write (T191): its turn's last step, or else, with no step of its own, the read or the call made
 * after that step and its write before, and before the write, by the recorded place (`xi`, `seq`), with no value in
 * the choice: one only opens when its value checks; more than one is refused with the reason; none, or a value that
 * does not check, gives none. A part that gives no number (a text, an image's call) is no count.
 */
export function writeSource(
  rec: Recording,
  a: { node: RecNode; write: RecWrite },
  turnOf: TurnOf,
  turn = writeTurn(rec, a, turnOf),
  ops?: readonly Op[],
): Expr | string | null {
  const e = writeExpr(rec, a, turnOf, turn);
  if (e) return e;
  const { node, write } = a;
  const prev = writeBefore(rec, a);
  const from = Math.max(prev?.xi ?? 0, (turn.stepAt?.at(-1) ?? -1) + 1);
  // a read by `xi` and its write's number (a table's text keeps it fifth); a call of a recording before T191 r1 (no
  // `seq`) by `xi` only
  const inWindow = (xi: number, seq: number | null | undefined, call = false) =>
    xi >= from &&
    xi <= write.xi &&
    (typeof seq === "number"
      ? seq >= (prev?.seq ?? 0) && seq < write.seq
      : call && seq === undefined);
  // each part by its name; a path read again with the same number is the same part
  const parts = new Map<string, { e: Expr; v: number }>();
  for (const [p, v, xi, seq, textSeq] of node.rx ?? []) {
    const n = num(v);
    if (n !== null && inWindow(xi, seq ?? textSeq))
      parts.set(`${p} = ${String(n)}`, {
        e: { t: "read", p, v: n },
        v: n,
      });
  }
  for (const id of node.c) {
    const k = rec.nodes[id];
    const n = num(k?.v);
    if (k && n !== null && inWindow(k.pxi, k.seq, true))
      parts.set(`${callRef(k)} #${String(id)}`, {
        e: { t: "call", id, v: n },
        v: n,
      });
  }
  // more than one: the right side of the code's assignment at the write's place picks (write-rhs.ts)
  const srcs = parts.size > 1 && ops ? rhsSources(node, write, ops) : null;
  const picked = srcs
    ? [...parts.values()].filter(({ e: p }) =>
        srcs.some((s) =>
          "call" in s
            ? p.t === "call" && rec.nodes[p.id]?.b === s.call
            : p.t === "read" && matchPattern(p.p, s.read),
        ),
      )
    : [...parts.values()];
  if (parts.size > 1 && picked.length !== 1)
    return `a escrita de ${write.path} seq ${String(write.seq)} sai de mais de uma leitura ou chamada (${[...parts.keys()].join("; ")}), e o lugar não decide entre elas`;
  const [one] = picked;
  return one && near(one.v, write.v) ? one.e : null;
}

/** The read of `path` among the leaves of `e` when there is one only: the place of a read opened, never by order. */
export function onlyRead(e: Expr | null, path: string): Expr | undefined {
  const reads = (e ? leavesOf(e) : []).filter(
    (l) => l.t === "read" && l.p === path,
  );
  return reads.length === 1 ? reads[0] : undefined;
}

/**
 * The answer key's refusal of a cache read among its terms (before the strip, with their expressions: the read's place)
 * whose writes the place does not decide between, or null.
 */
export function refusedAuthor(
  rec: Recording,
  top: RecNode,
  steps: Steps,
  terms: readonly RawTerm[],
): string | null {
  for (const t of terms)
    for (const [i, ref] of t.refs.entries()) {
      if (t.nodes[i] !== null) continue;
      const a = cacheAuthor(rec, ref, top, steps, onlyRead(t.e, ref));
      if (a && "ambiguous" in a) return a.refused;
    }
  return null;
}
