// The fake game of the state reader's tests: a scripted `send`, invented keys and a 250 ms tick.
import { expect, vi } from "vitest";
import { FORMULA_KEYS } from "../shared/index.ts";
import type { StatePath, StateSlice } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import type { EngineRef } from "./engine-ref.ts";
import { oneAtATime, startStateReader } from "./state-reader.ts";

const REF: EngineRef = { sessionId: "S", objectId: "O", pausedMs: 1 };
export const formulaKeys = (n: number) => [...FORMULA_KEYS].slice(0, n);

interface Game {
  char: string | null;
  map: number;
  top: string[];
  split: Record<string, string[]>;
  value: (path: StatePath) => unknown;
}
interface Sent {
  source: string;
  paths: StatePath[];
  objectId: string;
  sessionId: string | undefined;
  returnByValue: boolean;
}

export function setup(over: Partial<Game> = {}) {
  const game: Game = {
    char: "Hero",
    map: 1,
    top: ["Cards", "ChestMap"],
    split: {},
    value: () => 1,
    ...over,
  };
  const sent: Sent[] = [];
  const slices: StateSlice[] = [];
  const h = {
    game,
    sent,
    slices,
    ref: REF as EngineRef | null,
    latency: 0,
    gate: null as Promise<void> | null,
    /** Replaces the game's next answers: return a value to answer it, or throw to fail the read. */
    answer: null as ((s: Sent) => unknown) | null,
    onFailing: vi.fn(),
    onSlice: (s: StateSlice) => {
      slices.push(s);
    },
    turn: oneAtATime(),
  };
  const send: Cdp["send"] = async (method, params, sessionId) => {
    const p = params as {
      objectId: string;
      functionDeclaration: string;
      returnByValue: boolean;
      arguments?: { value: StatePath[] }[];
    };
    expect(method).toBe("Runtime.callFunctionOn");
    const s: Sent = {
      source: p.functionDeclaration,
      paths: p.arguments?.[0]?.value ?? [],
      objectId: p.objectId,
      sessionId,
      returnByValue: p.returnByValue,
    };
    sent.push(s);
    if (h.gate) await h.gate;
    if (h.latency)
      await new Promise((r) => {
        setTimeout(r, h.latency);
      });
    if (h.answer) return h.answer(s);
    const { char, map, top, split } = game;
    return {
      result: {
        value:
          s.source === "LIST"
            ? { char, map, top, split }
            : { char, map, out: s.paths.map((x) => game.value(x)) },
      },
    };
  };
  const reader = startStateReader({
    send,
    engine: () => h.ref,
    listSource: "LIST",
    sliceSource: "SLICE",
    turn: h.turn,
    onSlice: (s) => {
      h.onSlice(s);
    },
    onFailing: h.onFailing,
  });
  return { ...h, h, reader };
}

export const tick = (n = 1) => vi.advanceTimersByTimeAsync(250 * n);
export const sliceReads = (sent: Sent[]) =>
  sent.filter((s) => s.source === "SLICE");
