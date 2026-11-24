// The real-trees run (spec 010, FR-026, NFR-003, contracts/real-trees-run.md): `just trees <target>` and `just draft
// <target>` on the PC with the game, outside `just check` and the CI. It skips by itself unless TREES_GAME_DIR,
// TREES_SNAPSHOT, TREES_OUT, TREES_TARGET and TREES_MODE are set (the recipe sets the last two):
// - TREES_GAME_DIR: the installed game's `distBuild/static/game` folder, unpacked (`N.js` and `lib/default.pak`);
// - TREES_SNAPSHOT: the snapshot (`attrs` and `skipped`, in a file whose name has no character name), with its
//   `vars-*.json` beside it;
// - TREES_OUT: the output folder, outside the repository.
// One process, one thread, the numbers in series; no network. The roots mode records only each sketch's root and
// writes `roots.json` and `summary.txt`. The check mode locks each complete blueprint and checks each draft (once per
// class of the snapshot when a source has one, real-trees-check.ts) and writes `lock/<id>.json`, the review's lock
// beside a complete blueprint only, and `summary.txt` with each one's nodes and each stage's time. The draft mode drafts each sketch only (draft.ts), and a draft named alone (T204), into
// TREES_OUT/draft/ (never over the repository's blueprint), its guide of steps and its pieces (draft/pieces/) beside it.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { readGameNames } from "../game-names.ts";
import { useGameNames } from "../names/names.ts";
import { useGameTables } from "../names/table-names.ts";
import { bootRecorder, TREE_LIMITS } from "../tree-record.ts";
import { EXTRA_ROOTS, FOLLOW_CALLS, TREE_RECIPE } from "../tree-recipe.ts";
import { answerKey } from "./answer-key.ts";
import { BLUEPRINTS, loadBlueprints } from "./blueprints.ts";
import { stepsGuide } from "./draft-steps.ts";
import { draftJson, pieceJson } from "./draft-json.ts";
import { draftBlueprint, gameList } from "./draft.ts";
import {
  classCharacters,
  lockNumber,
  lockRuns,
  writeLock,
} from "./real-trees-check.ts";
import type { RecordFn } from "./real-trees-check.ts";
import { lockTally } from "./lock.ts";
import { blueprintSha, saoPauloTime } from "./review.ts";
import {
  checkPlan,
  draftPath,
  draftPlan,
  piecePath,
  mosaicWith,
  outPath,
  probeRoot,
  rootCallsOf,
  rootShapeOf,
  rootsReport,
  routineStepOf,
  stepsPath,
  summaryLine,
  targetIds,
  treesEnv,
} from "./real-trees-run.ts";
import type { RootProbe } from "./real-trees-run.ts";
import { treeCatalog } from "./tree-catalog-fixture.ts";

