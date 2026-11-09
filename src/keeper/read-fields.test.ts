// A rule on a behavior the reader does not read would never match and show "Unknown tab": each key must come from read.js.
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";
import { SCREEN_CATALOG } from "../shared/index.ts";
import { loadReadSource } from "./read-source.ts";

// The behaviors of contracts/read-fields.md: [PixelHelperActor index, ActorEvents number, field].
const BEHAVIORS: [number, number, string][] = [
  [0, 29, "_MenuType2TabPage"],
  [0, 29, "_AnvilTabSelected"],
  [0, 29, "_TabIndex0to5"],
  [1, 116, "_GeneralINFO"],
  [2, 167, "_GeneralInfo"],
  [3, 201, "_GenINFO"],
  [4, 229, "_GenInfo"],
  [5, 232, "_GenINFO"],
  [6, 312, "_GenINFO"],
  [7, 340, "_GenINFO"],
  [8, 481, "_GenINFO"],
  [21, 510, "_GenINFO"],
  [22, 548, "_GenINFO"],
  [23, 577, "_GenINFO"],
  [24, 623, "_GenINFO"],
  [25, 670, "_GenINFO"],
  [26, 713, "_GenINFO"],
  [27, 741, "_GenINFO"],
];

function readBehaviors(): Record<string, unknown> {
  const actors: { behaviors: { cache: { h: Record<string, unknown> } } }[] = [];
  for (const [n, id, field] of BEHAVIORS) {
    actors[n] ??= { behaviors: { cache: { h: {} } } };
    const events = actors[n].behaviors.cache.h;
    const name = `ActorEvents_${String(id)}`;
    const entry = (events[name] ?? { script: {} }) as {
      script: Record<string, unknown>;
    };
    entry.script[field] = [];
    events[name] = entry;
  }
  const src = loadReadSource(join(import.meta.dirname, "read.js"));
  const fn = runInNewContext(src) as (this: unknown) => {
    behaviors: Record<string, unknown>;
  };
  return fn.call({ gameAttributes: { h: { PixelHelperActor: actors } } })
    .behaviors;
}

test("every behavior key of a rule is one the reader reads", () => {
  const read = readBehaviors();
  const keys = [...SCREEN_CATALOG.overlays, ...SCREEN_CATALOG.screens]
    .flatMap((rule) => Object.keys(rule.when))
    .filter((key) => key.startsWith("H"));
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.filter((key) => !Object.hasOwn(read, key))).toEqual([]);
});
