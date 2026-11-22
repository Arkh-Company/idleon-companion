// The shape of a recording as recorder.js writes it (spec 008, T021), and of the recipe it follows. A recording lives
// only in the tree worker: it carries table texts of the game, never a character name.

/** A value as recorded: numbers and yes/no as they are; any other thing as a label like "(text)" or a game id. */
export type RecValue = number | boolean | string | null;

export interface RecNode {
  id: number;
  /** The block's name, or a structural label: "(setup: game helpers)", "(root)"… */
  b: string;
  a: RecValue[];
  /** The calls made under this one, in order. */
  c: number[];
  p: number | null;
  /** How many steps the parent had run when this call started. */
  pxi: number;
  v?: RecValue;
  err?: true;
  /** State reads: [path, value, the last write's number before the first read]; table texts have no number. */
  r?: ([string, RecValue] | [string, RecValue, number])[];
  /**
   * The step log of the reads: [path, value, how many steps had run] and, for a number, the last write's number before
   * the read (the write it saw).
   */
  rx?: [string, RecValue, number, number?][];
  /** Checks made without reading the value: [path, it exists]. */
  q?: [string, boolean][];
  /** The steps of the block's arithmetic: [op id, value]. */
  x?: [number, number | boolean | null][];
}

export interface RecWrite {
  path: string;
  node: number | null;
  v: RecValue;
  xi: number;
  seq: number;
}

export interface Recording {
  nodes: RecNode[];
  writes: RecWrite[];
  /** The builders' pass writes to other paths, taken out of `writes`. */
  spliced: RecWrite[];
  /** The number of the first write of the builders' pass, or null when there was no pass. */
  bpStart: number | null;
  setup: number | null;
  root: number | null;
  builders: number | null;
  /** The DNSM caches that came in the mosaic, from the running game. */
  fromGame: string[];
}

export type RecipeStep =
  | { block: string; args: (string | number)[] }
  | {
      slot: number;
      behavior: string;
      event: string;
      args: (string | number)[];
    };

/** A step of a root's routine on the recorder's copy (spec 010, T152, T156): for an event, the field it sets first. */
export type RoutineRun = RecipeStep & {
  set?: readonly [field: string, value: string | number];
};

export interface Recipe {
  /** Caches dropped from the copy before the helpers, so the game's own code builds them again. */
  recompute: string[];
  /** The calls that build a cache, run once after the total (the builders' pass). */
  builders: {
    /** The DNSM cache the call builds. */
    cache: string;
    run: RecipeStep;
    /** The block makes the cache new by itself: the game's one stays in place while it runs. */
    keepLive?: boolean;
    /** An event of a helper actor run first, with the game's cache in place. */
    before?: {
      slot: number;
      behavior: string;
      set: [field: string, value: string];
      event: string;
    };
  }[];
}
