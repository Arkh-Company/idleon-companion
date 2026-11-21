// Step 7 of the bench's build-tree.cjs at BASELINE-4, over a recording: each cache read under the root links to the
// last write that covers its path (`writerOf`), or to the call's own write (`ownOf`), and the writers' calls are kept
// too, as a work list, because a cache builder reads other caches. And the write a scratch read comes from
// (`scratchWrites`), and its piece key (`scratchKey`).
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import { near } from "../recorded/math.ts";
import { callText } from "./rows.ts";
import type { LoopTurn } from "../recorded/steps.ts";

/** Where a cache read came from: a call of the game (offline), the helpers' setup, the running game, or unknown. */
export type Origin = "offline" | "offline-helper" | "game" | "unknown";
export type Link = [path: string, writer: number | null, origin: Origin];
/** A read of a call's step log as recorder.js writes it: [path, value, how many steps had run, the last write's number]. */
export type LoggedRead = NonNullable<RecNode["rx"]>[number];

function byNodeAndPath(list: RecWrite[]): Map<number, Map<string, RecWrite>> {
  const out = new Map<number, Map<string, RecWrite>>();
  for (const w of list) {
    if (w.node === null) continue;
    const m = out.get(w.node) ?? new Map<string, RecWrite>();
    m.set(w.path, w);
    out.set(w.node, m);
  }
  return out;
}

export interface Linked {
  /** The calls under the root and every writer they need. */
  keep: Set<number>;
  links: Map<number, Link[]>;
  /** The last write that covers a path (before the read's number `seq`, when given). */
  writerOf: (readPath: string, seq?: number) => RecWrite | null;
  /** The call's own write of a path, when it reads its own. */
  ownOf: (id: number, path: string) => RecWrite | null;
}

export function linkReads(rec: Recording): Linked {
  const { nodes, writes, setup } = rec;
  const bpStart = rec.bpStart ?? Infinity;
  const lastWrite = new Map(writes.map((w) => [w.path, w]));
  // A call reads its own write: a working value every call of a block rewrites would link to whichever wrote it last.
  const ownWrite = byNodeAndPath(writes);
  const ownScratch = byNodeAndPath([...rec.spliced].reverse());
  const writesOf = new Map<string, RecWrite[]>();
  for (const w of writes) {
    const list = writesOf.get(w.path);
    if (list) list.push(w);
    else writesOf.set(w.path, [w]);
  }

  /** A read links to the last write before it; a write of the builders' pass still explains an earlier read. */
  function writerOf(readPath: string, seq?: number): RecWrite | null {
    let p = readPath;
    while (p) {
      let w = lastWrite.get(p) ?? null;
      if (w && seq !== undefined && !(w.seq > bpStart))
        w = (writesOf.get(p) ?? []).findLast((x) => x.seq <= seq) ?? null;
      if (w) return w;
      const cut = Math.max(p.lastIndexOf("."), p.lastIndexOf("["));
      if (cut <= 0) break;
      p = p.slice(0, cut);
    }
    return null;
  }
  // A builders'-pass call reads its own scratch write only when the last writer is another call of the same block.
  function ownOf(id: number, path: string): RecWrite | null {
    const own = ownWrite.get(id)?.get(path);
    if (own) return own;
    const scratch = ownScratch.get(id)?.get(path);
    if (!scratch) return null;
    const last = writerOf(path);
    const same =
      last?.node != null &&
      last.node !== id &&
      nodes[last.node]?.b === nodes[id]?.b;
    return same ? scratch : null;
  }

  const keep = new Set<number>();
  const queue: number[] = [];
  const keepUp = (id: number) => {
    if (keep.has(id)) return;
    keep.add(id);
    queue.push(id);
    for (const c of nodes[id]?.c ?? []) keepUp(c);
  };
  if (rec.root !== null) keepUp(rec.root);
  const fromGame = new Set(rec.fromGame);
  const links = new Map<number, Link[]>();
  const seen = new Set<number>();
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (seen.has(id)) continue;
    seen.add(id);
    for (const [path, , seq] of nodes[id]?.r ?? []) {
      if (!path.startsWith("DNSM.")) continue;
      const w = ownOf(id, path) ?? writerOf(path, seq);
      let origin: Origin;
      if (w && w.node !== null && w.node !== setup) {
        origin = "offline";
        keepUp(w.node);
      } else if (w) origin = "offline-helper";
      else {
        const key = path.slice(5).split(/[.[]/)[0] ?? "";
        origin = fromGame.has(key) ? "game" : "unknown";
      }
      const writer = w && w.node !== setup ? w.node : null;
      links.set(id, [...(links.get(id) ?? []), [path, writer, origin]]);
    }
  }
  return { keep, links, writerOf, ownOf };
}

