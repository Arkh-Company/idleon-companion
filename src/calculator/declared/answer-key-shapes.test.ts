// The root's shapes of the blueprint in the answer key (spec 010, T145, T152, T153; spec, Open Questions 21 and 22/11;
// ADR 0010): a part of a call, a sum of calls and a routine run on the recorder's copy, with their values, over the
// invented game (fake-game.js).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { LOG_CAP } from "../recording.ts";
import type { Recording } from "../recording.ts";
import { bootRecorder } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(
    GAME,
    PAK,
    { startMs: 5_000, numberMs: 500 },
    { infinite: true },
  );
});

const record = (block: string): Recording =>
  recorder.record(mosaicOf(), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });

// Spec 010, T145 and T153: a part is terms of the recorded pool, by reference; its value is their product (Multi) or
// their sum (Additive). The game multiplies a reducer loose together with the cost (the Market), so no sub-expression
// holds the reducer alone.
test("a part of a Multi pool: the product of the terms it names, and its terms are them", () => {
  // TreeDeclFactor: TreeReads() × (TreeLoop() × TreeTwins[0]) × TreeBase, one Multi pool of four terms
  const key = answerKey(record("TreeDeclFactor"), recorder.ops, {
    part: ["TreeLoop()", "TreeTwins[0]"],
  });
  if ("error" in key) throw new Error(key.reason);
  // TreeLoop() sums TreeList (1 + 2 + 3) and TreeTwins[0] is 3 (fake-mosaic.ts)
  expect(key.final).toBe(18);
  expect(key.pools.map((p) => [p.kind, p.value])).toEqual([["multi", 18]]);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
    "TreeLoop()",
    "TreeTwins[0]",
  ]);
  // two terms loose in the same product, as the Market's reducer next to its cost
  const loose = answerKey(record("TreeDeclFactor"), recorder.ops, {
    part: ["TreeReads()", "TreeBase"],
  });
  expect("error" in loose ? loose.reason : loose.final).toBe(32);
});

test("a part of an Additive pool: the sum of the terms it names", () => {
  // TreeDeclExpr: (TreeReads() + TreeCapped + 2) × TreeLoop() × (1 + TreeStats.b / 100)
  const key = answerKey(record("TreeDeclExpr"), recorder.ops, {
    part: ["TreeReads()", "TreeCapped"],
  });
  expect("error" in key ? key.reason : [key.final, key.pools[0]?.kind]).toEqual(
    [88, "additive"],
  );
});

test("a part is refused when a reference is no term of a recorded pool, or when its terms are in two pools", () => {
  const nowhere = answerKey(record("TreeDeclFactor"), recorder.ops, {
    part: ["TreeLoop()", "TreeNowhere()"],
  });
  expect(nowhere).toMatchObject({ error: "rootForm" });
  expect("reason" in nowhere ? nowhere.reason : "").toMatch(/TreeNowhere\(\)/);
  const split = answerKey(record("TreeDeclExpr"), recorder.ops, {
    part: ["TreeReads()", "TreeLoop()"],
  });
  expect(split).toMatchObject({ error: "rootForm" });
  expect("reason" in split ? split.reason : "").toMatch(/pools diferentes/);
});

test("a sum of calls: the final is the sum of the recorded values, the calls' refs in order", () => {
  const rec = recorder.record(
    mosaicOf(),
    [
      ["TreeReads", [0, 0, 0]],
      ["TreeLoop", [0, 0, 0]],
    ],
    { recompute: [], builders: [] },
  );
  const key = answerKey(rec, recorder.ops, { sum: 2 });
  if ("error" in key) throw new Error(key.reason);
  const [a, b] = (rec.nodes[rec.root ?? -1]?.c ?? []).map(
    (id) => rec.nodes[id]?.v,
  );
  expect(key.final).toBe(Number(a) + Number(b));
  expect(key.final).toBe(14);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
    "TreeReads(0,0,0)",
    "TreeLoop(0,0,0)",
  ]);
});

