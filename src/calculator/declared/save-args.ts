// The arguments of a block's call the game gives from the save (spec 010, Fase 4 r1 of part N): a count of the save, as
// N.js's ArcaneType("ArcaneMapMulti", MapBon[CurrentMap][i], 0) the map's kills, or Thingies("FriendBonusQTY", …) the
// friends of OptionsListAccount[476]. Found by the code at the call's place, by one walk with `{character}`
// (character-args.ts, the character's own form as the other predicate): the argument's expression reads the save
// (`getGameAttribute`, a game table aside), bare, through `asNumber(…)`, through a variable set before it on every way
// there, or through a parameter of the caller its own call got from the save (ArcaneType's Log2(t)); never by the
// number. The call's sites are the caller's calls of the block whose numbers and texts written in the code are the
// recorded ones. An argument some of them give from the save and another does not, or read from a working map of the
// game (r2: a loop's index or a save's count cached there), the place does not decide: the lock refuses what the
// recipe writes there, and the draft's name waits. The recipe writes `*` where the save gave it.
import type { Op } from "../instrument.ts";
import type { RecNode, Recording } from "../recording.ts";
import { GAME_TABLE } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import { ranSites } from "./call-site.ts";
import { defOf, fnOf, onTheWay } from "./code-fn.ts";
import type { Fn } from "./code-fn.ts";
import { at, isCharacter, member, walk } from "./character-args.ts";
import type { AnyNode } from "./character-args.ts";
import type { LevelContext } from "./lock-levels.ts";
import type { LockError } from "./lock.ts";
import { ARG_TEXT_MAX, CHARACTER, keyMatches, SAVE } from "./refs.ts";
import type { Ref } from "./refs.ts";

// a working map of the game holds a loop's index as well as a save's count cached there: the place does not decide
const WORKING = /^(DNSM|DummyNumbersStatManager)$/;

/** Whether an expression is a mark's, a mark's in a way the place does not decide, or not. */
type Says = "yes" | "unsure" | "no";
const worst = (all: readonly Says[]): Says =>
  all.includes("yes") ? "yes" : all.includes("unsure") ? "unsure" : "no";

/**
 * A read of the save, `….getGameAttribute("<name>")` with no game table; of a working map, what the call's own writes
 * of that key there gave (group 5 of part P, as T188: a table, a number of the code or a loop's index is no save's), and
 * unsure when the call wrote it nowhere, its writes read a parameter, or the key is the one being followed.
 */
function readsSave(e: AnyNode, f?: Fn): Says {
  const says1 = walk(e).flatMap((n): Says[] => {
    if (
      n.type !== "CallExpression" ||
      member(at(n, "callee")) !== "getGameAttribute"
    )
      return [];
    const [k] = n.arguments as AnyNode[];
    const name = k?.type === "Literal" ? k.value : null;
    if (typeof name !== "string" || GAME_TABLE.some((t) => t.test.test(name)))
      return [];
    return [WORKING.test(name) ? (f ? workingSays(n, f) : "unsure") : "yes"];
  });
  return worst(says1);
}

const following = new Set<string>();
/** What the call's own write of a working map's key the read saw gave (`X.h.KEY = …`, `X.h.KEY[…] = …`, `….push(…)`). */
function workingSays(get: AnyNode, f: Fn): Says {
  const h = f.up.get(get);
  const keyed = h ? f.up.get(h) : undefined;
  const key =
    keyed?.type === "MemberExpression" ? at(keyed, "property").name : undefined;
  if (typeof key !== "string" || following.has(key)) return "unsure";
  const isKey = (m: AnyNode | undefined): boolean =>
    m?.type === "MemberExpression" &&
    (at(m, "property").name === key ||
      isKey(m.computed ? at(m, "object") : undefined));
  // the write the read saw by its place: the last set of the key before it on every way there, and the pushes after it
  const pos = get.range[0];
  const before = (n: AnyNode) => n.range[1] <= pos && onTheWay(f, n, pos);
  const last = f.all
    .filter(
      (n) =>
        n.type === "AssignmentExpression" && isKey(at(n, "left")) && before(n),
    )
    .reduce<AnyNode | undefined>(
      (a, n) => (a && a.range[1] > n.range[1] ? a : n),
      undefined,
    );
  const pushed = (n: AnyNode) =>
    n.type === "CallExpression" &&
    member(at(n, "callee")) === "push" &&
    isKey(at(at(n, "callee"), "object")) &&
    n.range[1] <= pos &&
    (!last || n.range[0] > last.range[1]);
  // with no set on every way (one inside a loop that ran before), each set before it: they all have to agree
  const sets = last
    ? [last]
    : f.all.filter(
        (n) =>
          n.type === "AssignmentExpression" &&
          isKey(at(n, "left")) &&
          n.range[1] <= pos,
      );
  const given = [
    ...sets.map((n) => at(n, "right")),
    ...f.all.flatMap((n) => (pushed(n) ? (n.arguments as AnyNode[]) : [])),
  ];
  if (given.length === 0) return "unsure";
  const params = (x: AnyNode) =>
    namesIn(x).some((i) => f.params.includes(i.name as string));
  following.add(key);
  try {
    return worst(
      given.map((x) =>
        params(x)
          ? "unsure"
          : says(x, f, SAVE_MARK, () => ({ yes: [], unsure: [] }), 1),
      ),
    );
  } finally {
    following.delete(key);
  }
}

