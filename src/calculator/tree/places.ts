// The rows of a tree in their places (spec 008, T024, research R4): each row with its id (the path of names, `#n` on a
// repeat), its group placed under it and a known game bug tagged (FR-016). A row with more under it has its level built
// when it gets its place, only to decide its own name and its one child (spec Open Questions, 15/11); that level is kept
// by the row's id, and the player's expand places it then, with no second build, over the same recording
// (tree-build.ts). A level is renamed by the rows above it before its ⓘ (tree/above-renames.ts), and has one leaf of each
// code and value when it is placed (tree/one-of-each.ts), the yes/no beside the arena's count named as it (tree/arena.ts).
import type { RecNode } from "../recording.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import type { FormulaRow, Pair } from "./formulas.ts";
import { near, termsOf, vOf, withFormula } from "./formulas.ts";
import { classify } from "./kinds.ts";
import { termOf } from "./share.ts";
import { withWriterFormula } from "./cache-formulas.ts";
import type { Opened } from "./cache-formulas.ts";
import { gameBugOf } from "./game-bugs.ts";
import type { GameBugRule } from "./game-bugs.ts";
import { aboveRenames } from "./above-renames.ts";
import type { Above } from "./above-renames.ts";
import { isMould } from "./kid-names.ts";
import { oneOfEach } from "./one-of-each.ts";
import { besideArena } from "./arena.ts";
import { flatten } from "./flatten.ts";
import { byRole, inlined } from "./inline.ts";
import { formulaOut } from "./math.ts";
import { baseStatue } from "./last-renames.ts";
import {
  asideInFormula,
  branchCheck,
  buildUp,
  citing,
  ifChecks,
} from "./build-up.ts";
import { cardFactor, meritocracyMulti } from "./factors.ts";
import { besidePools, downToSources } from "./pool-rest.ts";
import { parentPasses } from "./parent-passes.ts";
import { callText } from "./rows.ts";
import type { CacheOpen, Row } from "./rows.ts";

/** Where a level's rows go: their depth, the calls above them and the rows above them in their piece. */
export interface At {
  depth: number;
  seen: readonly number[];
  up: readonly Above[];
}
/**
 * The rows under a row before they have a place: `row` is the one whose ⓘ they give, `code` the call (or cache) they
 * come from, which a game bug is tested in.
 */
