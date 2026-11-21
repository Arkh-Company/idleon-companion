// The blueprints the calculator carries (spec 010, research R8): every `*.blueprint.json` of src/calculator/blueprints/,
// put inside calculator.js by vite and checked on load. Only a complete one is served; a sketch, a draft or a refused
// one answers `unknownNumber` for its number. The `*.review.json` beside them are never imported.
import { parseBlueprint } from "./blueprint.ts";
import type { Blueprint, BlueprintStage } from "./blueprint.ts";
import { SYSTEMS } from "./systems.ts";

const SYSTEM_IDS: ReadonlySet<string> = new Set(SYSTEMS.map((s) => s.id));
const FILE = /(?:^|\/)([^/]+)\.blueprint\.json$/;

export function loadBlueprints(files: Readonly<Record<string, unknown>>): {
  complete: ReadonlyMap<string, Blueprint>;
  refused: { file: string; reason: string }[];
  stages: ReadonlyMap<string, BlueprintStage>;
} {
  const complete = new Map<string, Blueprint>();
  const stages = new Map<string, BlueprintStage>();
  const refused: { file: string; reason: string }[] = [];
  for (const [file, raw] of Object.entries(files)) {
    const fileId = FILE.exec(file)?.[1];
    if (fileId === undefined) continue;
    if (stages.has(fileId)) {
      refused.push({ file, reason: `id repetido: ${fileId} já tem receita` });
      continue;
    }
    const out = parseBlueprint(raw, { fileId, systemIds: SYSTEM_IDS });
    if (!out.ok) {
      refused.push({ file, reason: out.reason });
      continue;
    }
    stages.set(fileId, out.stage);
    if (out.stage === "complete") complete.set(fileId, out.blueprint);
  }
  return { complete, refused, stages };
}

export const BLUEPRINTS = import.meta.glob<unknown>(
  "../blueprints/**/*.blueprint.json",
  { eager: true, import: "default" },
);
const LOADED = loadBlueprints(BLUEPRINTS);

/** A complete blueprint, or null (the number answers `unknownNumber`). */
export const blueprintOf = (id: string): Blueprint | null =>
  LOADED.complete.get(id) ?? null;
