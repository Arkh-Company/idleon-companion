// A constant with its conditions inside a call (spec 010, T209 form 3; data-model "Constante com condição dentro de uma
// chamada"; FR-018 of 009): the call writes a variable of its own with a number of the code, then multiplies it, each
// time under a condition (the game's ArcadeBonus doubles DNSM.ArcadBonDNz). The lock follows the variable write by
// write, by its recorded place: each write's step is the code's number times the variable, and the comparison the call
// made right before it is the condition that applied it. A declared constant is tied to its write by the condition, never
// by order or value; one whose condition did not apply is its neutral value, 1.
import type { Expr } from "../recorded/steps.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { writeSource } from "./cache-author.ts";
import type { Level, LevelContext, LevelOut } from "./lock-levels.ts";
import { keyOfLeaf, leafCheck, leavesOf, num } from "./lock-parts.ts";
import { keyMatches, matchRead, refKey } from "./refs.ts";

/** The constants' count: the variable's value they give, and the parts their conditions cover; null when none is due. */
export interface Constants {
  value: number | null;
  /** The variable's path. */
  path?: string;
  covered: string[];
}

const refuse = (where: string, got: string, out: LevelOut): Constants => {
  out.errors.push({ kind: "openingRefused", where, got });
  return { value: null, covered: [] };
};

/** The number of the code a write's step multiplies the variable by (`n × variable`), or null. */
function factor(e: Expr | string | null, own: string): number | null {
  if (!e || typeof e === "string" || e.t !== "op" || e.o !== "*") return null;
  const isOwn = (x: Expr) =>
    (x.t === "val" && x.own === own) || (x.t === "read" && x.p === own);
  if (e.l.t === "num" && isOwn(e.r)) return num(e.l.v);
  if (e.r.t === "num" && isOwn(e.l)) return num(e.r.v);
  return null;
}

/** The declared constants of a level, checked against the writes of the variable its count reads; null with none. */
export function lockConstants(
  declared: readonly BlueprintNode[],
  level: Level,
  leaves: readonly Expr[],
  ctx: LevelContext,
  out: LevelOut,
): Constants | null {
  const consts = declared.filter((c) => c.constant !== undefined);
  if (consts.length === 0) return null;
  // the variable: a value the steps tied to it (`own`), or its read when it held one value only
  const wrote = (p: string) =>
    ctx.rec.writes.some((w) => w.node === level.scope.id && w.path === p);
  const leaf = leaves.find(
    (l) =>
      (l.t === "val" && l.own !== undefined) || (l.t === "read" && wrote(l.p)),
  );
  const own =
    leaf?.t === "val" ? leaf.own : leaf?.t === "read" ? leaf.p : undefined;
  if (!leaf || own === undefined)
    return refuse(
      ctx.where,
      "a conta não lê uma variável da própria chamada",
      out,
    );
  const { scope } = level;
  const steps = level.steps ?? ctx.stepsOf(scope.id);
  const k = steps.steps.findIndex((s) => leavesOf(s.e).includes(leaf));
  const at = steps.stepAt?.[k] ?? Infinity;
  const writes = [...ctx.rec.writes, ...ctx.rec.spliced]
    .filter((w) => w.node === scope.id && w.path === own && w.xi <= at)
    .sort((a, b) => a.xi - b.xi);
  const [first, ...rest] = writes;
  const source = (w: (typeof writes)[number]) =>
    writeSource(ctx.rec, { node: scope, write: w }, ctx.turnOf);
  // the first write is a number of the code: no step, no read or call gave it
  if (!first || source(first) !== null)
    return refuse(
      ctx.where,
      `a primeira escrita de ${own} não é um número do código`,
      out,
    );
  let value = num(first.v);
  // each later write: its number, and the comparison right before it, since the write before
  const applied: { n: number; key: string }[] = [];
  let prev = first.xi;
  for (const w of rest) {
    const n = factor(source(w), own);
    const cmp = (scope.x ?? [])
      .slice(prev, w.xi)
      // a comparison, or the test of a ? : or an if (the first mark of its place is the test)
      .findLast(([id]) => ["cmp", "test"].includes(ctx.ops?.[id]?.kind ?? ""));
    const keys = cmp
      ? leavesOf(steps.exprOf?.(cmp[0]) ?? { t: "val", v: null }).flatMap(
          (l) => keyOfLeaf(l, ctx.rec) ?? [],
        )
      : [];
    const [key] = keys;
    if (n === null || keys.length !== 1 || key === undefined || !cmp?.[1])
      return refuse(
        ctx.where,
        `a escrita de ${own} na volta ${String(w.xi)} não é um número do código sob uma condição`,
        out,
      );
    applied.push({ n, key });
    value = value === null ? null : value * n;
    prev = w.xi;
  }
  const covered: string[] = [];
  const conditionOf = (c: BlueprintNode) =>
    (c.children ?? []).flatMap((x) => (x.ref ? [x.ref] : []));
  const covers = (ref: NonNullable<BlueprintNode["ref"]>, key: string) =>
    "call" in ref
      ? keyMatches(ref, key, ctx.character)
      : matchRead(ref.read, [key], ctx.character) !== null;
  const used = new Set<number>();
  for (const c of consts) {
    const where = `${ctx.where}/${c.key}`;
    const refs = conditionOf(c);
    for (const x of c.children ?? []) leafCheck(x, `${where}/${x.key}`, out);
    const i = applied.findIndex(
      (a, j) => !used.has(j) && refs.some((r) => covers(r, a.key)),
    );
    covered.push(...refs.map((r) => refKey(r, ctx.character)));
    // its condition did not apply: the neutral value
    if (i < 0) continue;
    used.add(i);
    const a = applied[i];
    if (a && a.n !== c.constant)
      out.errors.push({
        kind: "notClosing",
        where,
        expected: a.n,
        got: c.constant ?? Number.NaN,
      });
  }
  applied.forEach((a, j) => {
    if (!used.has(j))
      out.errors.push({
        kind: "undeclaredPart",
        where: ctx.where,
        got: `× ${String(a.n)} (${a.key})`,
      });
  });
  return { value, covered, path: own };
}
