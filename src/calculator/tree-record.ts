// The tree worker's context: the game instrumented in memory (instrument.ts), with the recorder installed before the
// game runs, and one recording per request (spec 008, T021, research R1). The recording crosses as JSON text only.
import { anchored, bootContext, lazyDnsmKeys } from "./boot.ts";
import type { Context } from "./boot.ts";
import { rebuildScene } from "./inactive.ts";
import { instrument } from "./instrument.ts";
import type { Op } from "./instrument.ts";
import namesReaderSource from "./names-reader.js?raw";
import recorderPassSource from "./recorder-pass.js?raw";
import recorderSource from "./recorder.js?raw";
import type { Recipe, Recording, RoutineRun } from "./recording.ts";

/** Measured again on the compiled calculator.js over the real game (T026); the host's own limit is above these. */
export const TREE_LIMITS = { startMs: 20_000, numberMs: 10_000 };

/**
 * A follow-up call after the roots (recorder.js `roots`): for each argument the roots gave block `block` in mode
 * `mode`, block `then` in mode `thenMode` with that argument.
 */
export type FollowCall = readonly [
  block: string,
  mode: string,
  then: string,
  thenMode: string,
];
export type RootCall = readonly [
  block: string,
  /** A number, a text, or a short list of numbers (spec 010, T159). */
  args: readonly (string | number | readonly number[])[],
];

/** Puts an infinite number back at its place: the path from the recording's top, then its sign (recorder.js, infAt). */
function putInfinity(rec: Recording, path: readonly (string | number)[]) {
  let o = rec as unknown as Record<string | number, unknown>;
  for (const k of path.slice(0, -2))
    o = o[k] as Record<string | number, unknown>;
  const key = path.at(-2);
  if (key !== undefined)
    o[key] = Number(path.at(-1)) < 0 ? -Infinity : Infinity;
}

export function bootRecorder(
  code: string,
  pak: Uint8Array,
  limits: { startMs: number; numberMs: number } = TREE_LIMITS,
  /** Keep an infinite number as a number (spec 010, T162: the answer key only); the live tree gets null, as always. */
  { infinite = false }: { infinite?: boolean } = {},
): {
  context: Context;
  /** The instrumentation's steps, by the id the recording's `x` gives them (they never leave the worker). */
  ops: readonly Op[];
  /**
   * One recording over the mosaic, with `scene` an inactive character's scene caches rebuilt after the helpers; throws
   * when a step runs out of time or the recording is not text.
   */
  record(
    mosaicJson: string,
    roots: readonly RootCall[],
    recipe: Recipe,
    scene?: boolean,
    follow?: readonly FollowCall[],
    /** A routine of the game run after the roots, on this copy only, step by step (spec 010, T152, T156). */
    routine?: readonly RoutineRun[],
  ): Recording;
} {
  const { source, ops } = instrument(anchored(code));
  const context = bootContext(source, pak, limits, [
    recorderSource,
    recorderPassSource,
    namesReaderSource,
  ]);
  const { sandbox } = context;
  const run = (text: string, ms: number) => context.run(text, ms);
  const { startMs, numberMs } = limits;
  run("__rec.wrap()", startMs);
  // On the original code: the instrumented copy could hide a key from the scan.
  const lazyDnsm = JSON.stringify(lazyDnsmKeys(code));

  return {
    context,
    ops,
    record(mosaicJson, roots, recipe, scene = false, follow = [], routine) {
      sandbox.__mosaic = mosaicJson;
      sandbox.__recipe = JSON.stringify(recipe);
      const ms: Record<string, number> = {};
      let t = performance.now();
      const lap = (stage: string) => {
        const now = performance.now();
        ms[stage] = now - t;
        t = now;
      };
      try {
        run("__calc.loadMosaic()", startMs);
        lap("mosaic");
        run("__rec.begin(__recipe)", startMs);
        run(`__calc.helperPlan(${lazyDnsm})`, startMs);
        run("__calc.helperSteps()", startMs);
        run("__rec.afterHelpers()", startMs);
        if (scene) rebuildScene((text) => run(text, startMs));
        lap("helpers");
        run(
          `__rec.roots(${JSON.stringify(roots)}, ${JSON.stringify(follow)})`,
          numberMs,
        );
        if (routine)
          run(
            `__rec.routine(${JSON.stringify(JSON.stringify(routine))})`,
            numberMs,
          );
        lap("roots");
        run("__rec.startBuilders()", startMs);
        recipe.builders.forEach((_, i) => {
          try {
            run(`__rec.builder(${String(i)})`, startMs);
          } catch {
            // A builder out of time leaves its cache unexplained; the total is already recorded.
            run("__rec.abandonBuilder()", startMs);
          }
        });
        lap("builders");
        const json = run("__rec.take()", startMs);
        if (typeof json !== "string") throw new Error("no recording");
        lap("take");
        const rec = JSON.parse(json) as Recording;
        // an infinite number crossed as null, and its place apart (recorder.js, infAt): no label pass over the whole
        // recording, seconds on the real game (the seventh probe)
        if (infinite) {
          const at = run("__rec.infAt()", startMs);
          for (const p of JSON.parse(String(at)) as (string | number)[][])
            putInfinity(rec, p);
        }
        lap("parse");
        rec.ms = ms;
        return rec;
      } finally {
        run("__rec.stop()", startMs);
      }
    },
  };
}
