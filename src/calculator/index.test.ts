// The worker's messages, with a fake port and a fake engine (contracts/calculator.md).
import { expect, test, vi } from "vitest";
import { NUMBER_IDS } from "../shared/index.ts";
import { handleMessage } from "./index.ts";
import { TARGETS } from "./targets.ts";
import type { CalcNumbers } from "./targets.ts";

const NUMBERS = Object.fromEntries(
  NUMBER_IDS.map((id, i) => [id, i]),
) as CalcNumbers;
const ALL_NULL = Object.fromEntries(NUMBER_IDS.map((id) => [id, null]));
const CODE = new TextEncoder().encode("the bytes of the code");
const PAK = new Uint8Array([1, 2]);
const INIT = { type: "init", code: CODE, pak: PAK };

const fakePort = () => ({ postMessage: vi.fn() });
const posted = (port: ReturnType<typeof fakePort>): unknown[] =>
  port.postMessage.mock.calls.map((c) => c[0] as unknown);

const engineThat = (calculate: (json: string) => CalcNumbers) =>
  vi.fn(() => ({ calculate }));

test("the ids of TARGETS equal NUMBER_IDS", () => {
  expect(TARGETS.map(([id]) => id)).toEqual([...NUMBER_IDS]);
});

test("init decodes the code, builds the engine once and answers ready", () => {
  const port = fakePort();
  const make = engineThat(() => NUMBERS);
  handleMessage(INIT, port, make);
  handleMessage({ type: "calc", mosaic: "{}" }, port, make);
  expect(make).toHaveBeenCalledExactlyOnceWith("the bytes of the code", PAK);
  expect(posted(port)[0]).toEqual({ type: "ready" });
});

test("init answers failed with no game text in the message", () => {
  const port = fakePort();
  const make = vi.fn(() => {
    throw new Error("GAME-TEXT at line 1");
  });
  handleMessage(INIT, port, make);
  expect(posted(port)).toEqual([{ type: "failed" }]);
  expect(JSON.stringify(posted(port))).not.toContain("GAME-TEXT");
});

test("init with no bytes answers failed", () => {
  const port = fakePort();
  handleMessage(
    { type: "init" },
    port,
    engineThat(() => NUMBERS),
  );
  expect(posted(port)).toEqual([{ type: "failed" }]);
});

test("calc answers result with the numbers and the time", () => {
  const port = fakePort();
  const calculate = vi.fn(() => NUMBERS);
  const make = engineThat(calculate);
  handleMessage(INIT, port, make);
  handleMessage({ type: "calc", mosaic: '{"a":1}' }, port, make);
  expect(calculate).toHaveBeenCalledExactlyOnceWith('{"a":1}');
  expect(posted(port)[1]).toEqual({
    type: "result",
    numbers: NUMBERS,
    ms: expect.any(Number) as number,
  });
});

test("calc before init answers result with every number null", () => {
  const port = fakePort();
  handleMessage({ type: "calc", mosaic: "{}" }, port, vi.fn());
  expect(posted(port)).toEqual([
    { type: "result", numbers: ALL_NULL, ms: expect.any(Number) as number },
  ]);
});

test("calc with bad JSON answers result with every number null", () => {
  const port = fakePort();
  const make = engineThat((json) => JSON.parse(json) as CalcNumbers);
  handleMessage(INIT, port, make);
  handleMessage({ type: "calc", mosaic: "not json" }, port, make);
  expect(posted(port)[1]).toEqual({
    type: "result",
    numbers: ALL_NULL,
    ms: expect.any(Number) as number,
  });
});

test("a calc that fails keeps the engine, and the next calc uses it", () => {
  const port = fakePort();
  const calculate = vi
    .fn<(json: string) => CalcNumbers>()
    .mockImplementationOnce(() => {
      throw new Error("broken");
    })
    .mockReturnValue(NUMBERS);
  const make = engineThat(calculate);
  handleMessage(INIT, port, make);
  handleMessage({ type: "calc", mosaic: "{}" }, port, make);
  handleMessage({ type: "calc", mosaic: "{}" }, port, make);
  expect(make).toHaveBeenCalledOnce();
  expect(posted(port)[2]).toMatchObject({ type: "result", numbers: NUMBERS });
});

test.each([[null], ["text"], [{ type: "other" }], [{}]])(
  "an unknown message does nothing: %j",
  (m) => {
    const port = fakePort();
    handleMessage(m, port, vi.fn());
    expect(posted(port)).toEqual([]);
  },
);
