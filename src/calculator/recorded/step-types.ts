// The shapes of a block's steps (spec 008, T022; moved out of steps.ts, spec 010 T177 r5): the expression tree of a
// step, its checks, the calls a step tied to none, the game's own tables and step 9's `rl` (`lastReads`).
import type { RecNode, RecValue } from "../recording.ts";

export type StepValue = number | boolean | null | undefined;
export type Expr =
  | { t: "num"; v: number | string | boolean | null }
  | { t: "val"; v: StepValue }
  | { t: "call"; id: number; v: StepValue }
  | { t: "read"; p: string; v: StepValue }
  | { t: "def"; e: Expr; v: StepValue }
  | { t: "op"; o: string; l: Expr; r: Expr; v: StepValue }
  | { t: "fn"; name: string | null; args: Expr[]; v: StepValue }
  | { t: "not"; a: Expr; v: StepValue };
export interface Step {
  v: number;
  e: Expr;
}
export interface Check {
  v: boolean;
  e: Expr;
}
export interface BlockSteps {
  steps: Step[];
  checks: Check[];
  /** Any recorded step of the block (by its op id) as an expression, as the steps build it (spec 010, T151). */
  exprOf?: (op: number) => Expr | null;
  /** Where each step was last recorded in the call's step log (spec 010, T162: a write comes after its step). */
  stepAt?: number[];
  /** The calls a step tied to none, shared by every call and turn of one makeSteps (spec 010, T177 r1, r2). */
  ambiguous?: ReadonlySet<AmbiguousCall>;
}
/** A step's call that two or more calls of its block gave the value of, with no place to decide between them. */
export interface AmbiguousCall {
  block: string;
  v: StepValue;
}

/** The game's own definition tables are game data, not the player's (build-tree.cjs GAME_TABLE). */
export const GAME_TABLE: readonly { test: RegExp; proof: string }[] = [
  {
    test: /^(CustomLists|CustomMaps|ItemDefinitionsGET|MonsterDefinitionsGET|DialogueDefGET)\b/,
    proof: "bench build-tree.cjs GAME_TABLE",
  },
];
/** Step 9's `rl`: a path the call read with several numbers, with the last one (the state the call ended with). */
export function lastReads(n: Pick<RecNode, "rx">): Map<string, number> {
  const seen = new Map<string, { last: number; changed: boolean }>();
  for (const [p, v] of n.rx ?? [])
    if (typeof v === "number") {
      const x = seen.get(p);
      seen.set(p, { last: v, changed: !!x && (x.changed || v !== x.last) });
    }
  return new Map(
    [...seen].filter(([, x]) => x.changed).map(([p, x]) => [p, x.last]),
  );
}

export type Reads = [string, RecValue][];
/** A loop turn's place in the writer's step log: from its previous write to this one. */
export interface LoopTurn {
  from: number;
  to: number;
}