interface Mark {
  /** The predicate: the expression itself is the mark's. */
  is: (e: AnyNode, f: Fn) => Says;
  /** Whether an expression that reads it anywhere is the mark's too: any value from the save is `*`, the index only itself. */
  inside: boolean;
}
const CHARACTER_MARK: Mark = {
  is: (e, f) => (isCharacter(e, f.text) ? "yes" : "no"),
  inside: false,
};
const SAVE_MARK: Mark = { is: (e, f) => readsSave(e, f), inside: true };

/** The variables an expression reads: no property's name. */
const namesIn = (e: AnyNode): AnyNode[] =>
  walk(e).filter((n) => {
    if (n.type !== "Identifier") return false;
    const p = walk(e).find(
      (x) => x.type === "MemberExpression" && x.property === n,
    );
    return !p || p.computed === true;
  });

/** An argument's expression for a mark: itself, a variable set before it, or the caller's parameter its call got. */
function says(
  e: AnyNode,
  f: Fn,
  mark: Mark,
  given: () => Marks,
  depth = 0,
): Says {
  if (depth > 4) return "no";
  // the character's index is never the save's
  if (mark !== CHARACTER_MARK && isCharacter(e, f.text)) return "no";
  const own = mark.is(e, f);
  if (own === "yes") return own;
  if (e.type === "Identifier") {
    const name = e.name as string;
    const def = defOf(f, name, e.range[0]);
    if (def) return says(def, f, mark, given, depth + 1);
    const j = f.params.indexOf(name);
    if (j < 0) return "no";
    const { yes, unsure } = given();
    return yes.includes(j) ? "yes" : unsure.includes(j) ? "unsure" : "no";
  }
  const inner =
    e.type === "CallExpression" && member(at(e, "callee")) === "asNumber"
      ? (e.arguments as AnyNode[]).slice(0, 1)
      : [];
  const subs = mark.inside ? namesIn(e) : inner;
  return worst([own, ...subs.map((n) => says(n, f, mark, given, depth + 1))]);
}

/** A literal of the code: a number (a negative one too) or a text. */
function literal(a: AnyNode): { v: unknown } | null {
  if (a.type === "Literal") return { v: a.value };
  if (
    a.type === "UnaryExpression" &&
    a.operator === "-" &&
    at(a, "argument").type === "Literal"
  )
    return { v: -(at(a, "argument").value as number) };
  return null;
}

/** A site of the call: its numbers and texts written in the code are the recorded ones (a text cut as recorder.js does). */
const fits = (site: AnyNode, n: RecNode): boolean => {
  const args = site.arguments as AnyNode[];
  return (
    args.length === n.a.length &&
    args.every((a, i) => {
      const l = literal(a);
      const v = typeof l?.v === "string" ? l.v.slice(0, ARG_TEXT_MAX) : l?.v;
      return l === null || v === n.a[i];
    })
  );
};

const memo = new WeakMap<readonly Op[], Map<string, Fn | null>>();
function fnIn(ops: readonly Op[], block: string): Fn | null {
  let fns = memo.get(ops);
  if (!fns) memo.set(ops, (fns = new Map<string, Fn | null>()));
  if (!fns.has(block))
    fns.set(block, fnOf(ops.find((o) => o.block === block)?.fnText ?? ""));
  return fns.get(block) ?? null;
}

/** The positions of a call's arguments that are a mark's, and those the place does not decide. */
interface Marks {
  yes: number[];
  unsure: number[];
}

