// The instrumentation (spec 008, T015): every step of a block's arithmetic notes its value through `__X(id, value)`,
// in memory only (FR-011). Blocks invented here; nothing comes from the real game.
import * as fs from "node:fs";
import { createContext, runInContext } from "node:vm";
import { afterEach, expect, test, vi } from "vitest";
import { instrument } from "./instrument.ts";

vi.mock("node:fs", { spy: true });
afterEach(() => {
  vi.clearAllMocks();
});

const block = (name: string, body: string) =>
  `Blocks._customBlock_${name}=function(a,b){${body}};`;

/** Runs the source with a `__X` that keeps every step, then calls one block. */
function run(source: string, name: string, args: unknown[] = [7, 2]) {
  const steps: [number, unknown][] = [];
  const sandbox = {
    Blocks: {} as Record<string, (...a: unknown[]) => unknown>,
    __X: (id: number, v: unknown) => (steps.push([id, v]), v),
  };
  runInContext(source, createContext(sandbox));
  const value = sandbox.Blocks[`_customBlock_${name}`]?.(...args);
  return { value, steps };
}

test.each([
  ["+", 9],
  ["-", 5],
  ["*", 14],
  ["/", 3.5],
  ["%", 1],
])("%s is a step with its value", (operator, value) => {
  const { source, ops } = instrument(block("Op", `return a${operator}b`));
  expect(ops.map((o) => o.kind)).toEqual(["op", "leaf", "leaf"]);
  expect(run(source, "Op")).toEqual({
    value,
    steps: [
      [1, 7],
      [2, 2],
      [0, value],
    ],
  });
});

test.each([
  ["min", 2],
  ["max", 7],
  ["pow", 49],
  ["floor", 7],
  ["ceil", 7],
  ["round", 7],
  ["abs", 7],
  ["log", Math.log(7)],
  ["sqrt", Math.sqrt(7)],
])("Math.%s is a step with its value", (fn, value) => {
  const { source, ops } = instrument(block("Fn", `return Math.${fn}(a,b)`));
  expect(ops[0]).toMatchObject({ kind: "op", block: "Fn" });
  const { value: got, steps } = run(source, "Fn");
  expect(got).toBe(value);
  expect(steps.at(-1)).toEqual([0, value]);
});

test("an operand that is not a literal is a leaf inside its step", () => {
  const { source, ops } = instrument(
    block("Leaf", "return (a+b)*Math.min(a,10)"),
  );
  expect(ops.map((o) => [o.kind, o.parent])).toEqual([
    ["op", undefined],
    ["op", 0],
    ["leaf", 1],
    ["leaf", 1],
    ["op", 0],
    ["leaf", 4],
  ]);
  expect(run(source, "Leaf").value).toBe(63);
});

test("a compound assignment, an increment, a comparison and a test are steps", () => {
  const { source, ops } = instrument(
    block("Mixed", "var t=a;t*=b;t++;return t>10?t:0"),
  );
  expect(ops.map((o) => o.kind).sort()).toEqual(
    ["assign", "assign", "leaf", "leaf", "test"].sort(),
  );
  const { value, steps } = run(source, "Mixed");
  expect(value).toBe(15);
  expect(steps.map(([, v]) => v)).toEqual(
    expect.arrayContaining([14, 15, true]),
  );
});

test("a leaf knows the assignment that set its variable", () => {
  const { ops } = instrument(block("Def", "var t=a*2;return t+b"));
  const leaf = ops.find((o) => o.kind === "leaf" && o.node.name === "t");
  expect(leaf?.def?.type).toBe("BinaryExpression");
});

test("the code outside the blocks and the block's result stay the same", () => {
  const original = `var Blocks={};${block("Same", "return a*b+1")}var outside=1+2;`;
  const { source } = instrument(original);
  expect(source).toContain("var outside=1+2;");
  expect(source.startsWith("var Blocks={};")).toBe(true);
  expect(run(source.replace("var Blocks={};", ""), "Same").value).toBe(15);
});

test("a block that does not parse keeps its code and its number", () => {
  // The `v` flag is newer than the parser's version: the game's engine runs it, the parser refuses it.
  const newer = block("Newer", 'return /a/v.test("a")?a*3:0');
  const { source, ops } = instrument(newer + block("Plain", "return a+b"));
  expect(source).toContain(newer);
  expect(new Set(ops.map((o) => o.block))).toEqual(new Set(["Plain"]));
  expect(run(source, "Newer").value).toBe(21);
  expect(run(source, "Plain").value).toBe(9);
});

test("the prettier-formatted blocks of the invented game are found too", () => {
  const { ops } = instrument(
    "Blocks._customBlock_Spaced = function (a, b) {\n  return a + b;\n};",
  );
  expect(new Set(ops.map((o) => o.block))).toEqual(new Set(["Spaced"]));
});

test("a helper's event has its steps, named by its whole method (spec 010, T168; the live tree's too, 23/11)", () => {
  const events =
    "H.prototype._customEvent_Fill = function () { this.v = this.a * 5; };" +
    "var K = { _customEvent_Keyed: function () { return this.a + 1; } };";
  const blocks = new Set(
    instrument(events + block("Plain", "return a+b")).ops.map((x) => x.block),
  );
  expect(blocks).toEqual(
    new Set(["Plain", "_customEvent_Fill", "_customEvent_Keyed"]),
  );
});

test("the function text stays with each step, for the worker only", () => {
  const { ops } = instrument(block("Text", "return a+b"));
  expect(ops[0]?.fnText).toBe("function(a,b){return a+b}");
});

test("nothing is written to disk during the instrumentation (FR-011)", () => {
  instrument(block("Disk", "return a+b") + block("Disk2", "return a*b"));
  const writers = Object.entries(fs).filter(
    ([name, f]) =>
      vi.isMockFunction(f) &&
      /write|append|mkdir|copy|rename|create/i.test(name),
  );
  expect(writers.length).toBeGreaterThan(0);
  for (const [, f] of writers) expect(f).not.toHaveBeenCalled();
});
