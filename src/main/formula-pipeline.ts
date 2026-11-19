// From the window's tree request to the FormulaTree it gets back (spec 008, data-model.md). A request always uses the
// Stats' own pair of result and mosaic, so the root is checked against the number on screen (FR-019, formula-answer.ts).
// The live values of what is in view go over the same pair (FR-008, plan B), and the open tree takes its own (spec 009
// FR-015). Each part carries how many catalog numbers use it, from the index the shapes fill in the background (FR-027).
// No electron import, so tests can load it.
import { partsOf, pieceValues } from "../shared/index.ts";
import type {
  FormulaTree,
  LiveValues,
  Mark,
  Status,
  TreeNode,
  TreeRequest,
} from "../shared/index.ts";
import { characterNumber } from "./characters.ts";
import { feedsIndex, withFeeds } from "./feeds-index.ts";
import type { FormulaRequest } from "./payloads.ts";
import { namesOf } from "./character-names.ts";
import type { savedFiles } from "./saved-files.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { liveValues } from "./live-values.ts";
import type { patchRadar } from "./radar.ts";
import { checkTree } from "./tree-check.ts";
import {
  liveTree,
  MAX_TREE_NODES,
  rebuildClock,
  treeAnswer,
} from "./formula-answer.ts";
import type { FormulaLog } from "./formula-answer.ts";
import { withBranch } from "./tree-walk.ts";
import type { createTreeHost } from "./tree-host.ts";

type TreeHost = Pick<
  ReturnType<typeof createTreeHost>,
  "request" | "values" | "dropCurrent" | "setFiles" | "stop" | "shape"
>;