export interface Level {
  row: FormulaRow;
  rows: Row[];
  at: At;
  code: string | null;
  /** The call the rows come from, when they are a call's own (spec 009, FR-018: its family's build-up). */
  call?: RecNode;
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

/**
 * A row that ends with no kids: its type of leaf, by its name and code (tree/kinds.ts), when it has none; one whose ⓘ
 * says how it comes is no unknown leaf (never a "?").
 */
const typedLeaf = (n: CalcTreeNode): CalcTreeNode =>
  n.leaf || n.formula || n.role === "pool" || n.role === "system"
    ? n
    : { ...n, ...classify(n) };

export function makePlaces(ctx: PlaceContext) {
  const { nodes } = ctx;
  /** Each lazy branch's node and its level, kept since its place (null: the depth limit or a cycle cut it). */
  const places = new Map<string, { node: CalcTreeNode; level: Level | null }>();

  /** The level under row `r`, placed at `at`: its call's rows or its cache's, renamed by the rows above them. */
  function below(r: Row, at: At): Level | null {
    const seen = r.seen ?? at.seen;
    const up = [
      ...at.up,
      ...(r.up ?? []),
      { code: r.node.code, name: r.node.name },
    ];
    const o = r.open;
    if (o === null) return null;
    // a cache's rows are its writer's, each with the calls above it; the depth is its reader's, as in the bench
    if (typeof o !== "number") {
      const got = ctx.opened(o, at.depth - 1, new Set(seen));
      if (!got) return null;
      return {
        row: withWriterFormula(r, got.f),
        rows: aboveRenames(got.rows, up),
        at: { depth: at.depth + 1, seen, up },
        code: r.node.code,
      };
    }
    const rows = ctx.explain(o, at.depth, new Set(seen));
    if (!rows) return null;
    // The rows are the call `o`'s, not the row's: a call that passes its value on, or a cache, opens into another.
    const from = nodes[o];
    const xf = from && ctx.openXf.get(ctx.keyOf(from));
    return {
      row: xf ? { ...r, xf } : r,
      rows: aboveRenames(rows, up),
      at: { depth: at.depth + 1, seen: [...seen, o], up },
      code: from ? callText(from) : null,
      ...(from ? { call: from } : {}),
    };
  }

  /** The level under row `r` of a level placed at `at`, from the call or cache `code`: its opening's or its group's. */
  function levelOf(r: Row, at: At, code: string | null): Level | null {
    if (r.open !== null) return below(r, at);
    return r.group
      ? { row: r, rows: r.group, at: { ...at, seen: r.seen ?? at.seen }, code }
      : null;
  }

  /**
   * The ⓘ and rows of a level of a source (FR-007, FR-018): its family's full build-up when it has one, the whole sum or
   * product with no unnamed step, and the constants of the code and the branch checks in the ⓘ only.
   */
  function builtUp(
    lv: Level,
    name: string,
  ): {
    formula: CalcTreeNode["formula"];
    rows: Row[];
    maxReached?: CalcTreeNode["maxReached"];
  } {
    const up = buildUp(lv, {
      nodes,
      under: (k, l) => levelOf(k, l.at, l.code),
      name,
      keyOf: (n) => ctx.keyOf(n),
    });
    const l = up?.level ?? lv;
    // a built-up ⓘ names its rows whole, a name with a colon too ("Arcade: Prisma Bonuses")
    const f = up && l.row.f;
    // any other ⓘ takes in the unnamed steps of any math, and names the source's own part by its role (tree/inline.ts);
    // the math of the rows with no branch check comes first, each check said after it in words (FR-018, A39)
    // its Meritocracy multi and its card's level by their roles first, before any step moves up (tree/factors.ts)
    const rows0 = f ? l.rows : cardFactor(name, l.rows.map(meritocracyMulti));
    const own = (rows: Row[]) => byRole(name, inlined(l.row, flatten(rows)));
    const checks = f ? [] : rows0.filter((r) => branchCheck(r, rows0));
    const bare = checks.length
      ? own(rows0.filter((r) => !checks.includes(r)))
      : null;
    // a level at 0 whose other parts are all 0: its checks give it, not a math of its parts (a talent at 0, its guard)
    const zero =
      !!bare && vOf(l.row) === 0 && bare.rows.every((r) => vOf(r) === 0);
    const math = bare?.formula && !zero ? bare.formula : null;
    const all = f || math ? null : own(rows0);
    const w = f
      ? withFormula(l.row, flatten(l.rows))
      : math && bare
        ? { formula: citing(math, checks), rows: [...bare.rows, ...checks] }
        : all && zero && checks.length
          ? // no ⓘ but its checks: the value they lead to
            { formula: ifChecks(checks, vOf(l.row)), rows: all.rows }
          : (all ?? own(rows0));
    const formula = f
      ? up.rule
        ? { rule: f }
        : formulaOut(f, [
            ...termsOf(w.rows, f),
            ...w.rows.map((r) => termOf(r.node)),
          ])
      : w.formula;
    return {
      formula,
      rows: asideInFormula(w.rows, formula),
      ...(up?.maxReached ? { maxReached: up.maxReached } : {}),
    };
  }

  /** Whether the call of the source `s` read `r`, its path at its value (tree/pool-rest.ts `downToSources`). */
  const readBy = (s: Row, r: Row) =>
    typeof s.open === "number" &&
    !!nodes[s.open]?.r?.some(
      ([p, v]) => p === r.node.code && near(Number(v), vOf(r)),
    );

  /** Level `lv` placed under the row `id`, with the ⓘ it gives that row. */
  function placedLevel(id: string, lv: Level, name: string) {
    // a pool's or a system's ⓘ and shares are the mould's own (spec 009), never a guess from its rows, and so are those
    // of a source computed as a chain, which opens into its pools: its ⓘ is how they join, the step its call takes
    // (FR-017); any other level has no unnamed step (FR-007), and its row's ⓘ is the whole sum or product
    const pools = lv.rows.filter((r) => r.node.role === "pool");
    const mould = isMould(lv.row);
    const up = mould || pools.length ? null : builtUp(lv, name);
    const w =
      up ??
      (mould
        ? { formula: lv.row.node.formula, rows: lv.rows }
        : // only pools beside each other (tree/pool-rest.ts)
          besidePools(
            downToSources(lv.rows, readBy),
            lv.row.xf
              ? // a lone part between the pools goes by its term (tree/pools.ts `lone`)
                formulaOut(
                  lv.row.xf,
                  lv.rows.map((p) => termOf(p.node)),
                )
              : null,
          ));
    const reached = up?.maxReached;
    return {
      formula: w.formula,
      ...(reached ? { maxReached: reached } : {}),
      // the reads beside the pools above that its call read, after its rows (audit family 10)
      kids: placeAt(
        { id, code: lv.code },
        [...w.rows, ...(lv.row.below ?? [])],
        lv.at,
        vOf(lv.row),
      ),
    };
  }

  /**
   * Each row with its id, its name and its level decided by the passes over the level under it (a group of the mould
   * keeps its own), its group placed under it, a known game bug tagged; a lazy branch kept with its level.
   */
  function placeAt(
    parent: Pick<CalcTreeNode, "id" | "code">,
    rows: Row[],
    at: At,
    /** The level's value: its calls repeated are one unless they are the parts of its sum (audit family 8). */
    total?: number,
  ): CalcTreeNode[] {
    const count = new Map<string, number>();
    // FR-016: a source a game-bug rule marks stays repeated
    const marked = (code: string) =>
      gameBugOf(ctx.bugs, parent.code, code) !== null;
    // opus2Arena: the yes/no beside the arena's count is named as the count
    const sum =
      total !== undefined && Number.isFinite(total) ? total : undefined;
    return besideArena(oneOfEach(rows, marked, sum)).map((x) => {
      // opus5's openStatue: the statue's base bonus, over the recording
      const r0 = baseStatue(x, at.up, nodes);
      const level0 = levelOf(r0, at, parent.code);
      // a pool or a system's group keeps the app's name, and its rows the names of the level they come from (spec 009)
      const { row: r, level } = isMould(r0)
        ? { row: r0, level: level0 }
        : parentPasses(
            r0,
            level0,
            (k, lv) => levelOf(k, lv.at, lv.code),
            at.up,
          );
      const { node, open } = r;
      const n = (count.get(node.name) ?? 0) + 1;
      count.set(node.name, n);
      const id = `${parent.id}/${node.name}${n > 1 ? `#${String(n)}` : ""}`;
      const bug = gameBugOf(ctx.bugs, parent.code, node.code);
      // a branch built already has its ⓘ now; a group's rows are still the call's own (renamed with the level)
      const group = open === null ? level : null;
      const placed: CalcTreeNode = {
        id,
        ...node,
        ...(bug === null ? {} : { flags: { ...node.flags, gameBug: bug } }),
        ...(group ? placedLevel(id, group, node.name) : {}),
      };
      // audit family 6: a row that ends with no kids is a leaf with its type, one of the 9 or unknown with its why (a
      // call is typed when it opens: its build-up may give it rows its level does not have)
      const out: CalcTreeNode =
        open === null && Array.isArray(placed.kids) && !placed.kids.length
          ? typedLeaf(placed)
          : placed;
      if (open !== null) places.set(id, { node: out, level });
      return out;
    });
  }

  return {
    /** The rows under `parent`, at `depth` under the root, under the calls `seen` and the rows `up` (none at first). */
    place: (
      parent: Pick<CalcTreeNode, "id" | "code">,
      rows: Row[],
      depth: number,
      seen: readonly number[],
      up: readonly Above[] = [],
    ): CalcTreeNode[] => placeAt(parent, rows, { depth, seen, up }),
    /** The lazy branch `nodeId` with its kept level placed, or null when no lazy branch has that id. */
    expand: (nodeId: string): CalcTreeNode | null => {
      const p = places.get(nodeId);
      if (!p) return null;
      const { node, level } = p;
      if (!level)
        return { ...node, flags: { ...node.flags, truncated: true }, kids: [] };
      const open = { ...node, ...placedLevel(node.id, level, node.name) };
      // a call that opens empty ends there: a leaf with its type (audit family 6)
      return Array.isArray(open.kids) && !open.kids.length
        ? typedLeaf(open)
        : open;
    },
  };
}