// Spec 010, T152: a routine run on the recorder's copy only (the Cog Board's total).
test("a routine's root: the sum of the state paths the routine writes, each path a source", () => {
  const rec = recorder.record(
    mosaicOf(),
    [],
    { recompute: [], builders: [] },
    false,
    [],
    [
      {
        slot: 0,
        behavior: "ActorEvents_29",
        event: "_customEvent_TreeBoard",
        args: [],
      },
    ],
  );
  const key = answerKey(rec, recorder.ops, { routine: "TreeBoard[*]" });
  if ("error" in key) throw new Error(key.reason);
  expect(key.form).toBe("sum");
  // TreeList is 1, 2 and 3, each × (1 + 3 / 100)
  expect(key.final).toBeCloseTo(6.18, 12);
  const terms = key.pools.flatMap((p) => p.terms);
  expect(terms.map((t) => t.ref)).toEqual([
    "TreeBoard[0]",
    "TreeBoard[1]",
    "TreeBoard[2]",
  ]);
  terms.forEach((t, i) => {
    expect(t.value).toBeCloseTo((i + 1) * 1.03, 12);
  });
  const none = answerKey(rec, recorder.ops, { routine: "TreeNothing[*]" });
  expect(none).toMatchObject({ error: "rootForm" });
});

// Spec 010, T155: a part can be one term that holds all its references, and it is looked for in the pools of a
// running total the root only reads.
test("a part can be one term that holds all its references: its value", () => {
  // TreePartTerm: TreeLoop() × (1 + (TreeStats.a + TreeStats.b) / 100)
  const key = answerKey(record("TreePartTerm"), recorder.ops, {
    part: ["TreeStats.a", "TreeStats.b"],
  });
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBeCloseTo(1.08, 12);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.refs))).toEqual([
    ["TreeStats.a", "TreeStats.b"],
  ]);
});

test("a part is looked for in the running total a call builds in a scratch path that the root only reads", () => {
  // TreeCostRead rounds DNSM.TreeCost.v, which TreeCostBuild writes: TreeCapped × 100 × max(0.1, 1 − 3/100) ×
  // max(0.9, 1 − 3/100)
  const key = answerKey(record("TreeCostRead"), recorder.ops, {
    part: ["TreeStats.a", "TreeTwins[0]"],
  });
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBeCloseTo(0.97 * 0.97, 12);
  expect(key.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)])).toEqual([
    ["multi", ["TreeStats.a", "TreeTwins[0]"]],
  ]);
});

// Spec 010, T156: a routine in steps, each event with the trigger text it sets first (the Cog Board: m, then z).
test("a routine in two passes by its trigger text: the sum of what the last pass wrote in the helper's copy", () => {
  const pass = (text: string) => ({
    slot: 0,
    behavior: "ActorEvents_29",
    event: "_customEvent_TreeHouses",
    args: [],
    set: ["_TRIGGEREDtext", text] as const,
  });
  const rec = recorder.record(
    mosaicOf(),
    [],
    { recompute: [], builders: [] },
    false,
    [],
    [pass("m"), pass("z")],
  );
  const key = answerKey(rec, recorder.ops, {
    routine:
      "PixelHelperActor[0].behaviors.getBehavior(ActorEvents_29)._TreeHouses[*].a",
  });
  if ("error" in key) throw new Error(key.reason);
  // TreeList 1, 2 and 3, × 2 each, × (1 + 3 / 100)
  expect(key.final).toBeCloseTo(12 * 1.03, 12);
  expect(key.pools[0]?.terms).toHaveLength(3);
  // the copy is made again for each recording: z alone finds no houses that m built before
  expect(() =>
    recorder.record(
      mosaicOf(),
      [],
      { recompute: [], builders: [] },
      false,
      [],
      [pass("z")],
    ),
  ).toThrow();
});

