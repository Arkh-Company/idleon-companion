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
import { refKey } from "./refs.ts";
import { refCovers } from "./lock-values.ts";

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
  // in a builder of the pass, the variable's writes are its scratch, among the spliced ones
  const wrote = (p: string) =>
    [...ctx.rec.writes, ...ctx.rec.spliced].some(
      (w) => w.node === level.scope.id && w.path === p,
    );
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
  // a comparison, or the test of a ? : or an if (the first mark of its place is the test), and the parts it read
  const isCmp = ([id]: readonly [number, unknown]) =>
    ["cmp", "test"].includes(ctx.ops?.[id]?.kind ?? "");
  const keysOf = ([id]: readonly [number, unknown]) =>
    leavesOf(steps.exprOf?.(id) ?? { t: "val", v: null }).flatMap(
      (l) => keyOfLeaf(l, ctx.rec) ?? [],
    );
  // each later write: its number, and the comparison right before it, since the write before
  const applied: { n: number; key: string }[] = [];
  const usedCmp = new Set<unknown>();
  let prev = first.xi;
  for (const w of rest) {
    const n = factor(source(w), own);
    const j = (scope.x ?? []).slice(prev, w.xi).findLastIndex(isCmp);
    const cmp = j < 0 ? undefined : scope.x?.[prev + j];
    if (cmp) usedCmp.add(cmp);
    const keys = cmp ? keysOf(cmp) : [];
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
    refCovers(ref, key, ctx.character);
  for (const c of consts)
    covered.push(...conditionOf(c).map((r) => refKey(r, ctx.character)));
  // each applied write's constant: the one its condition's reading names; two under the same reading part by the
  // code's own number at the write's place (the x2 at 101 and the x6 at 102 of ArcadeBonus), never by order
  const taken = new Set<BlueprintNode>();
  for (const a of applied) {
    const by = consts.filter(
      (c) => !taken.has(c) && conditionOf(c).some((r) => covers(r, a.key)),
    );
    const pick = by.length > 1 ? by.filter((c) => c.constant === a.n) : by;
    const [c] = pick;
    if (!c || pick.length > 1) {
      out.errors.push({
        kind: "undeclaredPart",
        where: ctx.where,
        got: `× ${String(a.n)} (${a.key})`,
      });
      continue;
    }
    taken.add(c);
    if (a.n !== c.constant)
      out.errors.push({
        kind: "notClosing",
        where: `${ctx.where}/${c.key}`,
        expected: a.n,
        got: c.constant ?? Number.NaN,
      });
    // only a constant its write checked counts its conditions as passed
    else
      for (const x of c.children ?? [])
        leafCheck(x, `${ctx.where}/${c.key}/${x.key}`, out);
  }
  // a constant no write took: each condition is read in the level, off up to the count, the neutral value; it counts
  // nothing as passed, its number has no write to check it by
  const cmps = (scope.x ?? []).slice(0, at === Infinity ? undefined : at + 1);
  for (const c of consts.filter((x) => !taken.has(x)))
    for (const x of c.children ?? []) {
      if (!x.ref) continue;
      const ref = x.ref;
      const seen = cmps.filter(
        (e) => isCmp(e) && keysOf(e).some((k) => covers(ref, k)),
      );
      // a comparison that applied another constant's write is that one's; the reading is still in the level
      const on = seen.find((e) => !usedCmp.has(e) && !!e[1]);
      if (seen.length === 0 || on)
        out.errors.push({
          kind: "conditionMismatch",
          where: `${ctx.where}/${c.key}/${x.key}`,
          expected: "off",
          ...(on ? { got: num(on[1]) ?? 1 } : {}),
        });
    }
  return { value, covered, path: own };
}
