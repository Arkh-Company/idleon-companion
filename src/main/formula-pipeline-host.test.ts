// The formula pipeline over the real tree host (review of the feature, R-I1 and CR4): two lazy rows opened in a row
// both get their branch with a shape of Where this goes in flight; the game closing with a shape or values in flight
// neither skips that shape nor blanks the values on screen. The worker is a fake; every value and name is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FormulaTree, LiveValues, TreeNode } from "../shared/index.ts";
import {
  FakeWorker,
  files,
  flush,
  RESOURCES,
} from "./calculator-host-fixture.ts";
import { node, pairOf, shapesOf } from "./formula-fixture.ts";
import { startFormulaPipeline } from "./formula-pipeline.ts";
import { ATTACHED, CALCULATED } from "./stats-pipeline-fixture.ts";
import { createTreeHost } from "./tree-host.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const lazy = (id: string) =>
  node({ id, name: id, role: "piece", value: 3, kids: "lazy" });
const [A, B] = [lazy("root/A"), lazy("root/B")];

/** The Drop Rate open over a ready worker, its kids two lazy rows; the open number's values asked, not answered. */
async function open() {
  const workers: FakeWorker[] = [];
  const sent: FormulaTree[] = [];
  const live: LiveValues[] = [];
  const p = startFormulaPipeline({
    send: (t) => sent.push(t),
    sendValues: (v) => live.push(v),
    treeHost: (on) =>
      createTreeHost({
        createWorker: () => {
          const w = new FakeWorker();
          workers.push(w);
          return w;
        },
        readFiles: files,
        ...on,
      }),
    statsPair: () => pairOf(),
    checkedOnThisGame: () => true,
    log: () => undefined,
    shapes: shapesOf(),
  });
  p.gameFiles(RESOURCES);
  p.request({ id: "dropRate", character: null });
  await flush();
  const worker = () => workers.at(-1) ?? new FakeWorker();
  worker().emit("message", { type: "ready" });
  /** The worker's answer to the last message it got. */
  const reply = (type: string, body: Record<string, unknown>) => {
    const id = worker().posted.at(-1)?.message.id;
    worker().emit("message", { type, id, ...body });
  };
  reply("treeResult", {
    tree: node({ value: CALCULATED.dropRate, kids: [A, B] }),
  });
  return { p, sent, live, worker, reply };
}

test("two branches asked with a shape in flight both reach the tree", async () => {
  const h = await open();
  h.reply("valuesResult", { values: {} });
  h.p.gameRead("sha");
  expect(h.worker().posted.at(-1)?.message.type).toBe("shape");
  h.p.request({ treeId: "dropRate", nodeId: "root/A" });
  h.p.request({ treeId: "dropRate", nodeId: "root/B" });
  h.reply("shapeResult", { shape: [] });
  const leaf = (id: string) => node({ id: `${id}/Level`, name: "Level" });
  h.reply("treeResult", { tree: { ...A, kids: [leaf("root/A")] } });
  h.reply("treeResult", { tree: { ...B, kids: [leaf("root/B")] } });
  const last = h.sent.at(-1);
  const kids = last?.state === "ready" ? (last.root.kids as TreeNode[]) : [];
  expect(kids.map((k) => k.kids)).toEqual([[leaf("root/A")], [leaf("root/B")]]);
});

test("the game closing with a shape in flight asks that shape again when it opens", async () => {
  const h = await open();
  h.reply("valuesResult", { values: {} });
  h.p.gameRead("sha");
  const asked = h.worker().posted.at(-1)?.message;
  h.p.status({ game: "closed", reader: "error" });
  h.p.status(ATTACHED);
  await flush();
  h.worker().emit("message", { type: "ready" });
  expect(h.worker().sent("shape").at(-1)?.treeId).toBe(asked?.treeId);
});

test("the game closing with values in flight keeps the last values on screen", async () => {
  const h = await open();
  h.reply("valuesResult", { values: { dropRate: 4 } });
  h.p.values(["hp"]);
  h.p.status({ game: "closed", reader: "error" });
  expect(h.live.at(-1)).toMatchObject({
    values: { dropRate: 4 },
    stale: true,
  });
});
