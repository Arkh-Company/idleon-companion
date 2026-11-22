// Every blueprint of the calculator (spec 010, FR-001, FR-024a): one per `arvore` number of the catalog, in its lot's
// folder, none more, each loading in a stage. The catalog is read as a file: the calculator imports none of it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { BLUEPRINTS, loadBlueprints } from "./blueprints.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const DIR = join(ROOT, "src", "calculator", "blueprints");
const LOT: Record<string, string> = {
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

const catalog = (
  JSON.parse(
    readFileSync(join(ROOT, "docs", "catalogo", "numeros.json"), "utf8"),
  ) as {
    id: string;
    mundo: string;
    destino: string;
  }[]
).filter((n) => n.destino === "arvore");
const files = readdirSync(DIR, { recursive: true, encoding: "utf8" })
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => f.endsWith(".blueprint.json"));

test("each tree number of the catalog has exactly one blueprint, in its lot's folder, and no file is extra", () => {
  expect(catalog).toHaveLength(301);
  const expected = catalog.map(
    (n) => `${LOT[n.mundo] ?? `?${n.mundo}`}/${n.id}.blueprint.json`,
  );
  expect(files.toSorted()).toEqual(expected.toSorted());
});

test("every blueprint loads in a stage, and its file's name is its id", () => {
  const out = loadBlueprints(BLUEPRINTS);
  expect(out.refused).toEqual([]);
  expect(out.stages.size).toBe(files.length);
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(DIR, f), "utf8")) as {
      id?: unknown;
    };
    expect(`${String(raw.id)}.blueprint.json`).toBe(f.split("/").at(-1));
  }
});
