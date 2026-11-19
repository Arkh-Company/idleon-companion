// A cache the game fills in a loop (spec 008, T022): the port of build-tree.cjs step 8d2 and of pieces.cjs `WRITERS_OF`
// and `writerByValue`, from the bench at BASELINE-4. One block writing many entries, or adding to the same entry many
// times: each write keeps its own steps, from the slice of the writer's step log since that block's previous write, with
// the calls and the reads of that turn. Only the entries a cache read asks for are kept (a work list, as in the bench:
// a turn that reads another cache asks for that cache's entries too), each under its writer and path.
import type { RecNode, Recording, RecValue, RecWrite } from "../recording.ts";
import type { Linked } from "./links.ts";
import { near } from "./math.ts";
import { callText } from "./rows.ts";
import type { LoopTurn, Step } from "./steps.ts";

/** A turn's read: [path, value] and, for a cache read, the call that wrote it. */
export type TurnRead = [path: string, value: RecValue, writer?: number];
export interface Entry {
  v: RecValue;
  /** The turn's steps. */
  s: Step[];
  /** The calls made in the turn. */
  k: number[];
  r: TurnRead[];
  /** The turn's place in the writer's step log: a read of the turn is the one logged there (tree/links.ts readSeq). */
  t?: LoopTurn;
}
export type Entries = ReadonlyMap<string, readonly Entry[]>;

/** build-tree.cjs: the work list stops at 3000 caches, and a cache keeps up to 400 turns and the last 60 reads of each. */
const MAX_QUEUE = 3000;
const MAX_TURNS = 400;
const MAX_READS = 60;

export function entriesOf(
  rec: Recording,
  linked: Linked,
  turn: (n: RecNode, xs: RecNode["x"], range: LoopTurn) => Step[],
): Map<string, Entry[]> {
  const { nodes, setup } = rec;
  const { links, writerOf, ownOf } = linked;
  const keep = new Set(linked.keep);
  const offline = (w: RecWrite | null): w is RecWrite & { node: number } =>
    !!w && w.node !== null && w.node !== setup;
  const byNode = new Map<number, RecWrite[]>();
  for (const w of rec.writes)
    if (offline(w)) byNode.set(w.node, [...(byNode.get(w.node) ?? []), w]);
  const wanted = new Set<string>();
  const queue: string[] = [];
  const want = (w: RecWrite | null) => {
    const key = `${String(w?.node)}|${w?.path ?? ""}`;
    if (w && !wanted.has(key)) {
      wanted.add(key);
      queue.push(key);
    }
  };
  // (S2) the writer a read is linked to (the call itself when it wrote the cache and read it back), in the order of the
  // bench's links object (by call id)
  for (const id of [...links.keys()].sort((a, b) => a - b))
    for (const [rp, wid] of links.get(id) ?? [])
      if (wid !== null) want(ownOf(id, rp) ?? writerOf(rp));
  // (T3) a call kept only now asks for the entries of the caches it filled itself
  const keepUp = (id: number) => {
    if (keep.has(id)) return;
    keep.add(id);
    for (const [rp] of nodes[id]?.r ?? []) {
      if (!rp.startsWith("DNSM.")) continue;
      const w = ownOf(id, rp) ?? writerOf(rp);
      if (offline(w)) want(w);
    }
    for (const c of nodes[id]?.c ?? []) keepUp(c);
  };

  const entries = new Map<string, Entry[]>();
  for (let qi = 0; qi < queue.length && qi < MAX_QUEUE; qi++) {
    const key = queue[qi] ?? "";
    const nid = Number(key.slice(0, key.indexOf("|")));
    const p = key.slice(key.indexOf("|") + 1);
    const list = byNode.get(nid) ?? [];
    const n = nodes[nid];
    // one write: the block's own steps are this entry's
    if (!n?.x || list.length < 2) continue;
    const out: Entry[] = [];
    for (let i = 0; i < list.length && out.length < MAX_TURNS; i++) {
      const w = list[i];
      if (w?.path !== p) continue;
      const from = list[i - 1]?.xi ?? 0;
      // nothing computed since the last write
      if (w.xi <= from) continue;
      const k = n.c.filter((c) => {
        const pxi = nodes[c]?.pxi ?? -1;
        return pxi >= from && pxi <= w.xi;
      });
      // a search of the game belongs to the turn whose write comes after it: the next turn's search, right after this
      // write and at the same place of the step log, is the next turn's
      const inTurn = (n.rx ?? []).filter(
        (x) =>
          x[2] >= from &&
          (x[2] < w.xi || (x[2] === w.xi && !x[0].includes(" contains "))),
      );
      const r = [...new Map(inTurn.map((x) => [x[0], x[1]]))]
        .slice(-MAX_READS) // the last reads of a turn say which item it is
        .map(([rp, rv]): TurnRead => {
          const ww = rp.startsWith("DNSM.") ? writerOf(rp) : null;
          if (!offline(ww)) return [rp, rv];
          want(ww);
          // the writer's rows must reach the output
          keepUp(ww.node);
          return [rp, rv, ww.node];
        });
      out.push({
        v: w.v,
        s: turn(n, n.x.slice(from, w.xi), { from, to: w.xi }),
        k,
        r,
        t: { from, to: w.xi },
      });
    }
    if (out.length) entries.set(key, out);
  }
  return entries;
}

/** pieces.cjs `WRITERS_OF` and `writerByValue`: who wrote each cache path in loop turns, and which one wrote a value. */
export function makeWriters(nodes: readonly RecNode[], entries: Entries) {
  const writersOf = new Map<string, number[]>();
  for (const k of entries.keys()) {
    const i = k.indexOf("|");
    const p = k.slice(i + 1);
    writersOf.set(p, [...(writersOf.get(p) ?? []), Number(k.slice(0, i))]);
  }
  return {
    writersOf: writersOf as ReadonlyMap<string, readonly number[]>,
    /**
     * A read whose writer was not recorded is linked to the writer whose recorded write of that path has exactly the
     * value read; never by a guess. [OPUS3-F1b] several writers that are all the same call are one piece.
     */
    writerByValue(p: string, value: unknown): RecNode | null {
      const ids = (writersOf.get(p) ?? []).filter((id) =>
        (entries.get(`${String(id)}|${p}`) ?? []).some(
          (e) => typeof e.v === "number" && near(e.v, value),
        ),
      );
      const text = (id: number) => {
        const n = nodes[id];
        return n ? callText(n) : "";
      };
      const [first] = ids;
      if (first === undefined) return null;
      return ids.length === 1 || ids.every((id) => text(id) === text(first))
        ? (nodes[first] ?? null)
        : null;
    },
  };
}
