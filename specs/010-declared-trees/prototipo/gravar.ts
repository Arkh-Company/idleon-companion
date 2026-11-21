// Disposable prototype: not product code.
// Grava o Drop Rate com o gravador real (src/calculator) sobre a cópia do jogo e o retrato do personagem, que ficam
// FORA do repositório. Nada do que sai daqui (gravação, passos, valores) é escrito dentro do repositório: o teste grava
// os dumps só na pasta de rascunho da sessão.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  activeCharacter,
  mosaicOfSnapshot,
} from "../../../src/calculator/parity-values.ts";
import type { Recording } from "../../../src/calculator/recording.ts";
import { bootRecorder } from "../../../src/calculator/tree-record.ts";
import {
  EXTRA_ROOTS,
  FOLLOW_CALLS,
  TREE_RECIPE,
} from "../../../src/calculator/tree-recipe.ts";
import { TREE_ROOTS } from "../../../src/calculator/tree-roots.ts";
import { makeSteps } from "../../../src/calculator/tree/steps.ts";
import type { Check, Step } from "../../../src/calculator/tree/steps.ts";

/** Pasta de rascunho da sessão: os insumos e os dumps ficam aqui, nunca no repositório. */
export const SCRATCH =
  "C:/Users/Vinicius/AppData/Local/Temp/claude/6881dd00f8f3d17b/3d18f90e-0652-4f4e-a29e-e4ca4bce5d2b/scratchpad";
const GAME = join(SCRATCH, "game");
const SNAPSHOT =
  "C:/Users/Vinicius/idleon-companion/lab/out/retrato-character-9.json";

const readJson = (f: string): unknown => JSON.parse(readFileSync(f, "utf8"));

/** O mosaico do retrato com o vars-*.json mais recente da mesma pasta, como a sonda check09 monta. */
function loadMosaic(): { mosaic: string; character: number } {
  const snap = readJson(SNAPSHOT) as { attrs: unknown; skipped?: unknown };
  const dir = dirname(SNAPSHOT);
  const varsFile = readdirSync(dir)
    .filter((f) => f.startsWith("vars-"))
    .sort()
    .at(-1);
  const vars = varsFile ? readJson(join(dir, varsFile)) : {};
  return {
    mosaic: mosaicOfSnapshot(snap, vars),
    character: activeCharacter(snap),
  };
}

export interface Gravado {
  rec: Recording;
  /** O nó do bloco raiz (a primeira chamada sob "(root)"). */
  topId: number;
  steps: Step[];
  checks: Check[];
  /** Os passos de qualquer outro nó da mesma gravação (para ler os filhos de uma fonte). */
  stepsOf(id: number): { steps: Step[]; checks: Check[] };
  ms: { boot: number; record: number; steps: number };
}

/** Uma gravação do número `id` (padrão dropRate), medindo o boot, a gravação e os passos do nó raiz separados. */
export function gravar(id = "dropRate"): Gravado {
  const root = TREE_ROOTS[id];
  if (!root) throw new Error(`sem raiz para ${id}`);
  const t0 = performance.now();
  const recorder = bootRecorder(
    readFileSync(join(GAME, "N.js"), "utf8"),
    new Uint8Array(readFileSync(join(GAME, "lib", "default.pak"))),
  );
  const t1 = performance.now();
  const { mosaic } = loadMosaic();
  const rec = recorder.record(
    mosaic,
    [root, ...EXTRA_ROOTS],
    TREE_RECIPE,
    false,
    FOLLOW_CALLS,
  );
  const t2 = performance.now();
  const topId = rec.nodes[rec.root ?? -1]?.c[0];
  if (topId === undefined) throw new Error("a gravação não tem raiz");
  const all = makeSteps(rec, recorder.ops);
  const { steps, checks } = all.of(topId);
  const t3 = performance.now();
  return {
    rec,
    topId,
    steps,
    checks,
    stepsOf: (n) => all.of(n),
    ms: { boot: t1 - t0, record: t2 - t1, steps: t3 - t2 },
  };
}