const ENV = treesEnv(process.env);
/** The blueprints' folder: each review is written beside its blueprint. */
const BLUEPRINTS_DIR = join(import.meta.dirname, "..", "blueprints");
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

      const boot = () => {
        const code = readFileSync(join(gameDir, "N.js"), "utf8");
        const recorder = bootRecorder(
          code,
          new Uint8Array(readFileSync(join(gameDir, "lib", "default.pak"))),
          undefined,
          { infinite: true },
        );
        lines.push(`boot\t${String(Math.round(performance.now() - t0))} ms`);
        return {
          recorder,
          gameSha: createHash("sha256").update(code).digest("hex"),
        };
      };

      if (mode === "check") {
        const plan = checkPlan(ids, loaded.stages);
        for (const id of plan.notWritten)
          lines.push(summaryLine(id, { result: "notWritten", ms: 0 }));
        if (plan.lock.length + plan.draft.length > 0) {
          const { recorder, gameSha } = boot();
          const state = mosaic(snapshot);
          const classes = classCharacters(readJson(snapshot));
          const active = activeCharacter(snapshot);
          const lots = new Map(treeCatalog().map((n) => [n.id, n.lot]));
          mkdirSync(outPath(out, "lock"), { recursive: true });
          const record: RecordFn = (text, scene, roots, routine) =>
            recorder.record(
              text,
              [...roots, ...EXTRA_ROOTS],
              TREE_RECIPE,
              scene,
              FOLLOW_CALLS,
              routine,
            );
          // a draft is checked where it is closed (T199); only a complete blueprint gets the review's lock
          for (const id of [...plan.lock, ...plan.draft]) {
            const bp = loaded.all.get(id);
            const lot = lots.get(id);
            if (!bp || !lot) continue;
            const complete = plan.lock.includes(id);
            const t1 = performance.now();
            const { lock, stages } = lockNumber(
              record,
              recorder.ops,
              bp,
              state,
              lockRuns(bp, classes, active),
            );
            writeFileSync(
              outPath(out, "lock", `${id}.json`),
              `${JSON.stringify(lock, null, 1)}\n`,
            );
            if (complete)
              writeLock(BLUEPRINTS_DIR, id, lot, blueprintSha(bp), {
                ok: lock.ok,
                gameSha,
                at: saoPauloTime(new Date()),
              });
            lines.push(
              summaryLine(id, {
                result: !complete ? "draft" : lock.ok ? "passed" : "failed",
                ms: performance.now() - t1,
                nodes: lockTally(lock, bp),
                stages,
              }),
            );
            peak = Math.max(peak, process.memoryUsage().rss);
          }
        }
      } else if (mode === "draft") {
        const todo = draftPlan(ids, loaded.stages, target);
        for (const id of ids)
          if (!todo.includes(id))
            lines.push(summaryLine(id, { result: "notWritten", ms: 0 }));
        if (todo.length > 0) {
          const { recorder } = boot();
          // the names and the talent order of the installed game, as the worker reads them at its boot
          const game = readGameNames(recorder.context, TREE_LIMITS.startMs);
          useGameNames(game.names);
          useGameTables(game.tables);
          const dc = {
            character: activeCharacter(snapshot),
            talentOrder: gameList(
              recorder.context,
              "CustomLists.TalentOrder",
              TREE_LIMITS.startMs,
            ),
            // a part that is another blueprint's root is a line with a link to its tree (T200)
            trees: [...loaded.all.values()],
          };
          const state = mosaic(snapshot);
          mkdirSync(outPath(out, "draft"), { recursive: true });
          for (const id of todo) {
            const bp = loaded.all.get(id);
            if (!bp) continue;
            const t1 = performance.now();
            const done = (
              result: Parameters<typeof summaryLine>[1]["result"],
            ) => summaryLine(id, { result, ms: performance.now() - t1 });
            let rec;
            try {
              rec = recorder.record(
                mosaicWith(state, bp.root.scratch),
                [...rootCallsOf(bp, dc.character), ...EXTRA_ROOTS],
                TREE_RECIPE,
                false,
                FOLLOW_CALLS,
                routineStepOf(bp, dc.character),
              );
            } catch {
              lines.push(done("error"));
              continue;
            }
            const key = answerKey(
              rec,
              recorder.ops,
              rootShapeOf(bp, dc.character),
            );
            // a root out of the rule, or one with no pool, has no draft: its sketch stays as it is
            if ("error" in key || key.pools.length === 0) {
              lines.push(done("error" in key ? "outOfRule" : "leaf"));
              continue;
            }
            const draft = draftBlueprint(
              id,
              bp.root,
              key,
              rec,
              recorder.ops,
              dc,
            );
            writeFileSync(draftPath(out, id), draftJson(draft));
            // its common branches' pieces beside it (T203), each written once
            for (const p of draft.pieces ?? []) {
              mkdirSync(outPath(out, "draft", "pieces"), { recursive: true });
              writeFileSync(piecePath(out, p.id), pieceJson(p));
            }
            writeFileSync(
              stepsPath(out, id),
              stepsGuide(key, rec, recorder.ops, dc),
            );
            lines.push(done("drafted"));
            peak = Math.max(peak, process.memoryUsage().rss);
          }
        }
      } else {
        const { recorder } = boot();
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
