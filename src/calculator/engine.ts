// Runs the installed game's own code over a mosaic, in an isolated context (ADR 0006, research R7). The boot and the
// isolation live in boot.ts, shared with the tree worker.
import { anchored, bootContext, lazyDnsmKeys } from "./boot.ts";
import { TARGETS } from "./targets.ts";
import type { CalcNumbers } from "./targets.ts";

const NUMBER_MS = 2_000;
/** The limit of each call into the context, the one that runs all the helpers included. */
const START_MS = 8_000;
export const LIMITS = { startMs: START_MS, numberMs: NUMBER_MS };

export function createEngine(
  code: string,
  pak: Uint8Array,
): { calculate(mosaicJson: string): CalcNumbers } {
  const context = bootContext(anchored(code), pak, LIMITS);
  // The live game's actors are the trees' alone (spec 008 US12): the Stats stay as they were.
  context.run("__calc.ignoreActors()", START_MS);
  const lazyDnsm = lazyDnsmKeys(code);

  return {
    calculate(mosaicJson) {
      context.load(mosaicJson, lazyDnsm);
      return Object.fromEntries(
        TARGETS.map(([id, block, arg]) => [
          id,
          context.number(block, [arg, 0, 0]),
        ]),
      ) as CalcNumbers;
    },
  };
}
