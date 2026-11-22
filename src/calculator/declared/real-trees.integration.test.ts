// The real-trees run (spec 010, FR-026, NFR-003, contracts/real-trees-run.md): `just trees <target>` and `just draft
// <target>` on the PC with the game, outside `just check` and the CI. It skips by itself unless TREES_GAME_DIR,
// TREES_SNAPSHOT, TREES_OUT, TREES_TARGET and TREES_MODE are set (the recipe sets the last two):
// - TREES_GAME_DIR: the installed game's `distBuild/static/game` folder, unpacked (`N.js` and `lib/default.pak`);
// - TREES_SNAPSHOT: the snapshot (`attrs` and `skipped`, in a file whose name has no character name), with its
//   `vars-*.json` beside it;
// - TREES_OUT: the output folder, outside the repository.
// One process, one thread, the numbers in series; no network. The roots mode records only each sketch's root and
// writes `roots.json` and `summary.txt`. The check mode locks from T033 on, and the draft mode comes with draft.ts.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { bootRecorder } from "../tree-record.ts";
import { EXTRA_ROOTS, FOLLOW_CALLS, TREE_RECIPE } from "../tree-recipe.ts";
import { BLUEPRINTS, loadBlueprints } from "./blueprints.ts";
import {
  checkPlan,
  mosaicWith,
  outPath,
  probeRoot,
  rootsReport,
  summaryLine,
  targetIds,
  treesEnv,
} from "./real-trees-run.ts";
import type { RootProbe } from "./real-trees-run.ts";
import { treeCatalog } from "./tree-catalog-fixture.ts";

const ENV = treesEnv(process.env);
/** About 3 s a recording (prototype), 301 roots, and the boot. */
const RUN_MS = 90 * 60_000;

const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(file, "utf8"));

/** The active character's place in the snapshot's list of characters; 0 when the snapshot does not say. */
function activeCharacter(snapshot: string): number {
  const snap = readJson(snapshot) as {
    attrs?: { UserInfo?: unknown; GetPlayersUsernames?: unknown };
  };
  const info = snap.attrs?.UserInfo;
  const names = snap.attrs?.GetPlayersUsernames;
  if (!Array.isArray(info) || !Array.isArray(names)) return 0;
  return Math.max(0, names.indexOf(info[0]));
}

/** The snapshot with the newest `vars-*.json` of its folder, as the recorder takes it. */
function mosaic(snapshot: string): string {
  const snap = readJson(snapshot) as { attrs: unknown; skipped?: unknown };
  const dir = dirname(snapshot);
  const varsFile = readdirSync(dir)
    .filter((f) => f.startsWith("vars-"))
    .sort()
    .at(-1);
  const vars = varsFile ? readJson(join(dir, varsFile)) : {};
  return JSON.stringify({
    attrs: snap.attrs,
    vars,
    skipped: snap.skipped ?? [],
  });
}

describe.skipIf(!ENV)("the real-trees run", () => {
  test(
    "the target's numbers, in series, with the outputs in TREES_OUT",
    () => {
      if (!ENV) return;
      const { gameDir, snapshot, out, target, mode } = ENV;
      const ids = targetIds(target, treeCatalog());
      const loaded = loadBlueprints(BLUEPRINTS);
      mkdirSync(out, { recursive: true });
      const lines: string[] = [];
      const t0 = performance.now();
      let peak = process.memoryUsage().rss;

      if (mode === "check") {
        const plan = checkPlan(ids, loaded.stages);
        for (const id of plan.notWritten)
          lines.push(summaryLine(id, { result: "notWritten", ms: 0 }));
        if (plan.lock.length > 0)
          throw new Error("o modo check trava receitas a partir da T033");
      } else if (mode === "draft") {
        throw new Error("o modo draft chega com o draft.ts (Fase 3)");
      } else {
        const recorder = bootRecorder(
          readFileSync(join(gameDir, "N.js"), "utf8"),
          new Uint8Array(readFileSync(join(gameDir, "lib", "default.pak"))),
          undefined,
          { infinite: true },
        );
        lines.push(`boot\t${String(Math.round(performance.now() - t0))} ms`);
        const state = mosaic(snapshot);
        const character = activeCharacter(snapshot);
        const probes: RootProbe[] = [];
        for (const id of ids) {
          const bp = loaded.all.get(id);
          if (!bp) {
            lines.push(summaryLine(id, { result: "notWritten", ms: 0 }));
            continue;
          }
          const probe = probeRoot(
            (roots, scratch, routine) =>
              recorder.record(
                mosaicWith(state, scratch),
                [...roots, ...EXTRA_ROOTS],
                TREE_RECIPE,
                false,
                FOLLOW_CALLS,
                routine,
              ),
            recorder.ops,
            bp,
            character,
          );
          probes.push(probe);
          lines.push(summaryLine(id, { result: probe.form, ms: probe.ms }));
          peak = Math.max(peak, process.memoryUsage().rss);
        }
        const report = rootsReport(probes);
        writeFileSync(
          outPath(out, "roots.json"),
          `${JSON.stringify(report, null, 1)}\n`,
        );
        expect(probes).toHaveLength(ids.length);
      }
      lines.push(`total\t${String(Math.round(performance.now() - t0))} ms`);
      lines.push(`peak memory\t${String(Math.round(peak / 2 ** 20))} MB`);
      writeFileSync(outPath(out, "summary.txt"), `${lines.join("\n")}\n`);
    },
    RUN_MS,
  );
});
