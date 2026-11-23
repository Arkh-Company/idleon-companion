// A passage the root wrote and read back (spec 010, research R9): the step or the child call that gave it is found by
// where the write came (RecWrite.xi against the steps' place), never by the first one with the same value; when the
// place does not decide between two passages with that value, the answer key refuses it with the reason.
import { expect, test } from "vitest";
import { recordingOf } from "../fixtures/recording-fixture.ts";
import { LOG_CAP } from "../recording.ts";
import type { RecNode } from "../recording.ts";
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
  expect("reason" in key ? key.reason : "").toMatch(
    /a posição não decide entre elas/,
  );
});

test("a step in 0 and then a child call in 0 written with `=`: both came before the write, the place does not decide, refused", () => {
  // `t = A(1) * 2`, then `DNSM.b = B(2)`, then `5 + DNSM.b`
  const later = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "InventedRoot", a: [0, 0, 0], v: 5, c: [2, 3] },
      { b: "InventedA", a: [1], v: 0, pxi: 0 },
      { b: "InventedB", a: [2], v: 0, pxi: 1 },
    ],
    [{ path: "DNSM.b", node: 1, v: 0, xi: 1, seq: 1 }],
    { root: 0 },
  );
  const sum = {
    v: 5,
    e: op("+", { t: "num", v: 5 }, { t: "read", p: "DNSM.b", v: 0 }, 5),
  };
  const key = answerKeyOfSteps(later, {
    steps: [steps[0] ?? total, sum],
    checks: [],
    stepAt: [0, 1],
  });
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(
    /a posição não decide entre elas/,
  );
});

// `DNSM.p = A(1) * 2`, `return 5 + DNSM.p`'s step, then `DNSM.p = B(2) * 3` again, also 6, with the root's reads
const twice = (
  r: NonNullable<RecNode["r"]>,
  rx: NonNullable<RecNode["rx"]> = [],
) => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "InventedRoot", a: [0, 0, 0], v: 11, c: [2, 3], r, rx },
      { b: "InventedA", a: [1], v: 3, pxi: 0 },
      { b: "InventedB", a: [2], v: 2, pxi: 2 },
    ],
    [
      { path: "DNSM.p", node: 1, v: 6, xi: 1, seq: 1 },
      { path: "DNSM.p", node: 1, v: 6, xi: 3, seq: 2 },
    ],
    { root: 0 },
  );
  return answerKeyOfSteps(rec, {
    steps: [
      { v: 6, e: op("*", { t: "call", id: 2, v: 3 }, { t: "num", v: 2 }, 6) },
      {
        v: 11,
        e: op("+", { t: "num", v: 5 }, { t: "read", p: "DNSM.p", v: 6 }, 11),
      },
      { v: 6, e: op("*", { t: "call", id: 3, v: 2 }, { t: "num", v: 3 }, 6) },
    ],
    checks: [],
    stepAt: [0, 1, 2],
  });
};
const refsVia = (key: ReturnType<typeof answerKeyOfSteps>) => {
  if ("error" in key) throw new Error(key.reason);
  return key.pools.flatMap((p) => p.terms.map((t) => [t.ref, t.via]));
};
const reasonOf = (key: ReturnType<typeof answerKeyOfSteps>) =>
  "reason" in key ? key.reason : "no refusal";

test("a path written twice with the same value, before and after the read: the read opens the write it saw", () => {
  expect(refsVia(twice([["DNSM.p", 6, 1]], [["DNSM.p", 6, 1, 1]]))).toEqual([
    ["5", []],
    ["InventedA(1)", ["DNSM.p"]],
  ]);
});

test("the read after both writes opens the second one, by the seq of the write it saw", () => {
  expect(refsVia(twice([["DNSM.p", 6, 2]]))).toEqual([
    ["5", []],
    ["InventedB(2)", ["DNSM.p"]],
  ]);
});

test("two reads that saw the two writes (seq 1 and 2): the read at the step's place opens the write it saw", () => {
  const rx: RecNode["rx"] = [
    ["DNSM.p", 6, 1, 1],
    ["DNSM.p", 6, 3, 2],
  ];
  expect(refsVia(twice([["DNSM.p", 6, 1]], rx))).toEqual([
    ["5", []],
    ["InventedA(1)", ["DNSM.p"]],
  ]);
});

