// The keeper's link server and the app's link client over a real local pipe (spec §5.4; Review Focus 5).
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { AlreadyRunning, startLinkServer } from "./keeper/link-server.ts";
import { connectLink } from "./main/link-client.ts";
import type { LinkMessage, Reading } from "./shared/index.ts";

let n = 0;
function pipePath(): string {
  const name = `idleon-companion-test-${String(process.pid)}-${String(n++)}`;
  return process.platform === "win32"
    ? `\\\\.\\pipe\\${name}`
    : join(tmpdir(), `${name}.sock`);
}

const cleanups: (() => unknown)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !ok(); i++) await sleep(20);
}

const reading: Reading = {
  t: 1,
  map: 264,
  menu: 3,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: "Tester",
  afk: null,
  codexTab: 2,
  codexSel: null,
};

test("a late client gets the last status, then the last reading", async () => {
  const path = pipePath();
  const server = await startLinkServer(path, () => undefined);
  cleanups.push(() => server.close());
  server.publish({
    type: "status",
    status: { game: "running", reader: "connecting" },
  });
  server.publish({ type: "reading", reading: { ...reading, map: 1 } });
  server.publish({
    type: "status",
    status: { game: "running", reader: "attached" },
  });
  server.publish({ type: "reading", reading });
  const got: LinkMessage[] = [];
  const client = connectLink(
    path,
    (m) => got.push(m),
    () => undefined,
  );
  cleanups.push(() => {
    client.close();
  });
  await until(() => got.length >= 2);
  expect(got).toEqual([
    { type: "status", status: { game: "running", reader: "attached" } },
    { type: "reading", reading },
  ]);
});

test("a second server on the same pipe rejects with AlreadyRunning", async () => {
  const path = pipePath();
  const server = await startLinkServer(path, () => undefined);
  cleanups.push(() => server.close());
  await expect(startLinkServer(path, () => undefined)).rejects.toBeInstanceOf(
    AlreadyRunning,
  );
});

test("the client reconnects after the server comes back", async () => {
  const path = pipePath();
  const ups: boolean[] = [];
  const client = connectLink(
    path,
    () => undefined,
    (up) => ups.push(up),
    200,
  );
  cleanups.push(() => {
    client.close();
  });
  const first = await startLinkServer(path, () => undefined);
  await until(() => ups.length >= 1);
  await first.close();
  await until(() => ups.length >= 2);
  const second = await startLinkServer(path, () => undefined);
  cleanups.push(() => second.close());
  await until(() => ups.length >= 3);
  expect(ups).toEqual([true, false, true]);
});

test("confirm-attach from the client reaches onConfirm", async () => {
  const path = pipePath();
  let confirms = 0;
  const server = await startLinkServer(path, () => {
    confirms++;
  });
  cleanups.push(() => server.close());
  let up = false;
  const client = connectLink(
    path,
    () => undefined,
    (u) => (up = u),
  );
  cleanups.push(() => {
    client.close();
  });
  await until(() => up);
  client.send({ type: "confirm-attach" });
  await until(() => confirms > 0);
  expect(confirms).toBe(1);
});
