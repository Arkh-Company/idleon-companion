// The helpers of the real-trees run (spec 010, FR-026, NFR-003, contracts/real-trees-run.md), in CI over the invented
// game: the variables, the target, the plan of the check mode, the summary line, the paths of the output and the probe
// of the roots. The run itself is real-trees.integration.test.ts, only on Vinicius's PC.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { CHARACTERS, GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { bootRecorder } from "../tree-record.ts";
import type { Blueprint } from "./blueprint.ts";
import {
  checkPlan,
  outPath,
  probeRoot,
  rootCallOf,
  rootsReport,
  summaryLine,
  targetIds,
  treesEnv,
} from "./real-trees-run.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const LOT: Record<string, string> = {
  Personagem: "character",
  Conta: "account",
};
const CATALOG = (
  JSON.parse(
    readFileSync(join(ROOT, "docs", "catalogo", "numeros.json"), "utf8"),
  ) as {
    id: string;
    mundo: string;
    destino: string;
  }[]
)
  .filter((n) => n.destino === "arvore")
  .map((n) => ({ id: n.id, lot: LOT[n.mundo] ?? n.mundo.toLowerCase() }));

const VARS = {
  TREES_GAME_DIR: "C:/game",
  TREES_SNAPSHOT: "C:/snap.json",
  TREES_OUT: "C:/out",
};

test("without one of the three variables there is no run, and the integration test skips", () => {
  for (const k of Object.keys(VARS))
    expect(
      treesEnv({ ...VARS, [k]: "", TREES_TARGET: "w1", TREES_MODE: "check" }),
    ).toBe(null);
  expect(treesEnv({ TREES_TARGET: "w1", TREES_MODE: "check" })).toBe(null);
  // `just test` with the three in the terminal: no target, no run
  expect(treesEnv(VARS)).toBe(null);
  expect(
    treesEnv({ ...VARS, TREES_TARGET: "roots", TREES_MODE: "roots" }),
  ).toEqual({
    gameDir: "C:/game",
    snapshot: "C:/snap.json",
    out: "C:/out",
    target: "roots",
    mode: "roots",
  });
  expect(() =>
    treesEnv({ ...VARS, TREES_TARGET: "../x", TREES_MODE: "check" }),
  ).toThrow();
  expect(() =>
    treesEnv({ ...VARS, TREES_TARGET: "w1", TREES_MODE: "fast" }),
  ).toThrow();
});

test("a lot gives its ids in the catalog's order; all and roots give the 289; an id outside the catalog is refused", () => {
  const w1 = CATALOG.filter((n) => n.lot === "w1").map((n) => n.id);
  expect(w1).toHaveLength(22);
  expect(targetIds("w1", CATALOG)).toEqual(w1);
  expect(targetIds("all", CATALOG)).toHaveLength(289);
  expect(targetIds("roots", CATALOG)).toEqual(CATALOG.map((n) => n.id));
  expect(targetIds("stats-drop-rate", CATALOG)).toEqual(["stats-drop-rate"]);
  expect(() => targetIds("no-such-number", CATALOG)).toThrow();
  expect(() => targetIds("../stats-drop-rate", CATALOG)).toThrow();
});

test("in the check mode, a sketch or a draft is not locked: it counts as no blueprint written", () => {
  const stages = new Map([
    ["a", "sketch"],
    ["b", "complete"],
    ["c", "draft"],
  ] as const);
  expect(checkPlan(["a", "b", "c", "d"], stages)).toEqual({
    lock: ["b"],
    notWritten: ["a", "c", "d"],
  });
});

test("every output falls inside TREES_OUT; a path with .. or / out of it is refused", () => {
  expect(outPath("C:/out", "trees", "stats-drop-rate.json")).toBe(
    resolve("C:/out", "trees", "stats-drop-rate.json"),
  );
  expect(() => outPath("C:/out", "trees", "../../x.json")).toThrow();
  expect(() => outPath("C:/out", "../elsewhere.json")).toThrow();
  expect(() => outPath("C:/out", "/elsewhere/x.json")).toThrow();
});

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
const sketch = (id: string, call: string): Blueprint => ({
  id,
  root: { name: "Invented", ref: { call, args: [0, 0, 0] } },
  pools: [],
});
const record = (root: ReturnType<typeof rootCallOf>) =>
  recorder.record(mosaicOf(), [root], { recompute: [], builders: [] });

test("the probe records each sketch's root and classifies its form", () => {
  const probes = [
    probeRoot(record, recorder.ops, sketch("decl-chain", "TreeDeclChain")),
    probeRoot(record, recorder.ops, sketch("decl-expr", "TreeDeclExpr")),
    probeRoot(record, recorder.ops, sketch("decl-swap", "TreeDeclSwap")),
    probeRoot(record, recorder.ops, sketch("map-monster", "TreeMapMonster")),
  ];
  expect(probes.map((p) => [p.id, p.call, p.form, p.pools])).toEqual([
    [
      "decl-chain",
      "TreeDeclChain(0,0,0)",
      "chain",
      ["additive", "multi", "additive", "multi"],
    ],
    ["decl-expr", "TreeDeclExpr(0,0,0)", "expression", ["additive", "multi"]],
    ["decl-swap", "TreeDeclSwap(0,0,0)", "outOfRule", []],
    ["map-monster", "TreeMapMonster(0,0,0)", "liveMap", []],
  ]);
  expect(probes[2]?.reason).toMatch(/^forma de raiz fora da regra dos pools/);
  const report = rootsReport(probes);
  expect(report.counts).toEqual({
    chain: 1,
    expression: 1,
    outOfRule: 1,
    liveMap: 1,
    error: 0,
  });
  expect(report.liveMap).toEqual(["map-monster"]);
  expect(report.outOfRule.map((r) => r.id)).toEqual(["decl-swap"]);
});

test("the summary line has only the id, the result and the time, never a character's name", () => {
  expect(summaryLine("stats-drop-rate", { result: "passed", ms: 1234.6 })).toBe(
    "stats-drop-rate\tpassed\t1235 ms",
  );
  const probes = [
    probeRoot(record, recorder.ops, sketch("tree-player", "TreePlayer")),
  ];
  const text = [
    ...probes.map((p) => summaryLine(p.id, { result: p.form, ms: p.ms })),
    JSON.stringify(rootsReport(probes)),
  ].join("\n");
  for (const name of CHARACTERS) expect(text).not.toContain(name);
});
