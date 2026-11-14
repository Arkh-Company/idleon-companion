// @vitest-environment jsdom
// The window's tests stub every method of `window.companion`, the 008 ones included.
import { expect, test } from "vitest";
import { stubCompanion } from "./companion-stub.ts";

test.each([
  "requestFormula",
  "onFormula",
  "closeFormula",
  "formulaValues",
  "onLiveValues",
  "onPanel",
  "listMarks",
  "saveMark",
  "clearMark",
  "getPins",
  "setPins",
  "onFarm",
  "onRadar",
  "dismissRadar",
  "setSidePanel",
])("the stub has %s", (method) => {
  const stub = stubCompanion() as unknown as Record<string, unknown>;
  expect(typeof stub[method]).toBe("function");
  expect(window.companion).toBe(stub);
});
