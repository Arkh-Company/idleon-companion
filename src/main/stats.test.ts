// What the Stats tab shows: the format of each number, the check against the game's own list and the tab's state.
// Every number here is invented.
import { expect, test, vi } from "vitest";
import type { CalcNumbers, Stats } from "../shared/index.ts";
import {
  formatNumber,
  statListCheck,
  statsRows,
  statsTracker,
} from "./stats.ts";

const numbers = (over: Partial<CalcNumbers> = {}): CalcNumbers => ({
  damageMax: 9000.2,
  damageMin: 7000.2,
  hp: 1234.1,
  mp: 55,
  accuracy: 1.499e33,
  str: 11,
  agi: 22,
  wis: 33,
  luk: 44,
  dropRate: 2797521.5,
  afkGains: 1605.06,
  ...over,
});

interface Row {
  label: string;
  text: string;
}
const rowsOf = (s: Stats): Row[] => (s.state === "ready" ? s.rows : []);
const textOf = (s: Stats, label: string) =>
  rowsOf(s).find((r) => r.label === label)?.text;

test.each([
  [1234.1, "1,235"],
  [1234, "1,234"],
  [0, "0"],
  [999_999_999_999, "999,999,999,999"],
  [1e12, "1T"],
  [351.2e12, "352T"],
  [1e15, "1.00E15"],
  [2.5e20, "2.50E20"],
  [1.499e33, "1.49E33"],
])("formatNumber(%d) is %s", (n, text) => {
  expect(formatNumber(n)).toBe(text);
});

test("the ten rows come in the order of the game's Player Info", () => {
  expect(rowsOf(statsRows(numbers(), new Set()))).toEqual([
    { label: "Drop Rate", text: "2,797,522x" },
    { label: "Damage", text: "7,001 – 9,001" },
    { label: "HP", text: "1,235" },
    { label: "MP", text: "55" },
    { label: "STR", text: "11" },
    { label: "AGI", text: "22" },
    { label: "WIS", text: "33" },
    { label: "LUK", text: "44" },
    { label: "Accuracy", text: "1.49E33" },
    { label: "AFK Gains", text: "160,506%" },
  ]);
});

test("Accuracy is in E notation even when it is small", () => {
  expect(
    textOf(statsRows(numbers({ accuracy: 12 }), new Set()), "Accuracy"),
  ).toBe("1.20E1");
});

test("AFK Gains does not round up the error of multiplying by 100", () => {
  // 1.1 * 100 is 110.00000000000001 in floating point.
  expect(
    textOf(statsRows(numbers({ afkGains: 1.1 }), new Set()), "AFK Gains"),
  ).toBe("110%");
});

test.each(["damageMin", "damageMax"] as const)(
  "without %s the Damage row is unavailable",
  (id) => {
    expect(
      textOf(statsRows(numbers({ [id]: null }), new Set()), "Damage"),
    ).toBe("unavailable");
  },
);

test("a null number makes only its own row unavailable", () => {
  const s = statsRows(numbers({ hp: null }), new Set());
  expect(rowsOf(s).filter((r) => r.text === "unavailable")).toEqual([
    { label: "HP", text: "unavailable" },
  ]);
});

test("an id the check refused makes only its own row unavailable", () => {
  const s = statsRows(numbers(), new Set(["str"]));
  expect(rowsOf(s).filter((r) => r.text === "unavailable")).toEqual([
    { label: "STR", text: "unavailable" },
  ]);
});

function clock() {
  let t = 1_000;
  return {
    now: () => t,
    pass: (ms: number) => {
      t += ms;
    },
  };
}

test("a value within 1% of the list passes", () => {
  const c = clock();
  const check = statListCheck(c.now);
  check(numbers({ str: 1005 }), [1000, 22, 33, 44]);
  c.pass(50_001);
  expect(check(numbers({ str: 1005 }), [1000, 22, 33, 44])).toEqual(new Set());
});

test("a value within 1 point of the list passes", () => {
  const c = clock();
  const check = statListCheck(c.now);
  check(numbers({ str: 12 }), [11, 22, 33, 44]);
  c.pass(50_001);
  expect(check(numbers({ str: 12 }), [11, 22, 33, 44])).toEqual(new Set());
});

test("a different value passes for 50 s and then is unavailable", () => {
  const c = clock();
  const check = statListCheck(c.now);
  const list = [11, 22, 33, 900];
  expect(check(numbers(), list)).toEqual(new Set());
  c.pass(50_000);
  expect(check(numbers(), list)).toEqual(new Set());
  c.pass(1);
  expect(check(numbers(), list)).toEqual(new Set(["luk"]));
});

test("the list is read as STR, AGI, WIS, LUK", () => {
  const c = clock();
  const check = statListCheck(c.now);
  const list = [900, 901, 902, 903];
  check(numbers(), list);
  c.pass(50_001);
  expect(check(numbers(), list)).toEqual(new Set(["str", "agi", "wis", "luk"]));
});

