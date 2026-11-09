// The keeper's side of the link (spec §5.4): a local named-pipe server that sends every app the last tables, status
// and reading, then each new message. Node `net` on a pipe path only, never TCP.
import { createServer } from "node:net";
import type { Socket } from "node:net";
import { createLineDecoder, encodeLine } from "../shared/index.ts";
import type { LinkMessage } from "../shared/index.ts";

/** Another keeper already holds the link pipe: this one must not launch the game a second time. */
export class AlreadyRunning extends Error {
  constructor(pipePath: string) {
    super(`another keeper holds ${pipePath}`);
    this.name = "AlreadyRunning";
  }
}

export async function startLinkServer(
  pipePath: string,
  onMessage: (m: "confirm-attach" | "release" | "reconnect") => void,
): Promise<{ publish(m: LinkMessage): void; close(): Promise<void> }> {
  const clients = new Set<Socket>();
  let lastTables: LinkMessage | undefined;
  let lastStatus: LinkMessage | undefined;
  let lastReading: LinkMessage | undefined;
  const write = (s: Socket, m: LinkMessage | undefined) => {
    if (m && s.writable) s.write(encodeLine(m));
  };

  const server = createServer((socket) => {
    clients.add(socket);
    // An app that dies mid-write only loses its own connection.
    socket.on("error", () => undefined);
    socket.on("close", () => clients.delete(socket));
    socket.on(
      "data",
      createLineDecoder((m) => {
        if (
          m.type === "confirm-attach" ||
          m.type === "release" ||
          m.type === "reconnect"
        )
          onMessage(m.type);
      }),
    );
    write(socket, lastTables);
    write(socket, lastStatus);
    write(socket, lastReading);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", (e: NodeJS.ErrnoException) => {
      reject(e.code === "EADDRINUSE" ? new AlreadyRunning(pipePath) : e);
    });
    server.listen(pipePath, resolve);
  });
  server.on("error", () => undefined);

  return {
    publish(m) {
      if (m.type === "tables") lastTables = m;
      if (m.type === "status") lastStatus = m;
      if (m.type === "reading") lastReading = m;
      for (const c of clients) write(c, m);
    },
    close() {
      return new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
        // end() lets the last message (the game closed) reach the apps; an app that never closes its side is cut.
        for (const c of clients) c.end();
        setTimeout(() => {
          for (const c of clients) c.destroy();
        }, 1000).unref();
      });
    },
  };
}
