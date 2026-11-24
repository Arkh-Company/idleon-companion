// The arguments of a block's call the game gives from the save (spec 010, Fase 4 r1 of part N): a count of the save, as
// N.js's ArcaneType("ArcaneMapMulti", MapBon[CurrentMap][i], 0) the map's kills, or Thingies("FriendBonusQTY", …) the
// friends of OptionsListAccount[476]. Found by the code at the call's place, as `{character}` (character-args.ts): the
// argument's expression reads the save (`getGameAttribute`, a game table and a working map aside), bare, through
// `asNumber(…)`, through a variable set before it on every way there, or through a parameter of the caller its own call
// got from the save (ArcaneType's Log2(t)); never by the number. The call's sites are the caller's calls of the block
// whose numbers and texts written in the code are the recorded ones; an argument some of them give from the save and
// another does not, the place does not decide: none. The recipe writes `*` there.
import { parse } from "acorn";
import type { Op } from "../instrument.ts";
import type { RecNode, Recording } from "../recording.ts";
import { GAME_TABLE } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import {
  at,
  characterArgs,
  characterRef,
  isCharacter,
  isNode,
  member,
  walk,
} from "./character-args.ts";
import type { AnyNode } from "./character-args.ts";
import type { LevelContext } from "./lock-levels.ts";
import type { LockError } from "./lock.ts";
import { ARG_TEXT_MAX, CHARACTER, keyMatches, SAVE } from "./refs.ts";
import type { Ref } from "./refs.ts";

interface Fn {
  text: string;
  all: AnyNode[];
  params: string[];
  up: Map<AnyNode, AnyNode>;
  /** Each block's calls in the function, by the block's name. */
  sites: Map<string, AnyNode[]>;
}

function fnOf(fnText: string): Fn | null {
  const text = `(${fnText})`;
  let program: AnyNode;
  try {
    program = parse(text, { ecmaVersion: 2022, ranges: true }) as never;
  } catch {
    return null;
  }
  const all = walk(program);
  const up = new Map<AnyNode, AnyNode>();
  for (const n of all)
    for (const v of Object.values(n))
      for (const c of Array.isArray(v) ? (v as unknown[]) : [v])
        if (isNode(c)) up.set(c, n);
  const fn = all.find((n) => n.type === "FunctionExpression");
  const params = ((fn?.params ?? []) as AnyNode[]).map((p) => p.name as string);
  const sites = new Map<string, AnyNode[]>();
  for (const n of all) {
    const name = n.type === "CallExpression" ? member(at(n, "callee")) : "";
    if (!name?.startsWith("_customBlock_")) continue;
    const block = name.slice(13);
    sites.set(block, [...(sites.get(block) ?? []), n]);
  }
  return { text, all, params, up, sites };
}

// the sides of a node that run only on some ways through it
const SIDES: Readonly<Record<string, readonly string[]>> = {
  IfStatement: ["consequent", "alternate"],
  ConditionalExpression: ["consequent", "alternate"],
  LogicalExpression: ["right"],
  ForStatement: ["test", "update", "body"],
  ForInStatement: ["body"],
  WhileStatement: ["test", "body"],
  SwitchCase: ["consequent"],
};
const holds = (n: AnyNode, pos: number) =>
  n.range[0] <= pos && pos < n.range[1];

/** Whether `def` runs on every way to `pos`: each side it sits on holds `pos` too. */
function onTheWay(f: Fn, def: AnyNode, pos: number): boolean {
  for (let c = def, p = f.up.get(c); p; c = p, p = f.up.get(p)) {
    const side = (SIDES[p.type] ?? []).some((k) => {
      const v = p[k];
      return v === c || (Array.isArray(v) && v.includes(c));
    });
    if (side && !holds(c, pos)) return false;
  }
  return true;
}

/** The last value given to `name` before `pos` on every way there: its declaration or its assignment. */
function defOf(f: Fn, name: string, pos: number): AnyNode | undefined {
  let best: AnyNode | undefined;
  for (const n of f.all) {
    const set =
      n.type === "VariableDeclarator" && at(n, "id").name === name
        ? (n.init as AnyNode | null)
        : n.type === "AssignmentExpression" && at(n, "left").name === name
          ? at(n, "right")
          : null;
    if (
      set &&
      n.range[1] <= pos &&
      (!best || n.range[1] > best.range[1]) &&
      onTheWay(f, n, pos)
    )
      best = set;
  }
  return best;
}

