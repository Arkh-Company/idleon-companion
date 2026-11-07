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

  /** A callback that throws is the caller's problem: it never stops the loop or takes the engine again. */
  const safely = (f: () => void) => {
    try {
      f();
    } catch {
      // ignored on purpose
    }
  };
  const failed = (e: unknown) => {
    safely(() => {
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
    });
  };

  // Spec §3 and §7.1: the engine is taken once per game load. A failed reading (an exception inside read.js, a value
  // of the wrong shape) is skipped and the next cycle reads again with the same reference; only a lost reference
  // (Runtime.callFunctionOn rejects: dead object or session) or a failed acquireEngine leads to a new one.
  async function loop(): Promise<void> {
    let ref: EngineRef | null = null;
    let prev = "";
    while (!isStopped()) {
      if (!ref) {
        safely(() => {
          onStatus({ game: "running", reader: "connecting" });
        });
        try {
          ref = await acquireEngine(cdp, { scriptSuffix, anchor });
        } catch (e) {
          if (isStopped()) return;
          failed(e);
          await sleep(retryMs);
          continue;
        }
        if (isStopped()) return;
        prev = "";
        safely(() => {
          onStatus({ game: "running", reader: "attached" });
        });
      }
      let source: string;
      try {
        source = readSource();
      } catch {
        await sleep(pollMs);
        continue;
      }
      let answer: {
        result: { value?: unknown };
        exceptionDetails?: unknown;
      };
      try {
        answer = (await cdp.send(
          "Runtime.callFunctionOn",
          {
            objectId: ref.objectId,
            functionDeclaration: source,
            returnByValue: true,
          },
          ref.sessionId,
        )) as typeof answer;
      } catch (e) {
        if (isStopped()) return;
        failed(e);
        await release(ref);
        ref = null;
        await sleep(retryMs);
        continue;
      }
      const reading =
        answer.exceptionDetails === undefined
          ? toReading(answer.result.value, Date.now())
          : null;
      const key = JSON.stringify({ ...reading, t: 0 });
      if (reading && key !== prev && !isStopped()) {
        prev = key;
        safely(() => {
          onReading(reading);
        });
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

  void loop();
  return {
    stop() {
      stopped = true;
      wake?.();
    },
  };
}
