// Every blueprint of the calculator (spec 010, FR-001, FR-024a): one per `arvore` number of the catalog, in its lot's
// folder, none more, each loading in a stage. The catalog is read as a file: the calculator imports none of it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { BlueprintNode } from "./blueprint.ts";
import { BLUEPRINTS, loadBlueprints } from "./blueprints.ts";
import { hasRawCharacterIndex } from "./refs.ts";
import { treeCatalog } from "./tree-catalog-fixture.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const DIR = join(ROOT, "src", "calculator", "blueprints");
const catalog = treeCatalog();
const files = readdirSync(DIR, { recursive: true, encoding: "utf8" })
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => f.endsWith(".blueprint.json"));

test("each tree number of the catalog has exactly one blueprint, in its lot's folder, and no file is extra", () => {
  expect(catalog).toHaveLength(301);
  const expected = catalog.map((n) => `${n.lot}/${n.id}.blueprint.json`);
  expect(files.toSorted()).toEqual(expected.toSorted());
});

test("every tree a number of the catalog says it goes into is a number of the catalog", () => {
  const all = JSON.parse(
    readFileSync(join(ROOT, "docs", "catalogo", "numeros.json"), "utf8"),
  ) as { id: string; arvore_mae?: string[] }[];
  const ids = new Set(all.map((n) => n.id));
  expect(
    all.flatMap((n) =>
      (n.arvore_mae ?? [])
        .filter((m) => !ids.has(m))
        .map((m) => `${n.id} -> ${m}`),
    ),
  ).toEqual([]);
});

test("the Drop Rate's blueprint is complete: Additive, Multi, Additive, Multi, no character written out, every source proven (T031)", () => {
  const out = loadBlueprints(BLUEPRINTS);
  expect(out.stages.get("stats-drop-rate")).toBe("complete");
  const bp = out.complete.get("stats-drop-rate");
  expect(bp?.pools.map((p) => p.kind)).toEqual([
    "additive",
    "multi",
    "additive",
    "multi",
  ]);
  const nodes: BlueprintNode[] = [];
  const walk = (n: BlueprintNode) => {
    nodes.push(n);
    if (n.condition) walk(n.condition);
    n.children?.forEach(walk);
  };
  bp?.pools.forEach((p) => {
    p.groups.forEach((g) => {
      g.sources.forEach(walk);
    });
  });
  expect(
    nodes.filter(
      (n) => n.ref && "read" in n.ref && hasRawCharacterIndex(n.ref.read),
    ),
  ).toEqual([]);
  expect(nodes.filter((n) => n.nameProof === undefined)).toEqual([]);
});

test("the Star Signs piece loads below a line that reads a star sign's field: the active signs' bases, then the multis (T172)", () => {
  const probe = {
    id: "star-signs-probe",
    root: {
      name: "Drop Rate",
      ref: { call: "TotalStats", args: ["Drop_Rarity", 0, 0] },
    },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "star-signs",
            sources: [
              {
                key: "signs-drop",
                name: "Star Signs total: Drop Rate",
                nameProof: { names: "DNSM.StarSigns.Drop" },
                ref: { read: "DNSM.StarSigns.Drop" },
                piece: { name: "star-signs", args: {} },
              },
            ],
          },
        ],
      },
    ],
  };
  const out = loadBlueprints({
    ...BLUEPRINTS,
    "probe/star-signs-probe.blueprint.json": probe,
  });
  expect(out.refused).toEqual([]);
  const line = out.all.get("star-signs-probe")?.pools[0]?.groups[0]?.sources[0];
  expect(line?.pools?.map((p) => p.kind)).toEqual(["additive", "multi"]);
  expect(line?.pools?.[0]?.groups[0]?.sources[0]?.each).toEqual({
    list: "DNSM.StarSignsDL[*]",
    as: "sign",
  });
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
