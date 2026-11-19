// pieces.cjs `ownSearchName` and `searchLabel` (spec 009 T030): a cache block `n` fills with the answer of its one search
// (HaveW6Trophy: the cache = Cards[1] contains the trophy) is said by what it found, "Found <item>". The names of a
// check's sides in tree/conditions.ts take it first.
import type { RecNode } from "../recording.ts";
import { tableText } from "./table-names.ts";

/** The name of the read `p` of block `n`, "Found <item>"; null for any other read, or an item with no name in the game's
 * table (never its raw id). `writersOf`: the calls that wrote each path (the recording's writes). */
export function searchNames(
  nodes: readonly RecNode[],
  writersOf: ReadonlyMap<string, readonly number[]>,
) {
  return function searchName(p: string, n: RecNode): string | null {
    // the block's own cache: written by this call, or by an earlier call of the same block that made the search (the
    // later one reads it back); a big recording keeps no write of it, and then the block's own search says it
    if (!p.startsWith("DNSM.")) return null;
    const writers = writersOf.get(p) ?? [];
    const fillers = writers.length
      ? writers.flatMap((id) => {
          const w = nodes[id];
          return w && (w === n || w.b === n.b) ? [w] : [];
        })
      : [n];
    if (!fillers.length) return null;
    const own = n.r?.find(([q]) => q === p);
    const want = own ? !!Number(own[1]) : null;
    const reads = [...new Set([n, ...fillers])].flatMap((x) => x.r ?? []);
    const found = reads.filter(
      ([q, v]) =>
        q.includes(" contains ") &&
        typeof v === "boolean" &&
        (want === null || v === want),
    );
    const m =
      found.length === 1
        ? /^Cards\[1\] contains (?:value )?(.*)$/.exec(found[0]?.[0] ?? "")
        : null;
    const item = m?.[1] === undefined ? null : tableText("item", m[1]);
    return item === null ? null : `Found ${item}`;
  };
}
