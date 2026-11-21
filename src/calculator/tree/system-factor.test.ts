// A factor of the bonuses of one system, some taken away, at least a floor (spec 009, FR-007, FR-008; Vinicius's answer B
// of 20/11, the prayers factor of the game's accuracy): max(c, 1 + (a signed sum of the bonuses of one system) ÷ 100) is
// one row named by its system, "<System> multiplier", never "Formula of N sources"; its sources its rows, its whole math
// in its ⓘ, closing on its value. Over the invented game (fake-game.js TreePrayerOf), invented values.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import type { RecNode, RecValue } from "../recording.ts";
import { systemFactorName } from "./shapes.ts";
import type { Expr } from "../recorded/steps.ts";
import { kidsIn } from "./tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
/** TreePrayerOf: (25 + 4) × max(0.1, 1 + (60 - 17 - 8) ÷ 100), the factor alone in its pool, as in the game. */
const root = () =>
  buildTree(
    recorder.record(mosaicOf(), [["TreePrayerOf", []]], {
      recompute: [],
      builders: [],
    }),
    0,
    recorder.ops,
  ).root;
/** Each row under `n` already built, at any depth. */
const below = (n: CalcTreeNode | null | undefined): CalcTreeNode[] =>
  kidsIn(n).flatMap((k) => [k, ...below(k)]);
/** The row of value 1.35, the factor. */
const factor = () => below(root()).find((k) => k.value === 1.35);
/** An ⓘ as its two lines, from its atoms or its rule. */
const linesOf = (f: CalcTreeNode["formula"] | undefined): string[] =>
  Array.isArray(f) ? [f[0].join(" "), f[1].join(" ")] : f ? [...f.rule] : [];

const call = (id: number): Expr => ({ t: "call", id, v: 1 });
const op = (o: string, l: Expr, r: Expr): Expr => ({ t: "op", o, l, r, v: 1 });
const num = (v: number): Expr => ({ t: "num", v });
/** max(0.1, 1 + (a − b) ÷ 100) over the calls of `blocks`, the first argument their mode. */
function factorOf(blocks: [string, unknown][], top = "max"): string | null {
  const nodes: RecNode[] = blocks.map(([b, mode], id) => ({
    id,
    b,
    a: [mode, 0] as RecValue[],
    c: [],
    p: null,
    pxi: 0,
  }));
  const sum = op("-", call(0), call(1));
  const pct = op("+", num(1), op("/", sum, num(100)));
  return systemFactorName(
    top === "max" ? { t: "fn", name: "max", args: [num(0.1), pct], v: 1 } : pct,
    nodes,
  );
}

test("any system's factor of that shape is named by its system, in the singular; two systems or no floor, none", () => {
  expect(
    factorOf([
      ["prayersReal", 1],
      ["prayersReal", 2],
    ]),
  ).toBe("Prayer multiplier");
  expect(
    factorOf([
      ["CardBonusREAL", 1],
      ["CardBonusREAL", 2],
    ]),
  ).toBe("Card multiplier");
  expect(
    factorOf([
      ["GetSetBonus", "A"],
      ["GetSetBonus", "B"],
    ]),
  ).toBe("Set Bonus multiplier");
  expect(
    factorOf([
      ["prayersReal", 1],
      ["CardBonusREAL", 2],
    ]),
  ).toBeNull();
  expect(
    factorOf(
      [
        ["prayersReal", 1],
        ["prayersReal", 2],
      ],
      "none",
    ),
  ).toBeNull();
});

test("the factor of one system's bonuses is one row named by its system, never a count of its sources", () => {
  expect(root().value).toBeCloseTo(39.15, 9);
  const f = factor();
  expect([f?.name, f?.flags.unnamed]).toEqual(["Prayer multiplier", undefined]);
  expect(below(root()).map((k) => k.name)).not.toContain(
    "Formula of 3 sources",
  );
});

test("its sources are its rows, and its whole math, the max, the subtractions and the ÷ 100, is its ⓘ, closing (FR-008)", () => {
  const f = factor();
  expect(
    kidsIn(f).flatMap((k) => (k.code === null ? [] : [[k.code, k.value]])),
  ).toEqual([
    ["prayersReal(1, 0)", 60],
    ["prayersReal(2, 1)", 17],
    ["prayersReal(3, 0)", 8],
  ]);
  const [names] = linesOf(f?.formula);
  expect(names).toMatch(/^max \( 0\.1 , 1 \+ \(.* − .* − .*\) ÷ 100 \) \)$/);
  // its numbers, each prayer's among them, and the row's value at the end
  expect(Array.isArray(f?.formula) && f.formula[1]).toEqual([
    0.1, 1, 60, 17, 8, 100, 1.35,
  ]);
});
