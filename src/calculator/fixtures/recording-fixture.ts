// A recording written by hand for the tests (spec 008, T017; spec 010, T017): the shape recorder.js gives, with invented
// blocks and paths. Each node's id is its place in `nodes`, and its children run in the order of `c`. It lives outside
// tree/, so recorded/ and declared/ may use it (spec 010, `declared-not-guessed`).
import type { RecNode, Recording, RecWrite } from "../recording.ts";

export type NodeSpec = Partial<RecNode> & Pick<RecNode, "b">;

/** A recording from its nodes in id order; `p` and `pxi` are filled from the children lists. */
export function recordingOf(
  specs: NodeSpec[],
  writes: (Omit<RecWrite, "xi"> & Partial<Pick<RecWrite, "xi">>)[] = [],
  roles: Partial<Pick<Recording, "setup" | "root" | "fromGame">> = {},
): Recording {
  const nodes: RecNode[] = specs.map((s, id) => ({
    id,
    a: [],
    c: [],
    p: null,
    pxi: 0,
    ...s,
  }));
  for (const n of nodes)
    for (const c of n.c) {
      const kid = nodes[c];
      if (kid) kid.p = n.id;
    }
  return {
    nodes,
    writes: writes.map((w) => ({ xi: 0, ...w })),
    spliced: [],
    bpStart: null,
    setup: roles.setup ?? null,
    root: roles.root ?? null,
    builders: null,
    fromGame: roles.fromGame ?? [],
  };
}