test("the path's only logged read comes after the step: the read is not found by its place, refused", () => {
  expect(reasonOf(twice([], [["DNSM.p", 6, 3, 2]]))).toMatch(
    /a leitura de DNSM\.p que alimenta o passo 1 não está no log até o lugar dele/,
  );
});

const call = (id: number, v: number): Expr => ({ t: "call", id, v });
const poolsOf = (key: ReturnType<typeof answerKeyOfSteps>) => {
  if ("error" in key) throw new Error(key.reason);
  return key.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)]);
};

test("an accumulator summed in sequence with a source in 0: each read opens the write it saw at its step's place", () => {
  // `i = 10 + A(1); DNSM.e = i; i = DNSM.e + Z(2); DNSM.e = i; i = DNSM.e + C(3); DNSM.e = i; return DNSM.e * 2`:
  // Z(2) is 0, so its write is the one before it + 0
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "InventedRoot",
        a: [0, 0, 0],
        v: 44,
        c: [2, 3, 4],
        rx: [
          ["DNSM.e", 15, 1, 1],
          ["DNSM.e", 15, 2, 2],
          ["DNSM.e", 22, 3, 3],
        ],
      },
      { b: "InventedA", a: [1], v: 5, pxi: 0 },
      { b: "InventedZ", a: [2], v: 0, pxi: 1 },
      { b: "InventedC", a: [3], v: 7, pxi: 2 },
    ],
    [
      { path: "DNSM.e", node: 1, v: 15, xi: 1, seq: 1 },
      { path: "DNSM.e", node: 1, v: 15, xi: 2, seq: 2 },
      { path: "DNSM.e", node: 1, v: 22, xi: 3, seq: 3 },
    ],
    { root: 0 },
  );
  const e = (v: number): Expr => ({ t: "read", p: "DNSM.e", v });
  const key = answerKeyOfSteps(rec, {
    steps: [
      { v: 15, e: op("+", { t: "num", v: 10 }, call(2, 5), 15) },
      { v: 15, e: op("+", e(15), call(3, 0), 15) },
      { v: 22, e: op("+", e(15), call(4, 7), 22) },
      { v: 44, e: op("*", e(22), { t: "num", v: 2 }, 44) },
    ],
    checks: [],
    stepAt: [0, 1, 2, 3],
  });
  expect(poolsOf(key)).toEqual([
    ["additive", ["10", "InventedA(1)", "InventedZ(2)", "InventedC(3)"]],
    ["multi", ["2"]],
  ]);
});

test("a sum in a loop, one more term in 0 and the result pushed to a list: the value with no name opens the write each read saw", () => {
  // `for k of [0, 1]: DNSM.t = DNSM.t + P(k)`; `DNSM.t = DNSM.t + Q(9)`, Q(9) in 0; `DNSM.L.push(DNSM.t)`; then a
  // step over the value 8 with no name, as both DNSM.t and DNSM.L[0] hold it
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "InventedRoot",
        a: [0, 0, 0],
        v: 16,
        c: [2, 3, 4],
        rx: [
          ["DNSM.t", 0, 0, 0],
          ["DNSM.t", 5, 1, 1],
          ["DNSM.t", 8, 2, 2],
          ["DNSM.t", 8, 3, 3],
          ["DNSM.L[0]", 8, 3, 4],
        ],
      },
      { b: "InventedP", a: [0], v: 5, pxi: 0 },
      { b: "InventedP", a: [1], v: 3, pxi: 1 },
      { b: "InventedQ", a: [9], v: 0, pxi: 2 },
    ],
    [
      { path: "DNSM.t", node: 1, v: 5, xi: 1, seq: 1 },
      { path: "DNSM.t", node: 1, v: 8, xi: 2, seq: 2 },
      { path: "DNSM.t", node: 1, v: 8, xi: 3, seq: 3 },
      { path: "DNSM.L[0]", node: 1, v: 8, xi: 3, seq: 4 },
    ],
    { root: 0 },
  );
  const t = (v: number): Expr => ({ t: "read", p: "DNSM.t", v });
  const key = answerKeyOfSteps(rec, {
    steps: [
      // the loop's step, recorded twice: its expression is its last turn's
      { v: 8, e: op("+", t(5), call(3, 3), 8) },
      { v: 8, e: op("+", t(8), call(4, 0), 8) },
      { v: 16, e: op("*", { t: "val", v: 8 }, { t: "num", v: 2 }, 16) },
    ],
    checks: [],
    stepAt: [1, 2, 3],
  });
  expect(poolsOf(key)).toEqual([
    ["additive", ["InventedP(0)", "InventedP(1)", "InventedQ(9)"]],
    ["multi", ["2"]],
  ]);
});