// The review of T155: ambiguity is refused, never resolved by order.
test("a part whose references are in more than one term is refused", () => {
  // TreePartTwice: TreeLoop() × (1 + (TreeStats.a + TreeStats.b) / 100) × (2 + (TreeStats.a + TreeStats.b) / 50)
  for (const part of [["TreeStats.a", "TreeStats.b"], ["TreeStats.a"]]) {
    const key = answerKey(record("TreePartTwice"), recorder.ops, { part });
    expect(key, part.join()).toMatchObject({ error: "rootForm" });
    expect("reason" in key ? key.reason : "", part.join()).toMatch(
      /a parte está em mais de um termo/,
    );
  }
});

test("a part that more than one call gives, in the paths the root reads, is refused", () => {
  // TreeCostTwice calls TreeCostBuild twice and reads what each built
  const key = answerKey(record("TreeCostTwice"), recorder.ops, {
    part: ["TreeStats.a", "TreeTwins[0]"],
  });
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(
    /a parte vem de mais de uma chamada/,
  );
});

test("a part ambiguous in the root is refused there, never looked for in the calls the root reads", () => {
  // TreePartBoth: round(the cost TreeCostBuild built) × (1 + TreeTwins[0] / 100) × (2 + TreeTwins[0] / 50)
  const key = answerKey(record("TreePartBoth"), recorder.ops, {
    part: ["TreeStats.a", "TreeTwins[0]"],
  });
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(
    /a parte está em mais de um termo/,
  );
});

test("a part ambiguous inside the one call that builds what the root reads is refused with that reason", () => {
  // TreeCostAmbRead rounds the cost TreeCostAmbBuild builds, with TreeStats.a in two of its reducers
  const key = answerKey(record("TreeCostAmbRead"), recorder.ops, {
    part: ["TreeStats.a"],
  });
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(
    /a parte está em mais de um termo/,
  );
});

// Spec 010, T159: a root that takes a short list of numbers and names an item of the list it returns.
test("an item of the list a root returns: the root's last write to that item, and its pools", () => {
  const rec = recorder.record(mosaicOf(), [["TreeTabs", [[0, 0, 0]]]], {
    recompute: [],
    builders: [],
  });
  // the third tab: TreeLevel + TreeBase − 0
  const key = answerKey(rec, recorder.ops, { item: 2 });
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBe(29);
  expect(key.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)])).toEqual([
    ["additive", ["TreeLevel", "TreeBase", "0"]],
  ]);
  const none = answerKey(rec, recorder.ops, { item: 7 });
  expect(none).toMatchObject({ error: "rootForm" });
});

// The review of T159: an item is refused when it is ambiguous.
test("an item whose value more than one step gives, or that is in more than one list, is refused", () => {
  const tabs = recorder.record(mosaicOf(), [["TreeTabs", [[0, 10, 0]]]], {
    recompute: [],
    builders: [],
  });
  // the first two tabs are both 10
  const same = answerKey(tabs, recorder.ops, { item: 0 });
  expect("reason" in same ? same.reason : "no refusal").toMatch(
    /o item 0 está em mais de um passo/,
  );
  const third = answerKey(tabs, recorder.ops, { item: 2 });
  expect("error" in third ? third.reason : third.final).toBe(29);
  // T162: two lists, the root returning a copy of one (no path to tell which): refused
  const two = answerKey(record("TreeTwoListsCopy"), recorder.ops, { item: 0 });
  expect("reason" in two ? two.reason : "no refusal").toMatch(
    /o item 0 está em mais de uma lista/,
  );
});

// Spec 010, T162 (1): the item is looked for only in the list the root returned (Talent points per tab: the root also
// writes its working lists, TalentDL and TalentDLbonus).
test("an item of the list the root returns, beside another list the root wrote", () => {
  // TreeTwoLists returns TreeListA: TreeLevel + 1
  const key = answerKey(record("TreeTwoLists"), recorder.ops, { item: 0 });
  expect("error" in key ? key.reason : key.final).toBe(26);
});

