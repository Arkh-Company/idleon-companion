// Each file fits in a single read (constitution: up to 400 lines; spec 010, T019): every file of declared/ and the
// recorder, which grow with each new root shape.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const MAX = 400;
const files = [
  ...readdirSync(import.meta.dirname).map((f) => join(import.meta.dirname, f)),
  join(import.meta.dirname, "..", "recorder.js"),
];

test("no file of declared/ nor the recorder passes 400 lines", () => {
  const long = files.flatMap((f) => {
    const n = readFileSync(f, "utf8").trimEnd().split("\n").length;
    return n > MAX ? [`${f}: ${String(n)}`] : [];
  });
  expect(long).toEqual([]);
});
