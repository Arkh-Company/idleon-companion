// The same piece many times on one level (audit family 8; tree/one-of-each.ts): identical checks with no code (the
// game's loop checks the same thing once per item) appear once; identical calls with the same value stay apart only
// when they are separate parts of the level's sum (FR-008), else they are one. Invented calls and values.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { check, lazy, leaf, placed } from "./tree-fixture.ts";

const names = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids.map((k) => k.name) : [];
/** The level under a call `Call1()` of value `v`, opened. */
function under(v: number, rows: Parameters<typeof placed>[0][number]) {
  const t = placed({ 1: rows }, [lazy("Invented source", v, "Call1()", 1)]);
  return t.expand(t.rows[0]?.id ?? "");
}

test("identical checks with no code on one level appear once", () => {
  const n = under(10, [
    leaf("Invented bonus", 10, "Stats.bonus", "rawBonus"),
    check("Gallery unlocked", true),
    check("Gallery unlocked", true),
    check("Gallery unlocked", true),
  ]);
  expect(names(n)).toEqual(["Invented bonus", "Gallery unlocked"]);
});

test("identical calls that are not separate parts of the level's sum are one", () => {
  const n = under(3, [
    lazy("Invented call", 3, "Call2()", 2),
    lazy("Invented call", 3, "Call2()", 2),
  ]);
  expect(names(n)).toEqual(["Invented call"]);
});

test("identical calls that are separate parts of the level's sum stay apart (FR-008)", () => {
  const n = under(7, [
    lazy("Invented call", 3, "Call2()", 2),
    lazy("Invented call", 3, "Call2()", 2),
    leaf("Invented bonus", 1, "Stats.bonus", "rawBonus"),
  ]);
  expect(names(n)).toEqual([
    "Invented call",
    "Invented call",
    "Invented bonus",
  ]);
});
