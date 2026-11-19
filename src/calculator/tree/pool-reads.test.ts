// A level that has pools has only pools (spec 009, FR-005; audit family 10, the rest): a read beside them that no pool
// shows goes down to the source in a pool whose call read it, and is shown under that source, after its rows; a read
// no such source read stays where it is, so no value leaves (FR-008). Invented calls, paths and values.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import {
  kidsIn,
  kidsOf,
  lazy,
  leaf,
  placed,
  read,
  recNode,
} from "./tree-fixture.ts";

const names = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids.map((k) => k.name) : [];
const pool = (group: Row[]): Row => ({
  node: row({
    pieceKey: null,
    value: 2,
    code: null,
    name: "Multi pool",
    role: "pool",
    combine: "product",
    poolKind: "multi",
    fmt: "x",
    flags: { closed: true },
  }),
  open: null,
  group,
});
const NODES = [
  recNode(0, "Call0"),
  recNode(1, "Call1"),
  recNode(2, "Call2", { r: [["Stats.loose", 5]] }),
];

function sourceLevel(loose: Row) {
  const t = placed(
    {
      1: [
        pool([
          lazy("Invented source", 2, "Call2()", 2),
          leaf("Other source", 1, "Stats.one", "rawBonus"),
        ]),
        loose,
      ],
      2: [
        leaf("Invented bonus", 1, "Stats.bonus", "rawBonus"),
        leaf("Second bonus", 1, "Stats.second", "rawBonus"),
      ],
    },
    [lazy("Invented system", 2, "Call1()", 1)],
    NODES,
  );
  const top = t.expand(t.rows[0]?.id ?? "");
  const [p] = kidsIn(top);
  const [source] = kidsIn(p);
  return { top, source: t.expand(source?.id ?? "") };
}

test("a read beside the pools that no pool shows goes down to the source in a pool whose call read it", () => {
  const { top, source } = sourceLevel(read("Stats.loose", 5));
  expect(names(top)).toEqual(["Multi pool"]);
  expect(kidsOf(source).map((k) => [k.code, k.value])).toEqual([
    ["Stats.bonus", 1],
    ["Stats.second", 1],
    ["Stats.loose", 5],
  ]);
});

test("a read beside the pools that no source in them read stays beside them (FR-008)", () => {
  const { top, source } = sourceLevel(read("Stats.other", 5));
  expect(names(top)).toEqual(["Multi pool", "Game value"]);
  expect(kidsOf(source).map((k) => k.code)).toEqual([
    "Stats.bonus",
    "Stats.second",
  ]);
});
