// The keeper ↔ app link (spec §5.4): one JSON message per line over a local named pipe, never TCP.
import type { GameTables, Reading, Status } from "./types.ts";

export const LINK_PIPE = "\\\\.\\pipe\\idleon-companion";

export type LinkMessage =
  | { type: "reading"; reading: Reading }
  | { type: "status"; status: Status }
  | { type: "tables"; tables: GameTables }
  | { type: "confirm-attach" }
  | { type: "release" }
  | { type: "reconnect" };

export function encodeLine(m: LinkMessage): string {
  return `${JSON.stringify(m)}\n`;
}

/** A plain object: not null and not an array. Shared by every shape check (link, payloads, catalog). */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The message a line carries, or null for junk. The bodies are checked by whoever uses them. */
function toMessage(line: string): LinkMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isObject(v)) return null;
  // Bodiless messages come back bare: extra fields are dropped.
  if (
    v.type === "confirm-attach" ||
    v.type === "release" ||
    v.type === "reconnect"
  )
    return { type: v.type };
  if (v.type === "reading" && isObject(v.reading)) return v as LinkMessage;
  if (v.type === "status" && isObject(v.status)) return v as LinkMessage;
  if (v.type === "tables" && isObject(v.tables)) return v as LinkMessage;
  return null;
}

/** Feeds chunks of the stream; calls `onMessage` once per complete, well-formed line. */
export function createLineDecoder(
  onMessage: (m: LinkMessage) => void,
): (chunk: Buffer | string) => void {
  // TextDecoder, not Node's StringDecoder: this file also reaches the window's bundle through src/shared.
  const utf8 = new TextDecoder();
  let buf = "";
  return (chunk) => {
    buf +=
      typeof chunk === "string" ? chunk : utf8.decode(chunk, { stream: true });
    for (let i = buf.indexOf("\n"); i >= 0; i = buf.indexOf("\n")) {
      const m = toMessage(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (m) onMessage(m);
    }
  };
}
