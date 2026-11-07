// Chrome DevTools Protocol over the debugging pipe: JSON messages separated by \0 (fd 3 to the browser, fd 4 from it).
import type { Readable, Writable } from "node:stream";

/** One message from the browser: an answer (with `id`) or an event (with `method`). */
export interface CdpMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message: string };
  sessionId?: string;
}

interface Pending {
  resolve(v: unknown): void;
  reject(e: Error): void;
}

export function createCdp(
  toBrowser: Writable,
  fromBrowser: Readable,
  timeoutMs = 20000,
) {
  let nextId = 0;
  let buf = "";
  let closed = false;
  const pending = new Map<number, Pending>();
  const listeners = new Set<(m: CdpMessage) => void>();
  const waiters = new Set<(e: Error) => void>();

  // Decoded as a stream: a multibyte character split across two chunks stays whole.
  fromBrowser.setEncoding("utf8");
  fromBrowser.on("data", (d: string) => {
    buf += d;
    for (let i = buf.indexOf("\0"); i >= 0; i = buf.indexOf("\0")) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 1);
      let m: CdpMessage;
      try {
        m = JSON.parse(raw) as CdpMessage;
      } catch {
        continue;
      }
      const p = m.id === undefined ? undefined : pending.get(m.id);
      if (p && m.id !== undefined) {
        pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message));
        else p.resolve(m.result);
      } else for (const l of listeners) l(m);
    }
  });
  // The game closing ends the pipe: every request in flight fails, and nothing throws out of this module.
  fromBrowser.on("error", close);
  fromBrowser.on("close", close);
  toBrowser.on("error", close);

  function close(): void {
    closed = true;
    for (const p of pending.values()) p.reject(new Error("the game closed"));
    pending.clear();
    for (const w of waiters) w(new Error("the game closed"));
  }

  return {
    send(
      method: string,
      params: object = {},
      sessionId?: string,
    ): Promise<unknown> {
      if (closed) return Promise.reject(new Error("the game closed"));
      const id = ++nextId;
      const m = sessionId
        ? { id, method, params, sessionId }
        : { id, method, params };
      return new Promise((resolve, reject) => {
        // A browser that ignores the pipe never answers: fail visibly instead of waiting forever.
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`no answer from the game for ${method}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
        toBrowser.write(`${JSON.stringify(m)}\0`);
      });
    },
    waitFor(pred: (m: CdpMessage) => boolean, ms: number): Promise<CdpMessage> {
      if (closed) return Promise.reject(new Error("the game closed"));
      return new Promise((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          listeners.delete(l);
          waiters.delete(fail);
        };
        const l = (m: CdpMessage) => {
          if (!pred(m)) return;
          done();
          resolve(m);
        };
        const fail = (e: Error) => {
          done();
          reject(e);
        };
        const timer = setTimeout(() => {
          fail(new Error("timed out waiting for the game"));
        }, ms);
        listeners.add(l);
        waiters.add(fail);
      });
    },
    close,
  };
}

export type Cdp = ReturnType<typeof createCdp>;
