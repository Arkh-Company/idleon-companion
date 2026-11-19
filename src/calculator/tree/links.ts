// Step 7 of the bench's build-tree.cjs at BASELINE-4, over a recording: each cache read under the root links to the
// last write that covers its path (`writerOf`), or to the call's own write (`ownOf`), and the writers' calls are kept
// too, as a work list, because a cache builder reads other caches. And the write a scratch read comes from
// (`scratchWrites`), and its piece key (`scratchKey`).
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import { near } from "./math.ts";
import { callText } from "./rows.ts";

/** Where a cache read came from: a call of the game (offline), the helpers' setup, the running game, or unknown. */
export type Origin = "offline" | "offline-helper" | "game" | "unknown";
export type Link = [path: string, writer: number | null, origin: Origin];

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
 * The write a scratch read comes from: by the first of `by` (its writer, else its reader's own, for a box no cache link
 * covers) that wrote the value read, the write the read saw, by the number of the last write the recording keeps in the
 * read (`seq`), else the call's first write of that value; and the write's place among the call's writes of the box.
 */
export function scratchWrites(writes: readonly RecWrite[]) {
  const byCall = new Map<string, RecWrite[]>();
  for (const w of writes) {
    const k = `${String(w.node)}|${w.path}`;
    byCall.set(k, [...(byCall.get(k) ?? []), w]);
  }
  return (
    path: string,
    value: unknown,
    seq: number | undefined,
    ...by: (RecNode | null)[]
  ): { call: RecNode; at: number } | null => {
    if (/^(?:DNSM|DummyNumbersStatManager)\./.test(path))
      for (const n of by) {
        const all = n ? (byCall.get(`${String(n.id)}|${path}`) ?? []) : [];
        const seen =
          seq === undefined
            ? -1
            : all.findLastIndex((w) => w.seq <= seq && near(w.v, value));
        const at = seen >= 0 ? seen : all.findIndex((w) => near(w.v, value));
        if (n && at >= 0) return { call: n, at };
      }
    return null;
  };
}
