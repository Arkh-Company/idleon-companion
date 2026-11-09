// For tests only: READ_NULLS spreads into a Reading literal, in place of its `codexSel` line; readingOf is a whole one.
import type { Reading } from "./types.ts";

/** The fields of a Reading that a test does not care about, empty. */
export const READ_NULLS = {
  codexSel: null,
  scene: null,
  attack: null,
  bag: null,
  ol1: null,
  ol3: null,
  ol18: null,
  ol19: null,
  ola489: null,
  nd37: null,
  hole: null,
  behaviors: {},
} satisfies Partial<Reading>;

/** A whole Reading with no window open, and `fields` over it. */
export const readingOf = (fields: Partial<Reading> = {}): Reading => ({
  ...READ_NULLS,
  t: 0,
  map: 0,
  menu: 0,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: null,
  afk: null,
  codexTab: null,
  ...fields,
});
