// The ⓘ of a cache read from its writer's turn (pieces.cjs entryRows at BASELINE-4, LAST_WRITER_FORMULA and turnF):
// the step of the one turn that made the value, a turn that only adds 0 to a call, and the part each turn adds.
import { expect, test } from "vitest";
import { oneTurnFormula, turnFormula } from "./cache-formulas.ts";
import { makeCodeFormulas } from "./code-formulas.ts";
import type { Entry } from "./entries.ts";
import { token } from "./formulas.ts";
import type { Expr } from "./steps.ts";
import { recNode } from "./tree-fixture.ts";

const rift = recNode(1, "RiftStuff", {
  a: ["5starCards"],
  v: 1,
  r: [["Rift[0]", 50]],
});
const plain = recNode(2, "Plain", { v: 1 });
const NODES = [recNode(0, "W"), rift, plain];
const formulas = makeCodeFormulas(NODES, () => []);
const w = recNode(0, "W", { r: [["B", 1]] });
const RIFT: [string, string] = [
  "1 when the Rift level ≥ 45, else 0",
  "Rift level 50 → 1",
];

const read = (p: string, v: number): Expr => ({ t: "read", p, v });
const num = (v: number): Expr => ({ t: "num", v });
const val = (v: number): Expr => ({ t: "val", v });
const call = (id: number, v: number): Expr => ({ t: "call", id, v });
const plus = (l: Expr, r: Expr): Expr => ({
  t: "op",
  o: "+",
  l,
  r,
  v: Number(l.v) + Number(r.v),
});
const times = (l: Expr, r: Expr): Expr => ({
  t: "op",
  o: "*",
  l,
  r,
  v: Number(l.v) * Number(r.v),
});
/** min(A, 10) with A of `a`. */
const capped = (a: number): Expr => ({
  t: "fn",
  name: "min",
  args: [read("A", a), num(10)],
  v: Math.min(a, 10),
});
const CAPPED_3: [string, string] = [
  `min(${token("c:A@3", "A")}, 10)`,
  "min(3, 10) = 3",
];
const turn = (v: number, ...steps: Expr[]): Entry => ({
  v,
  s: steps.map((e) => ({ v: Number(e.v), e })),
  k: [],
  r: [["A", 3]],
});

test("the one turn that made a cache: its step with the value, as the cache's ⓘ", () => {
  expect(oneTurnFormula(w, turn(3, capped(3)), 3, formulas, NODES)).toEqual(
    CAPPED_3,
  );
  // no step of the turn has the value
  expect(oneTurnFormula(w, turn(3, capped(5)), 3, formulas, NODES)).toBeNull();
});

test("the one turn that only adds 0 to a call, on either side: that call's ⓘ", () => {
  expect(
    oneTurnFormula(w, turn(1, plus(num(0), call(1, 1))), 1, formulas, NODES),
  ).toEqual(RIFT);
  expect(
    oneTurnFormula(w, turn(1, plus(call(1, 1), val(0))), 1, formulas, NODES),
  ).toEqual(RIFT);
  // a call with no ⓘ of its own gives none
  expect(
    oneTurnFormula(w, turn(1, plus(num(0), call(2, 1))), 1, formulas, NODES),
  ).toBeNull();
  // 0 times a call is the turn's step
  expect(
    oneTurnFormula(w, turn(0, times(num(0), call(1, 1))), 0, formulas, NODES),
  ).toEqual([
    `0 × ${token('c:RiftStuff("5starCards")', 'RiftStuff("5starCards")')}`,
    "0 × 1 = 0",
  ]);
});

test("a turn that adds 1, or a read of 0, to a call is the turn's step", () => {
  expect(
    oneTurnFormula(w, turn(2, plus(num(1), call(1, 1))), 2, formulas, NODES),
  ).toEqual([
    `1 + ${token('c:RiftStuff("5starCards")', 'RiftStuff("5starCards")')}`,
    "1 + 1 = 2",
  ]);
  expect(
    oneTurnFormula(
      w,
      turn(1, plus(read("Z", 0), call(1, 1))),
      1,
      formulas,
      NODES,
    ),
  ).toEqual([
    `${token("c:Z@0", "Z")} + ${token('c:RiftStuff("5starCards")', 'RiftStuff("5starCards")')}`,
    "0 + 1 = 1",
  ]);
});

const part = (q: Entry, d: number) => ({ kind: "+" as const, d, q });

test("a turn's part is the side its step adds to the running total, on either side", () => {
  expect(
    turnFormula(w, part(turn(7, plus(val(4), capped(3))), 3), formulas),
  ).toEqual(CAPPED_3);
  expect(
    turnFormula(w, part(turn(7, plus(capped(3), val(4))), 3), formulas),
  ).toEqual(CAPPED_3);
  // neither side is the running total: the whole step, which is not the part
  expect(
    turnFormula(w, part(turn(7, plus(val(5), capped(2))), 3), formulas),
  ).toBeNull();
  // a product beside the running total is no part that the turn adds
  expect(
    turnFormula(w, part(turn(7, times(val(4), capped(3))), 3), formulas),
  ).toBeNull();
});

test("a turn's part with no step of the new total is its last step, when that step is the part", () => {
  expect(turnFormula(w, part(turn(7, capped(3)), 3), formulas)).toEqual(
    CAPPED_3,
  );
  expect(turnFormula(w, part(turn(7), 3), formulas)).toBeNull();
});
