// The rows of a tree in their places (spec 008, T024, research R4): each row with its id (the path of names, `#n` on a
// repeat), its group placed under it and a known game bug tagged (FR-016); a row with more under it is kept by its id,
// so the player's expand builds its rows then, over the same recording (tree-build.ts). A level is renamed by the rows
// above it before its ⓘ (tree/above-renames.ts).
import type { RecNode } from "../recording.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import type { Pair } from "./formulas.ts";
import { withFormula } from "./formulas.ts";
import { withWriterFormula } from "./cache-formulas.ts";
import type { Opened } from "./cache-formulas.ts";
import { gameBugOf } from "./game-bugs.ts";
import type { GameBugRule } from "./game-bugs.ts";
import { aboveRenames } from "./above-renames.ts";
import type { Above } from "./above-renames.ts";
import { callText } from "./rows.ts";
import type { CacheOpen, Row } from "./rows.ts";

interface Place {
  node: CalcTreeNode;
  /** The row as it was built, with the game's expressions around it for its ⓘ (tree/formulas.ts). */
  row: Row;
  open: number | CacheOpen;
  depth: number;
  seen: readonly number[];
  /** The rows above the place's row in its piece, from the piece's head (tree/above-renames.ts). */
  up: readonly Above[];
}

export interface PlaceContext {
  nodes: readonly RecNode[];
  bugs: readonly GameBugRule[];
  keyOf(n: RecNode): string;
  /** [NR-G 2b] the ⓘ a call takes from the one cache it returns, by piece, once its rows are built. */
  openXf: ReadonlyMap<string, Pair>;
  /** A call's rows (tree/pieces.ts); null when the depth limit or a cycle cuts it. */
  explain(id: number, depth: number, seen: ReadonlySet<number>): Row[] | null;
  /** A cache row's rows, its writer's, with the writer's ⓘ (tree/caches.ts). */
  opened(o: CacheOpen, depth: number, seen: ReadonlySet<number>): Opened | null;
}

export function makePlaces(ctx: PlaceContext) {
  const { nodes } = ctx;
  const places = new Map<string, Place>();
  /**
   * Each row with its id (the path of names, `#n` on a repeat), its group placed under it, a known game bug tagged; `up`
   * the rows above them in their piece (none at the first level, the pieces' heads), kept for the rows they open into.
   */
  function place(
    parent: Pick<CalcTreeNode, "id" | "code">,
    rows: Row[],
    depth: number,
    seen: readonly number[],
    up: readonly Above[] = [],
  ): CalcTreeNode[] {
    const count = new Map<string, number>();
    return rows.map((r) => {
      const { node, open, group, seen: own } = r;
      const above = own ?? seen;
      const n = (count.get(node.name) ?? 0) + 1;
      count.set(node.name, n);
      const id = `${parent.id}/${node.name}${n > 1 ? `#${String(n)}` : ""}`;
      const bug = gameBugOf(ctx.bugs, parent.code, node.code);
      // a branch built already has its ⓘ now; a group's rows are still the call's own (renamed with the level)
      const built = group && withFormula(r, group);
      const placed: CalcTreeNode = {
        id,
        ...node,
        ...(bug === null ? {} : { flags: { ...node.flags, gameBug: bug } }),
        ...(built
          ? {
              formula: built.formula,
              kids: place(
                { id, code: parent.code },
                built.rows,
                depth,
                above,
                up,
              ),
            }
          : {}),
      };
      if (open !== null)
        places.set(id, { node: placed, row: r, open, depth, seen: above, up });
      return placed;
    });
  }
  /** The place's ⓘ and the rows under it; null when the depth limit or a cycle cuts it. */
  function kidsAt(
    p: Place,
  ): { formula: CalcTreeNode["formula"]; kids: CalcTreeNode[] } | null {
    const up = [...p.up, { code: p.node.code, name: p.node.name }];
    // a cache's rows are its writer's, each with the calls above it; the depth is its reader's, as in the bench
    if (typeof p.open !== "number") {
      const got = ctx.opened(p.open, p.depth - 1, new Set(p.seen));
      if (!got) return null;
      const w = withFormula(
        withWriterFormula(p.row, got.f),
        aboveRenames(got.rows, up),
      );
      return {
        formula: w.formula,
        kids: place(p.node, w.rows, p.depth + 1, p.seen, up),
      };
    }
    const rows = ctx.explain(p.open, p.depth, new Set(p.seen));
    if (!rows) return null;
    // The rows are the call `open`'s, not the row's: a call that passes its value on, or a cache, opens into another.
    const from = nodes[p.open];
    const xf = from && ctx.openXf.get(ctx.keyOf(from));
    const w = withFormula(
      xf ? { ...p.row, xf } : p.row,
      aboveRenames(rows, up),
    );
    const parent = { id: p.node.id, code: from ? callText(from) : null };
    return {
      formula: w.formula,
      kids: place(parent, w.rows, p.depth + 1, [...p.seen, p.open], up),
    };
  }
  return {
    place,
    /** The lazy branch `nodeId` with its rows built, or null when no lazy branch has that id. */
    expand: (nodeId: string): CalcTreeNode | null => {
      const p = places.get(nodeId);
      if (!p) return null;
      const built = kidsAt(p);
      return built
        ? { ...p.node, ...built }
        : { ...p.node, flags: { ...p.node.flags, truncated: true }, kids: [] };
    },
  };
}
