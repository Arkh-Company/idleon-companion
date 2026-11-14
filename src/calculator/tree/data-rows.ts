// The data rows of a block (spec 008, T022): the port of pieces.cjs `dataRows` from the bench at BASELINE-4. What the
// block read from the account's state and did not already show as a part of its formula: levels, counts, owned items.
// The game's own tables are constants and stay out, as do a length, a text and the block's own working values.
import type { RecNode } from "../recording.ts";
import { near } from "./math.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";
import { lastReads } from "./steps.ts";
import type { Expr } from "./steps.ts";
import { hasKids } from "./terms.ts";

/** The read paths a block's steps show (pieces.cjs dataRows `used`). */
function readsIn(e: Expr | undefined, out: Set<string>): Set<string> {
  if (e?.t === "read") out.add(e.p);
  if (e?.t === "op") [e.l, e.r].forEach((x) => readsIn(x, out));
  if (e?.t === "fn") e.args.forEach((x) => readsIn(x, out));
  return out;
}

/**
 * pieces.cjs `dataRows`: what the block read and did not already show (a table, a length or a text stays out); `readRow`
 * makes a read's row, `writersOf` the calls that wrote each cache path in loop turns.
 */
export function dataRows(
  n: RecNode,
  rows: Row[],
  stepsRead: Expr[],
  stepNotOpened: boolean,
  readRow: (path: string, value: number) => Row,
  writersOf: ReadonlyMap<string, readonly number[]>,
): Row[] {
  const used = new Set<string>();
  stepsRead.forEach((e) => readsIn(e, used));
  const terms = new Set(rows.map((r) => termOf(r.node)));
  const last = lastReads(n);
  // the paths this call writes in a loop (its own working values)
  const own = new Set(
    [...writersOf].filter(([, ids]) => ids.includes(n.id)).map(([p]) => p),
  );
  const out: Row[] = [];
  for (const [p, v0] of n.r ?? []) {
    // a path the call read with several values shows the last one, the state the call ended with
    const v = last.get(p) ?? v0;
    const cache = p.startsWith("DNSM.");
    // [F1-RC1] a state read of a step that did not open is a data row (a cache stays as it was)
    if (
      (used.has(p) && !(stepNotOpened && !cache)) ||
      typeof v !== "number" ||
      /^Custom(Lists|Maps).|.length$|^DummyNumbers/.test(p) ||
      rows.some((r) => r.node.code === p) ||
      terms.has(p)
    )
      continue;
    const r = readRow(p, v);
    // the block's own result kept in a working value, with nothing under it: not a part of the block
    if (cache && near(v, n.v) && !hasKids(r) && rows.length) continue;
    // a working value this call writes itself, that opens to nothing, or that changes inside this very call (the
    // scratch of its loop): not a part; a cache it filled earlier and that opens stays
    if (own.has(p) && (!hasKids(r) || last.has(p))) continue;
    terms.add(p);
    out.push(r);
  }
  return out;
}
