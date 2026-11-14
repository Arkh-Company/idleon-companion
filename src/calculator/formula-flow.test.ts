// The Independent Test of the 008's foundation: with the invented game, a `number` request for the Drop Rate goes window
// → main → tree host → tree worker and back as a `ready` tree whose root equals the Stats number of the same mosaic. The
// main's pipelines are the real ones and both workers run the real calculator entry, in a microtask instead of a thread.
import { expect, test, vi } from "vitest";
import { startPipelines } from "../main/pipelines.ts";
import { IPC, READ_NULLS } from "../shared/index.ts";
import type { FormulaTree, StateSlice, Stats } from "../shared/index.ts";
import { BASE, CHARACTERS, GAME, PAK } from "./fixtures/fake-mosaic.ts";
import { handleMessage } from "./index.ts";

/** A worker thread stand-in: the calculator's entry answers each message a microtask later, on a port of its own. */
class InlineWorker {
  private handlers = new Map<string, (value: unknown) => void>();
  private alive = true;
  private port = {
    postMessage: (m: unknown) => {
      if (this.alive) this.handlers.get("message")?.(m);
    },
  };
  postMessage(message: unknown): void {
    queueMicrotask(() => {
      if (this.alive) handleMessage(message, this.port);
    });
  }
  on(event: string, listener: (value: unknown) => void): void {
    this.handlers.set(event, listener);
  }
  terminate(): void {
    this.alive = false;
    this.handlers.get("exit")?.(1);
  }
}

/** The invented state as the keeper slices it: whole keys, and the two split maps child by child. */
function pieces(): StateSlice["pieces"] {
  const out: StateSlice["pieces"] = [
    { path: ["_vars"], value: { TomePct: 40 } },
    { path: ["GetPlayersUsernames"], value: [...CHARACTERS] },
  ];
  const { DNSM, PlayerDATABASE, ...whole } = BASE;
  for (const [top, value] of Object.entries(whole))
    out.push({ path: [top], value });
  for (const [top, split] of Object.entries({ DNSM, PlayerDATABASE }))
    for (const [child, value] of Object.entries(split.$m))
      out.push({ path: [top, child], value });
  return out;
}

test("a Drop Rate request comes back as a ready tree whose root is the Stats number of the same mosaic", async () => {
  const sent: { channel: string; value: unknown }[] = [];
  const on = (channel: string) =>
    sent.filter((s) => s.channel === channel).map((s) => s.value);
  const { stats, formula, handlers } = startPipelines({
    send: (channel, value) => {
      sent.push({ channel, value });
    },
    createWorker: () => new InlineWorker(),
    readFiles: () =>
      Promise.resolve({
        code: new TextEncoder().encode(GAME),
        pak: Uint8Array.from(PAK),
      }),
    log: () => undefined,
  });

  const [active] = CHARACTERS;
  stats.status({ game: "running", reader: "attached" });
  stats.reading({
    ...READ_NULLS,
    t: 1,
    map: 3,
    menu: 0,
    menu2: 0,
    menu2tab: 0,
    skillTab: 0,
    char: active,
    afk: null,
    codexTab: null,
  });
  stats.message({ type: "gameFiles", resources: "C:\\invented\\resources" });
  formula.gameFiles("C:\\invented\\resources");
  const slice = (fast: number, list: StateSlice["pieces"]) => {
    stats.message({
      type: "state",
      slice: {
        sentinel: { char: active, map: 3 },
        pieces: list,
        at: 1,
        cycles: { fast, all: fast },
      },
    });
  };
  slice(0, []);
  slice(1, pieces());
  await vi.waitFor(() => {
    expect(on(IPC.statsUpdate).at(-1)).toMatchObject({ state: "ready" });
  });
  const shown = on(IPC.statsUpdate).at(-1) as Extract<
    Stats,
    { state: "ready" }
  >;
  const dropRate = shown.rows.find((r) => r.label === "Drop Rate")?.text;

  await handlers[IPC.formulaRequest]?.({ id: "dropRate" });
  await vi.waitFor(
    () => {
      expect(on(IPC.formulaUpdate).at(-1)).toMatchObject({ state: "ready" });
    },
    { timeout: 10_000 },
  );
  const tree = on(IPC.formulaUpdate).at(-1) as Extract<
    FormulaTree,
    { state: "ready" }
  >;
  expect(tree.root.value).toBe(BASE.Stats.Drop_Rarity);
  expect(tree.statsValue).toBe(BASE.Stats.Drop_Rarity);
  expect(tree.rootText).toBe(dropRate);
  expect(tree.request).toEqual({
    type: "number",
    id: "dropRate",
    character: 0,
  });
  expect(on(IPC.statsUpdate)).not.toContainEqual({ state: "unavailable" });
}, 20_000);
