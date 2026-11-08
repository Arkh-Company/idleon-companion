// For tests only: spread into a Reading literal, in place of its `codexSel` line.
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
