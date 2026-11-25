// The writes of a working map's key a call's argument read saw (spec 010, r3 of parts P and Q; moved out of
// save-args.ts, which keeps under 400 lines): by the recorded read, of the exact path it read, never another entry's.
import type { Op } from "../instrument.ts";
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import { atCap } from "./answer-key-pool.ts";

/** Where a call's argument was read: its caller's recording, the ops and the steps the caller had run when it began. */
export interface Place {
  rec: Recording;
  ops: readonly Op[];
  caller: RecNode;
  pos: number;
}

const indexes = new WeakMap<Recording, Map<string, RecWrite[]>[]>();
/**
 * A recording's writes of one path by number, the builders' pass's scratch among the spliced ones (recorder-pass.js);
 * with `spliced` false, `rec.writes` only.
 */
export function writesAt(
  rec: Recording,
  path: string,
  spliced = true,
): readonly RecWrite[] {
  let ix = indexes.get(rec);
  if (!ix) {
    const group = (ws: readonly RecWrite[]) => {
      const byPath = new Map<string, RecWrite[]>();
      for (const w of ws) {
        const all = byPath.get(w.path);
        if (all) all.push(w);
        else byPath.set(w.path, [w]);
      }
      for (const all of byPath.values()) all.sort((a, b) => a.seq - b.seq);
      return byPath;
    };
    ix = [group([...rec.writes, ...rec.spliced]), group(rec.writes)];
    indexes.set(rec, ix);
  }
  return ix[spliced ? 0 : 1]?.get(path) ?? [];
}

type ByNode = Map<number | null, RecWrite[]>;
const nodeIndexes = new WeakMap<Recording, { all: ByNode; plain: ByNode }>();
/**
 * A recording's writes of one call by number (part R: a scan of every write per level was most of a draft's time); with
 * `spliced`, the builders' pass's scratch among them, else `rec.writes` only.
 */
export function writesBy(
  rec: Recording,
  node: number | null,
  spliced = true,
): readonly RecWrite[] {
  let ix = nodeIndexes.get(rec);
  if (!ix) {
    const group = (ws: readonly RecWrite[]): ByNode => {
      const m: ByNode = new Map();
      for (const w of ws) {
        const all = m.get(w.node);
        if (all) all.push(w);
        else m.set(w.node, [w]);
      }
      for (const all of m.values()) all.sort((a, b) => a.seq - b.seq);
      return m;
    };
    ix = {
      all: group([...rec.writes, ...rec.spliced]),
      plain: group(rec.writes),
    };
    nodeIndexes.set(rec, ix);
  }
  return (spliced ? ix.all : ix.plain).get(node) ?? [];
}

type Read = NonNullable<RecNode["rx"]>[number];

/**
 * The caller's own write a read saw: of the exact path the read read or of a list or map it is in, the last by number;
 * undefined unrecorded, another's, or of another number than the one read.
 */
function readWrite(place: Place, read: Read): RecWrite | undefined {
  const [path, value] = read;
  const seen = read[3] ?? read[4];
  if (seen === undefined) return undefined;
  const paths = [
    path,
    ...[...path.matchAll(/[[.]/g)].map((m) => path.slice(0, m.index)),
  ];
  const w = paths
    .map((p) => writesAt(place.rec, p).findLast((x) => x.seq <= seen))
    .reduce<RecWrite | undefined>(
      (a, x) => (!x || (a && a.seq > x.seq) ? a : x),
      undefined,
    );
  // a write of another number is not the one the read saw (one the pass took out of the writes and kept nowhere)
  if (typeof value === "number" && w?.v !== value) return undefined;
  return w?.node === place.caller.id ? w : undefined;
}

/**
 * The caller's own writes of `map.key` the call's read saw: one per path of the key read at the step of the last read
 * before the call (an argument reads one entry of a list, another argument another, a search all of them: the log does
 * not tell which ones this argument read); undefined when one of them has none.
 */
export function ownWrites(place: Place, key: string): RecWrite[] | undefined {
  const of = (p: string) =>
    p === key || p.startsWith(`${key}[`) || p.startsWith(`${key}.`);
  const rx = place.caller.rx ?? [];
  // a log the cap cut at the call's place or before it may have lost the read right before the call
  if (atCap(place.caller) && (rx.at(-1)?.[2] ?? -1) <= place.pos)
    return undefined;
  const reads = rx.filter(([p, , xi]) => of(p) && xi <= place.pos);
  const last = reads.at(-1);
  if (!last) return undefined;
  const atStep = new Map(
    reads.filter((r) => r[2] === last[2]).map((r) => [r[0], r]),
  );
  const ws: RecWrite[] = [];
  for (const r of atStep.values()) {
    const w = readWrite(place, r);
    if (!w) return undefined;
    ws.push(w);
  }
  return ws;
}
