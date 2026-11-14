// Where each thing the keeper sends goes, and what a new page of the window gets again. No electron import, so tests
// can load it.
import type { LinkMessage, Status } from "../shared/index.ts";
import type { contextTracker } from "./context.ts";
import { statusOnLinkDrop } from "./lifecycle.ts";
import { linkReading, linkStatus, linkTables } from "./payloads.ts";
import type { startStatsPipeline } from "./stats-pipeline.ts";
import { afterGameClosed } from "./updates.ts";

export function routeLink(deps: {
  tracker: ReturnType<typeof contextTracker>;
  stats: Pick<
    ReturnType<typeof startStatsPipeline>,
    "message" | "reading" | "status" | "replay"
  >;
  updates: { replay(): void };
  status: () => Status;
  setStatus: (s: Status) => Promise<void>;
  sendStatus: (s: Status) => void;
  gameExited: () => void;
  page: { on(event: "did-finish-load", listener: () => void): unknown };
}): {
  message: (m: LinkMessage) => void;
  connected: (up: boolean) => void;
} {
  const { tracker, stats } = deps;
  deps.page.on("did-finish-load", () => {
    deps.sendStatus(deps.status());
    tracker.replay();
    deps.updates.replay();
    stats.replay();
  });
  return {
    message: (m) => {
      if (m.type === "reading") {
        const r = linkReading(m.reading);
        if (!r) return; // the decoder checks only the message type
        tracker.reading(r);
        stats.reading(r);
      } else if (m.type === "tables") {
        tracker.tables(linkTables(m.tables));
      } else if (m.type === "status") {
        const s = linkStatus(m.status);
        if (!s) return;
        stats.status(s);
        const settled = deps.setStatus(s);
        if (s.game === "closed") void afterGameClosed(settled, deps.gameExited);
      } else stats.message(m);
    },
    connected: (up) => {
      if (up) return;
      const dropped = statusOnLinkDrop(deps.status());
      stats.status(dropped);
      void deps.setStatus(dropped);
    },
  };
}
