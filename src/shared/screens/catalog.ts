// Joins the parts of the screen catalog and checks every rule: a rule without proof never reaches the player (FR-003).
import { isObject } from "../link.ts";
import { FIELDS } from "../reading.ts";
import type { ScreenCatalog, ScreenRule } from "../types.ts";

const PROOF = /^(foto|sprite):\S+$/;
const BEHAVIOR_KEY = /^H\d+\.\w+(\[\d+\])?$/;

function fail(what: unknown): never {
  throw new Error(`Invalid screen catalog: ${JSON.stringify(what)}`);
}

const isWhenKey = (key: string) =>
  BEHAVIOR_KEY.test(key) ||
  (Object.hasOwn(FIELDS, key) && key !== "char" && key !== "behaviors");

const isCondition = ([key, value]: [string, unknown]) =>
  isWhenKey(key) && (typeof value === "number" || typeof value === "string");

function isRule(v: unknown): v is ScreenRule {
  if (!isObject(v)) return false;
  const { when, name, tabs, proof } = v;
  return (
    isObject(when) &&
    Object.keys(when).length > 0 &&
    Object.entries(when).every(isCondition) &&
    typeof name === "string" &&
    name.trim() !== "" &&
    (tabs === undefined || tabs === true) &&
    typeof proof === "string" &&
    PROOF.test(proof)
  );
}

const isWindow = (v: unknown): v is number => Number.isInteger(v);

function items<T>(
  part: Record<string, unknown>,
  key: keyof ScreenCatalog,
  ok: (v: unknown) => v is T,
): T[] {
  const list = part[key];
  if (list === undefined) return [];
  if (!Array.isArray(list)) fail(list);
  return (list as unknown[]).map((item) => (ok(item) ? item : fail(item)));
}

/** The parts joined into one catalog; throws on any invalid part or rule. */
export function parseScreenCatalog(parts: unknown[]): ScreenCatalog {
  const catalog: ScreenCatalog = {
    overlays: [],
    screens: [],
    unprovenWindows: [],
  };
  for (const part of parts) {
    if (!isObject(part)) fail(part);
    catalog.overlays.push(...items(part, "overlays", isRule));
    catalog.screens.push(...items(part, "screens", isRule));
    catalog.unprovenWindows.push(...items(part, "unprovenWindows", isWindow));
  }
  const inRules = new Set(
    [...catalog.overlays, ...catalog.screens].map((rule) => rule.when.menu2),
  );
  for (const n of catalog.unprovenWindows) if (inRules.has(n)) fail(n);
  return catalog;
}
