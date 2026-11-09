// The two readers of a game, wired together: the 1 s reader and the reader of the state, one read of the game at a time.
import type { Cdp } from "./cdp.ts";
import type { EngineRef } from "./engine-ref.ts";
import type { KeeperDeps, KeeperLog } from "./keeper.ts";
import { startReader } from "./reader.ts";
import { inTurn, startStateReader } from "./state-reader.ts";
import { createVarsReader } from "./vars-reader.ts";

/** Gives the text of a script sent to the game, by its file name; throws when it cannot. */
export type LoadScript = (file: string) => string;

const FAILING = "state-read-failing";

/** Once for the whole session; a missing script only turns the state reading off: ending the keeper closes the game. */
export function loadStateScripts(
  load: LoadScript,
  log: KeeperLog,
): { listSource: string; sliceSource: string } | null {
  try {
    return {
      listSource: load("state-list.js"),
      sliceSource: load("state-slice.js"),
    };
  } catch {
    log(FAILING);
    return null;
  }
}

/** The 1 s reader and, sharing its engine and one read at a time, the reader of the state. */
export function startReaders(
  scripts: ReturnType<typeof loadStateScripts>,
  load: LoadScript,
  log: KeeperLog,
): KeeperDeps["read"] {
  return (cdp, onReading, onStatus, onAttached, onRead, onSlice) => {
    const turn = inTurn();
    let engine: EngineRef | null = null;
    const reader = startReader(
      cdp,
      () => load("read.js"),
      onReading,
      onStatus,
      {
        onAttached,
        onRead,
        onEngine: (ref) => {
          engine = ref;
        },
        turn,
      },
    );
    if (!scripts) return reader;
    const send: Cdp["send"] = (...args) => cdp.send(...args);
    const state = startStateReader({
      send,
      engine: () => engine,
      ...scripts,
      turn,
      onSlice,
      onFailing: () => {
        log(FAILING);
      },
      vars: createVarsReader(send, scripts.sliceSource),
    });
    return {
      async stop() {
        await state.stop();
        await reader.stop();
      },
    };
  };
}
