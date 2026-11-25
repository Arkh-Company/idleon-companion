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
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import { GAME_TABLE } from "../recorded/steps.ts";
import { atCap } from "./answer-key-pool.ts";
import { ranSites } from "./call-site.ts";
import { defOf, fnOf } from "./code-fn.ts";
import type { Fn } from "./code-fn.ts";
import { at, isCharacter, member, walk } from "./character-args.ts";
import type { AnyNode } from "./character-args.ts";
import { ARG_TEXT_MAX, CHARACTER, SAVE } from "./refs.ts";
import type { Ref } from "./refs.ts";
import { writeSpan } from "./write-rhs.ts";

// a working map of the game holds a loop's index as well as a save's count cached there: the place does not decide
const WORKING = /^(DNSM|DummyNumbersStatManager)$/;

/** Whether an expression is a mark's, a mark's in a way the place does not decide, or not. */
type Says = "yes" | "unsure" | "no";
const worst = (all: readonly Says[]): Says =>
  all.includes("yes") ? "yes" : all.includes("unsure") ? "unsure" : "no";

/** Where a call's argument was read: its caller's recording, the ops and the steps the caller had run when it began. */
interface Place {
  rec: Recording;
  ops: readonly Op[];
  caller: RecNode;
  pos: number;
}

/**
 * A read of the save, `….getGameAttribute("<name>")` with no game table; of a working map, what the call's own writes
 * of that key there gave (group 5 of part P, as T188: a table, a number of the code or a loop's index is no save's), and
 * unsure when the call wrote it nowhere, its writes read a parameter, or the key is the one being followed.
 */
function readsSave(e: AnyNode, f?: Fn, place?: Place): Says {
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
    if (!WORKING.test(name)) return ["yes"];
    return [f ? workingSays(n, f, name, place) : "unsure"];
  });
  return worst(says1);
}

/** The caller's own write of `map.key` the call's read saw, by its recorded number; undefined unrecorded or another's. */
function ownWrite(place: Place, path: string): RecWrite | undefined {
  const of = (p: string) =>
    p === path || p.startsWith(`${path}[`) || p.startsWith(`${path}.`);
  const rx = place.caller.rx ?? [];
  // a log the cap cut at the call's place or before it may have lost the read right before the call
  if (atCap(place.caller) && (rx.at(-1)?.[2] ?? -1) <= place.pos)
    return undefined;
  const read = rx.filter(([p, , xi]) => of(p) && xi <= place.pos).at(-1);
  const seen = read?.[3] ?? read?.[4];
  if (seen === undefined) return undefined;
  // the builders' pass writes its scratch among the spliced ones (recorder-pass.js): the last by number of both
  const w = [...place.rec.writes, ...place.rec.spliced]
    .filter((x) => of(x.path) && x.seq <= seen)
    .reduce<RecWrite | undefined>(
      (a, x) => (a && a.seq > x.seq ? a : x),
      undefined,
    );
  return w?.node === place.caller.id ? w : undefined;
}

const following = new Set<string>();
/**
 * What the call's own write of a working map's key the read saw gave (`X.h.KEY = …`, `X.h.KEY[…] = …`, `….push(…)`), by
 * the recorded write (r2 of parts P and Q): the set at that write's place in the caller's step log (write-rhs.ts), the
 * k-th in the text for the k-th write of one path at one step. Another block's write, none recorded, or a place that
 * does not give one set, is unsure: never the text's order.
 */
function workingSays(get: AnyNode, f: Fn, map: string, place?: Place): Says {
  const h = f.up.get(get);
  const keyed = h ? f.up.get(h) : undefined;
  const key =
    keyed?.type === "MemberExpression" ? at(keyed, "property").name : undefined;
  if (typeof key !== "string" || following.has(key) || !place) return "unsure";
  const isKey = (m: AnyNode | undefined): boolean =>
    m?.type === "MemberExpression" &&
    (at(m, "property").name === key ||
      isKey(m.computed ? at(m, "object") : undefined));
  const w = ownWrite(place, `${map}.${key}`);
  const span = w ? writeSpan(place.caller, w, place.ops) : null;
  if (!w || !span || `(${span.text})` !== f.text) return "unsure";
  const sets = f.all
    .filter(
      (n) =>
        ((n.type === "AssignmentExpression" && isKey(at(n, "left"))) ||
          (n.type === "CallExpression" &&
            member(at(n, "callee")) === "push" &&
            isKey(at(at(n, "callee"), "object")))) &&
        n.range[1] >= span.from &&
        n.range[1] <= span.to,
    )
    .sort((a, b) => a.range[1] - b.range[1]);
  // no step ran between the writes of one path at one step: the k-th write is the k-th set in the text
  const same = [...place.rec.writes, ...place.rec.spliced]
    .filter((x) => x.node === w.node && x.xi === w.xi && x.path === w.path)
    .sort((a, b) => a.seq - b.seq);
  const set = sets.length === same.length ? sets[same.indexOf(w)] : undefined;
  if (!set) return "unsure";
  const given =
    set.type === "CallExpression"
      ? (set.arguments as AnyNode[])
      : [at(set, "right")];
  const params = (x: AnyNode) =>
    namesIn(x).some((i) => f.params.includes(i.name as string));
  following.add(key);
  try {
    const all = new Set(
      given.map((x) =>
        params(x)
          ? "unsure"
          : says(x, f, SAVE_MARK, () => ({ yes: [], unsure: [] }), 1),
      ),
    );
    const [one] = all;
    return all.size === 1 && one ? one : "unsure";
  } finally {
    following.delete(key);
  }
}

interface Mark {
  /** The predicate: the expression itself is the mark's. */
  is: (e: AnyNode, f: Fn, place?: Place) => Says;
  /** Whether an expression that reads it anywhere is the mark's too: any value from the save is `*`, the index only itself. */
  inside: boolean;
}
const CHARACTER_MARK: Mark = {
  is: (e, f) => (isCharacter(e, f.text) ? "yes" : "no"),
  inside: false,
};
const SAVE_MARK: Mark = {
  is: (e, f, place) => readsSave(e, f, place),
  inside: true,
};

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
  place?: Place,
): Says {
  if (depth > 4) return "no";
  // the character's index is never the save's
  if (mark !== CHARACTER_MARK && isCharacter(e, f.text)) return "no";
  const own = mark.is(e, f, place);
  if (own === "yes") return own;
  if (e.type === "Identifier") {
    const name = e.name as string;
    const def = defOf(f, name, e.range[0]);
    if (def) return says(def, f, mark, given, depth + 1, place);
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
  return worst([
    own,
    ...subs.map((n) => says(n, f, mark, given, depth + 1, place)),
  ]);
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
  const place: Place = { rec, ops, caller, pos: n.pxi };
  let up: Marks | undefined;
  const given = () => (up ??= marksOf(rec, ops, caller, mark, depth + 1));
  n.a.forEach((_, i) => {
    const all = new Set(
      sites.map((s) => {
        const a = (s.arguments as AnyNode[])[i];
        return a === undefined ? "no" : says(a, f, mark, given, 0, place);
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