/** `n`'s arguments for a mark, by every site of its call in the caller; none with no code of the caller. */
function marksOf(
  rec: Recording,
  ops: readonly Op[],
  n: RecNode,
  mark: Mark,
  depth = 0,
): Marks {
  const out: Marks = { yes: [], unsure: [] };
  const caller = rec.nodes[n.p ?? -1];
  const f = caller ? fnIn(ops, caller.b) : null;
  const fit = (f?.sites.get(n.b) ?? []).filter((s) => fits(s, n));
  // the sites on the sides its caller recorded as taken when the call began (call-site.ts): the recorded place decides
  const sites = caller && f ? ranSites(fit, f.up, caller, ops, n) : fit;
  if (!caller || !f || sites.length === 0 || depth > 8) return out;
  let up: Marks | undefined;
  const given = () => (up ??= marksOf(rec, ops, caller, mark, depth + 1));
  n.a.forEach((_, i) => {
    const all = new Set(
      sites.map((s) => {
        const a = (s.arguments as AnyNode[])[i];
        return a === undefined ? "no" : says(a, f, mark, given);
      }),
    );
    if (all.size > 1 || all.has("unsure")) out.unsure.push(i);
    else if (all.has("yes")) out.yes.push(i);
  });
  return out;
}

/** The positions of `n`'s arguments its caller gave from the character's index, and those the place does not decide. */
export const characterArgs = (
  rec: Recording,
  ops: readonly Op[],
  n: RecNode,
): Marks => marksOf(rec, ops, n, CHARACTER_MARK);

/** The positions of `n`'s arguments its caller gave from the save, and those the place does not decide. */
export function saveArgs(
  rec: Recording,
  ops: readonly Op[],
  n: RecNode,
): { save: number[]; unsure: number[] } {
  const { yes, unsure } = marksOf(rec, ops, n, SAVE_MARK);
  return { save: yes, unsure };
}

/** A call's reference with `{character}` and `*` where its caller gave the character's index and the save. */
export function markedRef(
  ref: Ref,
  rec: Recording,
  ops: readonly Op[],
  n: RecNode,
): Ref {
  if (!("call" in ref)) return ref;
  const character = characterArgs(rec, ops, n).yes;
  const { save } = saveArgs(rec, ops, n);
  if (character.length + save.length === 0) return ref;
  return {
    ...ref,
    args: ref.args.map((a, i) =>
      character.includes(i) ? CHARACTER : save.includes(i) ? SAVE : a,
    ),
  };
}

/** Whether a call's name waits: an argument from the character or the save, or one its place does not decide. */
export const unnamed = (
  ref: Ref,
  rec: Recording,
  ops: readonly Op[],
  n: RecNode,
): boolean =>
  markedRef(ref, rec, ops, n) !== ref ||
  [saveArgs(rec, ops, n), characterArgs(rec, ops, n)].some(
    (m) => m.unsure.length > 0,
  );

/**
 * A declared call against its place: the character's index and the save's number are never written out, and a `*`
 * stands only where the game gave the save (research R5).
 */
export function writtenArgs(
  ref: Ref | undefined,
  scope: RecNode,
  ctx: LevelContext,
  /** A call list's item's argument (T205): its turn's, no mark to check. */
  skip?: number,
): LockError[] {
  if (
    !ctx.ops ||
    !ref ||
    !("call" in ref) ||
    !keyMatches(ref, callRef(scope), ctx.character)
  )
    return [];
  const arg = (i: number) => `o argumento ${String(i + 1)} de ${ref.call}`;
  const { save, unsure } = saveArgs(ctx.rec, ctx.ops, scope);
  const { yes: character, unsure: unsureCharacter } = characterArgs(
    ctx.rec,
    ctx.ops,
    scope,
  );
  const out: LockError[] = [];
  const undecided = (i: number, from: string) =>
    out.push({
      kind: "rootForm",
      where: ctx.where,
      got: `o lugar não decide se ${arg(i)} vem do ${from}`,
    });
  ref.args.forEach((a, i) => {
    if (i === skip) return;
    // what the recipe writes where the place does not decide is refused, `{character}` too, before any other check
    if (unsureCharacter.includes(i)) undecided(i, "personagem");
    else if (unsure.includes(i)) undecided(i, "save");
    else if (character.includes(i)) {
      if (a !== CHARACTER)
        out.push({ kind: "characterWritten", where: ctx.where, got: arg(i) });
    } else if (a === CHARACTER)
      out.push({
        kind: "rootForm",
        where: ctx.where,
        got: `${arg(i)} não vem do personagem`,
      });
    else if (save.includes(i) && a !== SAVE)
      out.push({ kind: "saveWritten", where: ctx.where, got: arg(i) });
    else if (a === SAVE && !save.includes(i))
      out.push({
        kind: "rootForm",
        where: ctx.where,
        got: `${arg(i)} está no código, não vem do save: a receita escreve o número`,
      });
  });
  return out;
}