test("equal again clears the row and its time", () => {
  const c = clock();
  const check = statListCheck(c.now);
  const far = [900, 22, 33, 44];
  check(numbers(), far);
  c.pass(50_001);
  expect(check(numbers(), far)).toEqual(new Set(["str"]));
  expect(check(numbers(), [11, 22, 33, 44])).toEqual(new Set());
  expect(check(numbers(), far)).toEqual(new Set());
});

test.each<[string, unknown]>([
  ["no list", undefined],
  ["a list with a non-number", [11, "x", 33, 44]],
  ["a list too short", [11, 22]],
  ["something else", { a: 1 }],
])("%s checks nothing", (_name, list) => {
  const c = clock();
  const check = statListCheck(c.now);
  check(numbers(), [900, 22, 33, 44]);
  c.pass(50_001);
  expect(check(numbers(), list)).toEqual(new Set());
  expect(check(numbers(), [900, 22, 33, 44])).toEqual(new Set()); // the time starts over
});

test("a number that was not calculated is not compared", () => {
  const c = clock();
  const check = statListCheck(c.now);
  const list = [900, 22, 33, 44];
  check(numbers({ str: null }), list);
  c.pass(50_001);
  expect(check(numbers({ str: null }), list)).toEqual(new Set());
});

function tracker() {
  const sent: Stats[] = [];
  const t = statsTracker((s) => sent.push(s));
  return { t, sent, last: () => sent.at(-1) };
}
const ready = (hp: string): Stats => ({
  state: "ready",
  rows: [{ label: "HP", text: hp }],
});

test("the first slice of a character shows Calculating, once", () => {
  const h = tracker();
  h.t.slice();
  h.t.slice();
  expect(h.sent).toEqual([{ state: "calculating" }]);
});

test("the first result shows the rows", () => {
  const h = tracker();
  h.t.slice();
  h.t.result(ready("1"));
  expect(h.last()).toEqual(ready("1"));
});

test("a new result keeps ready and never shows Calculating again (FR-024)", () => {
  const h = tracker();
  h.t.slice();
  h.t.result(ready("1"));
  h.t.slice();
  h.t.result(ready("2"));
  h.t.slice();
  expect(h.sent).toEqual([{ state: "calculating" }, ready("1"), ready("2")]);
});

test("a new character shows Calculating, without the old rows", () => {
  const h = tracker();
  h.t.slice();
  h.t.result(ready("1"));
  h.t.character();
  expect(h.last()).toEqual({ state: "calculating" });
  h.t.slice();
  expect(h.last()).toEqual({ state: "calculating" });
});

test("clear shows nothing and forgets the rows", () => {
  const h = tracker();
  h.t.slice();
  h.t.result(ready("1"));
  h.t.clear();
  expect(h.last()).toEqual({ state: "none" });
  h.t.slice();
  expect(h.last()).toEqual({ state: "calculating" });
});

test("unavailable holds through slices and results until a new start", () => {
  const h = tracker();
  h.t.slice();
  h.t.unavailable();
  expect(h.last()).toEqual({ state: "unavailable" });
  h.t.slice();
  h.t.result(ready("1"));
  h.t.character();
  expect(h.sent.at(-1)).toEqual({ state: "unavailable" });
  h.t.start();
  expect(h.last()).toEqual({ state: "none" });
  h.t.slice();
  expect(h.last()).toEqual({ state: "calculating" });
});

test("with no character, unavailable shows nothing and comes back with the next one", () => {
  const h = tracker();
  h.t.slice();
  h.t.unavailable();
  h.t.clear();
  expect(h.last()).toEqual({ state: "none" });
  h.t.slice();
  expect(h.last()).toEqual({ state: "unavailable" });
});

test("a stall shows unavailable, also before any slice", () => {
  const h = tracker();
  h.t.stalled();
  expect(h.last()).toEqual({ state: "unavailable" });
});

test("a slice after a stall goes back to Calculating", () => {
  const h = tracker();
  h.t.stalled();
  h.t.slice();
  expect(h.last()).toEqual({ state: "calculating" });
});

test("a slice after a stall goes back to the rows", () => {
  const h = tracker();
  h.t.slice();
  h.t.result(ready("1"));
  h.t.stalled();
  expect(h.last()).toEqual({ state: "unavailable" });
  h.t.slice();
  expect(h.last()).toEqual(ready("1"));
});

test("a slice after a stall does not hide a failed calculator", () => {
  const h = tracker();
  h.t.slice();
  h.t.unavailable();
  h.t.stalled();
  h.t.slice();
  expect(h.last()).toEqual({ state: "unavailable" });
});

test("clear ends a stall", () => {
  const h = tracker();
  h.t.stalled();
  h.t.clear();
  expect(h.last()).toEqual({ state: "none" });
});

test("replay repeats the last value", () => {
  const send = vi.fn();
  const t = statsTracker(send);
  t.slice();
  send.mockClear();
  t.replay();
  expect(send.mock.calls).toEqual([[{ state: "calculating" }]]);
});

test("replay before anything sends none", () => {
  const h = tracker();
  h.t.replay();
  expect(h.sent).toEqual([{ state: "none" }]);
});
