// The root's shapes of a blueprint, checked on load (spec 010, T145, T152, T156, T159; spec, Open Questions 21 and
// 22/11): a sum of calls, a part of a call, a marker on the recording's copy, a routine (in steps, with the text that
// triggers each event), and a short list of numbers as an argument with an item of the result.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";

const ctx = {
  fileId: "invented-number",
  systemIds: new Set(["talents", "cards", "achievements", "bundles"]),
};

test("the root's shapes (spec, Open Questions 21/11): a sum of calls, a part of a call, a marker on the recording's copy", () => {
  const sketch = (root: object) =>
    parseBlueprint({ id: "invented-number", root }, ctx);
  const call = (n: number) => ({ call: "Invented", args: ["Pts", n, 0] });
  expect(
    sketch({ name: "Invented", combine: "sum", calls: [call(0), call(1)] }),
  ).toMatchObject({ ok: true, stage: "sketch" });
  expect(
    sketch({
      name: "Invented",
      ref: call(0),
      part: [
        { call: "Other", args: [38, 0] },
        { read: "OptionsListAccount[62]" },
      ],
    }),
  ).toMatchObject({ ok: true });
  expect(
    sketch({ name: "Invented", ref: call(0), scratch: { TreeMark: "gimme" } }),
  ).toMatchObject({ ok: true });
  for (const [root, reason] of [
    [{ name: "Invented", combine: "sum", calls: [] }, /calls/],
    [{ name: "Invented", combine: "sum", calls: [{ read: "A[1]" }] }, /calls/],
    [{ name: "Invented", combine: "product", calls: [call(0)] }, /combine/],
    [
      { name: "Invented", combine: "sum", calls: [call(0)], ref: call(1) },
      /ref/,
    ],
    [{ name: "Invented", ref: call(0), part: "the third step" }, /part/],
    [{ name: "Invented", ref: call(0), part: [] }, /part/],
    [{ name: "Invented", ref: call(0), part: [{ formula: "a*b" }] }, /part/],
    [
      { name: "Invented", ref: call(0), scratch: { TreeMark: { a: 1 } } },
      /scratch/,
    ],
    [{ name: "Invented", ref: call(0), scratch: null }, /scratch/],
    [{ name: "Invented", ref: call(0), scratch: [] }, /scratch/],
    [{ name: "Invented" }, /ref/],
  ] as const) {
    const out = sketch(root);
    expect(out.ok ? "loaded" : out.reason, JSON.stringify(root)).toMatch(
      reason,
    );
  }
});

test("a routine's root (T152): a block or a helper's event run on the recorder's copy, and the state path it sums", () => {
  const sketch = (root: object) =>
    parseBlueprint({ id: "invented-number", root }, ctx);
  const event = {
    slot: 0,
    behavior: "ActorEvents_29",
    event: "_customEvent_Board",
  };
  for (const routine of [event, { call: "Invented", args: ["Board", 0] }])
    expect(
      sketch({ name: "Invented", routine, sum: "InventedBoard[*]" }),
      JSON.stringify(routine),
    ).toMatchObject({ ok: true, stage: "sketch" });
  for (const [root, reason] of [
    [{ name: "Invented", routine: event }, /sum/],
    [{ name: "Invented", routine: event, sum: "A[1] + B[2]" }, /sum/],
    [
      { name: "Invented", routine: event, sum: "PlayerDATABASE[0].Board[*]" },
      /sum/,
    ],
    [
      {
        name: "Invented",
        routine: { slot: -1, behavior: "B", event: "e" },
        sum: "A[*]",
      },
      /routine/,
    ],
    [{ name: "Invented", routine: { read: "A[1]" }, sum: "A[*]" }, /routine/],
    [
      {
        name: "Invented",
        routine: event,
        sum: "A[*]",
        ref: { call: "X", args: [] },
      },
      /routine/,
    ],
  ] as const) {
    const out = sketch(root);
    expect(out.ok ? "loaded" : out.reason, JSON.stringify(root)).toMatch(
      reason,
    );
  }
});

test("a routine in steps (T156): each event may set its trigger text first, and the sum may go through a helper", () => {
  const sketch = (root: object) =>
    parseBlueprint({ id: "invented-number", root }, ctx);
  const pass = (text: unknown) => ({
    slot: 8,
    behavior: "ActorEvents_481",
    event: "_customEvent_Board",
    set: ["_TRIGGEREDtext", text],
  });
  const sum =
    "PixelHelperActor[8].behaviors.getBehavior(ActorEvents_481)._GenINFO[8][*].a";
  expect(
    sketch({ name: "Invented", routine: [pass("m"), pass("z")], sum }),
  ).toMatchObject({ ok: true, stage: "sketch" });
  for (const [root, reason] of [
    [{ name: "Invented", routine: [], sum }, /routine/],
    [{ name: "Invented", routine: [pass({ a: 1 })], sum }, /routine/],
    [
      {
        name: "Invented",
        routine: [pass("m")],
        sum: "PixelHelperActor[8].getBehavior(A B).x",
      },
      /sum/,
    ],
  ] as const) {
    const out = sketch(root);
    expect(out.ok ? "loaded" : out.reason, JSON.stringify(root)).toMatch(
      reason,
    );
  }
});

