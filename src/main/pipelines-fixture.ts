// The Stats and the trees joined as the app runs them (src/main/index.ts), for pipelines*.test.ts: the pipelines over
// fake workers, the game open and a character read. A test file that loads it mocks version-band.ts first, with the
// bytes of checked-code-fixture.ts. Every value and name is invented.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, vi } from "vitest";
import { IPC } from "../shared/index.ts";
import { FakeWorker } from "./calculator-host-fixture.ts";
import { CHECKED_CODE } from "./checked-code-fixture.ts";
import type { GameBytes } from "./game-files.ts";
import { startPipelines } from "./pipelines.ts";
import { savedFiles } from "./saved-files.ts";
import {
  ATTACHED,
  CALCULATED,
  flush,
  piece,
  reading,
  RESOURCES,
  vars,
} from "./stats-pipeline-fixture.ts";

export const CHARACTER = [
  piece("UserInfo", ["Invented"]),
  piece("GetPlayersUsernames", ["Someone", "Invented"]),
  piece("CharacterClass", 1),
];

export function setup(
  code: Uint8Array<ArrayBuffer> = CHECKED_CODE,
  // No mark or pin is read or written here unless a test gives a folder.
  saved = savedFiles(join(tmpdir(), "no-marks")),
) {
  const workers: { worker: FakeWorker; heap: number }[] = [];
  const sent: { channel: string; value: unknown }[] = [];
  /** The window gone for the trees only. */
  let treesFail = false;
  const send = vi.fn((channel: string, value: unknown) => {
    if (treesFail && channel === IPC.formulaUpdate)
      throw new Error("window gone");
    sent.push({ channel, value });
  });
  const log = vi.fn();
  const p = startPipelines({
    send,
    createWorker: (o) => {
      const worker = new FakeWorker();
      workers.push({
        worker,
        heap: o.resourceLimits?.maxOldGenerationSizeMb ?? 0,
      });
      return worker;
    },
    readFiles: (): Promise<GameBytes> =>
      Promise.resolve({
        code,
        pak: Uint8Array.from([2]),
      }),
    log,
    saved,
  });
  const workerOf = (heap: number) => {
    const w = workers.find((x) => x.heap === heap)?.worker;
    if (!w) throw new Error("no such worker");
    return w;
  };
  const on = (channel: string) =>
    sent.filter((s) => s.channel === channel).map((s) => s.value);
  return {
    p,
    send,
    failTrees() {
      treesFail = true;
    },
    log,
    on,
    stats: () => workerOf(1024),
    trees: () => workerOf(2048),
    slice(fast: number, pieces: typeof CHARACTER, char = "Invented") {
      p.stats.message({
        type: "state",
        slice: {
          sentinel: { char, map: 5 },
          pieces,
          at: 1,
          cycles: { fast, all: fast },
        },
      });
    },
    /** The game open, a character read and its Stats answered. */
    async showing() {
      p.stats.status(ATTACHED);
      p.stats.reading(reading());
      p.stats.message({ type: "gameFiles", resources: RESOURCES });
      p.formula.gameFiles(RESOURCES);
      this.slice(0, []);
      this.slice(1, [vars, ...CHARACTER]);
      await flush();
      this.stats().emit("message", { type: "ready" });
      this.stats().emit("message", { type: "result", numbers: CALCULATED });
    },
  };
}

/** The shape of Where this goes (FR-027) in flight in the background: values asked meanwhile wait for its answer. */
export function answerShape(worker: FakeWorker): void {
  const shape = worker.sent("shape").at(-1);
  expect(shape).toBeDefined();
  worker.emit("message", { type: "shapeResult", id: shape?.id, shape: [] });
}
