// The passages of the answer key (spec 010, research R9; CODING_STANDARDS, "The answer key ties by the recorded place"):
// a path the root wrote and read back is tied to the write that the read feeding the step being explained saw, by that
// read's place in the root's step log, and that write to what gave it, by the write's place. When the place does not
// decide, the root is refused with the reason, never settled by value or by order.
import type { RecNode } from "../recording.ts";
import type { Expr, Step } from "../recorded/steps.ts";
import { atCap, callRef, near, OutOfRule } from "./answer-key-pool.ts";

/** A write of a passage: its value, its place in the root's step log and its number. */
export interface PassageWrite {
  v: number;
  xi: number;
  seq: number;
}

/**
 * The writes of a path that the read feeding a step saw: the last read of the path in the root's step log (rx) at or
 * before the step's place, and the last write up to the number of the write it saw (`seq`). A log at the cap with the
 * step at or after its cut: a read after the cut is not in it, so also the last write up to the cut's `seq` and any
 * later one. A path with no logged read: by its first read (r), or all its writes when the root never read it back.
 * Null when the step has no place or no logged read of the path comes before it: the read is not found by its place.
 */
export function readBack(
  top: RecNode,
  own: readonly PassageWrite[],
  p: string,
  place: number | undefined,
): readonly PassageWrite[] | null {
  const rx = top.rx ?? [];
  const logged = rx.filter(([q]) => q === p);
  const saw = (seqs: readonly (number | undefined)[]) => {
    const got = new Set(
      seqs.flatMap((n) =>
        n === undefined ? [] : (own.findLast((w) => w.seq <= n) ?? []),
      ),
    );
    return own.filter((w) => got.has(w));
  };
  const last =
    place === undefined ? undefined : logged.findLast(([, , x]) => x <= place);
  if (
    atCap(top) &&
    (place === undefined || place >= Math.max(...rx.map(([, , x]) => x)))
  ) {
    const cut = Math.max(0, ...rx.map(([, , , n]) => n ?? 0));
    const kept = saw([cut, last?.[3]]);
    return own.filter((w) => w.seq > cut || kept.includes(w));
  }
  if (logged.length === 0) {
    const first = saw(
      (top.r ?? []).map(([q, , n]) => (q === p ? n : undefined)),
    );
    return first.length > 0 ? first : own;
  }
  return last ? saw([last[3]]) : null;
}

export interface PassageContext {
  nodes: readonly RecNode[];
  steps: readonly Step[];
  /** The root's call: its step log (rx) and first reads (r) tell which write each read saw. */
  top: RecNode;
  /** The root's child calls. */
  kids: readonly RecNode[];
  /** Paths the root wrote and may read back, with each of their writes. */
  passage: ReadonlyMap<string, readonly PassageWrite[]>;
  /** Where each step was last recorded in the root's step log (BlockSteps.stepAt), to tell which step gave a write. */
  stepAt: readonly number[];
}
export interface Giver {
  e: Expr;
  step: number | null;
}

/** The child calls a step holds in its expression: their value went into that step, never straight to a write. */
const callsIn = (e: Expr): number[] =>
  e.t === "call"
    ? [e.id]
    : e.t === "op"
      ? [...callsIn(e.l), ...callsIn(e.r)]
      : e.t === "fn"
        ? e.args.flatMap(callsIn)
        : e.t === "def"
          ? callsIn(e.e)
          : e.t === "not"
            ? callsIn(e.a)
            : [];

/** The expression that gave a passage's value, read from the root's recording only. */
export function passageReader(ctx: PassageContext) {
  const inSteps = new Set(ctx.steps.flatMap((s) => callsIn(s.e)));
  const nameOf = (g: Giver): string => {
    if (g.step !== null) return `passo ${String(g.step)}`;
    const n = g.e.t === "call" ? ctx.nodes[g.e.id] : undefined;
    return n ? callRef(n) : "?";
  };
  /**
   * What gave a write, by its place (like matchChain): the step with its value recorded last before it, and the child
   * call with its value outside any step (a call the root wrote with `=` makes no step) that started last after that
   * step and before the write. More than one of them: the place does not decide.
   */
  function giversOf(path: string, w: PassageWrite): Giver[] {
    const steps = ctx.steps.flatMap((s, j) => {
      const at = ctx.stepAt[j] ?? -1;
      return at < w.xi && near(s.v, w.v) ? [{ at, j, e: s.e }] : [];
    });
    const lastStep = Math.max(...steps.map((s) => s.at));
    const fits = (n: RecNode) =>
      n.pxi > lastStep && n.pxi <= w.xi && near(n.v, w.v);
    const kids = ctx.kids.filter((n) => !inSteps.has(n.id) && fits(n));
    // a call written with `=` and then used in a later step: it gave the write too
    if (steps.length + kids.length === 0 && ctx.kids.some(fits)) {
      const calls = ctx.kids.filter(fits).map((n) => {
        const j = ctx.steps.findIndex((s) => callsIn(s.e).includes(n.id));
        return `${path} seq ${String(w.seq)} ← ${callRef(n)}, que entra no passo ${String(j)}`;
      });
      throw new OutOfRule(
        `a passagem ${String(w.v)} vem de uma chamada filha que também entra num passo (${calls.join("; ")}), e a posição não decide entre elas`,
      );
    }
    const lastKid = Math.max(...kids.map((n) => n.pxi));
    return [
      ...steps
        .filter((s) => s.at === lastStep)
        .map((s) => ({ e: s.e, step: s.j })),
      ...kids
        .filter((n) => n.pxi === lastKid)
        .map((n): Giver => ({
          e: { t: "call", id: n.id, v: w.v },
          step: null,
        })),
    ];
  }

  /**
   * The expression that gave a passage's value, with the path it crossed: what gave the write that the read feeding
   * the step being explained (the last one opened in `seen`) saw, by that read's place; null when it is a step already
   * opened on this way down. A value with no name (`read` false) is held by any of `paths`: one whose read is not
   * found by its place did not give it.
   */
  return function passageExpr(
    paths: readonly string[],
    v: number,
    seen: ReadonlySet<number>,
    read: boolean,
  ): (Giver & { path: string }) | null {
    const step = [...seen].filter((s) => s >= 0).at(-1);
    const place = step === undefined ? undefined : ctx.stepAt[step];
    const found = new Map<string, Giver & { path: string }>();
    const from: string[] = [];
    let placed = false;
    for (const path of paths) {
      const ws = readBack(ctx.top, ctx.passage.get(path) ?? [], path, place);
      if (ws === null) continue;
      placed = true;
      for (const w of ws)
        if (near(w.v, v)) {
          for (const g of giversOf(path, w)) {
            found.set(JSON.stringify([g.step, g.e]), { ...g, path });
            from.push(`${path} seq ${String(w.seq)} ← ${nameOf(g)}`);
          }
        }
    }
    if (read && !placed)
      throw new OutOfRule(
        `a leitura de ${paths.join(", ")} que alimenta o passo ${String(step)} não está no log até o lugar dele, e a posição não decide entre elas`,
      );
    if (found.size > 1)
      throw new OutOfRule(
        `a passagem ${String(v)} sai de mais de uma escrita (${from.join("; ")}), e a posição não decide entre elas${atCap(ctx.top) ? " (o log da chamada chegou ao limite)" : ""}`,
      );
    const [g] = found.values();
    return g && (g.step === null || !seen.has(g.step)) ? g : null;
  };
}
