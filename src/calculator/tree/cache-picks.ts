// Which writes of a cache, and which part of a turn's step, a cache read opens into (spec 008, T022): the tests of
// pieces.cjs `cacheRows` and `entryRows` from the bench at BASELINE-4 that only read the recording, apart from the
// walk that builds the rows (caches.ts).
import type { RecNode } from "../recording.ts";
import type { Entry } from "./entries.ts";
import { near } from "./math.ts";
import type { Expr } from "./steps.ts";

/** Whether expression `e` reads path `p` itself. */
export const readsPath = (e: Expr, p: string) =>
  JSON.stringify(e).includes(`"p":${JSON.stringify(p)}`);

/**
 * OPUS4-4, the writes of bubble `p` that open: the bubble read in a later write of its own entry, its first write;
 * another bubble, all its writes when the last one is the value read (`undefined`); a total summed again in each loop
 * (`runTotal`), the run of writes that ends with the value read. null: none opens.
 */
export function bubbleWrites(
  LL: readonly Entry[],
  value: number,
  ownEntry: boolean,
  runTotal: boolean,
): readonly Entry[] | null | undefined {
  const last = LL.at(-1);
  const early = ownEntry || (LL.length > 1 && !near(last?.v, value));
  const i0 = early ? LL.findIndex((q) => near(q.v, value)) : -1;
  let only: readonly Entry[] | null | undefined = early
    ? i0 >= 0 && i0 < LL.length - 1
      ? LL.slice(i0, i0 + 1)
      : null
    : undefined;
  // a run ends where the next write is smaller
  if (!ownEntry && runTotal) {
    const ends = (i: number) =>
      i === LL.length - 1 || Number(LL[i + 1]?.v) < Number(LL[i]?.v);
    const iEnd = LL.findIndex((q, i) => near(q.v, value) && ends(i));
    let j0 = iEnd;
    while (j0 > 0 && !ends(j0 - 1)) j0--;
    only = iEnd >= 0 && iEnd > j0 ? LL.slice(j0, iEnd + 1) : null;
  }
  return only;
}

/**
 * [T3] the turn of `p`'s writes that has the value read and whose step is a product of an earlier read of the cache and
 * a call.
 */
export function factorTurn(
  LL: readonly Entry[],
  p: string,
  value: number,
): Entry | undefined {
  return LL.find((x) => {
    if (!near(x.v, value)) return false;
    const e = x.s.find((y) => near(y.v, x.v))?.e;
    if (e?.t !== "op" || e.o !== "*") return false;
    return [
      [e.l, e.r],
      [e.r, e.l],
    ].some(
      ([t, o]) =>
        t?.t === "read" &&
        t.p === p &&
        !near(t.v, x.v) &&
        o?.t === "call" &&
        near(Number(t.v) * Number(o.v), x.v),
    );
  });
}

/**
 * [DEEP-1, fix A] writer `w` is the call being built, it tested that the cache was empty before filling it, and its last
 * write of `p` is the value read.
 */
export function filledHere(
  w: RecNode,
  p: string,
  seen: ReadonlySet<number>,
  last: Entry | undefined,
  value: number,
): boolean {
  return (
    [...seen].pop() === w.id &&
    (w.r ?? []).some(
      ([rp, rv]) =>
        rv === 0 && rp === `${p.replace(/[[.][^[.]*$/, "")}.length`,
    ) &&
    typeof last?.v === "number" &&
    near(last.v, value)
  );
}

/** [R1-PATCH, A R2] the read of turn `q`, other than `p`, with the turn's value (a game table read as text is the same number). */
export const turnRead = (q: Entry, p: string, target: number) =>
  q.r.find(
    ([rp, rv]) =>
      (typeof rv === "number" ||
        (typeof rv === "string" &&
          rv.trim() !== "" &&
          Number.isFinite(Number(rv)))) &&
      near(Number(rv), target) &&
      rp !== p,
  );

/**
 * A turn that adds a function of its own to the running total `before` of `p` (step `e`): the other side of the sum,
 * when the running total is a read of `p` or a value; else null.
 */
export function addedSide(e: Expr | undefined, p: string, before: number) {
  const isBefore = (x: Expr) =>
    (x.t === "read" ? x.p === p : x.t === "val") && near(x.v, before);
  return e?.t === "op" && e.o === "+"
    ? isBefore(e.l)
      ? e.r
      : isBefore(e.r)
        ? e.l
        : null
    : null;
}