test("a root with a short list of numbers as an argument and an item of its result (T159)", () => {
  const sketch = (root: object) =>
    parseBlueprint({ id: "invented-number", root }, ctx);
  const ref = (args: unknown[]) => ({ call: "TotalTalentPoints", args });
  expect(
    sketch({ name: "Invented", ref: ref([[0, 0, 0, 0, 0, 0]]), item: 5 }),
  ).toMatchObject({ ok: true, stage: "sketch" });
  for (const [root, reason] of [
    [{ name: "Invented", ref: ref([[0, 0, 0, 0, 0, 0, 0, 0, 0]]) }, /args/],
    [{ name: "Invented", ref: ref([[0, "a"]]) }, /args/],
    [{ name: "Invented", ref: ref([[]]) }, /args/],
    [{ name: "Invented", ref: ref([[0]]), item: -1 }, /item/],
    [{ name: "Invented", ref: ref([[0]]), item: 1.5 }, /item/],
    [{ name: "Invented", combine: "sum", calls: [ref([0])], item: 0 }, /item/],
  ] as const) {
    const out = sketch(root);
    expect(out.ok ? "loaded" : out.reason, JSON.stringify(root)).toMatch(
      reason,
    );
  }
});

test("a part may name the branch of its loop's turns by the list it searches (T163), and only a part", () => {
  const sketch = (root: object) =>
    parseBlueprint({ id: "invented-number", root }, ctx);
  const ref = { call: "Invented", args: ["Reset", 0, 0] };
  const part = [{ read: "A[1]" }];
  expect(
    sketch({ name: "Invented", ref, part, branch: "InventedLists[3]" }),
  ).toMatchObject({ ok: true, stage: "sketch" });
  for (const [root, reason] of [
    [{ name: "Invented", ref, branch: "InventedLists[3]" }, /branch/],
    [{ name: "Invented", ref, part, branch: "A[1] + B[2]" }, /branch/],
    [{ name: "Invented", ref, part, branch: 3 }, /branch/],
    // a character's index written out, as the ref.read refuses it (FR-007)
    [
      { name: "Invented", ref, part, branch: "PlayerDATABASE[0].Lists[3]" },
      /branch/,
    ],
  ] as const) {
    const out = sketch(root);
    expect(out.ok ? "loaded" : out.reason, JSON.stringify(root)).toMatch(
      reason,
    );
  }
});

test("a character's index written out in the branch or the sum is refused by that reason, as the ref.read is", () => {
  const sketch = (root: object) =>
    parseBlueprint({ id: "invented-number", root }, ctx);
  const ref = { call: "Invented", args: ["Reset", 0, 0] };
  const event = {
    slot: 0,
    behavior: "ActorEvents_29",
    event: "_customEvent_B",
  };
  for (const [root, where] of [
    [
      {
        name: "Invented",
        ref,
        part: [{ read: "A[1]" }],
        branch: "PlayerDATABASE[0].Lists[3]",
      },
      "branch",
    ],
    [
      { name: "Invented", routine: event, sum: "PlayerDATABASE[0].Board[*]" },
      "sum",
    ],
  ] as const) {
    const out = sketch(root);
    expect(out.ok ? "loaded" : out.reason).toBe(
      `root: índice de personagem por extenso no ${where}`,
    );
  }
});

test("an item never goes with a part, and a list of numbers is an argument of the root's call only", () => {
  const sketch = (root: object) =>
    parseBlueprint({ id: "invented-number", root }, ctx);
  const list = { call: "TotalTalentPoints", args: [[0, 0, 0, 0, 0, 0]] };
  for (const [root, reason] of [
    [
      { name: "Invented", ref: list, item: 1, part: [{ read: "A[1]" }] },
      /item/,
    ],
    [
      {
        name: "Invented",
        ref: { call: "Invented", args: [0] },
        part: [list],
      },
      /lista/,
    ],
    [{ name: "Invented", combine: "sum", calls: [list] }, /lista/],
  ] as const) {
    const out = sketch(root);
    expect(out.ok ? "loaded" : out.reason, JSON.stringify(root)).toMatch(
      reason,
    );
  }
});
