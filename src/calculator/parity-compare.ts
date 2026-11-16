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
    if (!sameFormula(a.formula, b.formula)) add("formula");
    if (!root && b.name !== a.name && !reviewedNames.has(path)) add("name");
    const ak = Array.isArray(a.kids) ? a.kids : [];
    const bk = b.kids ?? [];
    if (ak.length !== bk.length) {
      add("shape");
      return;
    }
    ak.forEach((k, i) => {
      const bi = bk[i] ?? {};
      walk(k, bi, `${path} › ${bi.name ?? "?"}`, `${at}/${String(i)}`, false);
    });
  };
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
