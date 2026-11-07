// Converts the prototype's names.json (06/11, Portuguese names) into the app's default catalog (spec §5.3).
// Usage: node scripts/convert-prototype-names.ts <prototype names.json> <output .json>
import { readFileSync, writeFileSync } from "node:fs";
import type { Catalog, Entry } from "../src/shared/index.ts";

type Table = "menu" | "menu2" | "codex" | "quickref";

/** Confirmed in the game on 06/11 (spec §5.3); everything else was deduced from the game code. */
const CONFIRMED: Partial<Record<Table, string[]>> = {
  menu: ["3", "4", "5"],
  menu2: [
    ...[
      "2",
      "5",
      "6",
      "8",
      "9",
      "10",
      "12",
      "13",
      "14",
      "17",
      "21",
      "23",
      "28",
      "30",
    ],
    ...[
      "35",
      "38",
      "45",
      "56",
      "72",
      "82",
      "94",
      "100",
      "64",
      "65",
      "66",
      "67",
      "68",
      "69",
    ],
  ],
};

/** Every Portuguese name of the prototype, without its " (?)" suffix (plan, Kit decision 9). */
const ENGLISH: Record<string, string> = {
  nenhum: "None",
  nenhuma: "None",
  Itens: "Items",
  Talentos: "Talents",
  "Mapa do mundo": "World map",
  Ataques: "Attacks",
  "Atalho do Quik Ref (Bigorna)": "Quik Ref shortcut (Anvil)",
  "Atalho do Quik Ref (Obols)": "Quik Ref shortcut (Obols)",
  "Atalho do Quik Ref (Alquimia)": "Quik Ref shortcut (Alchemy)",
  Bigorna: "Anvil",
  "Bigorna (produção)": "Anvil (production)",
  Estátuas: "Statues",
  Torneio: "Tournament",
  Baú: "Storage",
  "Menu › Servidor": "Menu › Server",
  "Menu › Personagens": "Menu › Characters",
  "Menu › Evento/Patch notes": "Menu › Event/Patch notes",
  Correio: "Mail",
  Alquimia: "Alchemy",
  "Ofertas (loja)": "Offers (shop)",
  "Mapas/monstros": "Maps/monsters",
  "Info do mapa": "Map info",
  Amigos: "Friends",
  Guilda: "Guild",
  "ícone 14 (especial)": "Icon 14 (special)",
};

const PORTUGUESE_CHARS = /[À-ÿ]/;
const DEDUCED_SUFFIX = " (?)";

function convertTable(
  table: Table,
  names: Record<string, string>,
): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const [key, raw] of Object.entries(names)) {
    const guessed = raw.endsWith(DEDUCED_SUFFIX);
    const bare = guessed ? raw.slice(0, -DEDUCED_SUFFIX.length) : raw;
    const name = ENGLISH[bare] ?? bare;
    if (PORTUGUESE_CHARS.test(name))
      throw new Error(`untranslated name in ${table}: "${raw}"`);
    const confirmed = !guessed && (CONFIRMED[table]?.includes(key) ?? false);
    out[key] = { name, status: confirmed ? "confirmed" : "deduced" };
  }
  return out;
}

interface Prototype {
  menu: Record<string, string>;
  menu2: Record<string, string>;
  codex: Record<string, string>;
  quickref: Record<string, string>;
  maps: string[];
  afk: Record<string, string>;
}

const [input, output] = process.argv.slice(2);
if (input === undefined || output === undefined) {
  throw new Error(
    "usage: node scripts/convert-prototype-names.ts <prototype names.json> <output .json>",
  );
}
const proto = JSON.parse(readFileSync(input, "utf8")) as Prototype;
const catalog: Catalog = {
  version: 1,
  menu: convertTable("menu", proto.menu),
  menu2: convertTable("menu2", proto.menu2),
  codex: convertTable("codex", proto.codex),
  quickref: convertTable("quickref", proto.quickref),
  maps: proto.maps,
  afk: proto.afk,
};
writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`);
