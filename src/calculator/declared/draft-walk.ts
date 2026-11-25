// The draft's walk of a source (spec 010, research R7; moved out of draft.ts, which keeps under 400 lines): a part as the
// recording shows it, level by level, down to the leaves the recording ties, by the parts the lock asks for
// (level-parts.ts partsOf) or the opening the recording makes (level-openings.ts).
import type { RecNode } from "../recording.ts";
import type { Expr } from "../recorded/steps.ts";
import { topOf } from "./answer-key.ts";
import type { AnswerTerm } from "./answer-key.ts";
import { onlyRead } from "./cache-author.ts";
import { openingOf } from "./level-openings.ts";
import type { Opening } from "./level-openings.ts";
import { partsOf, textPart } from "./level-parts.ts";
import type { LevelContext } from "./lock-levels.ts";
import { callAt, kidOf } from "./lock-values.ts";
import {
  keyOfLeaf,
  leavesOf,
  num,
  returnOf,
  saveChild,
  termExpr,
} from "./lock-parts.ts";
import { CALL } from "./not-leaves.ts";

/** A part as the recording shows it: its reference key, its recorded call, and what is below it. */
export interface Walked {
  key: string;
  call: RecNode | null;
  below: Walked[] | "leaf" | "descend";
  /** Why the descent waits, for the guide (draft-steps.ts): never in the draft. */
  why?: string;
  /** The second source of a two-source term, and on (research R4): its system is the agent's. */
  termPart?: true;
  /** The number of its loop's turn, when another turn has the same item (T198): its key says it. */
  turn?: number;
  /** A text of the save its reader's literal was picked by (T195): a `condition` leaf. */
  condition?: true;
  /** A count (T215, count-turns.ts): a `quantity` line, its parts the items its test saw. */
  count?: true;
}

/** A part of an opened level, with the number of its turn when the opening gives one (T198). */
const withTurn = (w: Walked, o: Opening): Walked =>
  o.turn === undefined ? w : { ...w, turn: o.turn };
const DEEP = "a descida para nos 12 níveis do rascunho";
const UNRECORDED = "a chamada não tem gravação neste lugar";

// shortcut: the descent stops 12 levels down, pending `descend`; raise it when a number of the game goes deeper
const MAX_DEPTH = 12;

/**
 * A part down to its leaves; a read the recording opens (level-openings.ts: a cache's author) opens into its parts, and a
 * refused one waits for the agent's descent. `reader` is the call that read it, `expr` what gave a call's value, or the
 * read itself at its place (one only) in what its reader's level is; `from` the opening the call's level came from: the
 * cache's write it made, whose turns open it, and the steps of that turn, where its reads have their place.
 */
