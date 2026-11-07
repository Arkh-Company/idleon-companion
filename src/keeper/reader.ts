// The reader loop: takes the engine once, runs read.js on it every second and emits each new reading.
import type { Reading, Status } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { AnchorNotFound, OBJECT_GROUP, acquireEngine } from "./engine-ref.ts";
import type { EngineRef } from "./engine-ref.ts";

const GAME_UPDATED = "Game updated: the reader needs an update";

const isNumber = (v: unknown) => typeof v === "number";
const isTextOrNull = (v: unknown) => v === null || typeof v === "string";
const FIELDS: Record<keyof Omit<Reading, "t">, (v: unknown) => boolean> = {
  map: isNumber,
  menu: isNumber,
  menu2: isNumber,
  menu2tab: isNumber,
  skillTab: isNumber,
  char: isTextOrNull,
  afk: isTextOrNull,
  codexTab: (v) => v === null || isNumber(v),
  codexSel: (v) => isTextOrNull(v) || isNumber(v),
};

/** What read.js returned, as a Reading stamped at `t`; null when its shape is not a Reading's. */
export function toReading(value: unknown, t: number): Reading | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  for (const [k, ok] of Object.entries(FIELDS)) if (!ok(v[k])) return null;
  const r = v as Omit<Reading, "t">;
  return {
    t,
    map: r.map,
    menu: r.menu,
    menu2: r.menu2,
    menu2tab: r.menu2tab,
    skillTab: r.skillTab,
    char: r.char,
    afk: r.afk,
    codexTab: r.codexTab,
    codexSel: r.codexSel,
  };
}

export function startReader(
  cdp: Cdp,
  readSource: () => string,
  onReading: (r: Reading) => void,
  onStatus: (s: Status) => void,
  opts: {
    pollMs?: number;
    retryMs?: number;
    anchor?: string;
    scriptSuffix?: string;
  } = {},
): { stop(): void } {
  const pollMs = opts.pollMs ?? 1000;
  const retryMs = opts.retryMs ?? 5000;
  const anchor = opts.anchor ?? "getGameAttribute:function(";
  const scriptSuffix = opts.scriptSuffix ?? "/static/game/N.js";
  let stopped = false;
  // A function, not the variable: TypeScript would keep `stopped` narrowed to false across the awaits.
  const isStopped = () => stopped;
  let wake: (() => void) | undefined;
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  async function loop(): Promise<void> {
    let ref: EngineRef | null = null;
    let prev = "";
    while (!isStopped()) {
      try {
        if (!ref) {
          onStatus({ game: "running", reader: "connecting" });
          ref = await acquireEngine(cdp, { scriptSuffix, anchor });
          if (isStopped()) return;
          onStatus({ game: "running", reader: "attached" });
        }
        const { result, exceptionDetails } = (await cdp.send(
          "Runtime.callFunctionOn",
          {
            objectId: ref.objectId,
            functionDeclaration: readSource(),
            returnByValue: true,
          },
          ref.sessionId,
        )) as {
          result: { value?: unknown };
          exceptionDetails?: { text?: string };
        };
        if (exceptionDetails)
          throw new Error(exceptionDetails.text ?? "read.js failed");
        const reading = toReading(result.value, Date.now());
        const key = JSON.stringify({ ...reading, t: 0 });
        // A value with the wrong shape is skipped, not re-acquired: taking the engine again pauses the game.
        if (reading && key !== prev && !isStopped()) {
          prev = key;
          onReading(reading);
        }
      } catch (e) {
        if (isStopped()) return;
        onStatus({
          game: "running",
          reader: "error",
          message:
            e instanceof AnchorNotFound
              ? GAME_UPDATED
              : e instanceof Error
                ? e.message
                : String(e),
        });
        if (ref) await release(ref);
        ref = null;
        prev = "";
        await sleep(retryMs);
        continue;
      }
      await sleep(pollMs);
    }
  }

  /** Lets go of a dead or failing engine reference before taking a new one. */
  async function release(ref: EngineRef): Promise<void> {
    await cdp
      .send(
        "Runtime.releaseObjectGroup",
        { objectGroup: OBJECT_GROUP },
        ref.sessionId,
      )
      .catch(() => undefined);
    await cdp
      .send("Target.detachFromTarget", { sessionId: ref.sessionId })
      .catch(() => undefined);
  }

  // A throwing callback must not leave an unhandled rejection in the keeper.
  loop().catch(() => undefined);
  return {
    stop() {
      stopped = true;
      wake?.();
    },
  };
}
