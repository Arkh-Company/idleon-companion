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
import type { Recipe, RecipeStep, Recording } from "./recording.ts";

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
  args: readonly (string | number)[],
];

export function bootRecorder(
  code: string,
  pak: Uint8Array,
  limits: { startMs: number; numberMs: number } = TREE_LIMITS,
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
    /** A routine of the game run after the roots, on this copy only (spec 010, T152). */
    routine?: RecipeStep,
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
      try {
        run("__calc.loadMosaic()", startMs);
        run("__rec.begin(__recipe)", startMs);
        run(`__calc.helperPlan(${lazyDnsm})`, startMs);
        run("__calc.helperSteps()", startMs);
        run("__rec.afterHelpers()", startMs);
        if (scene) rebuildScene((text) => run(text, startMs));
        run(
          `__rec.roots(${JSON.stringify(roots)}, ${JSON.stringify(follow)})`,
          numberMs,
        );
        if (routine)
          run(
            `__rec.routine(${JSON.stringify(JSON.stringify(routine))})`,
            numberMs,
          );
        run("__rec.startBuilders()", startMs);
        recipe.builders.forEach((_, i) => {
          try {
            run(`__rec.builder(${String(i)})`, startMs);
          } catch {
            // A builder out of time leaves its cache unexplained; the total is already recorded.
            run("__rec.abandonBuilder()", startMs);
          }
        });
        const json = run("__rec.take()", startMs);
        if (typeof json !== "string") throw new Error("no recording");
        return JSON.parse(json) as Recording;
      } finally {
        run("__rec.stop()", startMs);
      }
    },
  };
}
