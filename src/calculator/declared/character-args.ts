// The arguments of a block's call the game gives from the character's index (spec 010, research R5; Fase 4 r1): the
// game passes the current character as `GetPlayersUsernames.indexOf(UserInfo[0])` (N.js: its Divinity("Bonus_Minor",
// …, god) in TotalStats, SkillStats, RunCodeOfTypeXforThingY and others). Found by the code at the call's place, in
// the caller's function text (instrument.ts Op.fnText), never by a number equal to the character's index. An argument
// some call of the caller gives from the character and another does not, the place does not decide: none.
import { parse } from "acorn";
import type { Op } from "../instrument.ts";
import type { RecNode, Recording } from "../recording.ts";
import { CHARACTER } from "./refs.ts";
import type { Ref } from "./refs.ts";

type AnyNode = { type: string; range: [number, number] } & Record<
  string,
  unknown
>;

const isNode = (v: unknown): v is AnyNode =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { type?: unknown }).type === "string";
const at = (n: AnyNode, k: string) => n[k] as AnyNode;

function walk(n: AnyNode, out: AnyNode[] = []): AnyNode[] {
  out.push(n);
  for (const v of Object.values(n))
    for (const c of Array.isArray(v) ? (v as unknown[]) : [v])
      if (isNode(c)) walk(c, out);
  return out;
}

const member = (n: AnyNode | undefined): string | undefined =>
  n?.type === "MemberExpression" && !n.computed
    ? (at(n, "property").name as string)
    : undefined;

/** The last value given to the variable `name` before `pos`: its declaration or its assignment. */
function defOf(all: readonly AnyNode[], name: string, pos: number) {
  let best: AnyNode | undefined;
  for (const n of all) {
    const set =
      n.type === "VariableDeclarator" && at(n, "id").name === name
        ? (n.init as AnyNode | null)
        : n.type === "AssignmentExpression" &&
            n.operator === "=" &&
            at(n, "left").name === name
          ? at(n, "right")
          : null;
    if (set && n.range[1] <= pos && (!best || n.range[1] > best.range[1]))
      best = set;
  }
  return best;
}

/** `GetPlayersUsernames.indexOf(UserInfo[0])`, bare, through `asNumber(…)` or through a variable. */
function isCharacter(
  e: AnyNode | undefined,
  text: string,
  all: readonly AnyNode[],
  depth = 0,
): boolean {
  if (!e || depth > 4) return false;
  if (e.type === "Identifier")
    return isCharacter(
      defOf(all, e.name as string, e.range[0]),
      text,
      all,
      depth + 1,
    );
  if (e.type !== "CallExpression") return false;
  const callee = at(e, "callee");
  const [arg] = e.arguments as AnyNode[];
  if (member(callee) === "asNumber")
    return isCharacter(arg, text, all, depth + 1);
  const src = (n: AnyNode) => text.slice(...n.range);
  return (
    member(callee) === "indexOf" &&
    src(at(callee, "object")).includes("GetPlayersUsernames") &&
    arg?.type === "MemberExpression" &&
    arg.computed === true &&
    at(arg, "property").value === 0 &&
    src(at(arg, "object")).includes("UserInfo")
  );
}

/** For each block a caller calls, the argument positions every call of it there gives from the character. */
function sitesOf(fnText: string): Map<string, number[]> {
  const text = `(${fnText})`;
  let program: AnyNode;
  try {
    program = parse(text, { ecmaVersion: 2022, ranges: true }) as never;
  } catch {
    return new Map();
  }
  const all = walk(program);
  const seen = new Map<string, Map<number, boolean>>();
  for (const n of all) {
    const name = n.type === "CallExpression" ? member(at(n, "callee")) : "";
    if (!name?.startsWith("_customBlock_")) continue;
    const block = name.slice(13);
    const marks = seen.get(block) ?? new Map<number, boolean>();
    (n.arguments as AnyNode[]).forEach((a, i) => {
      marks.set(i, (marks.get(i) ?? true) && isCharacter(a, text, all));
    });
    seen.set(block, marks);
  }
  return new Map(
    [...seen].map(([b, m]) => [b, [...m].flatMap(([i, c]) => (c ? [i] : []))]),
  );
}

/** Each caller's sites, by its block name, parsed once per game's code. */
const memo = new WeakMap<
  readonly Op[],
  (caller: string) => Map<string, number[]>
>();
function sitesIn(ops: readonly Op[]) {
  const known = memo.get(ops);
  if (known) return known;
  const texts = new Map<string, string>();
  for (const o of ops) if (!texts.has(o.block)) texts.set(o.block, o.fnText);
  const sites = new Map<string, Map<string, number[]>>();
  const of = (caller: string) => {
    let s = sites.get(caller);
    if (!s) sites.set(caller, (s = sitesOf(texts.get(caller) ?? "")));
    return s;
  };
  memo.set(ops, of);
  return of;
}

/** The positions of `n`'s arguments its caller gave from the character's index; none with no code of the caller. */
export const characterArgs = (
  rec: Recording,
  ops: readonly Op[],
  n: RecNode,
): number[] => sitesIn(ops)(rec.nodes[n.p ?? -1]?.b ?? "").get(n.b) ?? [];

/** A call's reference with `{character}` at each argument its caller gave from the character's index. */
export function characterRef(
  ref: Ref,
  rec: Recording,
  ops: readonly Op[],
  n: RecNode,
): Ref {
  const marks = characterArgs(rec, ops, n);
  if (!("call" in ref) || marks.length === 0) return ref;
  const args = ref.args.map((a, i) => (marks.includes(i) ? CHARACTER : a));
  return { ...ref, args };
}
