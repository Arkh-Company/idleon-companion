// The tree worker's engine (research R1): the same boot as the Stats, and the root of a catalog number called with the
// game's arity. The recorder and the assembly (US1) build the branches under it; until then the root has no children.
import { anchored, bootContext, lazyDnsmKeys } from "./boot.ts";
import { LIMITS } from "./engine.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { TREE_ROOTS } from "./tree-roots.ts";

export interface TreeEngine {
  /** The root of a `number` request, or "unknownNumber"; throws on any other request or a failure. */
  tree(request: unknown, mosaicJson: unknown): CalcTreeNode | "unknownNumber";
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export function createTreeEngine(code: string, pak: Uint8Array): TreeEngine {
  const context = bootContext(anchored(code), pak, LIMITS);
  const lazyDnsm = lazyDnsmKeys(code);

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
      if (!Object.hasOwn(TREE_ROOTS, request.id)) return "unknownNumber";
      const [block, args] = TREE_ROOTS[request.id] ?? ["", []];
      context.load(mosaicJson, lazyDnsm);
      const value = context.number(block, args);
      return {
        id: "root",
        pieceKey: JSON.stringify([request.character, block, ...args]),
        name: "Total",
        value,
        fmt: null,
        leaf: null,
        condition: null,
        why: null,
        formula: null,
        code: `${block}(${args.map((a) => JSON.stringify(a)).join(", ")})`,
        role: "root",
        share: null,
        shareMode: null,
        flags:
          value === null
            ? { unnamed: true, unavailable: true }
            : { unnamed: true },
        kids: [],
      };
    },
  };
}
