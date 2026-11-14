// The tree worker's engine (research R1, R4): the game instrumented in memory with the recorder, one recording per
// `number` request with the root called at the game's arity, and the root with its first level built from it. An
// `expand` builds a lazy branch over the build of the last `number` request, without recording again. `values` only
// calculates the numbers in view, with the recorder off (research R4).
import { lazyDnsmKeys } from "./boot.ts";
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
  /** One number per id over the mosaic, null outside the roots or when it fails; throws on a bad request. */
  values(ids: unknown, mosaicJson: unknown): Record<string, number | null>;
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
  const lazyDnsm = lazyDnsmKeys(code);
  const rootOf = (id: string) =>
    Object.hasOwn(roots, id) ? roots[id] : undefined;
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
      const root = rootOf(request.id);
      if (!root) return "unknownNumber";
      const recording = recorder.record(mosaicJson, [root], recipe);
      last = {
        treeId: request.id,
        build: buildTree(recording, request.character, recorder.ops),
      };
      return last.build.root;
    },
    values(ids, mosaicJson) {
      if (!Array.isArray(ids) || typeof mosaicJson !== "string")
        throw new Error("not a values request");
      const { context } = recorder;
      context.load(mosaicJson, lazyDnsm);
      return Object.fromEntries(
        ids
          .filter((id): id is string => typeof id === "string")
          .map((id) => {
            const root = rootOf(id);
            return [id, root ? context.number(...root) : null];
          }),
      );
    },
  };
}
