// The rows of a loop's earlier turns (pieces.cjs EARLIER_NAMES, [D9-7]) on their way to the window: the main's check
// (src/main/tree-check.ts) takes each one, so no tree with them is shown as unavailable.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";
import { EARLIER_TOTALS, earlierTotal, wornTotal } from "./term-passes.ts";

const passes = (r: Row | null) =>
  r !== null && checkTree({ id: "x", ...r.node }, 1) !== null;

test.each(EARLIER_TOTALS.map((e) => [e.name, e.test.source]))(
  "the row of %s passes the main's check",
  (_name, source) => {
    const fam = source.replace(/^\^/, "").replace(/\\/g, "");
    const reads = new Map([[`${fam}b`, "(undefined)"]]);
    expect(passes(earlierTotal(`${fam}a`, 0, reads, true))).toBe(true);
  },
);

test("the worn items' total passes the main's check", () => {
  const step: Expr = { t: "read", p: "DNSM.TotalStatsDM.UQ1val", v: 5 };
  expect(
    passes(wornTotal("DummyNumbersStatManager.TotalStatsDN", 0, step)),
  ).toBe(true);
});
