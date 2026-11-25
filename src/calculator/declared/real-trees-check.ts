// The check mode of the real-trees run (spec 010, T033, FR-002a, FR-010, FR-026, contracts/real-trees-run.md and
// review.md): each complete blueprint recorded, its answer key taken and locked, once per class of the snapshot when a
// source has a class (the other characters rebuilt as the game rebuilds them, inactive.ts), the runs joined. The review
// beside the blueprint keeps only the blueprint's hash and the lock; the reasons stay in TREES_OUT/lock/.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inactiveMosaic } from "../inactive.ts";
import type { Op } from "../instrument.ts";
import type { Recording, RoutineRun } from "../recording.ts";
import type { RootCall } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";
import type { Blueprint } from "./blueprint.ts";
import { isObj } from "./blueprint-root.ts";
import { emptyOut } from "./lock-levels.ts";
import { lockBlueprint } from "./lock.ts";
import type { LockResult } from "./lock.ts";
import {
  LOTS,
  mosaicWith,
  rootCallsOf,
  rootShapeOf,
  routineStepOf,
  TARGET,
} from "./real-trees-run.ts";
import { parseReview, reviewJson, withLock } from "./review.ts";
import type { Review } from "./review.ts";

/** One recording over a state: the inactive character's scene rebuilt when `scene`. */
export type RecordFn = (
  mosaic: string,
  scene: boolean,
  roots: readonly RootCall[],
  routine?: readonly RoutineRun[],
) => Recording;
export interface LockRun {
  character: number;
  characterClass: number | null;
}

/** The review beside a blueprint: its path comes from the catalog's id and lot only, never from a text from outside. */
export function reviewPath(
  blueprintsDir: string,
  id: string,
  lot: string,
): string {
  if (!TARGET.test(id) || !LOTS.includes(lot))
    throw new Error("revisão fora da regra: um id e um lote do catálogo");
  return join(blueprintsDir, lot, `${id}.review.json`);
}

/** The lock written into the review; a review out of its shape is refused, never written over with its history. */
export function writeLock(
  dir: string,
  id: string,
  lot: string,
  sha: string,
  lock: Review["lock"],
): void {
  const file = reviewPath(dir, id, lot);
  const prev = existsSync(file)
    ? parseReview(JSON.parse(readFileSync(file, "utf8")))
    : null;
  if (existsSync(file) && !prev)
    throw new Error(`revisão fora da forma: ${id}`);
  writeFileSync(file, reviewJson(withLock(prev, sha, lock)));
}

const entries = (x: unknown) => (isObj(x) && isObj(x.$m) ? x.$m : {});

/** One character of each class of the snapshot (class id → place in the game's list), the active one for its own. */
export function classCharacters(snapshot: unknown): Map<number, number> {
  const attrs = isObj(snapshot) && isObj(snapshot.attrs) ? snapshot.attrs : {};
  const names: unknown[] = Array.isArray(attrs.GetPlayersUsernames)
    ? attrs.GetPlayersUsernames
    : [];
  const active: unknown = Array.isArray(attrs.UserInfo)
    ? attrs.UserInfo[0]
    : undefined;
  const saved = entries(attrs.PlayerDATABASE);
  const out = new Map<number, number>();
  names.forEach((name, i) => {
    const own =
      name === active
        ? attrs.CharacterClass
        : typeof name === "string"
          ? entries(saved[name]).CharacterClass
          : undefined;
    if (typeof own === "number" && (!out.has(own) || name === active))
      out.set(own, i);
  });
  return out;
}

/** The runs a blueprint needs: one per class of the snapshot when a source has a class; else the active character. */
export function lockRuns(
  bp: Blueprint,
  classes: ReadonlyMap<number, number>,
  active: number,
): LockRun[] {
  const byClass = bp.pools.some((p) =>
    p.groups.some((g) => g.sources.some((s) => s.classes !== undefined)),
  );
  if (byClass && classes.size > 0)
    return [...classes].map(([characterClass, character]) => ({
      character,
      characterClass,
    }));
  const own = [...classes].find(([, i]) => i === active);
  return [{ character: active, characterClass: own ? own[0] : null }];
}

/**
 * The runs joined: passed only when each error left is none; each error once; the counts and the stages' times added.
 * A child a run's gate (T210) or its chosen member (T212) did not reach is refused only when no run reached it.
 */
function joined(runs: readonly LockResult[]): LockResult {
  const out = emptyOut();
  const seen = new Set<string>();
  // reached: a run whose gate let it through checked it there (it closed, or it or a place below it was refused)
  const at = (w: string, where: string) =>
    w === where || w.startsWith(`${where}/`);
  const reached = (where: string) =>
    runs.some(
      (r) =>
        !r.unreached?.includes(where) &&
        [...r.closedAt, ...r.errors.map((e) => e.where)].some((w) =>
          at(w, where),
        ),
    );
  for (const r of runs) {
    for (const e of r.errors)
      if (
        (e.kind === "childNoValue" || e.kind === "childOutside") &&
        r.unreached?.includes(e.where) &&
        reached(e.where)
      )
        continue;
      else if (!seen.has(JSON.stringify(e))) {
        seen.add(JSON.stringify(e));
        out.errors.push(e);
      }
    for (const k of Object.keys(out.counts) as (keyof typeof out.counts)[])
      out.counts[k] += r.counts[k];
    out.closedAt.push(...r.closedAt);
  }
  const pendingAt = [...new Set(runs.flatMap((r) => r.pendingAt))];
  return { ok: out.errors.length === 0, ...out, pendingAt };
}

/** A number locked over each run: recorded for the run's character, its answer key taken, then the lock. */
export function lockNumber(
  record: RecordFn,
  ops: readonly Op[],
  bp: Blueprint,
  mosaic: string,
  runs: readonly LockRun[],
): { lock: LockResult; stages: Record<string, number> } {
  const stages: Record<string, number> = {};
  const add = (k: string, ms: number) => {
    stages[k] = (stages[k] ?? 0) + ms;
  };
  const results = runs.map(({ character, characterClass }): LockResult => {
    const inactive = inactiveMosaic(mosaic, character);
    const rec = record(
      mosaicWith(inactive ?? mosaic, bp.root.scratch),
      inactive !== null,
      rootCallsOf(bp, character),
      routineStepOf(bp, character),
    );
    for (const [k, ms] of Object.entries(rec.ms ?? {})) add(k, ms);
    let t = performance.now();
    const key = answerKey(rec, ops, rootShapeOf(bp, character));
    add("answerKey", performance.now() - t);
    if ("error" in key) {
      const out = emptyOut();
      out.errors.push({ kind: "rootForm", where: "root", got: key.reason });
      return { ok: false, ...out, pendingAt: [] };
    }
    t = performance.now();
    const lock = lockBlueprint({
      blueprint: bp,
      key,
      rec,
      ops,
      character,
      characterClass,
    });
    add("lock", performance.now() - t);
    return lock;
  });
  return { lock: joined(results), stages };
}
