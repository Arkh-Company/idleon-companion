// pieces.cjs `pommelionPass` from the bench at BASELINE-4 (spec 008, T023): the Pommelion Seed (exotic seed 59) is its
// max bonus × its level factor, and the factor is Level ÷ (Base + Level), the code's constant as a number (approved
// 11/11). It runs when the seed's row gets its place, over the level built under it, before structurePass, as the bench
// runs it (tree/parent-passes.ts). Left out, a deviation (research R14): a factor whose rows open later (the bench's
// factor is a branch of the seed's expression, built with its rows).
import type { Level } from "./places.ts";
import { withName } from "./row-checks.ts";
import type { Row } from "./rows.ts";
import { tagOf } from "./tags.ts";

/** The rule, with what it tests. */
export const POMMELION = {
  test: "Pommelion Seed",
  tag: "Exotic 59",
  proof: "bench pieces.cjs pommelionPass; N.js FarmingStuffs",
};

const f = (v: number) => String(+v.toFixed(3));
const ok = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
const v = (r: Row) => Number(r.node.value);

/** The seed's level with its ⓘ, its factor's name and ⓘ, and the factor's base named; else as it is. */
export function pommelion(n: Row, lv: Level): Level {
  if (
    n.node.name !== POMMELION.test ||
    !tagOf(n.node.code).includes(POMMELION.tag)
  )
    return lv;
  const max = lv.rows.find((k) => k.node.name.startsWith("Max bonus"));
  const fac = lv.rows.find((k) => !!k.group?.length);
  const g = fac?.group ?? [];
  const lvl = g.find((k) => k.node.leaf === "level");
  const base = g.find((k) => k.node.name.startsWith("Base"));
  if (!max || !fac || !lvl || !base) return lv;
  const [M, F, L, B] = [v(max), v(fac), v(lvl), v(base)];
  if (!ok(M * F, v(n)) || !ok(L / (B + L), F)) return lv;
  const factor: Row = {
    ...withName(fac, "Level factor"),
    group: g.map((k) => (k === base ? withName(k, "Base") : k)),
    f: [`Level ÷ (${f(B)} + Level)`, `${f(L)} ÷ (${f(B)} + ${f(L)}) = ${f(F)}`],
  };
  return {
    ...lv,
    row: {
      ...lv.row,
      f: ["Max bonus × Level factor", `${f(M)} × ${f(F)} = ${f(v(n))}`],
    },
    rows: lv.rows.map((k) => (k === fac ? factor : k)),
  };
}
