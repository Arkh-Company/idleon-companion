// Disposable prototype: not product code.
// Item 3 of the prototype: espree x acorn as the parser of the game's code. Measures (a) the bytes each one adds when
// bundled into one file, minified, as the calculator would carry it; (b) the time to parse the whole installed game
// file; (c) whether both give the same syntax tree (a hash of every node's type and range). Reads the bench's copy of
// the game file and prints only sizes, times and hashes, never the code.
// Run (from the repo root): node specs/008-formula-trees/prototipo/measure-parser.ts
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const GAME = "C:/Users/Vinicius/idleon-companion/research/run/N.game.js";
const local = createRequire(join(HERE, "package.json"));
const root = createRequire(join(HERE, "..", "..", "..", "package.json"));

async function bundleBytes(name: string, entryCode: string): Promise<number> {
  const vite = await import(pathToFileURL(root.resolve("vite")).href);
  const dir = mkdtempSync(join(tmpdir(), "proto008-bundle-"));
  // The entry sits in this folder, so the bundler finds the parser in this folder's node_modules.
  const entry = join(HERE, `entry-${name}.mjs`);
  writeFileSync(entry, entryCode);
  await vite.build({
    configFile: false,
    logLevel: "silent",
    root: dir,
    resolve: { modules: [join(HERE, "node_modules")] },
    build: {
      outDir: join(dir, "out"),
      minify: true,
      ssr: entry,
      rollupOptions: { output: { entryFileNames: "out.js", format: "cjs" } },
    },
    ssr: { noExternal: true },
  });
  return statSync(join(dir, "out", "out.js")).size;
}

function shape(ast: unknown): { nodes: number; hash: string } {
  const h = createHash("sha256");
  let nodes = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.type === "string" && Array.isArray(o.range)) {
      nodes++;
      h.update(`${o.type}:${(o.range as number[])[0]}:${(o.range as number[])[1]};`);
    }
    for (const k of Object.keys(o)) if (k !== "loc" && k !== "range" && typeof o[k] === "object") walk(o[k]);
  };
  walk(ast);
  return { nodes, hash: h.digest("hex").slice(0, 16) };
}

const src = readFileSync(GAME, "utf8");
const espree = local("espree");
const acorn = local("acorn");

const t1 = performance.now();
const a1 = espree.parse(src, { ecmaVersion: 2022, range: true });
const espreeMs = Math.round(performance.now() - t1);
const s1 = shape(a1);

const t2 = performance.now();
const a2 = acorn.parse(src, { ecmaVersion: 2022, ranges: true });
const acornMs = Math.round(performance.now() - t2);
const s2 = shape(a2);

console.log(
  JSON.stringify({
    gameFileMb: +(src.length / 1048576).toFixed(1),
    espree: {
      bundleKb: Math.round((await bundleBytes("espree", 'export { parse } from "espree";')) / 1024),
      parseMs: espreeMs,
      ...s1,
    },
    acorn: {
      bundleKb: Math.round((await bundleBytes("acorn", 'export { parse } from "acorn";')) / 1024),
      parseMs: acornMs,
      ...s2,
    },
    sameTree: s1.hash === s2.hash && s1.nodes === s2.nodes,
  }),
);