test("a step log at the cap: a later write of the path, by another call, may be what an unlogged read saw, refused", () => {
  const rx: NonNullable<RecNode["rx"]> = [["DNSM.p", 6, 1, 1]];
  while (rx.length < LOG_CAP) rx.push(["InventedPad", 0, 0]);
  expect(reasonOf(twice([["DNSM.p", 6, 1]], rx))).toMatch(
    /a posição não decide entre elas/,
  );
});

test("the reason of more than one write names the path, the seq and the candidate of each write, and a log at the cap", () => {
  // no read of the path in the log: both writes may be the one read back
  const rx: NonNullable<RecNode["rx"]> = [];
  const writes = "(DNSM.p seq 1 ← passo 0; DNSM.p seq 2 ← passo 2)";
  expect(reasonOf(twice([], rx))).toContain(
    `a passagem 6 sai de mais de uma escrita ${writes}, e a posição não decide entre elas`,
  );
  expect(reasonOf(twice([], rx))).not.toMatch(/limite/);
  while (rx.length < LOG_CAP) rx.push(["InventedPad", 0, 0]);
  expect(reasonOf(twice([], rx))).toMatch(
    /não decide entre elas \(o log da chamada chegou ao limite\)/,
  );
});

test("one write and two candidates, a step and a child call after it: the reason names each candidate", () => {
  // `t = A(1) * 2` (6), then `DNSM.p = B(2)` (6) with no step between them, then `5 + DNSM.p`
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "InventedRoot",
        a: [0, 0, 0],
        v: 11,
        c: [2, 3],
        rx: [["DNSM.p", 6, 1, 1]],
      },
      { b: "InventedA", a: [1], v: 3, pxi: 0 },
      { b: "InventedB", a: [2], v: 6, pxi: 1 },
    ],
    [{ path: "DNSM.p", node: 1, v: 6, xi: 1, seq: 1 }],
    { root: 0 },
  );
  const key = answerKeyOfSteps(rec, {
    steps: [
      { v: 6, e: op("*", call(2, 3), { t: "num", v: 2 }, 6) },
      {
        v: 11,
        e: op("+", { t: "num", v: 5 }, { t: "read", p: "DNSM.p", v: 6 }, 11),
      },
    ],
    checks: [],
    stepAt: [0, 1],
  });
  expect(reasonOf(key)).toContain(
    "a passagem 6 sai de mais de uma escrita (DNSM.p seq 1 ← passo 0; DNSM.p seq 1 ← InventedB(2)), e a posição não decide entre elas",
  );
});

test("a child call written with `=` and then used in a later step: the place does not decide, refused", () => {
  // `x = B(2); DNSM.b = x; u = x * 3; return 5 + DNSM.b + u`
  const used = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "InventedRoot", a: [0, 0, 0], v: 13, c: [2], r: [["DNSM.b", 2, 1]] },
      { b: "InventedB", a: [2], v: 2, pxi: 0 },
    ],
    [{ path: "DNSM.b", node: 1, v: 2, xi: 0, seq: 1 }],
    { root: 0 },
  );
  const x: Expr = { t: "def", e: { t: "call", id: 2, v: 2 }, v: 2 };
  const read: Expr = { t: "read", p: "DNSM.b", v: 2 };
  const ret = op(
    "+",
    op("+", { t: "num", v: 5 }, read, 7),
    { t: "val", v: 6 },
    13,
  );
  const key = answerKeyOfSteps(used, {
    steps: [
      { v: 6, e: op("*", x, { t: "num", v: 3 }, 6) },
      { v: 13, e: ret },
    ],
    checks: [],
    stepAt: [0, 1],
  });
  expect(reasonOf(key)).toMatch(/a posição não decide entre elas/);
  // the reason names the write and each child call with the step it goes into
  expect(reasonOf(key)).toContain(
    "(DNSM.b seq 1 ← InventedB(2), que entra no passo 0)",
  );
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
