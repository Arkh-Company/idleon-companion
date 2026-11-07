import { PassThrough } from "node:stream";
import { expect, test } from "vitest";
import { createCdp } from "./cdp.ts";

function pair(timeoutMs?: number) {
  const toBrowser = new PassThrough();
  const fromBrowser = new PassThrough();
  const written: string[] = [];
  toBrowser.on("data", (d: Buffer) => written.push(d.toString("utf8")));
  const cdp = createCdp(toBrowser, fromBrowser, timeoutMs);
  const answer = (m: object) => fromBrowser.write(`${JSON.stringify(m)}\0`);
  return { cdp, fromBrowser, written, answer };
}

test("send writes one \\0-framed message and resolves with the matching result", async () => {
  const { cdp, written, answer } = pair();
  const p = cdp.send("Target.getTargets");
  answer({ id: 1, result: { targetInfos: [] } });
  await expect(p).resolves.toEqual({ targetInfos: [] });
  expect(written.join("")).toBe(
    '{"id":1,"method":"Target.getTargets","params":{}}\0',
  );
});

test("send carries the session id", () => {
  const { cdp, written } = pair();
  void cdp.send("Debugger.enable", {}, "S1").catch(() => undefined);
  expect(JSON.parse(written.join("").slice(0, -1))).toEqual({
    id: 1,
    method: "Debugger.enable",
    params: {},
    sessionId: "S1",
  });
  cdp.close();
});

test("an answer split across chunks still resolves", async () => {
  const { cdp, fromBrowser } = pair();
  const p = cdp.send("A");
  const raw = `${JSON.stringify({ id: 1, result: { ok: true } })}\0`;
  fromBrowser.write(raw.slice(0, 7));
  fromBrowser.write(raw.slice(7));
  await expect(p).resolves.toEqual({ ok: true });
});

test("an answer with error rejects with its message", async () => {
  const { cdp, answer } = pair();
  const p = cdp.send("A");
  answer({ id: 1, error: { code: -32000, message: "No such target" } });
  await expect(p).rejects.toThrow("No such target");
});

test("an event without id reaches waitFor", async () => {
  const { cdp, answer } = pair();
  const w = cdp.waitFor((m) => m.method === "Debugger.paused", 1000);
  answer({ method: "Debugger.scriptParsed", params: {} });
  answer({ method: "Debugger.paused", params: { reason: "other" } });
  await expect(w).resolves.toMatchObject({ method: "Debugger.paused" });
});

test("waitFor rejects when nothing matches in time", async () => {
  const { cdp } = pair();
  await expect(cdp.waitFor(() => true, 20)).rejects.toThrow();
});

test("no answer within the timeout rejects", async () => {
  const { cdp } = pair(20);
  await expect(cdp.send("Runtime.evaluate")).rejects.toThrow(
    /no answer from the game for Runtime\.evaluate/,
  );
});

test("close() rejects every pending request", async () => {
  const { cdp } = pair();
  const a = cdp.send("A");
  const b = cdp.send("B");
  cdp.close();
  await expect(a).rejects.toThrow();
  await expect(b).rejects.toThrow();
});

test("the browser side closing rejects pending requests, and later sends too", async () => {
  const { cdp, fromBrowser } = pair();
  const a = cdp.send("A");
  fromBrowser.destroy(new Error("EPIPE"));
  await expect(a).rejects.toThrow();
  await expect(cdp.send("B")).rejects.toThrow();
});

test("close() also rejects a waitFor in progress", async () => {
  const { cdp } = pair();
  const w = cdp.waitFor(() => true, 60000);
  cdp.close();
  await expect(w).rejects.toThrow("the game closed");
});
