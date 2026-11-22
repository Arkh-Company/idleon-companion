// A passage the root wrote and read back (spec 010, research R9): the step or the child call that gave it is found by
// where the write came (RecWrite.xi against the steps' place), never by the first one with the same value; when the
// place does not decide between two passages with that value, the answer key refuses it with the reason.
import { expect, test } from "vitest";
import { recordingOf } from "../fixtures/recording-fixture.ts";
import type { Expr } from "../recorded/steps.ts";
import { answerKeyOfSteps } from "./answer-key.ts";

// two sources in 0: `DNSM.a = A(1) * 2`, `DNSM.b = B(2) * 3`, then `5 + DNSM.a + DNSM.b`
const rec = recordingOf(
  [
    { b: "(root)", c: [1] },
    { b: "InventedRoot", a: [0, 0, 0], v: 5, c: [2, 3] },
    { b: "InventedA", a: [1], v: 0, pxi: 0 },
    { b: "InventedB", a: [2], v: 0, pxi: 1 },
  ],
  [
    { path: "DNSM.a", node: 1, v: 0, xi: 1, seq: 1 },
    { path: "DNSM.b", node: 1, v: 0, xi: 2, seq: 2 },
  ],
  { root: 0 },
);
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
const total = {
  v: 5,
  e: op(
    "+",
    op("+", { t: "num", v: 5 }, { t: "read", p: "DNSM.a", v: 0 }, 5),
    { t: "read", p: "DNSM.b", v: 0 },
    5,
  ),
};
const steps = [
  { v: 0, e: op("*", { t: "call", id: 2, v: 0 }, { t: "num", v: 2 }, 0) },
  { v: 0, e: op("*", { t: "call", id: 3, v: 0 }, { t: "num", v: 3 }, 0) },
  total,
];

test("two passages in 0: each read opens the step that gave its own write, by the write's place", () => {
  const key = answerKeyOfSteps(rec, { steps, checks: [], stepAt: [0, 1, 2] });
  if ("error" in key) throw new Error(key.reason);
  expect(key.pools.flatMap((p) => p.terms.map((t) => [t.ref, t.via]))).toEqual([
    ["5", []],
    ["InventedA(1)", ["DNSM.a"]],
    ["InventedB(2)", ["DNSM.b"]],
  ]);
});

test("two passages in 0 with no place to tell their steps apart: refused with the reason", () => {
  const key = answerKeyOfSteps(rec, { steps, checks: [] });
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(/mais de uma passagem/);
});

test("two child calls that start at the same place give two writes in 0: the place does not decide, refused", () => {
  // `DNSM.a = A(1); DNSM.b = B(2);` with no step between them, then the sum
  const same = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "InventedRoot", a: [0, 0, 0], v: 5, c: [2, 3] },
      { b: "InventedA", a: [1], v: 0, pxi: 0 },
      { b: "InventedB", a: [2], v: 0, pxi: 0 },
    ],
    [
      { path: "DNSM.a", node: 1, v: 0, xi: 0, seq: 1 },
      { path: "DNSM.b", node: 1, v: 0, xi: 0, seq: 2 },
    ],
    { root: 0 },
  );
  const key = answerKeyOfSteps(same, {
    steps: [total],
    checks: [],
    stepAt: [0],
  });
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(/mais de uma/);
});
