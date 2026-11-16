// The boot of the game's context, shared by the Stats engine and the tree worker (ADR 0006, research R1). Errors of the
// game are never read here: a value that came from the context is only ever tested for being a number.
import { createContext, runInContext, Script } from "node:vm";
import { gunzipSync, inflateRawSync, inflateSync } from "node:zlib";
import contextSource from "./context.js?raw";

const ANCHOR = 'A["com.stencyl.Engine"]=a,';

type Decompress = (data: Uint8Array) => Uint8Array | null;

/** The game's code with the engine registry exposed as `__hx`; throws unless the anchor is there exactly once. */
export function anchored(code: string): string {
  if (code.split(ANCHOR).length !== 2)
    throw new Error("the game's anchor is not there exactly once");
  return code.replace(ANCHOR, `${ANCHOR}globalThis.__hx=A,`);
}

/** Maps the game creates lazily, read as `DNSM").h.KEY.h`, except the ones it fills itself when absent (a text scan). */
export function lazyDnsmKeys(code: string): string[] {
  const names = [...code.matchAll(/DNSM"\)\.h\.(\w+)\.h(?!\w)/g)].map(
    (m) => m[1] ?? "",
  );
  return [...new Set(names)].filter((n) => !code.includes(`.h,"${n}")`));
}

export interface Context {
  sandbox: Record<string, unknown>;
  run(text: string, timeout: number): unknown;
  /** Puts a mosaic in the state and runs the helpers; throws when the mosaic is not JSON or a step runs out of time. */
  load(mosaicJson: string, lazyDnsm: readonly string[]): void;
  /** One block of the game with these exact arguments; null unless a finite number came back in time. */
  number(block: string, args: readonly (string | number)[]): number | null;
}

/** Runs the anchored game in a context of its own, with no code generation and no host object inside it. */
export function bootContext(
  script: string,
  pak: Uint8Array,
  limits: { startMs: number; numberMs: number },
  /** Texts run after the context's own and before the game's code (the tree worker's recorder). */
  preludes: readonly string[] = [],
): Context {
  const game = new Script(script, { filename: "game.js" });
  // No prototype, or the game's `this.constructor.constructor` would be the host's Function.
  const sandbox = Object.create(null) as Record<string, unknown>;
  const context = createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });
  const run = (text: string, timeout: number): unknown =>
    runInContext(text, context, { timeout });
  const { startMs, numberMs } = limits;

  const install = run(contextSource, startMs) as (
    ...decompressors: Decompress[]
  ) => void;
  const ContextArray = run("Uint8Array", startMs) as Uint8ArrayConstructor;
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

  for (const prelude of preludes) run(prelude, startMs);
  game.runInContext(context, { timeout: startMs });
  const pakCopy = new ContextArray(pak.length);
  Uint8Array.prototype.set.call(pakCopy, pak);
  sandbox.__pak = pakCopy;
  run("__calc.start(__pak)", startMs);
  run("__calc.tables()", startMs);

  return {
    sandbox,
    run,
    load(mosaicJson, lazyDnsm) {
      sandbox.__mosaic = mosaicJson;
      run("__calc.loadMosaic()", startMs);
      run(`__calc.helperPlan(${JSON.stringify(lazyDnsm)})`, startMs);
      run("__calc.helperSteps()", startMs);
      run("__calc.finishHelpers()", startMs);
    },
    number(block, args) {
      let value: unknown = null;
      try {
        value = run(
          `__calc.call(${JSON.stringify(block)},${JSON.stringify(args)})`,
          numberMs,
        );
      } catch {
        // The time limit: this number alone is unavailable.
      }
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
  };
}
