// Where each thing the keeper sends goes, and what a new page of the window gets again. No electron import, so tests
// can load it.
import type { LinkMessage, Status } from "../shared/index.ts";
import type { contextTracker } from "./context.ts";
import { isTown } from "./farm.ts";
import type { farmTracker } from "./farm.ts";
import { statusOnLinkDrop } from "./lifecycle.ts";
import {
  linkGameFiles,
  linkReading,
  linkState,
  linkStatus,
  linkTables,
} from "./payloads.ts";
import type { startPipelines } from "./pipelines.ts";
import type { startStatsPipeline } from "./stats-pipeline.ts";
import { afterGameClosed } from "./updates.ts";

export function routeLink(deps: {
  tracker: ReturnType<typeof contextTracker>;
  stats: Pick<
    ReturnType<typeof startStatsPipeline>,
    "message" | "reading" | "status" | "replay"
  >;
  formula: Pick<
    ReturnType<typeof startPipelines>["formula"],
    "status" | "gameFiles" | "replay" | "tables"
  >;
  updates: { replay(): void };
  farm: Pick<
    ReturnType<typeof farmTracker>,
    "onState" | "onMap" | "tables" | "reset" | "replay"
  >;
  status: () => Status;
  setStatus: (s: Status) => Promise<void>;
  sendStatus: (s: Status) => void;
  gameExited: () => void;
  page: { on(event: "did-finish-load", listener: () => void): unknown };
}): {
  message: (m: LinkMessage) => void;
  connected: (up: boolean) => void;
} {
  const { tracker, stats, formula, farm } = deps;
  /** The farm counts only while the game runs (FR-028): closed, it starts over. */
  const farmStatus = (s: Status) => {
    if (s.game !== "running") farm.reset();
  };
  deps.page.on("did-finish-load", () => {
    deps.sendStatus(deps.status());
    tracker.replay();
    deps.updates.replay();
    stats.replay();
    formula.replay();
    farm.replay();
  });
  return {
    message: (m) => {
      if (m.type === "reading") {
        const r = linkReading(m.reading);
        if (!r) return; // the decoder checks only the message type
        tracker.reading(r);
        stats.reading(r);
        if (r.char === null) farm.reset();
        else if (r.scene !== null) farm.onMap(r.map, isTown(r.scene));
      } else if (m.type === "tables") {
        const t = linkTables(m.tables);
        tracker.tables(t);
        farm.tables(t);
        formula.tables(t);
      } else if (m.type === "status") {
        const s = linkStatus(m.status);
        if (!s) return;
        stats.status(s);
        formula.status(s);
        farmStatus(s);
        const settled = deps.setStatus(s);
        if (s.game === "closed") void afterGameClosed(settled, deps.gameExited);
      } else {
        stats.message(m);
        if (m.type === "state") {
          const slice = linkState(m.slice);
          if (slice) farm.onState(slice);
        }
        if (m.type === "gameFiles") {
          const resources = linkGameFiles(m.resources);
          if (resources !== null) formula.gameFiles(resources);
        }
      }
    },
    connected: (up) => {
      if (up) return;
      const dropped = statusOnLinkDrop(deps.status());
      stats.status(dropped);
      formula.status(dropped);
      farmStatus(dropped);
      void deps.setStatus(dropped);
    },
  };
}
