// The rules of the catalog: how the table is read and what it must obey (FR-002, FR-012 to FR-017). Every row is invented.
import { describe, expect, test } from "vitest";
import {
  catalogName,
  catalogProblems,
  classOf,
  diffInventory,
  groupOf,
  inventoryNames,
  parseCatalog,
} from "./reading-catalog-rules.ts";
import type { CatalogRow } from "./reading-catalog-rules.ts";
import { NUMBER_IDS } from "./state.ts";

const HEAD = [
  "| Peça | Tipo | Bytes | Natureza | Números afetados | Muda em | Mecânica | Feature | Leitura | Grupo |",
  "| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |",
];
const table = (...rows: string[]) =>
  ["# Title", "", "Some words.", "", ...HEAD, ...rows, ""].join("\n");
const line = (numbers: string) =>
  `| \`Foo\` | lista | 12 | dado de origem | ${numbers} | matar, parado | Combate | Stats | lenta | — |`;

const row = (over: Partial<CatalogRow> = {}): CatalogRow => ({
  name: "Foo",
  type: "lista",
  bytes: 12,
  nature: "dado de origem",
  numbers: ["hp"],
  changesOn: "matar",
  mechanic: "Combate",
  feature: "Stats",
  reading: "rápida",
  group: "Combate",
  ...over,
});
const slow = (name: string) =>
  row({ name, numbers: [], reading: "lenta", group: "—" });

describe("parseCatalog", () => {
  test("reads the rows of the table into their fields", () => {
    const text = table(
      "| `DNSM.Foo` | mapa | 12 | cache derivado | hp, mp | buff, matar | Alquimia (a conferir) | Stats | rápida | ações |",
      "| `Bar` | número | 0 | rascunho | nenhum | não mudou | a conferir | — | lenta | — |",
    );
    expect(parseCatalog(text)).toEqual([
      {
        name: "DNSM.Foo",
        type: "mapa",
        bytes: 12,
        nature: "cache derivado",
        numbers: ["hp", "mp"],
        changesOn: "buff, matar",
        mechanic: "Alquimia (a conferir)",
        feature: "Stats",
        reading: "rápida",
        group: "ações",
      },
      {
        name: "Bar",
        type: "número",
        bytes: 0,
        nature: "rascunho",
        numbers: [],
        changesOn: "não mudou",
        mechanic: "a conferir",
        feature: "—",
        reading: "lenta",
        group: "—",
      },
    ]);
  });

  test.each(["nenhum", "não medido", "só quebra"])(
    "the cell `%s` is an empty list of numbers",
    (cell) => {
      expect(parseCatalog(table(line(cell)))[0]?.numbers).toEqual([]);
    },
  );

  test("the cell `todos` is every number of NUMBER_IDS", () => {
    expect(parseCatalog(table(line("todos")))[0]?.numbers).toEqual([
      ...NUMBER_IDS,
    ]);
  });

  test("a table padded to line up reads the same", () => {
    const padded =
      "|   `Foo`   |  lista  |   12 |  dado de origem  |  nenhum  |  matar, parado  |  Combate  |  Stats  |  lenta  |  —  |";
    expect(parseCatalog(table(padded))).toEqual(
      parseCatalog(table(line("nenhum"))),
    );
  });

  test.each([
    [
      "a column less",
      "| `Foo` | lista | 12 | dado de origem | nenhum | parado | Combate | Stats | lenta |",
    ],
    [
      "an empty column",
      "| `Foo` | lista | 12 | dado de origem | nenhum | parado |  | Stats | lenta | — |",
    ],
    [
      "a size that is no number",
      "| `Foo` | lista | x | dado de origem | nenhum | parado | Combate | Stats | lenta | — |",
    ],
  ])("%s throws", (_name, bad) => {
    expect(() => parseCatalog(table(bad))).toThrow();
  });
});