/**
 * 009 T023: a scratch box read at two moments is two pieces. A read's piece key names the write it comes from (its
 * `scratchWrites`): the writer's call and the write's place among that call's writes of the box; with no such write,
 * its path alone, as any other read.
 */
export const scratchKey = (
  character: number,
  path: string,
  own: { call: RecNode; at: number } | null,
): string =>
  JSON.stringify(
    own ? [character, path, callText(own.call), own.at] : [character, path],
  );

/**
 * The number of the write a read saw, from its reader's step log: its last read of the path with that value (in the
 * loop's turn `range` of steps, when one is open), else its first read's, when it has that value.
 */
export function readSeq(
  reader: RecNode | undefined,
  path: string,
  value: unknown,
  range?: LoopTurn,
): number | undefined {
  const inRange = (step: number) =>
    !range || (step >= range.from && step <= range.to);
  const log = (reader?.rx ?? []).findLast(
    ([p, v, step, seq]) =>
      p === path && seq !== undefined && inRange(step) && near(v, value),
  );
  return (
    log?.[3] ?? reader?.r?.find(([p, v]) => p === path && near(v, value))?.[2]
  );
}

/**
 * A scratch read as a row sees it (tree-build.ts readRow): the write it saw, by its number, and its place among its
 * writer's writes, for its key and its name. It opens in the writer `w` the cache links give (the builders' pass's
 * call of the same block explains an earlier read: linkReads), unless the write it saw is another block's; a read no
 * link covers (a loop's own running total) opens in nothing.
 */
export function scratchReads(rec: Recording) {
  const seen = scratchSeen(rec.writes, rec.spliced);
  const place = scratchWrites(rec.writes, rec.spliced);
  return (
    path: string,
    value: unknown,
    reader: RecNode | undefined,
    w: RecNode | null,
    range?: LoopTurn,
  ) => {
    const seq = readSeq(reader, path, value, range);
    const write = seq === undefined ? null : seen(path, value, seq);
    const node = write?.node ?? rec.setup;
    const saw = node === rec.setup ? null : (rec.nodes[node ?? -1] ?? null);
    const same = !!saw && !!w && callText(saw) === callText(w);
    const writer = same || !w ? w : (saw ?? w);
    const own = place(path, value, seq, saw ?? writer, reader ?? null);
    return { writer, own };
  };
}

