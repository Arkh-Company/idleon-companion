// The comparison of `just parity` (spec 008 T027, SC-002): the app's tree against the bench's assembled tree without
// compaction, row by row in the same place, in value, type, ⓘ and "?", plus the names outside the reviewed list, and the
// bench's code × value check. Only the parity test and its own test use it: no file is read here.
import type { CalcTreeNode } from "./tree-contract.ts";

/** A row of the bench's assembled tree (build-v1mold.cjs `{ tree }`), in the fields the parity reads. */
export interface BenchRow {
  name?: string;
  v?: unknown;
  kind?: string;
  sub?: string;
  formula?: [names: string, numbers: string];
  ref?: string;
  kids?: BenchRow[];
}

export interface Difference {
  /** The row's place: its position under each parent from the root ("0/3/2"), never a name, which can be a
   * character's (FR-010a). */
  at: string;
  field: "value" | "type" | "unknown" | "formula" | "name" | "shape";
}

/** The bench's leaf types (pieces.cjs `KIND`) and Condition subtypes (`SUB`), as the app writes them. */
const KIND: Readonly<Record<string, string>> = {
  Level: "level",
  Quantidade: "quantity",
  "Valor fixo": "fixedValue",
  "Bônus cru": "rawBonus",
  Condição: "condition",
  Escolha: "choice",
  Tier: "tier",
  Recorde: "record",
  "Pontos investidos": "investedPoints",
  "?": "unknown",
};
const SUB: Readonly<Record<string, string>> = {
  possui: "owned",
  concluiu: "done",
  ativo: "active",
  "igual a um valor": "equalsValue",
  máximo: "max",
  limite: "limit",
};

const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** A bench value as a number or yes/no; a text is not compared (undefined). */
function benchValue(v: unknown): number | boolean | null | undefined {
  if (typeof v === "number" || typeof v === "boolean" || v === null) return v;
  if (typeof v === "object" && "$n" in v) return Number(v.$n);
  return undefined;
}

function sameValue(app: CalcTreeNode["value"], bench: unknown): boolean {
  const b = benchValue(bench);
  if (b === undefined) return true;
  if (typeof app === "number" && typeof b === "number") return close(app, b);
  return app === b;
}

/** The numbers of the bench's numbers line, in order, without the thousands comma. */
const numbersOf = (line: string) =>
  [...line.matchAll(/-?\d[\d,]*(?:\.\d+)?(?:e[+-]?\d+)?/gi)].map((m) =>
    Number(m[0].replace(/,/g, "")),
  );

function sameFormula(
  app: CalcTreeNode["formula"],
  bench: BenchRow["formula"],
): boolean {
  if (!app || !bench) return !app && !bench;
  const b = numbersOf(bench[1]);
  const a = Array.isArray(app) ? app[1] : numbersOf(app.rule[1]);
  return b.length === a.length && b.every((x, i) => close(x, a[i] ?? NaN));
}

/** The app's rows of the mould (spec 009): its pools and its system groups. */
const MOULD = new Set<CalcTreeNode["role"]>(["pool", "system"]);
const appThrough = (ks: readonly CalcTreeNode[]): CalcTreeNode[] =>
  ks.flatMap((k) =>
    MOULD.has(k.role) && Array.isArray(k.kids) ? appThrough(k.kids) : [k],
  );
/**
 * The bench's groups at 0 and at ×1, at any level, which the app no longer has (spec 009, FR-016); they have the app's
 * 008 names (the 008 parity compared them).
 */
const BENCH_GROUP = /^At (?:0|×1) \(\d+\)$/;
/** The bench's rows through its groups at 0 and ×1, each with whether it was inside one. */
const benchThrough = (
  ks: readonly BenchRow[],
  inside = false,
): [BenchRow, boolean][] =>
  ks.flatMap((k): [BenchRow, boolean][] =>
    BENCH_GROUP.test(k.name ?? "")
      ? benchThrough(k.kids ?? [], true)
      : [[k, inside]],
  );
/**
 * A constant of an Additive pool, which pairs by value only: the app's terms built again name it "Fixed +N"
 * (tree/terms.ts rowOfTerm), the bench's expression parts "Base N" and "Percent to number (÷ 100)" (numRole).
 */
const isConstant = (name: string | undefined) =>
  /^(?:Fixed \+|Base )-?\d[\d.]*(?:e[+-]?\d+)?$|^Percent to number \(÷ 100\)$/i.test(
    name ?? "",
  );
