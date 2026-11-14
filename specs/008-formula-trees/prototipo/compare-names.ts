// Disposable prototype: not product code.
// Item 4, comparison: walks the two assembled Drop Rate trees of measure-names.ts (with and without spec 007) in
// parallel, node by node. Where both nodes have the same number of children, it compares their names and goes down;
// where the children differ, it counts that subtree as "shape changed" and stops there. Prints only counts.
// Run: node specs/008-formula-trees/prototipo/compare-names.ts [folder of measure-names.ts]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Row = { name: string; kind?: string; kids?: Row[] };

const dir =
  process.argv[2] ??
  readdirSync(tmpdir())
    .filter((d) => d.startsWith("proto008-names-"))
    .map((d) => join(tmpdir(), d))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const load = (f: string): Row => (JSON.parse(readFileSync(join(dir, f), "utf8")) as { tree: Row }).tree;
const size = (r: Row): number => 1 + (r.kids ?? []).reduce((s, k) => s + size(k), 0);

let same = 0;
let renamed = 0;
let shapeChangedRows = 0;
const renamedByKind: Record<string, number> = {};
function walk(a: Row, b: Row): void {
  if (a.name === b.name) same++;
  else {
    renamed++;
    const k = a.kind ?? "(branch)";
    renamedByKind[k] = (renamedByKind[k] ?? 0) + 1;
  }
  const ka = a.kids ?? [];
  const kb = b.kids ?? [];
  if (ka.length !== kb.length) {
    shapeChangedRows += ka.reduce((s, k) => s + size(k), 0);
    return;
  }
  ka.forEach((k, i) => {
    walk(k, kb[i]);
  });
}
const withIx = load("mold-with007.json");
const without = load("mold-no007.json");
walk(withIx, without);
console.log(
  JSON.stringify({ rowsWith007: size(withIx), rowsWithout007: size(without), sameName: same, renamed, shapeChangedRows, renamedByKind }),
);
