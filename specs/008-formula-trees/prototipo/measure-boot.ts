// Disposable prototype: not product code.
// Item 6 of the prototype: what the Stats worker pays at boot if the same calculator.js also carries the parser.
// Starts a worker_threads Worker 10 times with nothing and 10 times loading the parser bundle (acorn, minified, as the
// calculator would embed it), and compares the time to the first message and the heap used. Prints only numbers.
// Run: node specs/008-formula-trees/prototipo/measure-boot.ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const HERE = import.meta.dirname;
const root = createRequire(join(HERE, "..", "..", "..", "package.json"));
const dir = mkdtempSync(join(tmpdir(), "proto008-boot-"));

// The parser bundled into one minified CommonJS file, the way the calculator would carry it.
const entry = join(HERE, "entry-boot.mjs");
writeFileSync(entry, 'export { parse } from "acorn";');
const vite = await import(pathToFileURL(root.resolve("vite")).href);
await vite.build({
  configFile: false,
  logLevel: "silent",
  root: HERE,
  build: { outDir: dir, minify: true, ssr: entry, emptyOutDir: false, rollupOptions: { output: { entryFileNames: "parser.cjs", format: "cjs" } } },
  ssr: { noExternal: true },
});
(await import("node:fs")).rmSync(entry);

const code = (withParser: boolean) => `
  const { parentPort } = require("node:worker_threads");
  ${withParser ? `require(${JSON.stringify(join(dir, "parser.cjs"))});` : ""}
  parentPort.postMessage(process.memoryUsage().heapUsed);
`;

async function boot(withParser: boolean): Promise<{ ms: number; heapMb: number }> {
  const t0 = performance.now();
  const w = new Worker(code(withParser), { eval: true });
  const heap: number = await new Promise((r) => w.once("message", r));
  const ms = performance.now() - t0;
  await w.terminate();
  return { ms, heapMb: heap / 1048576 };
}

const med = (xs: number[]): number => xs.sort((a, b) => a - b)[xs.length >> 1];
const res: Record<string, { bootMs: number; heapMb: number }> = {};
for (const withParser of [false, true]) {
  const runs = [];
  for (let i = 0; i < 10; i++) runs.push(await boot(withParser));
  res[withParser ? "withParser" : "plain"] = {
    bootMs: +med(runs.map((r) => r.ms)).toFixed(1),
    heapMb: +med(runs.map((r) => r.heapMb)).toFixed(1),
  };
}
console.log(JSON.stringify(res));