/** The leaves under a row, all the way down. */
const appLeaves = (n: CalcTreeNode): CalcTreeNode[] =>
  Array.isArray(n.kids) && n.kids.length ? n.kids.flatMap(appLeaves) : [n];
const benchLeaves = (b: BenchRow): BenchRow[] =>
  b.kids?.length ? b.kids.flatMap(benchLeaves) : [b];

export function compareTrees(
  app: CalcTreeNode,
  bench: BenchRow,
  reviewedNames: ReadonlySet<string>,
): Difference[] {
  const out: Difference[] = [];
  /** `path` is the bench's names, only to find a reviewed name; `at` is what leaves. */
  const walk = (
    a: CalcTreeNode,
    b: BenchRow,
    path: string,
    at: string,
    root: boolean,
  ) => {
    if (b.ref !== undefined || b.kind === "shown earlier")
      throw new Error(
        "the bench tree has compaction: build it again with NO_COMPACT=1",
      );
    const add = (field: Difference["field"]) => out.push({ at, field });
    if (!sameValue(a.value, b.v)) add("value");
    const kind =
      b.kind === undefined ? null : (KIND[b.kind] ?? `bench:${b.kind}`);
    const sub = b.sub === undefined ? null : (SUB[b.sub] ?? `bench:${b.sub}`);
    if (kind !== a.leaf && (kind === "unknown" || a.leaf === "unknown"))
      add("unknown");
    else if (kind !== a.leaf || (kind === "condition" && sub !== a.condition))
      add("type");
    const ak = Array.isArray(a.kids) ? a.kids : [];
    const bk = b.kids ?? [];
    // spec 009: the root's ⓘ is its pools' (FR-005); its rows, and a level where the bench has groups at 0 or ×1
    // (FR-016), pair by name and value through the groups
    const moulded = root && ak.some((k) => MOULD.has(k.role));
    if (!moulded && !sameFormula(a.formula, b.formula)) add("formula");
    if (!root && b.name !== a.name && !reviewedNames.has(path)) add("name");
    if (moulded || bk.some((k) => BENCH_GROUP.test(k.name ?? ""))) {
      // a 1 + percent pool, or an Additive pool of a factor of one step, holds the factor's terms built again, never
      // the bench's branch of the expression's parts: it pairs whole, by value, and its leaves by value. An Additive
      // pool of a chain's sums pairs row by row, through the bench's steps (spec 009 r1): the bench has no row of its
      // value here, or one whose rows are the pool's
      const pools = ak.filter((k) => k.role === "pool").length;
      const here = benchThrough(bk).map(([b]) => b);
      const sameRows = (k: CalcTreeNode, b: BenchRow) => {
        const left = (Array.isArray(k.kids) ? k.kids : []).map((x) => x.value);
        const rows = benchThrough(b.kids ?? []);
        return (
          rows.length === left.length &&
          rows.every(([x]) => {
            const j = left.findIndex((v) => sameValue(v, x.v));
            return j >= 0 && left.splice(j, 1).length > 0;
          })
        );
      };
      const factor = (k: CalcTreeNode) =>
        here.some(
          (b) => sameValue(k.value, b.v) && !!b.kids?.length && !sameRows(k, b),
        );
      const whole = (k: CalcTreeNode) =>
        moulded &&
        pools > 1 &&
        k.role === "pool" &&
        (k.combine === "onePlusPercent" ||
          (k.poolKind === "additive" && factor(k)));
      const cands = ak.flatMap((k) => (whole(k) ? [k] : appThrough([k])));
      const used = new Set<number>();
      const free = (fits: (x: CalcTreeNode) => boolean) =>
        cands.findIndex((x, j) => !used.has(j) && fits(x));
      // the app's place of each bench row outside its groups, which keeps the game's order below the root
      const order: number[] = [];
      const pair = (rows: readonly BenchRow[], over: string, here: string) => {
        benchThrough(rows).forEach(([bi, grouped], i) => {
          const named = free(
            (x) => !whole(x) && x.name === bi.name && sameValue(x.value, bi.v),
          );
          const j = named >= 0 ? named : free((x) => sameValue(x.value, bi.v));
          const place = `${here}/${String(i)}`;
          const below = `${over} › ${bi.name ?? "?"}`;
          const found = cands[j];
          // spec 009, rule Y: an earlier step of the chain, which the app's pools took apart, pairs through its rows
          if (!found && moulded && bi.kids?.length) pair(bi.kids, below, place);
          else if (!found) out.push({ at: place, field: "shape" });
          else {
            used.add(j);
            if (!grouped) order.push(j);
            if (whole(found)) sameLeaves(found, bi, place);
            else walk(found, bi, below, place, false);
          }
        });
      };
      pair(bk, path, at);
      if (used.size < cands.length) add("shape");
      if (!moulded && order.some((j, i) => i > 0 && j < (order[i - 1] ?? 0)))
        add("shape");
      return;
    }
    if (ak.length !== bk.length) {
      add("shape");
      return;
    }
    ak.forEach((k, i) => {
      const bi = bk[i] ?? {};
      walk(k, bi, `${path} › ${bi.name ?? "?"}`, `${at}/${String(i)}`, false);
    });
  };
  /**
   * An Additive pool and the bench's factor: the same value, and the same leaves by value and name; one difference of
   * name at the pool, the reviewed names not counting inside it (its leaves have no place of their own in the app).
   */
  function sameLeaves(a: CalcTreeNode, b: BenchRow, at: string): void {
    if (!sameValue(a.value, b.v)) out.push({ at, field: "value" });
    const left = appLeaves(a);
    const leaves = benchLeaves(b);
    // 1 + (bonuses) ÷ 100: the pool holds only the bonuses' terms, and its 1 and 100 are the bench's constants
    if (a.combine === "onePlusPercent")
      for (const c of [1, 100]) {
        const k = leaves.findIndex(
          (bl) => isConstant(bl.name) && sameValue(c, bl.v),
        );
        if (k >= 0) leaves.splice(k, 1);
      }
    let renamed = 0;
    const unmatched = leaves.filter((bl) => {
      const fits = (x: CalcTreeNode) => sameValue(x.value, bl.v);
      const named = left.findIndex((x) => fits(x) && x.name === bl.name);
      const j = named >= 0 ? named : left.findIndex(fits);
      const x = left[j];
      if (
        x &&
        x.name !== bl.name &&
        !isConstant(x.name) &&
        !isConstant(bl.name)
      )
        renamed++;
      if (j >= 0) left.splice(j, 1);
      return j < 0;
    });
    if (renamed > 0) out.push({ at, field: "name" });
    if (unmatched.length || left.length) out.push({ at, field: "shape" });
  }
  walk(app, bench, bench.name ?? "?", "0", true);
  return out;
}

