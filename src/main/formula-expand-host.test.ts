// Two lazy rows opened in a row over the real tree host (review of the feature, R-I1): with a shape of Where this goes
// in flight, the second never replaces the first in the host's wait, and both branches come. The worker is a fake; every
// value and name is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FormulaTree, TreeNode } from "../shared/index.ts";
import {
  FakeWorker,
  files,
  flush,
  nth,
  RESOURCES,
} from "./calculator-host-fixture.ts";
import { node, pairOf, shapesOf } from "./formula-fixture.ts";
import { startFormulaPipeline } from "./formula-pipeline.ts";
import { CALCULATED } from "./stats-pipeline-fixture.ts";
import { createTreeHost } from "./tree-host.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const lazy = (id: string) =>
  node({ id, name: id, role: "piece", value: 3, kids: "lazy" });

test("two branches asked with a shape in flight both reach the tree", async () => {
  const workers: FakeWorker[] = [];
  const sent: FormulaTree[] = [];
  const p = startFormulaPipeline({
    send: (t) => sent.push(t),
    sendValues: () => undefined,
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
  const w = nth(workers);
  w.emit("message", { type: "ready" });
  const reply = (type: string, body: Record<string, unknown>) => {
    const id = w.posted.at(-1)?.message.id;
    w.emit("message", { type, id, ...body });
  };
  const [a, b] = [lazy("root/A"), lazy("root/B")];
  reply("treeResult", {
    tree: node({ value: CALCULATED.dropRate, kids: [a, b] }),
  });
  reply("valuesResult", { values: {} });
  p.gameRead("sha");
  expect(w.posted.at(-1)?.message.type).toBe("shape");
  p.request({ treeId: "dropRate", nodeId: "root/A" });
  p.request({ treeId: "dropRate", nodeId: "root/B" });
  reply("shapeResult", { shape: [] });
  const leaf = (id: string) => node({ id: `${id}/Level`, name: "Level" });
  reply("treeResult", { tree: { ...a, kids: [leaf("root/A")] } });
  reply("treeResult", { tree: { ...b, kids: [leaf("root/B")] } });
  const last = sent.at(-1);
  const kids = last?.state === "ready" ? (last.root.kids as TreeNode[]) : [];
  expect(kids.map((k) => k.kids)).toEqual([[leaf("root/A")], [leaf("root/B")]]);
});
