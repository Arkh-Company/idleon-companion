// The shape of a reading (spec §5.1), checked on both sides of the link: the keeper on read.js's value, the app on
// each `reading` message (the link decoder checks only the message type).
import { isObject } from "./link.ts";
import type { Reading } from "./types.ts";

const isNumber = (v: unknown) => typeof v === "number";
const isNumberOrNull = (v: unknown) => v === null || isNumber(v);
const isTextOrNull = (v: unknown) => v === null || typeof v === "string";
const isSimple = (v: unknown) =>
  isTextOrNull(v) || isNumber(v) || typeof v === "boolean";
const FIELDS: Record<keyof Omit<Reading, "t">, (v: unknown) => boolean> = {
  map: isNumber,
  menu: isNumber,
  menu2: isNumber,
  menu2tab: isNumber,
  skillTab: isNumber,
  char: isTextOrNull,
  afk: isTextOrNull,
  codexTab: isNumberOrNull,
  codexSel: (v) => isTextOrNull(v) || isNumber(v),
  scene: isTextOrNull,
  attack: isNumberOrNull,
  bag: isNumberOrNull,
  ol1: isNumberOrNull,
  ol3: isNumberOrNull,
  ol18: isNumberOrNull,
  ol19: isNumberOrNull,
  ola489: isNumberOrNull,
  nd37: isNumberOrNull,
  hole: isNumberOrNull,
  behaviors: (v) => isObject(v) && Object.values(v).every(isSimple),
};
export { FIELDS };

/** `value` as a Reading stamped at `t`; null when its shape is not a Reading's. */
export function toReading(value: unknown, t: number): Reading | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  for (const [k, ok] of Object.entries(FIELDS)) if (!ok(v[k])) return null;
  const r = v as Omit<Reading, "t">;
  return {
    t,
    map: r.map,
    menu: r.menu,
    menu2: r.menu2,
    menu2tab: r.menu2tab,
    skillTab: r.skillTab,
    char: r.char,
    afk: r.afk,
    codexTab: r.codexTab,
    codexSel: r.codexSel,
    scene: r.scene,
    attack: r.attack,
    bag: r.bag,
    ol1: r.ol1,
    ol3: r.ol3,
    ol18: r.ol18,
    ol19: r.ol19,
    ola489: r.ola489,
    nd37: r.nd37,
    hole: r.hole,
    behaviors: r.behaviors,
  };
}
