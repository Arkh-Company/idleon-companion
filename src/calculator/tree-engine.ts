// The tree worker's engine (research R1, R4): the game instrumented in memory with the recorder, one recording per
// `number` request with the root called at the game's arity, and the root with its first level built from it. Opening
// a branch (`expand`) comes with the assembly's port (US1b).
import { buildTree } from "./tree-build.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { bootRecorder } from "./tree-record.ts";
import { TREE_RECIPE } from "./tree-recipe.ts";
import type { Recipe } from "./recording.ts";
import { TREE_ROOTS } from "./tree-roots.ts";
import type { TreeRoot } from "./tree-roots.ts";

export interface TreeEngine {
  /** The root of a `number` request, or "unknownNumber"; throws on any other request or a failure. */
  tree(request: unknown, mosaicJson: unknown): CalcTreeNode | "unknownNumber";
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export function createTreeEngine(
  code: string,
  pak: Uint8Array,
  roots: Readonly<Record<string, TreeRoot>> = TREE_ROOTS,
  recipe: Recipe = TREE_RECIPE,
): TreeEngine {
  const recorder = bootRecorder(code, pak);

  return {
    tree(request, mosaicJson) {
      if (
        !isRecord(request) ||
        request.type !== "number" ||
        typeof request.id !== "string" ||
        typeof request.character !== "number"
      )
        throw new Error("not a number request");
      if (typeof mosaicJson !== "string") throw new Error("no mosaic");
      const root = Object.hasOwn(roots, request.id)
        ? roots[request.id]
        : undefined;
      if (!root) return "unknownNumber";
      const recording = recorder.record(mosaicJson, [root], recipe);
      return buildTree(recording, request.character);
    },
  };
}
