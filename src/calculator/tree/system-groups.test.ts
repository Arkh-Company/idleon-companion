// The group of a named system is always there (fix tree-shape-091, rule 1; Vinicius, 19/11: every system that weighs
// on a value shows as its child; undoes audit family 21): a lone source of a named system sits in its system's group, in
// % or not, the group's ⓘ dividing a bonus in % by 100; a lone source of no system ("Other") still stands alone (A34,
// answer B). Invented arguments, apart from the game's own block names the rules read.
import { expect, test } from "vitest";
import { bySystem, ownPair } from "./groups.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";

const src = (code: string, value: number, percent = false): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
  ...(percent ? { percent: true as const } : {}),
});
const writerOf = () => undefined;
/** A level as [the group's name, or the source's code; its combine; its value; its sources' codes]. */
const level = (rows: readonly Row[]) =>
  rows.map((r) => [
    r.node.role === "system" ? r.node.name : r.node.code,
    r.node.combine ?? null,
    r.node.value,
    r.group?.map((k) => k.node.code) ?? null,
  ]);

test("a lone source of a named system is its system's group, in a product; one of Other stands alone", () => {
  const out = bySystem(
    [
      src('Ninja("PristineBon", 3, 0)', 1.15),
      src("CardBonusREAL(7, 0)", 1.1),
      src("InventedBlock(1)", 2),
    ],
    "product",
    writerOf,
  );
  expect(level(out)).toEqual([
    ["🃏 Cards", "product", 1.1, ["CardBonusREAL(7, 0)"]],
    ["🌟 Pristine Charms", "product", 1.15, ['Ninja("PristineBon", 3, 0)']],
    ["InventedBlock(1)", null, 2, null],
  ]);
  expect(out.slice(0, 2).map((r) => [r.node.fmt, r.node.role])).toEqual([
    ["x", "system"],
    ["x", "system"],
  ]);
});

test("a lone bonus in % of a named system is its system's group in %, its ⓘ the bonus ÷ 100", () => {
  const out = bySystem(
    [
      src('StampBonusOfTypeX("DropRate")', 172, true),
      src('Labb("SigilBonus", 0, 4)', 1200, true),
      src("InventedBlock(2)", 3),
    ],
    "sum",
    writerOf,
  );
  expect(level(out)).toEqual([
    ["📜 Stamps", "percent", 1.72, ['StampBonusOfTypeX("DropRate")']],
    ["🔮 Sigils", "percent", 12, ['Labb("SigilBonus", 0, 4)']],
    ["InventedBlock(2)", null, 3, null],
  ]);
  const [stamps] = out;
  expect(stamps?.node.formula).toEqual([
    ["Stamps: Drop Rate", "÷", "100"],
    [172, 100, 1.72],
  ]);
});

test("a product of groups whose numbers to 3 decimals would not close writes them with more digits, and closes", () => {
  // the Drop Rate's Multi pool 3: each group rounded up a little, the rounding past the ⓘ's 1e-3
  const rows = [1.9695, 1.06272, 1.2745129, 1.353625].map((v, i) =>
    src(`InventedBlock(${String(i)})`, v),
  );
  const value = 1.9695 * 1.06272 * 1.2745129 * 1.353625;
  const [, numbers] = ownPair(rows, true, value) ?? ["", ""];
  const [left = "", right = ""] = numbers.split(" = ");
  const product = left.split(" × ").reduce((p, x) => p * Number(x), 1);
  expect(Math.abs(product - Number(right))).toBeLessThan(1e-3 * value);
  expect(left).toBe("1.9695 × 1.06272 × 1.274513 × 1.353625");
  // numbers that close to 3 decimals stay as they are
  expect(
    ownPair(
      [src("InventedBlock(9)", 2), src("InventedBlock(8)", 3)],
      true,
      6,
    )?.[1],
  ).toBe("2 × 3 = 6");
});