export function startFormulaPipeline(deps: {
  send: (tree: FormulaTree) => void;
  sendValues: (v: LiveValues) => void;
  treeHost: (on: {
    onTree(id: number, tree: unknown, log?: "chainOpen"): void;
    onUnavailable(id: number): void;
    onValues(id: number, values: unknown): void;
    onShape(id: number, shape: unknown): void;
  }) => TreeHost;
  statsPair: () => StatsPair | null;
  /** Whether the game's code is the one the name and type rules were checked on (the version band, FR-018). */
  checkedOnThisGame: () => boolean;
  log: (entry: FormulaLog) => void;
  /** The tree shapes saved on this computer, which the index of Where this goes is built from (FR-027). */
  shapes: ReturnType<typeof savedFiles>["shapes"];
  /** The patch radar, which the shapes of a new game version are compared for (FR-029, FR-035). */
  radar?: ReturnType<typeof patchRadar>;
}): {
  /** A request the main already checked (`formulaRequestPayload`). */
  request(r: FormulaRequest): void;
  /** `formula:close`: no tree open. */
  close(): void;
  /** `formula:values`: what the window has in view, already checked (`formulaValuesPayload`). */
  values(ids: string[]): void;
  /** The pinned numbers: in view whatever the window shows (FR-026). */
  pinned(ids: string[]): void;
  /** The Stats sent something: maybe a new pair, maybe none (a character change). */
  statsChanged(): void;
  status(s: Status): void;
  gameFiles(resources: string): void;
  replay(): void;
  /** What a mark of `character` takes: the open tree's values by piece, and the names the file must never get. */
  markOf(character: number): { values: Mark["values"]; names: string[] } | null;
  /** The tree host read the game's code: its sha256, the version the shapes are saved for. */
  gameRead(sha: string): void;
  /** `feeds:list`: the catalog numbers that use a piece, each one a tree to open (FR-027). */
  feeds(pieceKey: string): string[];
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
    quiet: boolean; // a silent rebuild (FR-015): the tree on screen stays when it never comes
  } | null = null;
  /** The lazy branch asked of the worker; the same row asked again replaces it. */
  let expanding: { seq: number; treeId: string; nodeId: string } | null = null;
  /** The other rows opened meanwhile: each one asked after the branch before it answers (the host keeps one waiting). */
  let queued: { treeId: string; nodeId: string }[] = [];
  let seq = 0;
  let stale = false;
  let last: FormulaTree = { state: "none" };
  /** What the window has in view; the pins and the open tree are in view too. */
  let windowIds: string[] = [];
  let pinIds: string[] = [];
  /** The parts of the open tree asked live, by piece; only of the active character's tree (FR-024). */
  let parts = new Map<string, TreeNode>();
  /** The parts that had a live value: one that loses it asks the tree again (FR-015). A piece is the same call in any
   * tree, so the set outlives the tree. */
  const hadLive = new Set<string>();
  /** A change since the last tree came asks it again in silence, at most every 10 s (FR-015, NFR-002). */
  const rebuild = rebuildClock();
  const live = liveValues({
    ask: (id, ids, mosaicJson) => {
      host.values(id, ids, mosaicJson);
    },
    send: (v) => {
      // A part's piece key is a JSON list: the window only gets the catalog numbers.
      const values = Object.entries(v.values).filter(
        ([k]) => !k.startsWith("["),
      );
      deps.sendValues({ ...v, values: Object.fromEntries(values) });
      liveInTree(v);
    },
  });

  /** spec 009 FR-015: the open tree takes the live values at each reading, and a change asks it again in silence (its
   * ⓘ, its shares, a source that came or left), the tree kept on screen meanwhile. */
  function liveInTree(v: LiveValues): void {
    if (last.state !== "ready") return;
    const next = liveTree(last, v, parts, hadLive);
    for (const k of parts.keys())
      if (typeof v.values[k] === "number") hadLive.add(k);
    if (next) {
      // A part lost counts once: still without a value on the new tree, it asks nothing more.
      for (const k of next.lost) hadLive.delete(k);
      if (next.tree !== last) show(next.tree);
      rebuild.changed(v.calculatedAt);
    }
    rebuildIfDue();
  }

  /** The silent rebuild: one at a time, never over a branch asked (the host keeps one waiting job; a branch waiting in
   * `queued` is asked as the one before it comes, so `expanding` covers it). */
  function rebuildIfDue(): void {
    if (rebuild.take(!asked && !expanding)) ask(true);
  }

  const index = feedsIndex({
    shapes: deps.shapes,
    radar: deps.radar,
    ask: (id, treeId, mosaicJson) => {
      host.shape(id, treeId, mosaicJson);
    },
    // A new count reaches the open tree when the index is written, never per second.
    changed: () => {
      if (last.state !== "ready") return;
      const root = fed(last.root);
      if (root !== last.root) show({ ...last, root });
    },
  });
  const fed = (root: TreeNode) => withFeeds(root, index.count);

  /** The live values follow the Stats' pair: its mosaic, or none without a reading or a character; so do the shapes. */
  function follow(): void {
    const pair = deps.statsPair();
    live.onMosaic(pair?.mosaicJson ?? null, pair?.calculatedAt);
    const mosaic = current()?.pair.mosaicJson ?? null;
    index.mosaic(mosaic);
  }

  function inView(): void {
    live.setInView([
      ...windowIds,
      ...pinIds,
      ...(open ? [open.id] : []),
      ...parts.keys(),
    ]);
  }

  function view(): void {
    follow();
    inView();
  }

  function show(tree: FormulaTree): void {
    const root = tree.state === "ready" ? tree.root : null;
    if (root !== (last.state === "ready" ? last.root : null))
      parts =
        tree.state === "ready" &&
        root &&
        tree.character === tree.activeCharacter
          ? partsOf(root)
          : new Map<string, TreeNode>();
    last = tree;
    deps.send(tree);
    inView();
  }

  function drop(): void {
    asked = null;
    expanding = null;
    queued = [];
    host.dropCurrent();
  }

  function expand(r: { treeId: string; nodeId: string }): void {
    // A tree asked again in silence: the host keeps one waiting job, so an expand now would replace it. The new tree
    // has another time, and the window asks its open branches again then (FR-015).
    if (last.state !== "ready" || r.treeId !== open?.id || asked) return;
    if (expanding && expanding.nodeId !== r.nodeId) {
      if (!queued.some((q) => q.nodeId === r.nodeId)) queued.push(r);
      return;
    }
    seq++;
    expanding = { seq, ...r };
    host.request(seq, { type: "expand", ...r }, null);
  }

  /** The answer of the branch asked, then the next row waiting is asked. */
  function expanded(raw: unknown): void {
    const target = expanding;
    expanding = null;
    if (target) branched(target, raw);
    const next = queued.shift();
    if (next) expand(next);
    else rebuildIfDue();
  }

  /** The branch in place of the lazy row, or the row unavailable when the branch is refused or never comes. */
  function branched(
    { treeId, nodeId }: { treeId: string; nodeId: string },
    raw: unknown,
  ): void {
    if (last.state !== "ready") return;
    const branch = raw === null ? null : checkTree(raw, MAX_TREE_NODES);
    const done = withBranch(
      last.root,
      nodeId,
      branch && fed(branch),
      MAX_TREE_NODES,
    );
    if (!done) return;
    if (done.refused && raw !== null)
      deps.log({ event: "treeRejected", id: treeId });
    show({ ...last, root: done.root, counts: { nodes: done.nodes } });
  }

  /** The active character of the Stats' pair, with the pair; null without a reading or a known character. */
  function current(): { pair: StatsPair; active: number } | null {
    const pair = deps.statsPair();
    const active = pair ? characterNumber(pair.mosaicJson) : null;
    return pair && active !== null ? { pair, active } : null;
  }

  /** `quiet`: the tree on screen stays until the new one comes (a rebuild, FR-015). */
  function ask(quiet = false): void {
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
    seq++;
    asked = { seq, request, pair, active, quiet };
    if (!quiet) show({ state: "calculating", request });
    host.request(seq, request, pair.mosaicJson);
  }

  function received(id: number, raw: unknown, log?: "chainOpen"): void {
    if (asked?.seq !== id) return;
    const { request } = asked;
    rebuild.came(asked.pair.calculatedAt);
    const answer = treeAnswer(raw, asked, {
      fed,
      checkedOnThisGame: deps.checkedOnThisGame(),
      stale,
    });
    asked = null;
    if (answer.log) deps.log(answer.log);
    // spec 009 NFR-005: a chain of steps the worker could not read as pools, with the id only
    if (log) deps.log({ event: log, id: request.id });
    show(answer.tree);
  }

  const host = deps.treeHost({
    onTree: (id, raw, log) => {
      if (expanding?.seq === id) expanded(raw);
      else received(id, raw, log);
    },
    onUnavailable: (id) => {
      if (expanding?.seq === id) expanded(null);
      if (asked?.seq !== id) return;
      const { request, quiet } = asked;
      asked = null;
      // spec 009 NFR-005: a tree the worker could not build, its mould too, says so with its id only
      deps.log({ event: "treeFailed", id: request.id });
      if (quiet) rebuild.failed();
      else show({ state: "unavailable", request });
    },
    onValues: (id, values) => {
      live.received(id, values);
    },
    onShape: (id, shape) => {
      index.received(id, shape);
    },
  });

  return {
    request(r) {
      if ("treeId" in r) {
        expand(r);
        return;
      }
      drop();
      open = { id: r.id, character: r.character };
      view();
      ask();
    },
    close() {
      open = null;
      openFor = null;
      drop();
      view();
      show({ state: "none" });
    },
    values(ids) {
      windowIds = ids;
      view();
    },
    pinned(ids) {
      pinIds = ids;
      view();
    },
    statsChanged() {
      follow();
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
      // First: the shape and the values the stop cuts answer null, and neither is a failure nor a value on screen.
      live.setStale(closed);
      index.pause(closed);
      if (closed) {
        host.stop();
        // The branch in flight and the ones waiting never come: the worker ended.
        const lost = [...(expanding ? [expanding] : []), ...queued];
        expanding = null;
        queued = [];
        for (const r of lost) branched(r, null);
        // The worker ended with the tree in flight: it will never answer (FR-022); a silent rebuild keeps its tree, stale.
        const gone = asked;
        asked = null;
        if (gone && !gone.quiet)
          show({ state: "unavailable", request: gone.request });
      }
      if (closed === stale) return;
      stale = closed;
      if (last.state === "ready") show({ ...last, stale });
    },
    gameFiles(resources) {
      open = null;
      openFor = null;
      asked = null;
      // First: the shape and the values the new files cut answer null to an index and live values that wait for neither.
      index.reset();
      live.forget();
      host.setFiles(resources);
      show({ state: "none" });
    },
    replay() {
      deps.send(last);
      live.replay();
      deps.radar?.replay();
    },
    markOf(character) {
      if (last.state !== "ready" || last.character !== character) return null;
      return {
        values: pieceValues(last.root),
        names: namesOf(deps.statsPair()?.mosaicJson ?? ""),
      };
    },
    gameRead: index.game,
    feeds: index.list,
  };
}
