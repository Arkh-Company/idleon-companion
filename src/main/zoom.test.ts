// Text zoom (spec 008 FR-031): Ctrl+=, Ctrl+-, Ctrl+0 and Ctrl+wheel, from 100% to 200%, saved in the settings.
import { expect, test, vi } from "vitest";
import { zoomControl, zoomFactor } from "./zoom.ts";

function control(initial: unknown) {
  const page = { setZoomFactor: vi.fn<(f: number) => void>() };
  const save = vi.fn<(f: number) => void>();
  return { zoom: zoomControl(initial, page, save), page, save };
}

const ctrl = (key: string) => ({
  type: "keyDown",
  key,
  control: true,
  alt: false,
});

test.each([
  ["=", 1, 1.1],
  ["+", 1, 1.1],
  ["-", 1.5, 1.4],
  ["0", 1.5, 1],
])(
  "Ctrl+%s takes %d to %d, sets it on the page and saves it",
  (key, from, to) => {
    const { zoom, page, save } = control(from);
    expect(zoom.key(ctrl(key))).toBe(true);
    expect(zoom.factor()).toBe(to);
    expect(page.setZoomFactor).toHaveBeenLastCalledWith(to);
    expect(save).toHaveBeenLastCalledWith(to);
  },
);

test.each([
  ["in", 1.2, 1.3],
  ["out", 1.2, 1.1],
] as const)("Ctrl+wheel %s takes %d to %d", (direction, from, to) => {
  const { zoom, page, save } = control(from);
  zoom.wheel(direction);
  expect(zoom.factor()).toBe(to);
  expect(page.setZoomFactor).toHaveBeenLastCalledWith(to);
  expect(save).toHaveBeenLastCalledWith(to);
});

test("the step is 10%, and ten steps from 100% land on 200% exactly", () => {
  const { zoom } = control(1);
  const seen = Array.from({ length: 10 }, () => {
    zoom.key(ctrl("="));
    return zoom.factor();
  });
  expect(seen).toEqual([1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2]);
});

test.each([
  ["Ctrl+= at 200%", 2, "="],
  ["Ctrl+- at 100%", 1, "-"],
])("%s stays, is still taken, and saves nothing", (_name, from, key) => {
  const { zoom, page, save } = control(from);
  expect(zoom.key(ctrl(key))).toBe(true);
  expect(zoom.factor()).toBe(from);
  expect(page.setZoomFactor).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

test("the wheel stops at the limits too", () => {
  const top = control(2);
  top.zoom.wheel("in");
  expect(top.zoom.factor()).toBe(2);
  const bottom = control(1);
  bottom.zoom.wheel("out");
  expect(bottom.zoom.factor()).toBe(1);
  expect(top.save).not.toHaveBeenCalled();
  expect(bottom.save).not.toHaveBeenCalled();
});

test.each([
  ["without Ctrl", { ...ctrl("="), control: false }],
  ["with Ctrl+Alt (AltGr)", { ...ctrl("="), alt: true }],
  ["on key up", { ...ctrl("="), type: "keyUp" }],
  ["another key", ctrl("a")],
])("a key %s is not a zoom key", (_name, input) => {
  const { zoom, page, save } = control(1);
  expect(zoom.key(input)).toBe(false);
  expect(zoom.factor()).toBe(1);
  expect(page.setZoomFactor).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

test("the saved factor is set on the page when the window opens", () => {
  const { zoom, page, save } = control(1.5);
  zoom.apply();
  expect(page.setZoomFactor).toHaveBeenCalledWith(1.5);
  expect(save).not.toHaveBeenCalled();
});

test.each([
  ["missing", undefined, 1],
  ["below 100%", 0.5, 1],
  ["above 200%", 2.5, 1],
  ["not a number", "1.5", 1],
  ["NaN", Number.NaN, 1],
  ["100%", 1, 1],
  ["200%", 2, 2],
  ["within the range", 1.3, 1.3],
])("a saved factor %s is read with the limits", (_name, v, expected) => {
  expect(zoomFactor(v)).toBe(expected);
});

test("an invalid saved factor opens the window at 100%", () => {
  const { zoom, page } = control(9);
  zoom.apply();
  expect(page.setZoomFactor).toHaveBeenCalledWith(1);
});
