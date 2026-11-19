// The parity's check of a row's ⓘ (parity-values.ts sameFormula) reads its numbers only: the game's text a row's ⓘ may
// carry beside its math (fix/tree-names r2) changes nothing in it. Invented names and numbers.
import { expect, test } from "vitest";
import { sameFormula } from "./parity-values.ts";

test.each<[string, Parameters<typeof sameFormula>[0]]>([
  [
    "the math as atoms",
    [["Ax", "×", "Ay"], [3, 4, 12], "A shop's invented text!"],
  ],
  [
    "a rule",
    { rule: ["Ax × Ay", "3 × 4 = 12"], text: "A shop's invented text!" },
  ],
])("%s with the game's text: the same numbers are the same ⓘ", (_name, app) => {
  expect(sameFormula(app, ["Ax × Ay", "3 × 4 = 12"])).toBe(true);
  expect(sameFormula(app, ["Ax × Ay", "3 × 5 = 15"])).toBe(false);
});
