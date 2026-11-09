// A rule on a behavior the reader does not read would never match and show "Unknown tab": each key must come from read.js.
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";
import { SCREEN_CATALOG } from "../shared/screens/index.ts";
import { READ_CONTRACT } from "./read-contract-fixture.ts";
import { loadReadSource } from "./read-source.ts";

function readBehaviors(): Record<string, unknown> {
  const actors: { behaviors: { cache: { h: Record<string, unknown> } } }[] = [];
  for (const [n, id, field] of READ_CONTRACT) {
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