/** What goes to registro.md: how many differences of each field, then the first ones by place, never a name nor a
 * value (FR-032). */
export function summary(found: readonly Difference[]): string {
  const counts: Record<string, number> = {};
  for (const d of found) counts[d.field] = (counts[d.field] ?? 0) + 1;
  const first = found.slice(0, 20).map((d) => `${d.field}: ${d.at}`);
  return [JSON.stringify(counts), ...first].join("\n");
}

/** The bench's code × value check: a piece (block, arguments, character) shows one value wherever it is. */
export function codeValueConflicts(root: CalcTreeNode): string[] {
  const seen = new Map<string, CalcTreeNode["value"]>();
  const bad = new Set<string>();
  const pending = [root];
  for (let n = pending.pop(); n; n = pending.pop()) {
    if (n.pieceKey !== null) {
      if (seen.has(n.pieceKey) && seen.get(n.pieceKey) !== n.value)
        bad.add(n.pieceKey);
      seen.set(n.pieceKey, n.value);
    }
    if (Array.isArray(n.kids)) pending.push(...n.kids);
  }
  return [...bad].sort();
}

/** The bench's snapshot (`attrs` and `skipped`) and its `_vars` as the app's mosaic. */
export const mosaicOfSnapshot = (
  snap: { attrs: unknown; skipped?: unknown },
  vars: unknown,
): string =>
  JSON.stringify({ attrs: snap.attrs, vars, skipped: snap.skipped ?? [] });

/** The active character's place in the game's list of characters; 0 when the snapshot does not say. */
export function activeCharacter(snap: { attrs: unknown }): number {
  const attrs = snap.attrs as {
    UserInfo?: unknown;
    GetPlayersUsernames?: unknown;
  } | null;
  const info = attrs?.UserInfo;
  const names = attrs?.GetPlayersUsernames;
  if (!Array.isArray(info) || !Array.isArray(names)) return 0;
  return Math.max(0, names.indexOf(info[0]));
}
