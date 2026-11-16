// Where this goes (spec 008 US8, FR-027): which catalog numbers use each piece. The index is built from the saved tree
// shapes (`tree-shapes.json`, contracts/saved-files.md) and filled in the background: one tree at a time asked of the
// tree worker, after every tree and value the player asked, the file written every few trees, never per second. A
// piece is its key without the character, so a part of any character's tree finds its numbers. No electron import, so
// tests can load it.
import { TREE_CATALOG } from "../shared/index.ts";
import type { TreeNode } from "../shared/index.ts";
import { holdsName, namesOf } from "./character-names.ts";
import type { savedFiles, TreeShapes } from "./saved-files.ts";
import type { patchRadar } from "./radar.ts";
import { MAX_NODE_ID } from "./tree-check.ts";

/** The file is written after this many new trees, and when the last one comes. */
export const SAVE_EVERY = 20;
/** Failures in a row of one game's files before the asks stop: a worker that keeps failing is not started again. */
const MAX_FAILURES = 3;
/** The tree worker's own ceiling of parts (MAX_SHAPE); the main checks it again (FR-010b). */
const MAX_PARTS = 20_000;
const MAX_NAME = 200;
/** Live trees need a map actor's field (FR-023): their shape is never asked. */
const ASKED = TREE_CATALOG.filter((n) => !n.live).map((n) => n.id);

/** The piece without the character's index, its key's first entry: the same part in any character's tree. */
export function feedKey(pieceKey: string): string {
  try {
    const parsed: unknown = JSON.parse(pieceKey);
    return Array.isArray(parsed) ? JSON.stringify(parsed.slice(1)) : pieceKey;
  } catch {
    return pieceKey;
  }
}

/**
 * The tree with `feeds` on each part that 2 or more numbers use, and none on the others (FR-027); the same tree when no
 * count changed. Walked without recursion, as the tree check does: a tree can be as deep as it has nodes.
 */
export function withFeeds(
  root: TreeNode,
  count: (pieceKey: string) => number,
): TreeNode {
  const order: TreeNode[] = [];
  const pending = [root];
  for (let n = pending.pop(); n; n = pending.pop()) {
    order.push(n);
    if (Array.isArray(n.kids)) pending.push(...n.kids);
  }
  const copies = new Map<TreeNode, TreeNode>();
  let changed = false;
  // A node comes after its parent in `order`: from the end, its kids are copied before it.
  for (const n of order.toReversed()) {
    const c = n.pieceKey === null ? 0 : count(n.pieceKey);
    const feeds = c >= 2 ? c : undefined;
    if (feeds !== n.feeds) changed = true;
    const copy: TreeNode = {
      ...n,
      kids: Array.isArray(n.kids)
        ? n.kids.map((k) => copies.get(k) ?? k)
        : n.kids,
    };
    if (feeds === undefined) delete copy.feeds;
    else copy.feeds = feeds;
    copies.set(n, copy);
  }
  return changed ? (copies.get(root) ?? root) : root;
}

/** The parts the worker sent, without the character and without any part that holds a character's name; null when wrong. */
function partsOf(
  raw: unknown,
  names: readonly string[],
): [string, string][] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PARTS) return null;
  const parts: [string, string][] = [];
  for (const p of raw) {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      typeof p[0] !== "string" ||
      typeof p[1] !== "string" ||
      p[0].length > MAX_NODE_ID ||
      p[1].length > MAX_NAME
    )
      return null;
    const [key, name] = p as [string, string];
    if (!holdsName(key, names) && !holdsName(name, names))
      parts.push([feedKey(key), name]);
  }
  return parts;
}

export function feedsIndex(deps: {
  shapes: ReturnType<typeof savedFiles>["shapes"];
  /** One shape asked of the tree host, with this index's own count. */
  ask: (seq: number, id: string, mosaicJson: string) => void;
  /** The counts changed: the open tree's badges follow. */
  changed: () => void;
  /** The patch radar: the last version's shapes before they go, and each new shape (FR-029). */
  radar?:
    | Pick<ReturnType<typeof patchRadar>, "patched" | "shaped" | "done">
    | undefined;
}): {
  /** How many catalog numbers use the piece. */
  count: (pieceKey: string) => number;
  /** The catalog numbers that use the piece, in the catalog's order (`feeds:list`). */
  list: (pieceKey: string) => string[];
  /** The sha256 of the game's code, once the tree host read it. */
  game: (sha: string) => void;
  /** The Stats pair's mosaic; null with no reading or no character. */
  mosaic(json: string | null): void;
  /** The tree host's answer to an ask; null when it failed or was lost. */
  received(seq: number, raw: unknown): void;
  /** The game closed: the host ended the worker, with the shape in flight. */
  pause(closed: boolean): void;
  /** New game files: the version is known again from them, and the failures start over. */
  reset(): void;
} {
  const saved: TreeShapes = deps.shapes.get();
  const byPiece = new Map<string, Set<string>>();
  let gameSha: string | null = null;
  let mosaic: string | null = null;
  /** The ask in flight, with the characters' names of the mosaic it went with: its answer keeps them out. */
  let pending: { seq: number; id: string; names: string[] } | null = null;
  let seq = 0;
  let closed = false;
  let failures = 0;
  const skipped = new Set<string>();
  let unsaved = 0;

  function add(id: string, parts: readonly [string, string][]): void {
    for (const [key] of parts) {
      const ids = byPiece.get(key) ?? new Set<string>();
      byPiece.set(key, ids.add(id));
    }
  }
  for (const [id, parts] of saved.trees) add(id, parts);

  function save(): void {
    unsaved = 0;
    // A failed write keeps the shapes for this session; the next batch tries again.
    deps.shapes.save(saved);
    deps.changed();
  }

  function next(): void {
    if (closed || gameSha === null || mosaic === null || pending) return;
    if (failures >= MAX_FAILURES) return;
    const id = ASKED.find((n) => !saved.trees.has(n) && !skipped.has(n));
    if (id === undefined) {
      deps.radar?.done();
      if (unsaved > 0) save();
      return;
    }
    pending = { seq: ++seq, id, names: namesOf(mosaic) };
    deps.ask(seq, id, mosaic);
  }

  return {
    count: (pieceKey) => byPiece.get(feedKey(pieceKey))?.size ?? 0,
    list(pieceKey) {
      const ids = byPiece.get(feedKey(pieceKey));
      return ids ? ASKED.filter((id) => ids.has(id)) : [];
    },
    game(sha) {
      gameSha = sha;
      if (saved.gameSha !== sha) {
        // The old version's shapes go; the patch radar compares them first.
        const had = saved.trees.size > 0;
        // Trees are only saved under a version: `had` means a version.
        if (had && saved.gameSha !== null) deps.radar?.patched(saved.gameSha);
        saved.gameSha = sha;
        saved.trees.clear();
        byPiece.clear();
        if (had) deps.changed();
      }
      next();
    },
    mosaic(json) {
      mosaic = json;
      next();
    },
    received(answer, raw) {
      if (pending?.seq !== answer) return;
      const { id, names } = pending;
      pending = null;
      const parts = partsOf(raw, names);
      if (parts) {
        failures = 0;
        saved.trees.set(id, parts);
        add(id, parts);
        deps.radar?.shaped(id, parts);
        if (++unsaved >= SAVE_EVERY) save();
      } else {
        failures++;
        skipped.add(id);
      }
      next();
    },
    pause(on) {
      closed = on;
      if (on) pending = null;
      next();
    },
    reset() {
      gameSha = null;
      pending = null;
      failures = 0;
      skipped.clear();
    },
  };
}
