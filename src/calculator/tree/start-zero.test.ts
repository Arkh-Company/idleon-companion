// A loop's working value that starts at 0 beside its one turn (spec 009 T030, decision of 18/11: as the bench shows the
// Cape Vine's bonus): the start adds nothing, so the row is its one turn, and the turn's parts are its rows (1.32 and
// 40, not a branch of 52.8 beside a 0). Invented paths and values.
import { expect, test } from "vitest";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { branch, fixed, kidsOf, lazy, placed } from "./tree-fixture.ts";

const source = (code: string, value: number): Row => ({
  node: row({ pieceKey: code, value, code, name: `Invented ${code}` }),
  open: null,
});
/** The game's working value the loop adds to, read at its start, 0, with no name of its own. */
const start = (value = 0): Row => ({
  node: row({ pieceKey: "DNSM.InventedDN", value, code: "DNSM.InventedDN" }),
  open: null,
});
const cache = (kids: Row[], value: number): Row => ({
  node: row({
    pieceKey: "DNSM.InventedTOT",
    value,
    code: "DNSM.InventedTOT",
    name: "Invented total",
  }),
  open: null,
  group: kids,
});

test("a working value that starts at 0 beside the loop's one turn leaves the row to the turn's parts", () => {
  const turn = {
    ...branch(52.8, [source("Gallery.x", 1.32), fixed("Bonus value", 40)]),
    op: "*" as const,
  };
  const [total] = placed({}, [cache([start(), turn], 52.8)]).rows;
  expect(kidsOf(total).map((k) => [k.code, k.value])).toEqual([
    ["Gallery.x", 1.32],
    [null, 40],
  ]);
});

test("a start that is not 0, or two turns, keep their rows: the start, and each turn's parts (FR-007, any math)", () => {
  const turn = (v: number) => ({
    ...branch(v, [source("Gallery.x", 1.32), fixed("Bonus value", v / 1.32)]),
    op: "*" as const,
  });
  const [kept] = placed({}, [cache([start(2), turn(52.8)], 54.8)]).rows;
  expect(kidsOf(kept).map((k) => [k.code, k.value])).toEqual([
    ["DNSM.InventedDN", 2],
    ["Gallery.x", 1.32],
    [null, 52.8 / 1.32],
  ]);
  const [two] = placed({}, [cache([start(), turn(52.8), turn(13.2)], 66)]).rows;
  // 66 = 1.32 × 40 + 1.32 × 10: each turn's source is a part of the math its ⓘ cites, so both stay (FR-008)
  expect(kidsOf(two).map((k) => [k.code, k.value])).toEqual([
    ["DNSM.InventedDN", 0],
    ["Gallery.x", 1.32],
    [null, 52.8 / 1.32],
    ["Gallery.x", 1.32],
    [null, 13.2 / 1.32],
  ]);
});

test("two identical calls in a mixed math both stay when the level's ⓘ cites them both (FR-008)", () => {
  const call = (): Row => lazy("Invented call", 1.32, "Gallery()", 2);
  const turn = (v: number) => ({
    ...branch(v, [call(), fixed("Bonus value", v / 1.32)]),
    op: "*" as const,
  });
  const [two] = placed({ 2: [source("Gallery.y", 1.32)] }, [
    cache([start(), turn(52.8), turn(13.2)], 66),
  ]).rows;
  expect(kidsOf(two).map((k) => [k.code, k.value])).toEqual([
    ["DNSM.InventedDN", 0],
    ["Gallery()", 1.32],
    [null, 52.8 / 1.32],
    ["Gallery()", 1.32],
    [null, 13.2 / 1.32],
  ]);
});