function walkPart(
  key: string,
  call: RecNode | null,
  ctx: LevelContext,
  depth: number,
  reader: RecNode | null = null,
  expr?: Expr | null,
  from?: Opening,
): Walked {
  if (!call) {
    const level = {
      expr:
        expr?.t === "read" ? expr : ({ t: "read", p: key, v: null } as const),
      value: null,
      steps: from?.steps,
    };
    const open = reader ? openingOf({ ...level, scope: reader }, ctx) : null;
    // a read of its reader's own working list or map (the game's PlayerHPmaxLIST) goes down through the write it saw,
    // as the lock's parts do (level-parts.ts)
    const parts =
      reader && open === null
        ? partsOf({ ...level, scope: reader }, [level.expr], ctx).filter(
            (p) => p !== key,
          )
        : [];
    if (reader && parts.length > 0)
      return depth >= MAX_DEPTH
        ? { key, call, below: "descend", why: DEEP }
        : {
            key,
            call,
            below: parts.map((p) =>
              walkPart(p, kidOf(reader, p, ctx), ctx, depth + 1, reader),
            ),
          };
    if (open === null)
      return CALL.test(key)
        ? { key, call, below: "descend", why: UNRECORDED }
        : { key, call, below: "leaf" };
    if (typeof open === "string" || depth >= MAX_DEPTH)
      return {
        key,
        call,
        below: "descend",
        why: typeof open === "string" ? open : DEEP,
      };
    return {
      key,
      call,
      below: open.map((o) => walkOpening(o, ctx, depth + 1, reader, o.expr)),
    };
  }
  const own = from?.call === call ? from : undefined;
  const level = expr === undefined ? returnOf(call, ctx) : expr;
  if (depth >= MAX_DEPTH) return { key, call, below: "descend", why: DEEP };
  // a level the recording opens (a cache's author, a builder's too: no call of this one) goes down by the opening's own
  // call and the steps of its write, never by a child of the same reference (T187); a refused one gives its reason, as
  // the lock writes it
  const at = {
    expr: level,
    scope: call,
    ...(own?.write && { write: own.write }),
    // the reads of its write's turn, at their place (T212: the chosen member's), as the lock's levelOfOpening
    ...(own?.steps && { steps: own.steps }),
  };
  const open = openingOf(at, ctx);
  if (typeof open === "string")
    return { key, call, below: "descend", why: open };
  if (Array.isArray(open))
    return {
      key,
      call,
      ...(open.some((o) => o.passed !== undefined) && { count: true as const }),
      below: open.map((o) =>
        walkOpening(
          o,
          ctx,
          depth + 1,
          call,
          o.call || o.expr !== undefined ? o.expr : onlyRead(level, o.part),
        ),
      ),
    };
  const parts = partsOf(
    { ...at, value: num(call.v) },
    level ? leavesOf(level) : [],
    ctx,
  );
  // no part the recording ties: a leaf, unless the call reads the save below it (then the agent descends)
  if (parts.length === 0) {
    const save = saveChild(call, ctx);
    return save === null
      ? { key, call, below: "leaf" }
      : {
          key,
          call,
          below: "descend",
          why: `nenhuma parte ligada pela gravação; lê o save embaixo: ${save}`,
        };
  }
  return {
    key,
    call,
    below: parts.map((p) => {
      const w = walkPart(
        p,
        kidOf(call, p, ctx),
        ctx,
        depth + 1,
        call,
        onlyRead(level, p),
        own,
      );
      return w.below === "leaf" && textPart(call, level, p, ctx)
        ? { ...w, condition: true as const }
        : w;
    }),
  };
}

/**
 * A part of an opened level, with its turn's number; a turn's item that is a count (T193, research R4) is a line by its
 * first reference, each reference a child at its place in the item, the others termPart.
 */
function walkOpening(
  o: Opening,
  ctx: LevelContext,
  depth: number,
  reader: RecNode | null,
  expr?: Expr | null,
): Walked {
  if (!o.refs)
    return withTurn(walkPart(o.part, o.call, ctx, depth, reader, expr, o), o);
  const leaves = o.expr ? leavesOf(o.expr) : [];
  const turn: Opening = {
    part: o.part,
    call: null,
    value: null,
    ...(o.steps && { steps: o.steps }),
  };
  const [first, ...rest] = o.refs.map((p) => {
    const leaf = leaves.find((l) => keyOfLeaf(l, ctx.rec) === p);
    // the call at its place in the item, else the turn's own call (what gave a pass-through's write, T188)
    const call = reader && callAt(leaves, p, reader, ctx, o.steps?.range);
    // a read has its place in the turn's steps, as the lock's line level
    return call
      ? walkPart(p, call, ctx, depth + 1, reader)
      : walkPart(p, null, ctx, depth + 1, reader, leaf, turn);
  });
  const below = [
    ...(first ? [first] : []),
    ...rest.map((p) => ({ ...p, termPart: true as const })),
  ];
  return withTurn({ key: o.part, call: first?.call ?? null, below }, o);
}

/** A source's parts: its call or read down to the leaves; a two-source term opens into each of its references. */
export function walkTerm(t: AnswerTerm, ctx: LevelContext): Walked {
  const { nodes } = ctx.rec;
  const top = topOf(ctx.rec) ?? null;
  // the term's place in the root's steps, for the place of a read among its references
  const at = top ? termExpr(t, top, ctx) : null;
  const parts = t.refs.map((r, i) => {
    const call = nodes[t.nodes[i] ?? -1] ?? null;
    return walkPart(r, call, ctx, 0, top, call ? undefined : onlyRead(at, r));
  });
  const [first, ...rest] = parts;
  if (!first) return { key: t.ref, call: null, below: "leaf" };
  if (rest.length === 0) return first;
  return {
    key: t.ref,
    call: first.call,
    below: [first, ...rest.map((p) => ({ ...p, termPart: true as const }))],
  };
}
