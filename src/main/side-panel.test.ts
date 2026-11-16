// The window that widens for the side panel (spec 008 FR-005): from 420 to 840 px toward the side with room, and back to
// its size when the panel closes, also after the player moved it.
import { expect, test } from "vitest";
import { sidePanelPayload } from "./payloads.ts";
import { sidePanelControl, sidePanelHandler } from "./side-panel.ts";

const AREA = { x: 0, y: 0, width: 1920, height: 1040 };

function windowAt(x: number, width = 420) {
  let bounds = { x, y: 100, width, height: 640 };
  const calls: unknown[] = [];
  const win = {
    getBounds: () => ({ ...bounds }),
    setBounds: (b: Partial<typeof bounds>) => {
      calls.push(b);
      bounds = { ...bounds, ...b };
    },
  };
  return {
    control: sidePanelControl(win, () => AREA),
    bounds: () => bounds,
    calls,
    move: (to: number) => {
      bounds = { ...bounds, x: to };
    },
    resize: (to: number) => {
      bounds = { ...bounds, width: to };
    },
  };
}

test("with room on the right the window widens to the right, to 840 px", () => {
  const w = windowAt(100);
  w.control.set(true);
  expect(w.bounds()).toMatchObject({ x: 100, width: 840, y: 100, height: 640 });
});

test("without room on the right it widens to the left", () => {
  const w = windowAt(1500);
  w.control.set(true);
  expect(w.bounds()).toMatchObject({ x: 1080, width: 840 });
});

test("with room on neither side whole, it stays inside the screen", () => {
  const w = windowAt(1700, 420);
  w.control.set(true);
  expect(w.bounds().x + w.bounds().width).toBeLessThanOrEqual(1920);
  expect(w.bounds().x).toBeGreaterThanOrEqual(0);
});

test.each([
  ["to the right", 100, 100],
  ["to the left", 1500, 1500],
])(
  "closing after widening %s gives back the size and the place",
  (_side, x, back) => {
    const w = windowAt(x);
    w.control.set(true);
    w.control.set(false);
    expect(w.bounds()).toMatchObject({ x: back, width: 420 });
  },
);

test("closing after the player moved the window keeps the move and gives back the width", () => {
  const w = windowAt(1500);
  w.control.set(true);
  w.move(900);
  w.control.set(false);
  expect(w.bounds()).toMatchObject({ x: 1320, width: 420 });
});

test("closing after the player narrowed the open window never goes under one window's width", () => {
  const w = windowAt(100);
  w.control.set(true);
  w.resize(600);
  w.control.set(false);
  expect(w.bounds()).toMatchObject({ width: 420 });
});

test("opening twice widens once, and closing a closed panel does nothing", () => {
  const w = windowAt(100);
  w.control.set(false);
  w.control.set(true);
  w.control.set(true);
  expect(w.calls).toHaveLength(1);
});

test("the window:sidePanel handler checks the body before the window moves", () => {
  const w = windowAt(100);
  const handle = sidePanelHandler(w.control);
  expect(() => {
    handle({ open: "yes" });
  }).toThrow("window:sidePanel: invalid request");
  expect(w.calls).toEqual([]);
  handle({ open: true });
  expect(w.bounds().width).toBe(840);
});

test.each<[string, unknown, { open: boolean } | null]>([
  ["open", { open: true }, { open: true }],
  ["closed", { open: false }, { open: false }],
  ["no body", undefined, null],
  ["a text", { open: "yes" }, null],
  ["another key", { open: true, width: 2000 }, null],
])("window:sidePanel with %s", (_name, payload, expected) => {
  expect(sidePanelPayload(payload)).toEqual(expected);
});
