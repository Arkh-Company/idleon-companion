// Disposable prototype: not product code.
// Item 1 of the prototype: the cost of recording the Drop Rate tree with the research bench's recorder, under the
// app's heap limit (1024 MB, calculator-host.ts) and under the bench's (8192 MB). The bench lives outside the repo
// (BENCH below); its output goes to the OS temp folder, never to the repo. Prints only numbers.
// Run: node specs/008-formula-trees/prototipo/measure-record.ts
import { spawnSync } from "node:child_process";
import { mkdtempSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BENCH = "C:/Users/Vinicius/idleon-companion/research/run/formula-006";
const PEAK = join(import.meta.dirname, "peak.cjs");
const OUT = mkdtempSync(join(tmpdir(), "proto008-"));

function rows(file: string): number {
  // Counts the nodes of the recorded tree (a JSON object with kids/children arrays), whatever the key name.
  const t = JSON.parse(readFileSync(file, "utf8"));
  let n = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("b" in o || "block" in o) n++;
      for (const k of Object.keys(o)) if (typeof o[k] === "object") walk(o[k]);
    }
  };
  walk(t);
  return n;
}

for (const heap of [1024, 8192]) {
  const out = join(OUT, `tree-${heap}.json`);
  const r = spawnSync(
    process.execPath,
    [`--max-old-space-size=${heap}`, "-r", PEAK, "build-tree.cjs", out],
    { cwd: BENCH, encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env } },
  );
  const peak = /PEAK (\{.*\})/.exec(r.stderr ?? "")?.[1];
  let size = 0;
  let nodes = 0;
  try {
    size = statSync(out).size;
    nodes = rows(out);
  } catch {
    // no output: the run failed (the PEAK line says how)
  }
  console.log(
    JSON.stringify({
      heapLimitMb: heap,
      exit: r.status,
      signal: r.signal,
      peak: peak ? JSON.parse(peak) : null,
      outMb: +(size / 1048576).toFixed(1),
      recordedNodes: nodes,
      lastErr: (r.stderr ?? "").split("\n").filter((l) => /error|abort|heap/i.test(l)).slice(-2),
    }),
  );
}
console.log("out folder (temp, not in repo):", OUT);