// shortcut: the game's working maps are never the save, so a save's count the game cached there and then passed is not
// marked; tell them apart by the read's last write (RecNode.rx) when a recipe needs one.
const WORKING = /^(DNSM|DummyNumbersStatManager)$/;

/** A read of the save: `….getGameAttribute("<name>")`, no game table and no working map of the game (a loop's index). */
const readsSave = (e: AnyNode): boolean =>
  walk(e).some((n) => {
    if (
      n.type !== "CallExpression" ||
      member(at(n, "callee")) !== "getGameAttribute"
    )
      return false;
    const [k] = n.arguments as AnyNode[];
    const name = k?.type === "Literal" ? k.value : null;
    return (
      typeof name === "string" &&
      !WORKING.test(name) &&
      !GAME_TABLE.some((t) => t.test.test(name))
    );
  });

/** The variables an expression reads: no property's name. */
const namesIn = (e: AnyNode): AnyNode[] =>
  walk(e).filter((n) => {
    if (n.type !== "Identifier") return false;
    const p = walk(e).find(
      (x) => x.type === "MemberExpression" && x.property === n,
    );
    return !p || p.computed === true;
  });

function fromSave(
  e: AnyNode,
  f: Fn,
  given: () => number[],
  depth = 0,
): boolean {
  if (depth > 4 || isCharacter(e, f.text, f.all)) return false;
  if (e.type === "Identifier") {
    const name = e.name as string;
    const def = defOf(f, name, e.range[0]);
    if (def) return fromSave(def, f, given, depth + 1);
    const j = f.params.indexOf(name);
    return j >= 0 && given().includes(j);
  }
  return (
    readsSave(e) || namesIn(e).some((n) => fromSave(n, f, given, depth + 1))
  );
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

/** The positions of `n`'s arguments its caller gave from the save; none with no code of the caller. */
export function saveArgs(
  rec: Recording,
  ops: readonly Op[],
  n: RecNode,
  depth = 0,
): number[] {
  const caller = rec.nodes[n.p ?? -1];
  const f = caller ? fnIn(ops, caller.b) : null;
  const sites = (f?.sites.get(n.b) ?? []).filter((s) => fits(s, n));
  if (!caller || !f || sites.length === 0 || depth > 8) return [];
  let up: number[] | undefined;
  const given = () => (up ??= saveArgs(rec, ops, caller, depth + 1));
  return n.a.flatMap((_, i) =>
    sites.every((s) => {
      const a = (s.arguments as AnyNode[])[i];
      return a !== undefined && fromSave(a, f, given);
    })
      ? [i]
      : [],
  );
}

/** A call's reference with `{character}` and `*` where its caller gave the character's index and the save. */
export function markedRef(
  ref: Ref,
  rec: Recording,
  ops: readonly Op[],
  n: RecNode,
): Ref {
  const own = characterRef(ref, rec, ops, n);
  const marks = saveArgs(rec, ops, n);
  if (!("call" in own) || marks.length === 0) return own;
  return {
    ...own,
    args: own.args.map((a, i) =>
      marks.includes(i) && a !== CHARACTER ? SAVE : a,
    ),
  };
}

/**
 * A declared call against its place: the character's index and the save's number are never written out, and a `*`
 * stands only where the game gave the save (research R5).
 */
export function writtenArgs(
  ref: Ref | undefined,
  scope: RecNode,
  ctx: LevelContext,
): LockError[] {
  if (
    !ctx.ops ||
    !ref ||
    !("call" in ref) ||
    !keyMatches(ref, callRef(scope), ctx.character)
  )
    return [];
  const arg = (i: number) => `o argumento ${String(i + 1)} de ${ref.call}`;
  const save = saveArgs(ctx.rec, ctx.ops, scope);
  const out: LockError[] = [];
  for (const i of characterArgs(ctx.rec, ctx.ops, scope))
    if (ref.args[i] !== CHARACTER)
      out.push({ kind: "characterWritten", where: ctx.where, got: arg(i) });
  ref.args.forEach((a, i) => {
    if (save.includes(i) && a !== SAVE && a !== CHARACTER)
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
