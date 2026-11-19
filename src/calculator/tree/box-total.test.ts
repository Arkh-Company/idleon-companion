// A box's total beside the entries that make it (deferred A43; spec 009, FR-007, FR-008): a call that starts a working
// value of the game at 0, adds each entry into it and returns it (N.js RoyalG "TotalStatz", the Kingdom stats) shows
// the box's read, its start and its entries. The total opens into its start and entries, which are its rows, and
// nothing is counted twice. Rows written by hand, invented paths and values.
import { expect, test } from "vitest";
import { kidsIn, lazy, leaf, placed } from "./tree-fixture.ts";

const BOX = [
  leaf("Invented box total (cached)", 10, "DNSM.InventedBox", null),
  leaf("Start value", 0, "DNSM.InventedBox", "fixedValue"),
  leaf("Invented entry 0", 4, "InventedList[5][0]", "level"),
  leaf("Invented entry 1", 6, "InventedList[5][1]", "level"),
];
const opened = (level: typeof BOX, value = 10) => {
  const t = placed({ 1: level }, [
    lazy("Invented stats", value, 'Invented("Total", 0, 0)', 1),
  ]);
  return t.expand(t.rows[0]?.id ?? "");
};

test("a box's total beside its start and its entries opens into them: its rows, never side by side with it", () => {
  const [total, ...rest] = kidsIn(opened(BOX));
  expect([total?.code, total?.value, rest]).toEqual([
    "DNSM.InventedBox",
    10,
    [],
  ]);
  expect(kidsIn(total).map((k) => [k.name, k.value])).toEqual([
    ["Start value", 0],
    ["Invented entry 0", 4],
    ["Invented entry 1", 6],
  ]);
});

test("the total's ⓘ adds its start and its entries up to it (FR-008)", () => {
  const [total] = kidsIn(opened(BOX));
  expect(total?.formula).toEqual([
    ["Start value", "+", "Invented entry 0", "+", "Invented entry 1"],
    [0, 4, 6, 10],
  ]);
});

test("rows whose sum is not the read's value stay as they are", () => {
  const level = BOX.map((r, i) =>
    i === 3 ? leaf("Invented entry 1", 7, "InventedList[5][1]", "level") : r,
  );
  expect(kidsIn(opened(level)).map((k) => k.code)).toEqual([
    "DNSM.InventedBox",
    "DNSM.InventedBox",
    "InventedList[5][0]",
    "InventedList[5][1]",
  ]);
});
