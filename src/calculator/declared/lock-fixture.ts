// What the lock's tests share (spec 010, T027, T028): the invented game's recorder, booted once per file, a recording of
// one of its roots with its answer key, and an invented blueprint as a writable copy the test may change.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { Recording } from "../recording.ts";
import { makeSteps } from "../recorded/steps.ts";
import { bootRecorder } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";
import type { AnswerKey } from "./answer-key.ts";
import type { Blueprint, BlueprintGroup, BlueprintNode } from "./blueprint.ts";
import type { LevelContext } from "./lock-levels.ts";
import type { LockInput } from "./lock.ts";

/** A deep copy's type with every list and field writable; a tuple stays a tuple. */
export type Writable<T> = T extends object
  ? { -readonly [K in keyof T]: Writable<T[K]> }
  : T;

/** The value, or a thrown error naming what is missing. */
export function present<T>(x: T | undefined, what: string): T {
  if (x === undefined) throw new Error(`no ${what}`);
  return x;
}

const DIR = join(import.meta.dirname, "..", "fixtures", "blueprints");

export const inventedBlueprint = (id: string): Writable<Blueprint> =>
  JSON.parse(
    readFileSync(join(DIR, `${id}.blueprint.json`), "utf8"),
  ) as Writable<Blueprint>;

let recorder: ReturnType<typeof bootRecorder> | null = null;

/** A recording of `block` over the invented state (with `attrs` over it) and its answer key. */
export function recorded(
  block: string,
  attrs: object = {},
): { rec: Recording; key: AnswerKey; ops: LockInput["ops"] } {
  recorder ??= bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
  const rec = recorder.record(mosaicOf(attrs), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });
  const key = answerKey(rec, recorder.ops);
  if ("error" in key) throw new Error(key.reason);
  return { rec, key, ops: recorder.ops };
}

/** The lock's input for the invented Drop Rate: TreeDeclChain, the first character, of class 3. */
export function chainInput(
  bp: Writable<Blueprint> = inventedBlueprint("decl-chain"),
  attrs: object = {},
): LockInput {
  return {
    blueprint: bp,
    ...recorded("TreeDeclChain", attrs),
    character: 0,
    characterClass: 3,
  };
}

/** The descent's context over a recording, for the first character, at node `where`. */
export function levelContext(
  rec: Recording,
  ops: LockInput["ops"],
  where: string,
): LevelContext {
  const made = makeSteps(rec, ops);
  return { rec, stepsOf: (id) => made.of(id), character: 0, where };
}

export function groupOf(
  bp: Writable<Blueprint>,
  pool: number,
  system: string,
): Writable<BlueprintGroup> {
  const g = bp.pools[pool]?.groups.find((x) => x.system === system);
  if (!g) throw new Error(`no group ${system} in pool ${String(pool)}`);
  return g;
}

/** A node by its path of keys from a pool's group: `sourceOf(bp, 0, "talents", "talent", "talent", "points")`. */
export function sourceOf(
  bp: Writable<Blueprint>,
  pool: number,
  system: string,
  ...keys: string[]
): Writable<BlueprintNode> {
  let nodes = groupOf(bp, pool, system).sources;
  let found: Writable<BlueprintNode> | undefined;
  for (const k of keys) {
    found = nodes.find((n) => n.key === k);
    if (!found) throw new Error(`no node ${k}`);
    nodes = found.children ?? [];
  }
  if (!found) throw new Error("no key");
  return found;
}
