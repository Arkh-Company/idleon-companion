// From the window's tree request to the FormulaTree it gets back (spec 008, data-model.md). A request always uses the
// Stats' own pair of result and mosaic, so the root is checked against the number on screen (FR-019). What the worker
// sends is checked before it reaches the window (FR-010b). No electron import, so tests can load it.
import { isObject } from "../shared/index.ts";
import type {
  FormulaTree,
  Status,
  TreeNode,
  TreeRequest,
} from "../shared/index.ts";
import type { FormulaRequest } from "./payloads.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { statsNumber } from "./stats.ts";
import { checkTree } from "./tree-check.ts";
import type { createTreeHost } from "./tree-host.ts";

/** Drop Rate without compaction is about 5,000 rows (plan, Scale). */
export const MAX_TREE_NODES = 20_000;

type TreeHost = Pick<
  ReturnType<typeof createTreeHost>,
  "request" | "dropCurrent" | "setFiles" | "stop"
>;

/** A structured log entry: a label and a catalog id, never a value of the math or a name (FR-019, FR-010a). */
export type FormulaLog =
  | { event: "treeDiverged"; label: string; id: string }
  | { event: "treeRejected"; id: string };

/** The active character's place in the game's list of characters, read from the mosaic; null when it is not there. */
export function characterNumber(mosaicJson: string): number | null {
  try {
    const parsed: unknown = JSON.parse(mosaicJson);
    const attrs = isObject(parsed) ? parsed.attrs : null;
    if (!isObject(attrs)) return null;
    const { UserInfo: info, GetPlayersUsernames: names } = attrs;
    if (!Array.isArray(info) || !Array.isArray(names)) return null;
    const place = typeof info[0] === "string" ? names.indexOf(info[0]) : -1;
    return place >= 0 ? place : null;
  } catch {
    return null;
  }
}

/** Walked without recursion: a checked tree can be as deep as it has nodes. */
function countNodes(root: TreeNode): number {
  let count = 0;
  const pending = [root];
  for (let n = pending.pop(); n; n = pending.pop()) {
    count++;
    if (Array.isArray(n.kids)) pending.push(...n.kids);
  }
  return count;
}

export function startFormulaPipeline(deps: {
  send: (tree: FormulaTree) => void;
  treeHost: (on: {
    onTree(id: number, tree: unknown): void;
    onUnavailable(id: number): void;
    onValues(id: number, values: unknown): void;
  }) => TreeHost;
  statsPair: () => StatsPair | null;
  log: (entry: FormulaLog) => void;
}): {
  /** A request the main already checked (`formulaRequestPayload`). */
  request(r: FormulaRequest): void;
  /** `formula:close`: no tree open. */
  close(): void;
  /** The Stats sent something: maybe a new pair, maybe none (a character change). */
  statsChanged(): void;
  status(s: Status): void;
  gameFiles(resources: string): void;
  replay(): void;
} {
  /** The number the window has open; `character` null is the active one. */
  let open: { id: string; character: number | null } | null = null;
  /** The active character the open tree belongs to. */
  let openFor: number | null = null;
  let asked: {
    seq: number;
    request: Extract<TreeRequest, { type: "number" }>;
    pair: StatsPair;
    active: number;
  } | null = null;
  let seq = 0;
  let stale = false;
  let last: FormulaTree = { state: "none" };

  function show(tree: FormulaTree): void {
    last = tree;
    deps.send(tree);
  }

  function drop(): void {
    asked = null;
    host.dropCurrent();
  }

  /** The active character of the Stats' pair, with the pair; null without a reading or a known character. */
  function current(): { pair: StatsPair; active: number } | null {
    const pair = deps.statsPair();
    const active = pair ? characterNumber(pair.mosaicJson) : null;
    return pair && active !== null ? { pair, active } : null;
  }

  function ask(): void {
    if (!open) return;
    const now = current();
    if (!now) {
      drop();
      show({ state: "waiting" });
      return;
    }
    const { pair, active } = now;
    openFor = active;
    const request = {
      type: "number" as const,
      id: open.id,
      character: open.character ?? active,
    };
    if (request.character !== active) {
      // ponytail: only the active character until the picker (US11) brings the inactive rebuild.
      show({ state: "unavailable", request });
      return;
    }
    seq++;
    asked = { seq, request, pair, active };
    show({ state: "calculating", request });
    host.request(seq, request, pair.mosaicJson);
  }

  function received(id: number, raw: unknown): void {
    if (asked?.seq !== id) return;
    const { request, pair, active } = asked;
    asked = null;
    const root = checkTree(raw, MAX_TREE_NODES);
    if (!root) {
      deps.log({ event: "treeRejected", id: request.id });
      show({ state: "unavailable", request });
      return;
    }
    const stats = statsNumber(request.id);
    const statsValue = stats
      ? pair.numbers[request.id as keyof StatsPair["numbers"]]
      : null;
    const textOf = (v: unknown) =>
      typeof v === "number" ? (stats?.text(v) ?? String(v)) : "unavailable";
    if (stats && request.character === active && root.value !== statsValue) {
      deps.log({ event: "treeDiverged", label: stats.label, id: request.id });
      show({ state: "diverged", request, statsText: textOf(statsValue) });
      return;
    }
    show({
      state: "ready",
      request,
      title: stats?.label ?? request.id,
      rootText: textOf(root.value),
      statsValue,
      character: request.character,
      activeCharacter: active,
      calculatedAt: pair.calculatedAt,
      gameChanged: false,
      checkedOnThisGame: true,
      stale,
      comparingWith: null,
      counts: { nodes: countNodes(root) },
      root,
    });
  }

  const host = deps.treeHost({
    onTree: received,
    onUnavailable: (id) => {
      if (asked?.seq !== id) return;
      const { request } = asked;
      asked = null;
      show({ state: "unavailable", request });
    },
    onValues: () => undefined, // ponytail: live values arrive with US2 (T031).
  });

  return {
    request(r) {
      if ("treeId" in r) return; // ponytail: branches open with US1 (T024); no tree has a lazy branch yet.
      drop();
      open = { id: r.id, character: r.character };
      ask();
    },
    close() {
      open = null;
      openFor = null;
      drop();
      show({ state: "none" });
    },
    statsChanged() {
      if (!open) return;
      const now = current();
      if (!now) {
        if (last.state !== "waiting") {
          drop();
          show({ state: "waiting" });
        }
        return;
      }
      if (openFor !== null && now.active !== openFor) {
        drop();
        show({ state: "none" });
        ask();
      } else if (last.state === "waiting") ask();
    },
    status(s) {
      const closed = s.game === "closed";
      if (closed) host.stop();
      if (closed === stale) return;
      stale = closed;
      if (last.state === "ready") show({ ...last, stale });
    },
    gameFiles(resources) {
      open = null;
      openFor = null;
      asked = null;
      host.setFiles(resources);
      show({ state: "none" });
    },
    replay() {
      deps.send(last);
    },
  };
}
