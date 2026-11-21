// The names that come from the installed game's tables (spec 008, T023; names/names.ts): the recipes' cells and tables
// are read inside the context (names-reader.js) and cross as JSON text; each table is hashed here, and a recipe whose
// table's sha256 is not the bench's leaves its row with no name.
import { createHash } from "node:crypto";
import type { Context } from "./boot.ts";
import { resolveNames } from "./names/names.ts";
import { NAME_RECIPES, TABLE_HASHES } from "./names/names-table.ts";
import { isTextTable } from "./names/table-names.ts";
import type { NamePart, NameRecipe } from "./names/names-table.ts";

const cellId = (p: NamePart) => JSON.stringify([p.table, p.index, p.field]);
const isTextOrNull = (v: unknown) => v === null || typeof v === "string";

export interface GameNames {
  names: Map<string, string>;
  /** The tables a table text reads (names/table-names.ts) whose sha256 is the bench's, in the bench's canonical form. */
  tables: Map<string, unknown>;
}
const nothing = (): GameNames => ({ names: new Map(), tables: new Map() });

/** The recipes' names over the game in the context, and its checked tables; nothing when the reading fails or does not
 * come back as text. */
export function readGameNames(
  context: Pick<Context, "run" | "sandbox">,
  ms: number,
  recipes: readonly NameRecipe[] = NAME_RECIPES,
  hashes: ReadonlyMap<string, string> = TABLE_HASHES,
  keep: (id: string) => boolean = isTextTable,
): GameNames {
  const cells = [
    ...new Map(
      recipes.flatMap((r) => r.parts).map((p) => [cellId(p), p]),
    ).values(),
  ];
  const tables = [...hashes.keys()];
  context.sandbox.__namesAsk = JSON.stringify({
    cells: cells.map((p) => [p.table, p.index, p.field]),
    tables,
  });
  let read: unknown;
  try {
    const json = context.run("__names.read(__namesAsk)", ms);
    // only a text: JSON.parse would call another value's own toString
    read = typeof json === "string" ? JSON.parse(json) : null;
  } catch {
    return nothing(); // out of time: every recipe's row keeps the generic name
  } finally {
    delete context.sandbox.__namesAsk;
  }
  const { texts, forms } = (read ?? {}) as { texts?: unknown; forms?: unknown };
  if (
    !Array.isArray(texts) ||
    !Array.isArray(forms) ||
    texts.length !== cells.length ||
    forms.length !== tables.length ||
    !texts.every(isTextOrNull)
  )
    return nothing();
  const ok = new Set(
    tables.filter((id, i) => {
      const form: unknown = forms[i];
      return (
        typeof form === "string" &&
        createHash("sha256").update(form).digest("hex") === hashes.get(id)
      );
    }),
  );
  const text = new Map(
    cells.map((p, i) => [cellId(p), texts[i] as string | null]),
  );
  // a checked table's form is the bench's own JSON text: its cells are the bench's
  return {
    names: resolveNames(
      (p) => text.get(cellId(p)) ?? null,
      (id) => ok.has(id),
      recipes,
    ),
    tables: new Map(
      tables.flatMap((id, i) =>
        ok.has(id) && keep(id)
          ? [[id, JSON.parse(String(forms[i])) as unknown] as const]
          : [],
      ),
    ),
  };
}
