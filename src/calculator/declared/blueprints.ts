// The blueprints the calculator carries (spec 010, research R8): every `*.blueprint.json` of src/calculator/blueprints/,
// put inside calculator.js by vite and checked on load. Only a complete one is served; a sketch, a draft or a refused
// one answers `unknownNumber` for its number. The `*.piece.json` (T169) are the recipe pieces the blueprints call. The
// `*.review.json` beside them are never imported.
import { parseBlueprint } from "./blueprint.ts";
import { rootText } from "./blueprint-links.ts";
import { isObj } from "./blueprint-root.ts";
import type { Blueprint, BlueprintStage } from "./blueprint.ts";
import { SYSTEMS } from "./systems.ts";

const SYSTEM_IDS: ReadonlySet<string> = new Set(SYSTEMS.map((s) => s.id));
const FILE = /(?:^|\/)([^/]+)\.blueprint\.json$/;
const PIECE = /(?:^|\/)([^/]+)\.piece\.json$/;

export function loadBlueprints(files: Readonly<Record<string, unknown>>): {
  complete: ReadonlyMap<string, Blueprint>;
  /** Every blueprint loaded, in any stage (the real-trees run probes a sketch's root). */
  all: ReadonlyMap<string, Blueprint>;
  refused: { file: string; reason: string }[];
  stages: ReadonlyMap<string, BlueprintStage>;
} {
  const complete = new Map<string, Blueprint>();
  const all = new Map<string, Blueprint>();
  const stages = new Map<string, BlueprintStage>();
  const refused: { file: string; reason: string }[] = [];
  const pieces = new Map<string, unknown>();
  for (const [file, raw] of Object.entries(files)) {
    const name = PIECE.exec(file)?.[1];
    if (name === undefined) continue;
    if (pieces.has(name))
      refused.push({ file, reason: `id repetido: ${name} já tem pedaço` });
    else pieces.set(name, raw);
  }
  // another number's recipe is a piece with no params, its pools (T173): a line calls it by the recipe's id
  const named = new Set(pieces.keys());
  for (const [file, raw] of Object.entries(files)) {
    const id = FILE.exec(file)?.[1];
    if (id === undefined || !isObj(raw) || raw.pools === undefined) continue;
    if (named.has(id))
      refused.push({ file, reason: `id repetido: ${id} já tem pedaço` });
    else if (!pieces.has(id))
      pieces.set(id, { id, params: [], pools: raw.pools });
  }
  // a line links to another number's tree by its blueprint's id (T200), in any stage, and is that blueprint's root (r1)
  const trees = new Map(
    Object.entries(files).flatMap(([f, raw]) => {
      const id = FILE.exec(f)?.[1];
      return id === undefined ? [] : [[id, rootText(raw)] as const];
    }),
  );
  for (const [file, raw] of Object.entries(files)) {
    const fileId = FILE.exec(file)?.[1];
    if (fileId === undefined) continue;
    if (refused.some((r) => r.file === file)) continue;
    if (stages.has(fileId)) {
      refused.push({ file, reason: `id repetido: ${fileId} já tem receita` });
      continue;
    }
    const out = parseBlueprint(raw, {
      fileId,
      systemIds: SYSTEM_IDS,
      pieces,
      trees,
    });
    if (!out.ok) {
      refused.push({ file, reason: out.reason });
      continue;
    }
    stages.set(fileId, out.stage);
    all.set(fileId, out.blueprint);
    if (out.stage === "complete") complete.set(fileId, out.blueprint);
  }
  return { complete, all, refused, stages };
}

/** The recipe pieces' files (`*.piece.json`), raw, by their id: the draft calls a common branch's own (part R). */
export const pieceFiles = (
  files: Readonly<Record<string, unknown>>,
): Map<string, unknown> =>
  new Map(
    Object.entries(files).flatMap(([file, raw]) => {
      const id = PIECE.exec(file)?.[1];
      return id === undefined ? [] : [[id, raw] as const];
    }),
  );

export const BLUEPRINTS = import.meta.glob<unknown>(
  "../blueprints/**/*.{blueprint,piece}.json",
  { eager: true, import: "default" },
);
const LOADED = loadBlueprints(BLUEPRINTS);

/** A complete blueprint, or null (the number answers `unknownNumber`). */
export const blueprintOf = (id: string): Blueprint | null =>
  LOADED.complete.get(id) ?? null;
