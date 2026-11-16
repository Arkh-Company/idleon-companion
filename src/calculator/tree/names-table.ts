// The names table (spec 008, T023, research R3): the names the bench's rules give a call or a read path, from its
// names-008 export over the BASELINE-4 (pieces.cjs `nameOf` and `readName`, with names-sailing, names-rest and
// names-other, and the recorder's names of build-tree.cjs 8a, 8a1, 8a2 and 8f `inputOf`), without the 007 index.
// A static name is the bench's own English, each with its proof by reference; a recipe names a row with a text of a
// game table, read in the worker over the installed game (tree/names.ts), and only when that table's sha256 is the one
// the bench saw: a patched table leaves the row `no name yet`, never with a wrong name. The JSON files say how they
// were converted from the export.
import recipes from "./names-recipes.json" with { type: "json" };
import statics from "./names-static.json" with { type: "json" };
import stateHashes from "./state-hashes.json" with { type: "json" };

export interface NamePart {
  /** `CustomLists.X`, `CustomMaps.X`, `ItemDefinitionsGET` or `MonsterDefinitionsGET`. */
  table: string;
  index: readonly (string | number)[];
  field: string | null;
  /** How the table's text becomes the name (tree/names.ts `transformText`). */
  transform: string;
}

export interface NameRecipe {
  /** The call or the read path, as the tree writes it in `code`. */
  key: string;
  /** `{0}`, `{1}`: the parts' texts in order; null = the text alone. */
  template: string | null;
  parts: readonly NamePart[];
}

type Index = readonly (string | number)[];

/** The static names, by call or path: the name and its proof. */
export const STATIC_NAMES: ReadonlyMap<
  string,
  { name: string; proof: string }
> = new Map(
  Object.entries(statics.names as Record<string, readonly string[]>).map(
    ([key, [name = "", proof = ""]]) => [key, { name, proof }],
  ),
);

export const NAME_RECIPES: readonly NameRecipe[] = [
  ...recipes.groups.flatMap((g) =>
    (g.keys as unknown as readonly (readonly [string, Index])[]).map(
      ([key, index]): NameRecipe => ({
        key,
        template: g.template,
        parts: [
          { table: g.table, index, field: g.field, transform: g.transform },
        ],
      }),
    ),
  ),
  ...(
    recipes.multi as unknown as readonly (readonly [
      string,
      string | null,
      readonly (readonly [string, Index, string | null, string])[],
    ])[]
  ).map(([key, template, parts]): NameRecipe => ({
    key,
    template,
    parts: parts.map(([table, index, field, transform]) => ({
      table,
      index,
      field,
      transform,
    })),
  })),
  // N.js ActorEvents_548: the Lab's bonuses 14 to 17 are NinjaInfo[25..28], which the game adds to LabMainBonus only
  // after the boot (an Emporium bonus); the worker reads the tables at the boot, so these recipes read them there. A
  // name from either recipe is the same text.
  ...[14, 15, 16, 17].flatMap((k): NameRecipe[] => {
    const parts = [
      {
        table: "CustomLists.NinjaInfo",
        index: [k + 11, 6],
        field: null,
        transform: "clean",
      },
    ];
    return [
      {
        key: `PixelHelperActor[22].behaviors.getBehavior(ActorEvents_548)._GenINFO[92][${String(k)}]`,
        template: "{0} connected",
        parts,
      },
      { key: `DNSM.LabMFbonuses[${String(k)}]`, template: "{0} (Lab)", parts },
    ];
  }),
];

/** The sha256 of each table a recipe reads, at the version the bench saw, by table id (`partTable`); then the tables
 * only the game state paths' rules read (tree/state-names.ts), at 0e47e87b, and the form at the boot of the two tables
 * the game changes after it (LabMainBonus and NinjaInfo), over the bench's hash of a loaded game. */
export const TABLE_HASHES: ReadonlyMap<string, string> = new Map(
  [...recipes.hashes, ...stateHashes.hashes].map(([sha = "", id = ""]) => [
    id,
    sha,
  ]),
);

/** The id the hash of a part's table goes by: a list whole, an item or a monster by its entry. */
export const partTable = (p: NamePart): string =>
  p.table.includes(".") ? p.table : `${p.table}.${String(p.index[0])}`;
