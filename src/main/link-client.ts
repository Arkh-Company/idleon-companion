// The app's side of the link (spec §5.4): connects to the keeper's pipe and tries again every `retryMs` while it is
// missing or after it drops. Node `net` on a pipe path only, never TCP.
import { connect } from "node:net";
import type { Socket } from "node:net";
import { createLineDecoder, encodeLine } from "../shared/index.ts";
import type { LinkMessage } from "../shared/index.ts";

/** `onConnected(true)` on each connection, `onConnected(false)` when a connection drops. */
export function connectLink(
  pipePath: string,
  onMessage: (m: LinkMessage) => void,
  onConnected: (up: boolean) => void,
  retryMs = 5000,
): { send(m: LinkMessage): void; close(): void } {
  let socket: Socket | undefined;
  let up = false;
  let closed = false;
  let timer: NodeJS.Timeout | undefined;

  function open(): void {
    const s = connect(pipePath);
    socket = s;
    s.on("connect", () => {
      up = true;
      onConnected(true);
    });
    s.on("data", createLineDecoder(onMessage)); // one decoder per connection: no half line carries over
    s.on("error", () => undefined); // no keeper yet, or it went away: "close" follows
    s.on("close", () => {
      if (up) {
        up = false;
        onConnected(false);
      }
      if (!closed) timer = setTimeout(open, retryMs);
    });
  }
  open();

  return {
    send(m) {
      if (up && socket?.writable) socket.write(encodeLine(m));
    },
    close() {
      closed = true;
      clearTimeout(timer);
      socket?.destroy();
    },
  };
}
