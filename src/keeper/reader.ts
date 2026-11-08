// The reader loop: takes the engine once, runs read.js on it every second and emits each new reading.
import { toReading } from "../shared/index.ts";
import type { Reading, Status } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { AnchorNotFound, OBJECT_GROUP, acquireEngine } from "./engine-ref.ts";
import type { EngineRef } from "./engine-ref.ts";

const GAME_UPDATED = "Game updated: the reader needs an update";
/** Failed readings in a row before the status says so (spec, Open Questions, 07/11). */
const FAILS_BEFORE_WARNING = 10;

/** Why a reading failed: the exception read.js threw, or a value that is not a Reading. */
function failure(exceptionDetails: unknown): string {
  if (exceptionDetails === undefined) return "the reading has the wrong shape";
  const d = exceptionDetails as {
    text?: string;
    exception?: { description?: string };
  };
  return d.exception?.description ?? d.text ?? "unknown error";
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
    /** Called once per engine taken, with how long the game was paused (spec §7.2: the pause goes to the log). */
    onAttached?: (pausedMs: number) => void;
    /** Called on every good reading, changed or not, with its time (the window's "last reading N s ago"). */
    onRead?: (t: number) => void;
  } = {},
): { stop(): Promise<void> } {
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
      if (stopped) {
        resolve(); // a stop that came during a reading does not wait out the poll
        return;
      }
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
  // (Runtime.callFunctionOn rejects: dead object or session) or a failed acquireEngine leads to a new one, except a
  // missing anchor (a game update), which ends the reader for this game load.
  let ref: EngineRef | null = null;
  async function loop(): Promise<void> {
    let prev = "";
    let fails = 0;
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
          // A game update moved the anchor: every new try would attach and download N.js again for nothing, and the
          // game code does not change before the game is reopened. The "Game updated" status stays.
          if (e instanceof AnchorNotFound) return;
          await sleep(retryMs);
          continue;
        }
        if (isStopped()) return; // the finally below still lets the engine go
        prev = "";
        fails = 0;
        const { pausedMs } = ref;
        safely(() => {
          opts.onAttached?.(pausedMs);
        });
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
        const lost = ref;
        ref = null;
        await release(lost);
        await sleep(retryMs);
        continue;
      }
      const reading =
        answer.exceptionDetails === undefined
          ? toReading(answer.result.value, Date.now())
          : null;
      // A failed reading keeps the engine; ten in a row are told once, and the next good one clears it.
      if (!reading) {
        fails++;
        if (fails === FAILS_BEFORE_WARNING) {
          const message = `Reading failed: ${failure(answer.exceptionDetails)}`;
          safely(() => {
            onStatus({ game: "running", reader: "attached", message });
          });
        }
      } else {
        if (fails >= FAILS_BEFORE_WARNING)
          safely(() => {
            onStatus({ game: "running", reader: "attached" });
          });
        fails = 0;
        safely(() => {
          opts.onRead?.(reading.t);
        });
      }
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

  // Whatever ends the loop, a reference still held is let go (a stop can arrive while acquireEngine finishes).
  const done = loop().finally(() => (ref ? release(ref) : undefined));
  return {
    /** Resolves once the engine reference is let go and the page detached; the debugging pipe stays open. */
    stop() {
      stopped = true;
      wake?.();
      return done;
    },
  };
}
