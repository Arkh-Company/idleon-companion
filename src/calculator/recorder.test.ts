// The recorder over the invented game (spec 008, T016): calls, reads, steps, links, the builders' pass and the switch
// that turns it off, with the game instrumented as in the tree worker.
import { beforeAll, expect, test } from "vitest";
import { CHARACTERS, GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import type { Recipe, RecNode, Recording } from "./recording.ts";
import { bootRecorder } from "./tree-record.ts";
import { linkReads } from "./tree/links.ts";

const NONE: Recipe = { recompute: [], builders: [] };
const call = (block: string): [string, number[]] => [block, [0, 0, 0]];

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

const record = (blocks: string[], mosaic = mosaicOf(), recipe = NONE) =>
  recorder.record(mosaic, blocks.map(call), recipe);
function found(n: RecNode | undefined): RecNode {
  if (!n) throw new Error("no such node in the recording");
  return n;
}
const under = (rec: Recording, id: number | null) =>
  (id === null ? [] : found(rec.nodes[id]).c).map((c) => found(rec.nodes[c]));
const first = (rec: Recording, block: string) =>
  found(rec.nodes.find((n) => n.b === block));

test("a root call keeps its exact arguments, its value and its children", () => {
  const rec = record(["TreeSources"]);
  const [root] = under(rec, rec.root);
  expect(root).toMatchObject({ b: "TreeSources", a: [0, 0, 0], v: 52 });
  expect(under(rec, root?.id ?? null).map((n) => [n.b, n.v])).toEqual([
    ["TreeReads", 8],
    ["TreeLoop", 6],
  ]);
});

test("a call keeps its state reads and the steps of its arithmetic", () => {
  const reads = first(record(["TreeReads"]), "TreeReads");
  expect(reads.r?.map(([path, v]) => [path, v])).toEqual([
    ["TreeStats.a", 3],
    ["TreeStats.b", 5],
  ]);
  expect(reads.x?.map(([, v]) => v)).toEqual([3, 5, 8]);
});

test("the helpers run under the setup node, and a cache read links to its writer", () => {
  const rec = record(["TreeCacheRead"]);
  const read = first(rec, "TreeCacheRead");
  expect(read.v).toBe(9);
  const link = linkReads(rec).links.get(read.id)?.[0];
  expect([link?.[0], link?.[2]]).toEqual(["DNSM.TreeCache.total", "offline"]);
  const writer = found(rec.nodes[link?.[1] ?? -1]);
  expect(writer).toMatchObject({ b: "TreeCacheFill", a: [-1] });
  expect(writer.p).toBe(rec.setup);
});

test("a lazy DNSM map is still created with the instrumentation on", () => {
  expect(first(record(["TreeCacheRead"]), "TreeCacheRead").v).toBe(9);
});

test("a cache that came from the running game is from the game", () => {
  const rec = record(["TreeGameCache"]);
  const node = first(rec, "TreeGameCache");
  expect(node.v).toBe(5);
  expect(linkReads(rec).links.get(node.id)?.[0]?.[2]).toBe("game");
});

test("a cache of the recipe's recompute list leaves the copy before the helpers", () => {
  const rec = record(["TreeGameCache"], mosaicOf(), {
    recompute: ["GameCache"],
    builders: [],
  });
  expect(first(rec, "TreeGameCache").v).toBe(0);
  expect(rec.fromGame).toContain("GameCache");
});

test("the builders' pass rebuilds a cache after the total, and a read links to it", () => {
  const recipe: Recipe = {
    recompute: [],
    // the invented block writes into the cache in place: the game's one stays while it runs
    builders: [
      {
        cache: "TreeCache",
        run: { block: "TreeCacheFill", args: [-1] },
        keepLive: true,
      },
    ],
  };
  const rec = record(["TreeCacheRead"], mosaicOf(), recipe);
  expect(under(rec, rec.builders).map((n) => [n.b, n.a])).toEqual([
    ["TreeCacheFill", [-1]],
  ]);
  const read = first(rec, "TreeCacheRead");
  const writer = linkReads(rec).links.get(read.id)?.[0]?.[1] ?? -1;
  expect(rec.nodes[writer]?.p).toBe(rec.builders);
  expect(read.v).toBe(9);
});

test("a builder can be an event of a helper actor", () => {
  const recipe: Recipe = {
    recompute: [],
    builders: [
      {
        cache: "TreeCache",
        run: {
          slot: 0,
          behavior: "ActorEvents_29",
          event: "_customEvent_Refill",
          args: [],
        },
        keepLive: true,
      },
    ],
  };
  const rec = record(["TreeCacheRead"], mosaicOf(), recipe);
  const read = first(rec, "TreeCacheRead");
  expect(linkReads(rec).links.get(read.id)?.[0]?.slice(1)).toEqual([
    rec.builders,
    "offline",
  ]);
});

test("a game's search is one read, and never fills the read cap", () => {
  const big = Object.fromEntries(
    Array.from({ length: 200 }, (_, i) => [`k${String(i)}`, i === 150 ? 7 : 1]),
  );
  const rec = record(["TreeSearch"], mosaicOf({ TreeBig: { $m: big } }));
  const node = first(rec, "TreeSearch");
  expect(node.v).toBe(5);
  expect(node.r?.map(([path, v]) => [path, v])).toEqual([
    ["TreeBig contains value 7", true],
    ["TreeBase", 4],
  ]);
});

test("the server bridge answers the companions of the mosaic", () => {
  expect(first(record(["TreeCompanions"]), "TreeCompanions").v).toBe(1);
});

test("no character name is kept: keys and arguments become the index", () => {
  const rec = record(["TreePlayer", "TreeTextValue"]);
  expect(first(rec, "TreePlayer").v).toBe(4);
  expect(first(rec, "TreeNamed").a).toEqual(["(character 0)"]);
  expect(first(rec, "TreePlayer").r?.map(([path]) => path)).toContain(
    "PlayerDATABASE[0].CurrentMap",
  );
  const text = JSON.stringify(rec);
  for (const name of CHARACTERS) expect(text).not.toContain(name);
});

test("the same call with the same arguments is the same piece in any order (the lego)", () => {
  const piece = (rec: Recording) =>
    rec.nodes
      .filter((n) => n.b === "TreeReads")
      .map((n) => ({
        a: n.a,
        v: n.v,
        r: n.r?.map(([p, v]) => [p, v]),
        x: n.x,
      }));
  const ab = record(["TreeTwice", "TreeSources"]);
  const ba = record(["TreeSources", "TreeTwice"]);
  expect(piece(ab)).toEqual(piece(ba));
  expect(piece(ab)).toHaveLength(3);
});

test("the recording leaves the context only as JSON text", () => {
  record(["TreeReads"]);
  expect(typeof recorder.context.run("__rec.take()", 1_000)).toBe("string");
});

test("the record switch is off again when a root runs out of time", () => {
  expect(() =>
    record(["PlayerHPmax"], mosaicOf({ Scenario: "endless" })),
  ).toThrow();
  expect(recorder.context.run("__rec.isOn()", 1_000)).toBe(false);
  expect(first(record(["TreeReads"]), "TreeReads").v).toBe(8);
});

test("the recorder is in place before the game runs, and records nothing at boot", () => {
  const early = bootRecorder(`globalThis.__early = __X(0, 5);${GAME}`, PAK);
  expect(early.context.run("__early", 1_000)).toBe(5);
  expect(
    JSON.parse(early.context.run("__rec.take()", 1_000) as string),
  ).toMatchObject({
    nodes: [],
    writes: [],
  });
});

// Round 1 of the review: each branch that decides who explains a cache read, and a builder cut by its time limit.
const builder = (
  block: string,
  args: (string | number)[] = [],
  extra: Partial<Recipe["builders"][number]> = {},
): Recipe["builders"][number] => ({
  cache: "TreeCache",
  run: { block, args },
  ...extra,
});
const linkOf = (rec: Recording, block: string) =>
  linkReads(rec).links.get(first(rec, block).id)?.[0];
const writerOf = (rec: Recording, block: string) =>
  found(rec.nodes[linkOf(rec, block)?.[1] ?? -1]);

test("companions the helpers built equal to the game's keep their writer", () => {
  const rec = record(
    ["TreeCompanionRead"],
    mosaicOf({ Scenario: "companionsBuilt" }),
  );
  expect(first(rec, "TreeCompanionRead").v).toBe(3);
  const writer = writerOf(rec, "TreeCompanionRead");
  expect(writer.b).toBe("TreeCompBuild");
  expect(writer.p).toBe(rec.setup);
});

test("a builder that gives another number than the game's explains nothing", () => {
  const rec = record(["TreeCacheRead"], mosaicOf(), {
    recompute: [],
    builders: [builder("TreeCacheWrong", [], { keepLive: true })],
  });
  expect(first(rec, "TreeCacheRead").v).toBe(9);
  const writer = writerOf(rec, "TreeCacheRead");
  expect(writer.b).toBe("TreeCacheFill");
  expect(writer.p).toBe(rec.setup);
});

test("an event before the builder prepares what the builder reads", () => {
  const before = {
    slot: 0,
    behavior: "ActorEvents_29",
    set: ["_mode", "d"] as [string, string],
    event: "_customEvent_Prepare",
  };
  const rec = record(["TreeCacheRead"], mosaicOf(), {
    recompute: [],
    builders: [builder("TreeCacheReady", [], { before })],
  });
  const writer = writerOf(rec, "TreeCacheRead");
  expect(writer.b).toBe("TreeCacheReady");
  expect(writer.p).toBe(rec.builders);
});

test("a builder reads its own scratch write, not another call of its block", () => {
  const rec = recorder.record(
    mosaicOf(),
    [call("TreeScratch"), call("TreeCacheRead")],
    {
      recompute: [],
      builders: [builder("TreeScratch", [-1], { keepLive: true })],
    },
  );
  const pass = found(
    under(rec, rec.builders).find((n) => n.b === "TreeScratch"),
  );
  expect(linkReads(rec).links.get(pass.id)?.[0]).toEqual([
    "DNSM.TreeScratch.w",
    pass.id,
    "offline",
  ]);
});

test("a search cut by its time limit does not silence the next recording", () => {
  const slow = bootRecorder(GAME, PAK, { startMs: 1_000, numberMs: 500 });
  expect(() =>
    slow.record(mosaicOf(), [call("TreeSearchForever")], NONE),
  ).toThrow();
  const rec = slow.record(mosaicOf(), [call("TreeSearch")], NONE);
  expect(first(rec, "TreeSearch").r?.map(([path]) => path)).toEqual([
    "TreeBig contains value 7",
    "TreeBase",
  ]);
});

test("a builder cut by its time limit leaves the state and the links as they were", () => {
  const slow = bootRecorder(GAME, PAK, { startMs: 1_000, numberMs: 500 });
  const rec = slow.record(mosaicOf(), [call("TreeCacheRead")], {
    recompute: [],
    builders: [
      builder("TreeEndless"),
      builder("TreeCacheFill", [-1], { keepLive: true }),
    ],
  });
  expect(slow.context.run("__rec.isOn()", 1_000)).toBe(false);
  // The next builder found the game's cache in place, and the cut one explains nothing.
  const writer = writerOf(rec, "TreeCacheRead");
  expect([writer.b, writer.p]).toEqual(["TreeCacheFill", rec.builders]);
  expect(rec.writes.some((w) => w.v === 99)).toBe(false);
});
