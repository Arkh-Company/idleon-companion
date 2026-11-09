// The fake game of the state reader's tests: a scripted `send`, an invented catalog and an 83 ms tick.
import { expect, vi } from "vitest";
import { ACTIONS_GROUP } from "../shared/index.ts";
import type { CatalogRow, StatePath, StateSlice } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import type { EngineRef } from "./engine-ref.ts";
import { inTurn, startStateReader } from "./state-reader.ts";
import type { VarsReader } from "./vars-reader.ts";

const REF: EngineRef = { sessionId: "S", objectId: "O", pausedMs: 1 };
const named = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i)}`);
export const actionKeys = (n: number) => named("Act", n);
export const fastKeys = (n: number) => named("Fast", n);
export const slowKeys = (n: number) => named("Slow", n);

const row = (
  name: string,
  reading: CatalogRow["reading"],
  group: string,
): CatalogRow => ({
  name,
  type: "lista",
  bytes: 1,
  nature: "dado de origem",
  numbers: [],
  changesOn: "não mudou",
  mechanic: "a conferir",
  feature: "—",
  reading,
  group,
});
const FAST_GROUP = "Alpha";
export const TEST_CATALOG: readonly CatalogRow[] = [
  row("Cards", "rápida", FAST_GROUP),
  row("Research", "rápida", FAST_GROUP),
  ...fastKeys(30).map((k) => row(k, "rápida", FAST_GROUP)),
  row("Spice", "rápida", "Beta"),
  row("Personagem.Skills", "rápida", "Beta"),
  row("Personagem.Bag", "lenta", "—"),
  row("Gear", "rápida", ACTIONS_GROUP),
  row("GearCache", "rápida", ACTIONS_GROUP),
  ...actionKeys(25).map((k) => row(k, "rápida", ACTIONS_GROUP)),
  row("ChestMap", "lenta", "—"),
  ...slowKeys(40).map((k) => row(k, "lenta", "—")),
];

/** The lane the test catalog puts a path in: anything it does not know is `slow`. */
export function laneOf(path: StatePath | undefined): string {
  const name =
    path?.length === 3 && path[0] === "PlayerDATABASE"
      ? `Personagem.${path[2]}`
      : path?.[0];
  const found = TEST_CATALOG.find((r) => r.name === name);
  if (found?.reading !== "rápida") return "slow";
  return found.group === ACTIONS_GROUP ? "actions" : "fast";
}

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

export function setup(over: Partial<Game> = {}, vars?: VarsReader) {
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
    turn: inTurn(),
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
    catalog: TEST_CATALOG,
    ...(vars ? { vars } : {}),
  });
  return { ...h, h, reader };
}

export const TICK_MS = 83;
export const tick = (n = 1) => vi.advanceTimersByTimeAsync(TICK_MS * n);
export const sliceReads = (sent: Sent[]) =>
  sent.filter((s) => s.source === "SLICE");
