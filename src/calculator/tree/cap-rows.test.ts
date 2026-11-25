// Each cap of the game is one row with the name of what it caps (fix tree-shape-091, rule 4; Vinicius: everything has a
// name, never "Game value"): c + max((x − c)^e, 0) and c × (x ÷ c)^e, one after the other on the same part, are one row,
// "Base Damage", "Damage Bonus" or "Damage Multi" (the part of the max damage it caps), straight in its pool, in no
// group; its rows the sources of x by system (rule 1; no group "🔹 Other": Vinicius, 19/11), its ⓘ their sum or
// product by those rows' names, never "Game value"; its constant, exponent and floor in its ⓘ only, never loose in the
// pool, the cap's c added before its step too. Over the invented game (fake-game.js TreeShapeCaps), invented values.
// Since spec 010, T231 ("a antiga nao me importa"), each part's last read is the working list's read at its own place,
// so the old tree no longer shows the caps: the root is the product of the three parts.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { shownTerms } from "./places.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { CONSTANT, kidsOpen, shapeTree } from "./shape-fixture.ts";

// the parts as the invented block gives them
const X = 30 + 8000 + 7 + 0.3 + 50 + 25;
const BASE = 5000 + Math.pow(4000 + Math.pow(X - 4000, 0.9) - 5000, 0.8);
const M = 8 * 6 * 1.15 * 1.12;
const BONUS = 20 * Math.pow((10 + Math.pow(M - 10, 0.86)) / 20, 0.5);
const MULTI = 2 * Math.pow((6 * 1.04 * 1.15) / 2, 0.6);

test("the tests' constant is a name of the code's place, Base and its number, never a proven name", () => {
  expect(
    [
      "Base 1",
      "Base 2500",
      "Percent to number (÷ 100)",
      "Minimum 0",
      "Cap 1.3",
    ].map((n) => CONSTANT.test(n)),
  ).toEqual([true, true, true, true, true]);
  expect(
    ["Base Damage", "Base statue bonus", "Bonus", "Cotton Candy"].map((n) =>
      CONSTANT.test(n),
    ),
  ).toEqual([false, false, false, false]);
});

test("each capped part is its working value's read at its own place, a row of the root's product: its caps no longer show (T231)", () => {
  // spec 010, T231 ("a antiga nao me importa"): the parts' last reads, L[0], L[1] and L[2], are each the read of the
  // working list at the leaf's own place, no longer a value with no source the old tree chained to the caps before it
  const b = shapeTree("TreeShapeCaps");
  expect(b.root.value).toBeCloseTo(BASE * BONUS * MULTI * 6, 6);
  const [pool] = kidsOpen(b, b.root);
  expect([pool?.name, pool?.combine]).toEqual(["Multi pool", "product"]);
  expect(
    kidsOpen(b, pool).map((k) => [k.name, k.code, k.role, k.value]),
  ).toEqual(
    [BASE, BONUS, MULTI * 6].map((v, i): unknown[] => [
      `Damage working value, part ${String(i + 1)}`,
      `DummyNumbersStatManager.DamageDealtLIST[${String(i)}]`,
      "piece",
      expect.closeTo(v, 9),
    ]),
  );
  expect(kidsOpen(b, pool).flatMap((k) => kidsOpen(b, k))).toEqual([]);
});

test("rows that shared a term before their placement each give the ⓘ their own name, in their order", () => {
  // the Base Damage's ⚗️ Alchemy: three unnamed steps, two of which their placement names after their bubble
  const step = (v: number): Row => ({
    node: row({ pieceKey: null, value: v, code: null }),
    open: null,
  });
  const rows = [step(8), step(2), step(5)];
  const placed = ["Bubble A", "Game value", "Bubble C"].map(
    (name, i): CalcTreeNode => ({
      id: String(i),
      ...row({ pieceKey: null, value: 1, code: null, name }),
      ...(name === "Game value" ? { flags: { unnamed: true } } : {}),
    }),
  );
  expect(
    shownTerms(
      [
        ["Game value", "+", "Game value", "+", "Game value"],
        [8, 2, 5, 15],
      ],
      rows,
      placed,
    ),
  ).toEqual([
    ["Bubble A", "+", "Game value", "+", "Bubble C"],
    [8, 2, 5, 15],
  ]);
});
