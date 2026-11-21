// A branch check is matched to its subject by the code of the read it compares, not by the name (audit family 3, the
// rest): the check keeps that code (tree/conditions.ts condRows), so a guard whose subject was renamed ("Level ≤ 0"
// beside "Points in the talent"), a check said with a suffix and a check of a constant of the code with no row of its
// own all leave their rows for the ⓘ above, which says them (A39). Invented paths and values.
import { expect, test } from "vitest";
import type { RecNode } from "../recording.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { makeConditions } from "./conditions.ts";
import type { Row } from "./rows.ts";
import type { Check, Expr } from "../recorded/steps.ts";
import { check, leaf, named, placed, read } from "./tree-fixture.ts";

const node: RecNode = { id: 0, b: "Top", a: [], c: [], p: null, pxi: 0, v: 1 };
const { condRows } = makeConditions([node]);
const num = (v: number): Expr => ({ t: "num", v });
const at = (p: string, v: number): Expr => ({ t: "read", p, v });
const cmp = (o: string, l: Expr, r: Expr, v: boolean): Check => ({
  v,
  e: { t: "op", o, l, r, v },
});

test("a check of a read against a literal keeps the read's code as its subject, whichever side the read is on", () => {
  const rows = condRows(node, {
    steps: [],
    checks: [
      cmp("<=", at("Stats.pts", 0), num(0), true),
      cmp("<", num(100), at("Stats.lv", 101), true),
    ],
  });
  expect(rows.map((r) => [r.test, r.subject])).toEqual([
    ["Stats.pts ≤ 0", "Stats.pts"],
    ["Stats.lv > 100", "Stats.lv"],
  ]);
});

test("a yes/no read merged into its test is that state, with no subject: it is no check of a row", () => {
  const { mergeTests } = makeConditions([node]);
  const own = {
    steps: [],
    checks: [cmp("==", at("Stats.own", 1), num(1), true)],
  };
  const conds = condRows(node, own);
  const state = read("Stats.own", 1);
  const [merged] = mergeTests(
    node,
    [state, read("Stats.b", 4)],
    [],
    conds,
    own,
  ).filter((r) => r.node.leaf === "condition");
  expect(merged?.subject).toBeUndefined();
});

/** A check named as its comparison, its subject the read `code`. */
const guard = (name: string, yes: boolean, code: string): Row => ({
  ...check(name, yes),
  subject: code,
});
const kids = (n: CalcTreeNode | undefined) =>
  n && Array.isArray(n.kids) ? n.kids.map((k) => k.name) : [];

test("a check whose subject was renamed still leaves by the read's code, and the ⓘ says it", () => {
  const [n] = placed({}, [
    named("Invented talent", 10, [
      leaf("Points in the talent", 6, "Stats.pts", "investedPoints"),
      leaf("Other bonus", 4, "Stats.other", "rawBonus"),
      guard("Level > 0", true, "Stats.pts"),
    ]),
  ]).rows;
  expect(kids(n)).toEqual(["Points in the talent", "Other bonus"]);
  expect(n?.formula).toEqual({
    rule: ["Points in the talent + Other bonus (Level > 0: yes)", "6 + 4 = 10"],
  });
});

test("a talent at 0 with only its guard: the guard leaves, and the ⓘ says the value it gives", () => {
  const [n] = placed({}, [
    named("Invented talent", 0, [
      leaf("Points in the talent", 0, "Stats.pts", "investedPoints"),
      guard("Level ≤ 0", true, "Stats.pts"),
    ]),
  ]).rows;
  expect(kids(n)).toEqual(["Points in the talent"]);
  expect(n?.formula).toEqual({ rule: ["If Level ≤ 0: 0", "yes → 0"] });
});

test("a check said with a suffix leaves by its subject's code too", () => {
  const [n] = placed({}, [
    named("Invented map bonus", 10, [
      leaf("Kills left to open", 0, "Stats.kills", "quantity"),
      leaf("Map bonus", 10, "Stats.bonus", "rawBonus"),
      guard("Kills left to open reached", true, "Stats.kills"),
    ]),
  ]).rows;
  expect(kids(n)).toEqual(["Kills left to open", "Map bonus"]);
  expect(n?.formula).toEqual({
    rule: [
      "Kills left to open + Map bonus (Kills left to open reached: yes)",
      "0 + 10 = 10",
    ],
  });
});

test("a check of a constant of the code with no row of its own goes to the ⓘ above", () => {
  const [n] = placed({}, [
    named("Invented divinity bonus", 10, [
      leaf("Minor bonus", 6, "Stats.minor", "rawBonus"),
      leaf("Other bonus", 4, "Stats.other", "rawBonus"),
      guard("God bonus constant = -1", false, "CustomLists.God[8]"),
    ]),
  ]).rows;
  expect(kids(n)).toEqual(["Minor bonus", "Other bonus"]);
  expect(n?.formula).toEqual({
    rule: [
      "Minor bonus + Other bonus (God bonus constant = -1: no)",
      "6 + 4 = 10",
    ],
  });
});
