// Disposable prototype: not product code.
// Item 4 of the prototype: how many rows of the assembled Drop Rate tree lose their name without spec 007.
// Builds the tree twice from fresh recordings, once as the bench does and once with no007.cjs preloaded, and compares
// the two row by row in the same order. Output goes to the OS temp folder; prints only counts and the share by kind.
// Run: node specs/008-formula-trees/prototipo/measure-names.ts
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BENCH = "C:/Users/Vinicius/idleon-companion/research/run/formula-006";
const NO007 = join(import.meta.dirname, "no007.cjs");
const OUT = mkdtempSync(join(tmpdir(), "proto008-names-"));

type Row = { name: string; kind?: string; kids?: Row[] };

function build(tag: string, pre: string[]): { rows: Row[]; ms: number } {
  const rec = join(OUT, `rec-${tag}.json`);
  const mold = join(OUT, `mold-${tag}.json`);
  const t0 = Date.now();
  const a = spawnSync(process.execPath, ["--max-old-space-size=8192", ...pre, "build-tree.cjs", rec], {
    cwd: BENCH,
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
  if (a.status !== 0) throw new Error(`build-tree ${tag} failed: ${a.status}`);
  const b = spawnSync(process.execPath, ["--max-old-space-size=8192", ...pre, "build-v1mold.cjs"], {
    cwd: join(BENCH, "screen-proposal"),
    encoding: "utf8",
    maxBuffer: 1 << 28,
    env: { ...process.env, TREE: rec, OUT: mold },
  });
  if (b.status !== 0) throw new Error(`build-v1mold ${tag} failed: ${b.status}\n${(b.stderr ?? "").slice(-400)}`);
  const rows: Row[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Row & Record<string, unknown>;
      if (typeof o.name === "string") rows.push(o);
      for (const k of Object.keys(o)) if (typeof o[k] === "object") walk(o[k]);
    }
  };
  walk(JSON.parse(readFileSync(mold, "utf8")));
  return { rows, ms: Date.now() - t0 };
}

const withIx = build("with007", []);
const without = build("no007", ["-r", NO007]);
let changed = 0;
const byKind: Record<string, number> = {};
const n = Math.min(withIx.rows.length, without.rows.length);
for (let i = 0; i < n; i++) {
  if (withIx.rows[i].name !== without.rows[i].name) {
    changed++;
    const k = withIx.rows[i].kind ?? "(branch)";
    byKind[k] = (byKind[k] ?? 0) + 1;
  }
}
console.log(
  JSON.stringify({
    rowsWith007: withIx.rows.length,
    rowsWithout007: without.rows.length,
    namesChanged: changed,
    shareChanged: +(changed / n).toFixed(3),
    changedByKind: byKind,
    msWith007: withIx.ms,
    msWithout007: without.ms,
  }),
);
console.log("out folder (temp, not in repo):", OUT);
