// The Drop Rate's first level is the V1 of the bench (spec 009, FR-005, FR-010, task T010): its four pools, in the V1
// order and with the V1 names, by a table keyed by the catalog id; any other id gets the general pools. The steps here
// have the shape of the game's TotalStats("Drop_Rarity") (bench build-v1mold.cjs reads them), with invented values,
// paths and arguments; the block names are the game's, which the system rules read. (mould.test.ts would pass 400
// lines: the V1 cases are here.)
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { firstSrc } from "./expr.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import { branch, fixed, placed } from "./tree-fixture.ts";
import { V1_POOLS, v1Level } from "./v1-pools.ts";
import type { V1Context } from "./v1-pools.ts";

const num = (v: number): Expr => ({ t: "num", v });
const val = (v: number): Expr => ({ t: "val", v });
const rd = (p: string, v: number): Expr => ({ t: "read", p, v });
const call = (id: number, v: number): Expr => ({ t: "call", id, v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
const CALLS: Readonly<Record<number, string>> = {
  1: "GetTalentNumber(1, 207)",
  2: "CardBonusREAL(10, 0)",
  3: "GetTalentNumber(1, 328)",
  4: "CardBonusREAL(11, 0)",
  5: "CardBonusREAL(12, 0)",
};
const src = (code: string, value: number): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
});
/** A term as the assembly makes it (tree/terms.ts): its source at the term's value, a number by its shape. */
const termAt: V1Context["termAt"] = (e, o) => {
  const v = Number(e.v);
  if (e.t === "num")
    return fixed(`Fixed ${o === "*" ? "×" : "+"}${String(v)}`, v);
  const s = firstSrc(e);
  if (s?.t === "call") return src(CALLS[s.id] ?? "Unknown()", v);
  if (s?.t === "read") return src(s.p, v);
  return branch(v, [fixed("Invented part", v)]);
};