// Spec 010, T162: the part, on the fifth probe's cases.
test("a part reference inside another term takes that term (the Super Bit beside the talent)", () => {
  // TreeLoop() × (1 + TreeStats.a / 100) × (1 + (TreeCapped + 40 × TreeStats.b) / 100)
  const key = answerKey(record("TreePartSplit"), recorder.ops, {
    part: ["TreeStats.a", "TreeStats.b"],
  });
  if ("error" in key) throw new Error(key.reason);
  // (1 + 3 / 100) × (1 + (80 + 40 × 5) / 100)
  expect(key.final).toBeCloseTo(1.03 * 3.8, 12);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
    "TreeStats.a",
    "TreeCapped",
  ]);
});

test("a part is looked for only in the calls under the root, never in another root of the same recording", () => {
  // a second root, beside the first, builds the same cost again
  const rec = recorder.record(
    mosaicOf(),
    [
      ["TreeCostRead", [0, 0, 0]],
      ["TreeCostBuild", [0, 0, 0]],
    ],
    { recompute: [], builders: [] },
  );
  const key = answerKey(rec, recorder.ops, {
    part: ["TreeStats.a", "TreeTwins[0]"],
  });
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBeCloseTo(0.97 * 0.97, 12);
});

test("a part in a second running total the root builds itself, never in the total that adds it (the Obol stat multi)", () => {
  // TreeStatTwo.v = (TreeLevel + TreeBase) × (1 + (TreeReads() + 40 × TreeStats.b) / 100), added to a scratch total
  const key = answerKey(record("TreeStatMulti"), recorder.ops, {
    part: ["TreeReads()", "TreeStats.b"],
  });
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBeCloseTo(3.08, 12);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.refs))).toEqual([
    ["TreeReads()", "TreeStats.b"],
  ]);
});

// Spec 010, T161 (spec, Open Questions 22/11): a root that returns no number takes a part; the same part in each turn
// of a loop, with the same terms and the same value, is one part; in a ➗ line, the part is in %.
test("a part in each turn of a loop, with the same terms and value, is one part, and the root needs no number (the Seraph)", () => {
  const rec = record("TreeSignLoop");
  expect(typeof rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1]?.v).not.toBe(
    "number",
  );
  const key = answerKey(rec, recorder.ops, {
    part: ["TreeStats.a", "TreeLevel"],
  });
  if ("error" in key) throw new Error(key.reason);
  // min(5, (1.1 + 3 / 100) ^ ceil(26 / 20))
  expect(key.final).toBeCloseTo(1.13 ** 2, 12);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.refs))).toEqual([
    ["TreeStats.a", "TreeLevel"],
  ]);
});

test("a part whose value changes from turn to turn of the loop is refused", () => {
  const key = answerKey(record("TreeSignTurns"), recorder.ops, {
    part: ["TreeStats.a"],
  });
  expect("reason" in key ? key.reason : "no refusal").toMatch(
    /a parte não tem os mesmos termos e o mesmo valor em todas as voltas do laço/,
  );
});

test("a part in the ➗ line of each turn (the Mob respawn): its terms in %", () => {
  // each time ÷ (1 + (TreeReads() + TreeBase + TreeList[i]) / 100): the part is 8 + 4
  const key = answerKey(record("TreeRespawnLoop"), recorder.ops, {
    part: ["TreeReads()", "TreeBase"],
  });
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBeCloseTo(12, 12);
  expect(
    key.pools.map((p) => [p.kind, p.terms.map((t) => [t.ref, t.weight])]),
  ).toEqual([
    [
      "additive",
      [
        ["TreeReads()", 1],
        ["TreeBase", 1],
      ],
    ],
  ]);
});

