// The catalog's tree numbers with the lot of each (spec 010, FR-001, FR-024a), for the tests and the real-trees run:
// read from docs/catalogo/numeros.json as a file, since the calculator imports none of it (CODING_STANDARDS, "Test
// tables live once").
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The lot (the blueprints' folder) of each world of the catalog; any other world is `?<world>`, never a folder. */
const LOT: Readonly<Record<string, string>> = {
  W1: "w1",
  W2: "w2",
  W3: "w3",
  W4: "w4",
  W5: "w5",
  W6: "w6",
  W7: "w7",
  Personagem: "character",
  Conta: "account",
};

/** Every `arvore` number of the catalog, in its order, with its lot. */
export function treeCatalog(): { id: string; lot: string }[] {
  const root = join(import.meta.dirname, "..", "..", "..");
  const all = JSON.parse(
    readFileSync(join(root, "docs", "catalogo", "numeros.json"), "utf8"),
  ) as { id: string; mundo: string; destino: string }[];
  return all
    .filter((n) => n.destino === "arvore")
    .map((n) => ({ id: n.id, lot: LOT[n.mundo] ?? `?${n.mundo}` }));
}