// LUK curve 0.35; LUK Scaling 1.4 × 0.35 = 0.49; Additive Pool 8 + 20 + 4 + 10 = 42; Total Sum 1 + 0.49 + 42 ÷ 100 =
// 1.91; then + 2, × 1.5, + 0.3, × 1.2 and × 2 × 1.1: the Drop Rate 16.2756, Post-Processing 16.2756 ÷ 1.91.
const STEPS: Step[] = [
  { v: 3, e: rd("Stats.Invented", 3) },
  { v: 6, e: op("*", rd("DNSM.InventedA", 2), num(3), 6) },
  { v: 9, e: op("+", rd("DNSM.InventedB", 3), num(6), 9) },
  { v: 0.35, e: op("+", rd("Stats.InventedCurve", 0.053), num(0.297), 0.35) },
  {
    v: 8,
    e: op("+", call(1, 5), rd("DNSM.AlchBubbles.Invented", 3), 8),
  },
  {
    v: 1.91,
    e: op(
      "+",
      op(
        "+",
        op("*", num(1.4), val(0.35), 0.49),
        op(
          "/",
          op(
            "+",
            op(
              "+",
              op("+", rd("DNSM.DropRateLUK2", 8), call(2, 20), 28),
              call(5, 4),
              32,
            ),
            op("*", num(5), rd("Dream[10]", 2), 10),
            42,
          ),
          num(100),
          0.42,
        ),
        0.91,
      ),
      num(1),
      1.91,
    ),
  },
  {
    v: 3.91,
    e: op("+", rd("DNSM.TotStatMAP.Drop_Rarity", 1.91), num(2), 3.91),
  },
  { v: 5.865, e: op("*", val(3.91), call(3, 1.5), 5.865) },
  { v: 6.165, e: op("+", val(5.865), num(0.3), 6.165) },
  { v: 7.398, e: op("*", num(1.2), val(6.165), 7.398) },
  {
    v: 16.2756,
    e: op(
      "*",
      op("*", val(7.398), call(4, 2), 14.796),
      op(
        "+",
        num(1),
        op("/", rd("DNSM.AlchVials.Invented", 10), num(100), 0.1),
        1.1,
      ),
      16.2756,
    ),
  },
];
const ROOT = { name: "Total", value: 16.2756 };
const ctx = (steps: Step[] = STEPS): V1Context => ({
  steps,
  termAt,
  writerOf: () => undefined,
  root: ROOT,
});
const ownKids = (n: CalcTreeNode | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
/** A level as [the group's name, or the source's code or name; its value]. */
const level = (ns: readonly CalcTreeNode[]) =>
  ns.map((n) => [
    n.role === "system" ? n.name : (n.code ?? n.name),
    Number(Number(n.value).toFixed(4)),
  ]);

test("the Drop Rate's first level is the V1's four pools, in the V1 order, with the V1 names and values", () => {
  const out = v1Level("dropRate", ctx());
  const pools = placed({}, out?.rows ?? []).rows;
  expect(
    pools.map((n) => [n.name, n.role, n.pieceKey, n.poolKind, n.combine]),
  ).toEqual([
    ["LUK Scaling", "pool", null, "multi", "product"],
    ["Additive Pool", "pool", null, "additive", "sum"],
    ["Total Sum", "pool", null, "additive", null],
    ["Post-Processing", "pool", null, "multi", null],
  ]);
  expect(level(pools)).toEqual([
    ["LUK Scaling", 0.49],
    ["Additive Pool", 42],
    ["Total Sum", 1.91],
    ["Post-Processing", 8.5213],
  ]);
  // Total Sum × Post-Processing is the Drop Rate
  expect(out?.formula).toEqual([
    ["Total Sum", "×", "Post-Processing"],
    [1.91, 8.521, 16.276],
  ]);
});

test("the Additive Pool holds the bonuses of the sum, the second LUK part's terms in its place, by system in the V1 order", () => {
  const [, add] = placed({}, v1Level("dropRate", ctx())?.rows ?? []).rows;
  expect(level(ownKids(add))).toEqual([
    ["GetTalentNumber(1, 207)", 5],
    ["🃏 Cards", 24],
    ["DNSM.AlchBubbles.Invented", 3],
    ["Dream[10]", 10],
  ]);
});

test("Post-Processing keeps the chain's own steps in their places, named as the V1 names them, then the multipliers by system", () => {
  const [, , total, post] = placed(
    {},
    v1Level("dropRate", ctx())?.rows ?? [],
  ).rows;
  expect(total?.formula).toEqual([
    ["1", "+", "LUK Scaling", "+", "Additive Pool", "÷", "100"],
    [1, 0.49, 42, 100, 1.91],
  ]);
  expect(level(ownKids(post))).toEqual([
    ["Death Bringer Pack", 2],
    ["GetTalentNumber(1, 328)", 1.5],
    ["Sneaking Mastery", 0.3],
    ["Gem shop bundle", 1.2],
    ["CardBonusREAL(11, 0)", 2],
    ["DNSM.AlchVials.Invented", 1.1],
  ]);
});

test("each V1 pool has its rule's proof by reference", () => {
  expect(V1_POOLS.dropRate?.pools.map((p) => p.name)).toEqual([
    "LUK Scaling",
    "Additive Pool",
    "Total Sum",
    "Post-Processing",
  ]);
  for (const p of V1_POOLS.dropRate?.pools ?? [])
    expect(p.proof).toMatch(/build-v1mold\.cjs/);
});

test("any other id never gets the V1 pools", () => {
  expect(v1Level("hp", ctx())).toBeNull();
  expect(v1Level("toString", ctx())).toBeNull();
});

test("a Drop Rate whose steps lack the V1's shape gets no V1 pools, never a wrong tree", () => {
  expect(v1Level("dropRate", ctx(STEPS.slice(0, 5)))).toBeNull();
  expect(
    v1Level("dropRate", { ...ctx(), root: { ...ROOT, value: 20 } }),
  ).toBeNull();
});