describe("catalogName", () => {
  test.each<[string, Parameters<typeof catalogName>[0], string]>([
    ["a top key", ["Cards"], "Cards"],
    ["a child of DNSM", ["DNSM", "x"], "DNSM.x"],
    [
      "a subkey of the active character",
      ["PlayerDATABASE", "A", "x"],
      "Personagem.x",
    ],
  ])("%s has its row name", (_name, path, name) => {
    expect(catalogName(path, "A")).toBe(name);
  });

  test.each<[string, Parameters<typeof catalogName>[0], string | null]>([
    ["the whole active character", ["PlayerDATABASE", "A"], "A"],
    ["another character", ["PlayerDATABASE", "B"], "A"],
    ["a subkey of another character", ["PlayerDATABASE", "B", "x"], "A"],
    ["a subkey with no active character", ["PlayerDATABASE", "A", "x"], null],
    ["the _vars", ["_vars"], "A"],
    ["a child of another map", ["Cards", "x"], "A"],
    ["a third level of another map", ["DNSM", "x", "y"], "A"],
  ])("%s has no row", (_name, path, char) => {
    expect(catalogName(path, char)).toBeNull();
  });
});

describe("classOf and groupOf", () => {
  const rows = [
    row({ name: "Cards", group: "ações" }),
    row({ name: "DNSM.x", group: "Alquimia" }),
    row({ name: "Personagem.x", group: "Combate" }),
    slow("ChestMap"),
  ];

  test.each<[string, Parameters<typeof catalogName>[0]]>([
    ["a top key", ["Cards"]],
    ["a child of DNSM", ["DNSM", "x"]],
    ["a subkey of the active character", ["PlayerDATABASE", "A", "x"]],
  ])("a `rápida` row is fast: %s", (_name, path) => {
    expect(classOf(rows, path, "A")).toBe("fast");
  });

  test.each<[string, Parameters<typeof catalogName>[0]]>([
    ["a `lenta` row", ["ChestMap"]],
    ["a path outside the catalog", ["Unknown"]],
    ["the whole active character", ["PlayerDATABASE", "A"]],
    ["another character", ["PlayerDATABASE", "B"]],
    ["a subkey of another character", ["PlayerDATABASE", "B", "x"]],
    ["the _vars", ["_vars"]],
    ["a child of DNSM outside the catalog", ["DNSM", "Other"]],
  ])("%s is slow", (_name, path) => {
    expect(classOf(rows, path, "A")).toBe("slow");
  });

  test("with no character, a subkey of PlayerDATABASE is slow", () => {
    expect(classOf(rows, ["PlayerDATABASE", "A", "x"], null)).toBe("slow");
  });

  test("groupOf gives the group of a fast row", () => {
    expect(groupOf(rows, ["Cards"], "A")).toBe("ações");
    expect(groupOf(rows, ["DNSM", "x"], "A")).toBe("Alquimia");
    expect(groupOf(rows, ["PlayerDATABASE", "A", "x"], "A")).toBe("Combate");
  });

  test.each<[string, Parameters<typeof catalogName>[0]]>([
    ["a `lenta` row", ["ChestMap"]],
    ["a path outside the catalog", ["Unknown"]],
    ["a whole character", ["PlayerDATABASE", "A"]],
  ])("groupOf is null for %s", (_name, path) => {
    expect(groupOf(rows, path, "A")).toBeNull();
  });
});