// Spec 010, T163 (spec, Open Questions 22/11): the Mob respawn, one tree per world. The blueprint says which turns of
// the loop are the world's by the list its branch searches, never by their order; the world's ➗ line is its part.
const weights = (key: ReturnType<typeof answerKey>) =>
  "error" in key
    ? key.reason
    : key.pools.flatMap((p) => p.terms.map((t) => [t.ref, t.weight]));

test("a branch takes the turns whose search of its list found the item: the world's whole ➗ line, in %", () => {
  const rec = record("TreeRespawnWorlds");
  const part = ["TreeReads()", "TreeBase", "TreeStats.a"];
  // without a branch, the turns of the first and the third world have the same terms and other values
  const mixed = answerKey(rec, recorder.ops, { part });
  expect("reason" in mixed ? mixed.reason : "no refusal").toMatch(
    /a parte não tem os mesmos termos e o mesmo valor em todas as voltas do laço/,
  );
  const key = answerKey(rec, recorder.ops, { part, branch: "TreeWorlds[0]" });
  if ("error" in key) throw new Error(key.reason);
  // 8 + 4 + 3
  expect(key.final).toBeCloseTo(15, 12);
  expect(weights(key)).toEqual([
    ["TreeReads()", 1],
    ["TreeBase", 1],
    ["TreeStats.a", 1],
  ]);
});

test("a constant that multiplies a sum in the ➗ line scales each of its terms (the 0.65 of W7)", () => {
  const key = answerKey(record("TreeRespawnWorlds"), recorder.ops, {
    part: ["TreeReads()", "TreeBase", "TreeStats.b"],
    branch: "TreeWorlds[1]",
  });
  if ("error" in key) throw new Error(key.reason);
  // 0.65 × (8 + 4) + 5
  expect(key.final).toBeCloseTo(12.8, 12);
  expect(weights(key)).toEqual([
    ["TreeReads()", 0.65],
    ["TreeBase", 0.65],
    ["TreeStats.b", 1],
  ]);
});

test("a branch whose turns differ, a branch's turn without the part, or a branch with no turn is refused", () => {
  const rec = record("TreeRespawnWorlds");
  const reason = (part: string[], branch: string) => {
    const key = answerKey(rec, recorder.ops, { part, branch });
    return "reason" in key ? key.reason : "no refusal";
  };
  const part = ["TreeReads()", "TreeBase", "TreeStats.a"];
  expect(reason(part, "TreeWorlds[2]")).toMatch(
    /a parte não tem os mesmos termos e o mesmo valor em todas as voltas do laço/,
  );
  // a turn of the branch is never left out: the reference missing in it refuses the root
  expect(reason([...part, "TreeLevel"], "TreeWorlds[0]")).toMatch(
    /a parte não é termo de um pool gravado: TreeLevel/,
  );
  expect(reason(part, "TreeNoWorld")).toMatch(
    /nenhuma volta achou o item na lista TreeNoWorld/,
  );
});

// The review of T163: a step log cut at the recorder's cap could leave turns of the branch out without a word.
test("the cap of a call's step log is the recorder's, and a branch over a log at the cap is refused", () => {
  const src = readFileSync(
    join(import.meta.dirname, "..", "recorder.js"),
    "utf8",
  );
  expect(LOG_CAP).toBe(20_000);
  expect(/var LOG_CAP = (\d+);/.exec(src)?.[1]).toBe(String(LOG_CAP));
  const rec = record("TreeRespawnWorlds");
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top?.rx) throw new Error("no step log");
  while (top.rx.length < LOG_CAP) top.rx.push(["TreePad", 0, 0]);
  const key = answerKey(rec, recorder.ops, {
    part: ["TreeReads()", "TreeBase", "TreeStats.a"],
    branch: "TreeWorlds[0]",
  });
  expect("reason" in key ? key.reason : "no refusal").toMatch(
    /o log da chamada chegou ao limite antes das voltas do ramo/,
  );
});

