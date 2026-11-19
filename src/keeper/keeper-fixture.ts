// The keeper's flow with fake game, reader and app over a real local pipe, for keeper.test.ts and
// keeper-update.test.ts: a keeper whose game, reader and app are fakes, and an app on the link. Every value and name is
// invented.
import { mkdtempSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { threadId } from "node:worker_threads";
import { createLineDecoder, encodeLine, READ_NULLS } from "../shared/index.ts";
import type { LinkMessage, Reading, Status } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import type { KeeperDeps } from "./keeper.ts";

let n = 0;
/** A name no other keeper test uses, in this file or in a test file running beside it in another thread. */
export const uniqueName = () =>
  `${String(process.pid)}-${String(threadId)}-${String(n++)}`;

function pipePath(): string {
  const name = `idleon-companion-test-keeper-${uniqueName()}`;
  return process.platform === "win32"
    ? `\\\\.\\pipe\\${name}`
    : join(tmpdir(), `${name}.sock`);
}

/** What a test leaves open, closed after it by `cleanUp` (each test file's `afterEach`). */
export const cleanups: (() => unknown)[] = [];
export async function cleanUp(): Promise<void> {
  for (const c of cleanups.splice(0).reverse()) await c();
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !ok(); i++) await sleep(20);
}

interface FakeReader {
  onReading(r: Reading): void;
  onStatus(s: Status): void;
  onAttached(pausedMs: number): void;
  onRead(t: number): void;
}

/** A keeper whose game, reader and app are fakes; `order` records what it did, `exit()` closes the game. */
export function harness(gameCode: () => string | undefined) {
  let exit: () => void = () => undefined;
  const exited = new Promise<void>((r) => (exit = r));
  const order: string[] = [];
  const readers: FakeReader[] = [];
  const logs: Record<string, unknown>[] = [];
  const deps: KeeperDeps = {
    pipePath: pipePath(),
    hashPath: join(
      mkdtempSync(join(tmpdir(), "idleon-keeper-")),
      "game-hash.json",
    ),
    makeDataDir: () => undefined,
    gameCode,
    // "launch" opens the game with the debugging pipe, "launch-no-pipe" without it (and then there is no Cdp).
    launch: (debugPipe) => {
      order.push(debugPipe ? "launch" : "launch-no-pipe");
      return { pid: 42, cdp: debugPipe ? ({} as Cdp) : undefined, exited };
    },
    read: (_cdp, onReading, onStatus, onAttached, onRead) => {
      order.push("read");
      readers.push({ onReading, onStatus, onAttached, onRead });
      return { stop: () => (order.push("stop"), Promise.resolve()) };
    },
    startApp: () => order.push("app"),
    log: (label, data) => logs.push({ label, ...data }),
  };
  return {
    deps,
    exit: () => {
      exit();
    },
    order,
    readers,
    logs,
  };
}

/** An app on the link: what it got, and a way to send. Closed messages also go to `order`. */
export function app(path: string, order: string[] = []) {
  const got: LinkMessage[] = [];
  const s = connect(path);
  s.on("error", () => undefined);
  s.on(
    "data",
    createLineDecoder((m) => {
      if (m.type !== "tables") got.push(m); // the tables have their own tests, in keeper-scan.test.ts
      if (m.type === "status" && m.status.game === "closed")
        order.push("closed");
    }),
  );
  cleanups.push(() => s.destroy());
  return { got, send: (m: LinkMessage) => s.write(encodeLine(m)) };
}

export const reading: Reading = {
  t: 1,
  map: 264,
  menu: 3,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: "Tester",
  afk: null,
  codexTab: 2,
  ...READ_NULLS,
};
