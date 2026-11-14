// A recording written by hand for the assembly's tests (spec 008, T017): the shape recorder.js gives, with invented
// blocks and paths. Each node's id is its place in `nodes`, and its children run in the order of `c`.
import type { RecNode, Recording, RecWrite } from "../recording.ts";

type Spec = Partial<RecNode> & Pick<RecNode, "b">;

/** A recording from its nodes in id order; `p` and `pxi` are filled from the children lists. */
export function recordingOf(
  specs: Spec[],
  writes: Omit<RecWrite, "xi">[] = [],
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

/**
 * The pieces case: `Part(1)` is called twice under the root with different rows (a conflict), `Hit(2)` reads the cache
 * its twin under `Wrap()` filled, and the setup's own `Part(1)` writes a cache the root reads.
 */
export const PIECES = recordingOf(
  [
    { b: "(setup: game helpers)", c: [1, 9] },
    { b: "FillPool", a: [-1], v: 9, r: [["Stash", 9]] },
    { b: "(root)", c: [3] },
    {
      b: "Total",
      v: 30,
      c: [4, 5, 6, 8],
      r: [
        ["Stats.base", 4],
        ["DNSM.Pool.total", 9, 0],
        ["DNSM.Side.v", 99, 2],
        ["Stats.label", "(text)"],
      ],
    },
    { b: "Part", a: [1], v: 3, r: [["Level", 3]] },
    {
      b: "Part",
      a: [1],
      v: 3,
      r: [
        ["Level", 3],
        ["Extra", 0],
      ],
    },
    { b: "Wrap", v: 5, c: [7] },
    { b: "Hit", a: [2], v: 5, r: [["Level", 5]] },
    { b: "Hit", a: [2], v: 5, r: [["DNSM.Twin.v", 5, 1]] },
    { b: "Part", a: [1], v: 99, r: [["Level", 99]] },
  ],
  [
    { path: "DNSM.Pool.total", node: 1, v: 9, seq: 0 },
    { path: "DNSM.Twin.v", node: 7, v: 5, seq: 1 },
    { path: "DNSM.Side.v", node: 9, v: 99, seq: 2 },
  ],
  { setup: 0, root: 2 },
);

/** A chain of `depth` calls under the root, each calling the next, with a read at the bottom. */
export function chainOf(depth: number): Recording {
  const specs: Spec[] = [{ b: "(root)", c: [1] }];
  for (let i = 1; i <= depth; i++)
    specs.push({
      b: `Step${String(i)}`,
      v: 1,
      ...(i < depth ? { c: [i + 1] } : { r: [["Level", 1]] }),
    });
  return recordingOf(specs, [], { root: 0 });
}
