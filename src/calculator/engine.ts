// Runs the installed game's own code over a mosaic, in an isolated context (ADR 0006, research R7). Errors of the game
// are never read here: a value that came from the context is only ever tested for being a number.
import { createContext, runInContext, Script } from "node:vm";
import { gunzipSync, inflateRawSync, inflateSync } from "node:zlib";
import contextSource from "./context.js?raw";
import { TARGETS } from "./targets.ts";
import type { CalcNumbers } from "./targets.ts";

const ANCHOR = 'A["com.stencyl.Engine"]=a,';
const NUMBER_MS = 2_000;
/** The longest a whole step of the start may take: the helpers' longest, as in the lab. */
const START_MS = 8_000;

type Decompress = (data: Uint8Array) => Uint8Array | null;

/** Maps the game creates lazily, read as `DNSM").h.KEY.h`, except the ones it fills itself when absent (a text scan). */
function lazyDnsmKeys(code: string): string[] {
  const names = [...code.matchAll(/DNSM"\)\.h\.(\w+)\.h(?!\w)/g)].map(
    (m) => m[1] ?? "",
  );
  return [...new Set(names)].filter((n) => !code.includes(`.h,"${n}")`));
}

interface Started {
  sandbox: Record<string, unknown>;
  run: (text: string, timeout: number) => unknown;
}

export function createEngine(
  code: string,
  pak: Uint8Array,
): { calculate(mosaicJson: string): CalcNumbers } {
  if (code.split(ANCHOR).length !== 2)
    throw new Error("the game's anchor is not there exactly once");
  const game = new Script(code.replace(ANCHOR, `${ANCHOR}globalThis.__hx=A,`), {
    filename: "game.js",
  });
  const lazyDnsm = JSON.stringify(lazyDnsmKeys(code));

  function boot(): Started {
    // No prototype, or the game's `this.constructor.constructor` would be the host's Function.
    const sandbox = Object.create(null) as Record<string, unknown>;
    const context = createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false },
    });
    const run = (text: string, timeout: number): unknown =>
      runInContext(text, context, { timeout });

    const install = run(contextSource, START_MS) as (
      ...decompressors: Decompress[]
    ) => void;
    const ContextArray = run("Uint8Array", START_MS) as Uint8ArrayConstructor;
    // The host's own `set`, here and for the pak: `array.set` would look it up in the context, where the game can
    // replace it and receive host bytes.
    const decompressor =
      (inflater: (bytes: Buffer) => Buffer): Decompress =>
      (data) => {
        try {
          const bytes = inflater(
            Buffer.from(data.buffer, data.byteOffset, data.byteLength),
          );
          const out = new ContextArray(bytes.length);
          Uint8Array.prototype.set.call(out, bytes);
          return out;
        } catch {
          return null; // A host error never reaches the game: it could climb to the host's Function.
        }
      };
    install(
      decompressor(gunzipSync),
      decompressor(inflateSync),
      decompressor(inflateRawSync),
    );

    game.runInContext(context, { timeout: START_MS });
    const pakCopy = new ContextArray(pak.length);
    Uint8Array.prototype.set.call(pakCopy, pak);
    sandbox.__pak = pakCopy;
    run("__calc.start(__pak)", START_MS);
    run("__calc.tables()", START_MS);
    return { sandbox, run };
  }

  const { sandbox, run } = boot();

  return {
    calculate(mosaicJson) {
      sandbox.__mosaic = mosaicJson;
      run("__calc.loadMosaic()", START_MS);
      run(`__calc.helperPlan(${lazyDnsm})`, START_MS);
      run("__calc.helperSteps()", START_MS);
      run("__calc.finishHelpers()", START_MS);
      return Object.fromEntries(
        TARGETS.map(([id, block, arg]) => {
          let value: unknown = null;
          try {
            value = run(
              `__calc.number(${JSON.stringify(block)},${JSON.stringify(arg)})`,
              NUMBER_MS,
            );
          } catch {
            // This number alone is unavailable.
          }
          return [
            id,
            typeof value === "number" && Number.isFinite(value) ? value : null,
          ];
        }),
      ) as CalcNumbers;
    },
  };
}