const SCRATCH = /^(?:DNSM|DummyNumbersStatManager)\.[^.[]+/;
/** A scratch read's path and the paths above it, up to its box: a field is read from the object its box holds. */
function boxPaths(path: string): string[] {
  const box = SCRATCH.exec(path)?.[0];
  if (!box) return [];
  const out = [path];
  for (let p = path; p.length > box.length;) {
    p = p.slice(0, Math.max(p.lastIndexOf("."), p.lastIndexOf("[")));
    out.push(p);
  }
  return out;
}
/** Each path's writes, the builders' pass's too, in the order of their numbers, by `keyOf`. */
function byKey(
  list: readonly RecWrite[],
  keyOf: (w: RecWrite) => string,
): Map<string, RecWrite[]> {
  const out = new Map<string, RecWrite[]>();
  for (const w of [...list].sort((a, b) => a.seq - b.seq)) {
    const k = keyOf(w);
    const at = out.get(k);
    if (at) at.push(w);
    else out.set(k, [w]);
  }
  return out;
}

/**
 * The write a scratch read saw, by the number of the last write before it (`seq`): the last write of its path, or of
 * the box above it that holds an object, by any call and in the builders' pass too; none when the path's write has
 * another value than the read's.
 */
export function scratchSeen(
  writes: readonly RecWrite[],
  spliced: readonly RecWrite[] = [],
) {
  const byPath = byKey([...writes, ...spliced], (w) => w.path);
  return (path: string, value: unknown, seq: number): RecWrite | null => {
    const last = boxPaths(path)
      .flatMap((p) => byPath.get(p)?.findLast((w) => w.seq <= seq) ?? [])
      .reduce<RecWrite | null>((a, w) => (a && a.seq > w.seq ? a : w), null);
    return last && (last.path !== path || near(last.v, value)) ? last : null;
  };
}

/**
 * The place of the write read among a call's writes of a path (`exact`) or of the box above it: by the read's number,
 * else the first write of the path with the value read, else the box's only object.
 */
function placeOf(
  all: readonly RecWrite[],
  exact: boolean,
  value: unknown,
  seq?: number,
): number {
  if (seq !== undefined) {
    const seen = all.findLastIndex(
      (w) => w.seq <= seq && (!exact || near(w.v, value)),
    );
    if (seen >= 0) return seen;
  }
  if (exact) return all.findIndex((w) => near(w.v, value));
  return all.length === 1 && seq === undefined ? 0 : -1;
}

/**
 * The write a scratch read comes from: by the first of `by` (its writer, else its reader's own, for a box no cache link
 * covers) that wrote the value read, the write the read saw, by the number of the last write the recording keeps in the
 * read (`seq`), else the call's first write of that value; and the write's place among the call's writes of the box.
 * The builders' pass's writes count (`spliced`), and a field's read comes from its box's write of the object, by `seq`.
 * `reads` are the paths the writer read for that write, and `source` the read it copied, if any.
 */
export function scratchWrites(
  writes: readonly RecWrite[],
  spliced: readonly RecWrite[] = [],
) {
  const all = [...writes, ...spliced];
  const byCall = byKey(all, (w) => `${String(w.node)}|${w.path}`);
  const byNode = byKey(all, (w) => String(w.node));
  /** The writer's logged reads after its write before `w`, of any path, and before `w`. */
  const logged = (n: RecNode, w: RecWrite) => {
    const mine = byNode.get(String(n.id)) ?? [];
    const from = mine[mine.findIndex((x) => x === w) - 1]?.seq ?? -Infinity;
    return (n.rx ?? []).filter(
      ([, , , s]) => s !== undefined && s >= from && s < w.seq,
    );
  };
  const writeOf = (n: RecNode, w: RecWrite, at: number): ScratchWrite => ({
    call: n,
    at,
    seq: w.seq,
    reads: () => logged(n, w).map(([p]) => p),
    source: () =>
      logged(n, w).findLast(
        ([p, v]) =>
          SCRATCH.exec(p)?.[0] !== SCRATCH.exec(w.path)?.[0] && near(v, w.v),
      ),
  });
  return (
    path: string,
    value: unknown,
    seq: number | undefined,
    ...by: (RecNode | null)[]
  ): ScratchWrite | null => {
    for (const n of by)
      for (const p of n ? boxPaths(path) : []) {
        const list = byCall.get(`${String(n?.id)}|${p}`) ?? [];
        const at = list.length ? placeOf(list, p === path, value, seq) : -1;
        const w = list[at];
        if (n && w) return writeOf(n, w, at);
      }
    return null;
  };
}
/**
 * The write a scratch read comes from: its writer, its place among the writer's writes of the box, its number, what it
 * read and, for a write that copies a read (the start of a box), that read.
 */
export interface ScratchWrite {
  call: RecNode;
  at: number;
  seq: number;
  reads: () => readonly string[];
  source: () => LoggedRead | undefined;
}
