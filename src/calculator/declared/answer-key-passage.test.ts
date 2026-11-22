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

test("two reads that saw the two writes (seq 1 and 2): the place does not decide, refused", () => {
  const rx: RecNode["rx"] = [
    ["DNSM.p", 6, 1, 1],
    ["DNSM.p", 6, 3, 2],
  ];
  expect(reasonOf(twice([["DNSM.p", 6, 1]], rx))).toMatch(
    /a posição não decide entre elas/,
  );
});

test("a step log at the cap: a later write of the path, by another call, may be what an unlogged read saw, refused", () => {
  const rx: NonNullable<RecNode["rx"]> = [["DNSM.p", 6, 1, 1]];
  while (rx.length < LOG_CAP) rx.push(["InventedPad", 0, 0]);
  expect(reasonOf(twice([["DNSM.p", 6, 1]], rx))).toMatch(
    /a posição não decide entre elas/,
  );
});

test("the reason of more than one write names the path, the call and the seq of each write, and a log at the cap", () => {
  const rx: NonNullable<RecNode["rx"]> = [
    ["DNSM.p", 6, 1, 1],
    ["DNSM.p", 6, 3, 2],
  ];
  const writes =
    "(DNSM.p de InventedRoot(0,0,0), seq 1; DNSM.p de InventedRoot(0,0,0), seq 2)";
  expect(reasonOf(twice([["DNSM.p", 6, 1]], rx))).toContain(
    `a passagem 6 sai de mais de uma escrita ${writes}, e a posição não decide entre elas`,
  );
  expect(reasonOf(twice([["DNSM.p", 6, 1]], rx))).not.toMatch(/limite/);
  while (rx.length < LOG_CAP) rx.push(["InventedPad", 0, 0]);
  expect(reasonOf(twice([["DNSM.p", 6, 1]], rx))).toMatch(
    /não decide entre elas \(o log da chamada chegou ao limite\)/,
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
