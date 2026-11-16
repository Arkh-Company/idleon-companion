// The rows of a loop's earlier turns (pieces.cjs EARLIER_NAMES, [D9-7]) on their way to the window: the main's check
// (src/main/tree-check.ts) takes each one, so no tree with them is shown as unavailable.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";
import { instrument } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import { buildTree } from "../tree-build.ts";
import {
  EARLIER_TOTALS,
  earlierTotal,
  PROGRESS_BY_LABEL,
  progressRow,
  wornTotal,
} from "./term-passes.ts";
import { kidsOf, openPath, recordingOf } from "./tree-fixture.ts";

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

test.each(PROGRESS_BY_LABEL.map((p) => [p.label, p]))(
  "the working value %s read in its own loop is the loop's progress, never a source",
  (label, p) => {
    for (const code of [`DNSM.${label}`, `DNSM.${label}[1]`]) {
      const r = progressRow(code, 3);
      expect(passes(r)).toBe(true);
      expect(r?.node).toMatchObject({
        code,
        name: p.name,
        leaf: p.leaf,
        why: p.why,
        value: 3,
      });
      expect(r?.node.flags).toEqual({});
    }
    expect(progressRow(`DNSM.${label}x`, 3)).toBeNull();
  },
);

test("a progress row's why is said only for a ?; a fixed value has none", () => {
  const leaves = new Set(
    PROGRESS_BY_LABEL.map((p) => [p.leaf, !!p.why].join()),
  );
  expect(leaves).toEqual(new Set(["unknown,true", "fixedValue,false"]));
});

test("the working value read by the call that wrote it, or with no writer, is its loop's progress; read by another call it opens", () => {
  const label = PROGRESS_BY_LABEL[0]?.label ?? "";
  const rec = (writer: number | null) =>
    recordingOf(
      [
        { b: "(root)", c: [1] },
        { b: "Total", v: 10, c: [2] },
        {
          b: "Loop",
          v: 10,
          r: [
            writer === null
              ? [`DNSM.${label}`, 4]
              : [`DNSM.${label}`, 4, writer],
            ["Stats.x", 6],
          ],
        },
        { b: "Other", v: 4 },
      ],
      writer === null
        ? []
        : [{ path: `DNSM.${label}`, node: writer, v: 4, seq: 0 }],
      { root: 0 },
    );
  for (const writer of [2, null]) {
    const own = kidsOf(openPath(buildTree(rec(writer), 0), "Loop()"));
    expect(own.map((k) => [k.code, k.name, k.leaf, k.kids])).toEqual([
      [
        `DNSM.${label}`,
        PROGRESS_BY_LABEL[0]?.name,
        PROGRESS_BY_LABEL[0]?.leaf,
        [],
      ],
      ["Stats.x", "Game value", "unknown", []],
    ]);
  }
  const other = kidsOf(openPath(buildTree(rec(3), 0), "Loop()"));
  expect(other[0]).toMatchObject({ code: `DNSM.${label}`, kids: "lazy" });
});

test("in a step of the call that wrote it, and in the root's step, the working value is its loop's progress", () => {
  const label = PROGRESS_BY_LABEL[0]?.label ?? "";
  const { ops } = instrument(
    "Blocks._customBlock_Prod = function () { return s.A * s.B; };",
  );
  const prod = (id: number) => ({
    b: "Prod",
    v: 12,
    x: [
      [1, 3],
      [2, 4],
      [0, 12],
    ] as [number, number][],
    rx: [
      [`DNSM.${label}`, 3, 0],
      ["B", 4, 1],
    ] as [string, number, number][],
    r: [
      [`DNSM.${label}`, 3, id],
      ["B", 4],
    ] as NonNullable<RecNode["r"]>,
  });
  const write = (id: number) => [
    { path: `DNSM.${label}`, node: id, v: 3, seq: 0 },
  ];
  const under = buildTree(
    recordingOf(
      [{ b: "(root)", c: [1] }, { b: "Total", v: 12, c: [2] }, prod(2)],
      write(2),
      { root: 0 },
    ),
    0,
    ops,
  );
  const root = buildTree(
    recordingOf([{ b: "(root)", c: [1] }, prod(1)], write(1), { root: 0 }),
    0,
    ops,
  ).root;
  for (const n of [openPath(under, "Prod()"), root])
    expect(kidsOf(n).map((k) => [k.code, k.name, k.kids])).toEqual([
      [`DNSM.${label}`, PROGRESS_BY_LABEL[0]?.name, []],
      ["B", "Game value", []],
    ]);
});