// Spec 010, T162 (spec, Open Questions 22/11): the recording keeps an infinite cost, and `K < x && (x = K)` is a Cap K.
test("a cost that overflows to Infinity and is cut by `K < x && (x = K)`: a chain with a Cap K, and its part", () => {
  const rec = record("TreeCostInf");
  expect(rec.writes.some((w) => w.v === Infinity)).toBe(true);
  const key = answerKey(rec, recorder.ops);
  if ("error" in key) throw new Error(key.reason);
  expect(key.form).toBe("chain");
  expect(key.top.map((l) => [l.kind, l.value ?? null, l.after])).toEqual([
    ["round", null, 1000],
    ["cap", 1000, 1000],
  ]);
  expect(key.top[1]?.before).toBe(Infinity);
  const part = answerKey(rec, recorder.ops, {
    part: ["TreeTwins[0]", "TreeStats.a"],
  });
  expect("error" in part ? part.reason : part.final).toBeCloseTo(
    0.421875 * 0.97,
    12,
  );
});

// The fifth probe's time (sonda 6): labeling an infinite number is a pass over the whole recording, seconds on the real
// game; only a recording that has one names a place for it.
test("only a recording with an infinite number marks it for its label", () => {
  record("TreeDeclChain");
  expect(recorder.context.run("__rec.infAt()", 1_000)).toBe("[]");
  record("TreeCostInf");
  expect(recorder.context.run("__rec.infAt()", 1_000)).not.toBe("[]");
});

/** What the old label pass over the whole recording (a replacer in take(), a reviver after it) gave of its state. */
const labeled = (): unknown =>
  JSON.parse(
    String(
      recorder.context.run(
        `JSON.stringify({ nodes: __rec.state.nodes, writes: __rec.state.writes, spliced: __rec.state.spliced },
          (k, v) => (v === Infinity ? "(Infinity)" : v === -Infinity ? "(-Infinity)" : v))`,
        1_000,
      ),
    ),
    (_, v: unknown) =>
      v === "(Infinity)" ? Infinity : v === "(-Infinity)" ? -Infinity : v,
  );

// The seventh probe's time (4× the fifth's): a label pass over the whole recording (a replacer in take(), a reviver
// after it) cost seconds in every root. The recording names the place of each infinite number instead, and each comes
// back there: the same recording the labels gave.
test("each infinite number comes back at its place, as the label over the whole recording gave it", () => {
  const rec = recorder.record(
    mosaicOf(),
    [
      ["TreeCostInf", [0, 0, 0]],
      ["TreeInfNeg", [0, 0, 0]],
    ],
    { recompute: [], builders: [] },
  );
  const at = JSON.parse(
    String(recorder.context.run("__rec.infAt()", 1_000)),
  ) as unknown[][];
  expect(
    at.map((p) => p.slice(0, -1).filter((k) => typeof k === "string")),
  ).toEqual(
    expect.arrayContaining([
      ["nodes", "a"],
      ["nodes", "v"],
      ["nodes", "x"],
      ["nodes", "r"],
      ["nodes", "rx"],
      ["writes", "v"],
    ]),
  );
  expect({
    nodes: rec.nodes,
    writes: rec.writes,
    spliced: rec.spliced,
  }).toEqual(labeled());
  expect(rec.nodes.some((n) => n.v === -Infinity)).toBe(true);
});

// Review of the seventh probe: a write the builders' pass moves to the spliced ones, after another it drops from the
// writes, comes back at its place there.
test("an infinite number the builders' pass moves to the spliced writes comes back at its place there", () => {
  const rec = recorder.record(mosaicOf(), [["TreeCostInf", [0, 0, 0]]], {
    recompute: [],
    builders: [
      {
        cache: "TreeWhoCache",
        run: { block: "TreeInfBuild", args: [] },
        keepLive: true,
      },
    ],
  });
  expect(rec.spliced.some((w) => w.v === Infinity)).toBe(true);
  expect({
    nodes: rec.nodes,
    writes: rec.writes,
    spliced: rec.spliced,
  }).toEqual(labeled());
});