describe("catalogProblems", () => {
  const shown = ["hp"];
  const right = [
    row(),
    slow("Bar"),
    slow("Baz"),
    row({ name: "OutrosPersonagens.Foo", reading: "lenta", group: "—" }),
    row({ name: "Qux", numbers: ["mp"], reading: "lenta", group: "—" }),
    row({ name: "_vars.Foo", reading: "lenta", group: "—" }),
  ];

  test("a right table has no problem", () => {
    expect(catalogProblems(right, shown)).toEqual([]);
  });

  test.each<[string, CatalogRow, string]>([
    ["`rápida` with no number", row({ name: "Bad", numbers: [] }), "Bad"],
    [
      "`rápida` with no declared number",
      row({ name: "Bad", numbers: ["mp"] }),
      "Bad",
    ],
    [
      "`lenta` with a declared number",
      row({ name: "Bad", reading: "lenta" }),
      "Bad",
    ],
    [
      "`rápida` on another character",
      row({ name: "OutrosPersonagens.Bad" }),
      "OutrosPersonagens.Bad",
    ],
    ["`rápida` on a _vars key", row({ name: "_vars.Bad" }), "_vars.Bad"],
    ["a nature outside the 5", row({ name: "Bad", nature: "outra" }), "Bad"],
    [
      "a reading outside the 2",
      row({ name: "Bad", reading: "média" as never }),
      "Bad",
    ],
  ])("%s names the row", (_name, bad, name) => {
    const problems = catalogProblems([...right, bad], shown);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(name);
  });

  test("a name repeated names the row", () => {
    const problems = catalogProblems([...right, slow("Bar")], shown);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("Bar");
  });

  test.each([
    "dado de origem",
    "cache derivado",
    "tabela fixa",
    "rascunho",
    "interface",
  ])("the nature `%s` is valid", (nature) => {
    expect(
      catalogProblems([slow("A"), { ...slow("B"), nature }], shown),
    ).toEqual([]);
  });

  describe("a number a new feature declares (US3)", () => {
    const declared = [...NUMBER_IDS, "inventedNumber"];
    const affecting = row({
      name: "Foo",
      numbers: ["inventedNumber"],
      reading: "lenta",
      group: "—",
    });

    test("names the `lenta` row that affects it", () => {
      expect(catalogProblems([affecting], NUMBER_IDS)).toEqual([]);
      const problems = catalogProblems([affecting], declared);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("Foo");
    });

    test("has no problem once the row is `rápida`", () => {
      const promoted = { ...affecting, reading: "rápida", group: "Combate" };
      expect(catalogProblems([promoted as CatalogRow], declared)).toEqual([]);
    });
  });
});

describe("inventoryNames", () => {
  const state = {
    attrs: {
      Cards: [1],
      DNSM: { $m: { Totals: 1, Buffs: 2 } },
      PlayerDATABASE: {
        $m: {
          Aria: { $m: { SkillLevels: 1, Bag: 2 } },
          Bruno: { $m: { SkillLevels: 3, Pets: 4 } },
        },
      },
    },
    vars: { TomePct: 1, NotInTheClosedList: 2 },
  };

  test("names each piece by its catalog name, sorted and with no character name", () => {
    expect(inventoryNames(state, "Aria")).toEqual([
      "Cards",
      "DNSM.Buffs",
      "DNSM.Totals",
      "OutrosPersonagens.Pets",
      "OutrosPersonagens.SkillLevels",
      "Personagem.Bag",
      "Personagem.SkillLevels",
      "_vars.TomePct",
    ]);
  });

  test("a state with no _vars has no _vars name", () => {
    expect(inventoryNames({ attrs: { Cards: [1] } }, "Aria")).toEqual([
      "Cards",
    ]);
  });

  test("a split map or a character that is no map adds nothing", () => {
    expect(
      inventoryNames(
        { attrs: { DNSM: 5, PlayerDATABASE: { $m: { Aria: null } } } },
        "Aria",
      ),
    ).toEqual([]);
  });
});

describe("diffInventory", () => {
  test("a new piece is added, a renamed one is added and gone, both sorted", () => {
    const rows = [slow("Zed"), slow("Old"), slow("Same")];
    expect(diffInventory(rows, ["Zeta", "Same", "New"])).toEqual({
      added: ["New", "Zeta"],
      gone: ["Old", "Zed"],
    });
  });

  test("the same names give two empty lists", () => {
    expect(diffInventory([slow("Same")], ["Same"])).toEqual({
      added: [],
      gone: [],
    });
  });
});
