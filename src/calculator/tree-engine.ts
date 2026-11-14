// The tree worker's engine (research R1, R4): the game instrumented in memory with the recorder, one recording per
// `number` request with the root called at the game's arity, and the root with its first level built from it. An
// `expand` builds a lazy branch over the build of the last `number` request, without recording again.
import { buildTree } from "./tree-build.ts";
import type { TreeBuild } from "./tree-build.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { bootRecorder } from "./tree-record.ts";
import { TREE_RECIPE } from "./tree-recipe.ts";
import type { Recipe } from "./recording.ts";
import { TREE_ROOTS } from "./tree-roots.ts";
import type { TreeRoot } from "./tree-roots.ts";

export interface TreeEngine {
  /** The root of a `number` request or the branch of an `expand`, or "unknownNumber"; throws on a bad request or a failure. */
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
  /** The last `number` tree, kept for its branches until the next request. */
  let last: { treeId: string; build: TreeBuild } | null = null;

  return {
    tree(request, mosaicJson) {
      if (
        isRecord(request) &&
        request.type === "expand" &&
        typeof request.treeId === "string" &&
        typeof request.nodeId === "string"
      ) {
        const branch =
          last?.treeId === request.treeId
            ? last.build.expand(request.nodeId)
            : null;
        if (!branch) throw new Error("no such branch");
        return branch;
      }
      last = null;
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
      last = {
        treeId: request.id,
        build: buildTree(recording, request.character, recorder.ops),
      };
      return last.build.root;
    },
  };
}
