// The side a ? : took (sides.ts sideAt): its test's last record up to the place, in the call's whole step log; found by
// each op's places in the log, once per log (spec 010, part R), as the scan back it replaces.
import { expect, test } from "vitest";
import { sideAt } from "./sides.ts";

const LOG: [number, number | boolean | null][] = [
  [7, true],
  [3, 1],
  [7, false],
  [3, null],
  [7, 0],
];

test("the test's last record up to the place: its yes or no, null with no number or yes/no", () => {
  expect([0, 1, 2, 3, 4].map((pos) => sideAt(7, LOG, pos))).toEqual([
    true,
    true,
    false,
    false,
    false,
  ]);
  expect([1, 2, 3].map((pos) => sideAt(3, LOG, pos))).toEqual([
    true,
    true,
    null,
  ]);
});

test("no record up to the place, an op never recorded, no test or no log: undefined; a place past the log, its end", () => {
  expect(sideAt(3, LOG, 0)).toBeUndefined();
  expect(sideAt(9, LOG, 4)).toBeUndefined();
  expect(sideAt(undefined, LOG, 4)).toBeUndefined();
  expect(sideAt(7, undefined, 4)).toBeUndefined();
  expect(sideAt(7, LOG, -1)).toBeUndefined();
  expect(sideAt(7, LOG, 99)).toBe(false);
});
