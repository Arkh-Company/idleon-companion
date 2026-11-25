// A source zeroed by an early return shows its children (spec 010, T183; FR-018 of the 009: "every value a system
// influences MUST show that system as a child, even when the contribution is 0"). The invented game (fake-game.js,
// TreeGateRoot) gives TreeLevel + TreeGateBonus(), the bonus 0 because its gate TreeOwned is 0, before its count.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import { stepsGuide } from "./draft-steps.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const ID = "invented-zeroed";

function lockWith(
  gate: Partial<BlueprintNode>,
  [root, call, final] = ["TreeGateRoot", "TreeGateBonus", 25],
  attrs: object = {},
) {
  const out = parseBlueprint(
    {
      id: ID,
      root: {
        name: "Invented",
        ref: { call: root, args: [0, 0, 0] },
      },
      pools: [
        {
          kind: "additive",
          groups: [
            {
              system: "cards",
              sources: [
                {
                  key: "level",
                  name: "Invented Level",
                  ref: { read: "TreeLevel" },
                  leaf: "level",
                },
                {
                  key: "gate",
                  name: "Invented Gate",
                  ref: { call, args: [] },
                  ...gate,
                },
              ],
            },
          ],
        },
      ],
    },
    { fileId: ID, systemIds: new Set(["cards"]) },
  );
  if (!out.ok) throw new Error(out.reason);
  const { key, ...input } = recorded(root, attrs);
  expect(key.final).toBe(final);
  return lockBlueprint({
    blueprint: out.blueprint,
    key,
    ...input,
    character: 0,
    characterClass: 3,
  });
}

test("a source that returns 0 early closes with the children it read before the return", () => {
  const lock = lockWith({
    children: [
      {
        key: "owned",
        name: "Invented Owned",
        ref: { read: "TreeOwned" },
        leaf: "quantity",
      },
    ],
  });
  expect(lock.errors).toEqual([]);
});

test("the zeroed source asks for what it read: with no child it is a leaf that has one", () => {
  const lock = lockWith({ leaf: "rawBonus" });
  expect(lock.errors).toContainEqual({
    kind: "leafHasChildren",
    where: "invented-zeroed/0/cards/gate",
    got: "TreeOwned",
  });
});

// A call that returns a read with no step of its own (a cache, a table's cell; the LUK's GetSetBonus, Companions): the
// read, the last thing the call did, is its level (fake-game.js, TreeBareRoot).
test("a call that returns a bare read closes by that read, its unused step aside", () => {
  const lock = lockWith(
    {
      children: [
        {
          key: "big",
          name: "Invented Big",
          ref: { read: "TreeBig.k2" },
          leaf: "quantity",
        },
      ],
    },
    ["TreeBareRoot", "TreeBareRead", 32],
  );
  expect(lock.errors).toEqual([]);
});

// A literal the code picks by a test, with no step nor call of its own (the LUK's AchieveStatus: 1 when the
// achievement is done): its reads are its children (fake-game.js, TreeDoneRoot).
test("a call that returns a literal by a test closes with the read it tested", () => {
  const lock = lockWith(
    {
      children: [
        {
          key: "owned",
          name: "Invented Owned",
          ref: { read: "TreeOwned" },
          leaf: "condition",
        },
      ],
    },
    ["TreeDoneRoot", "TreeDone", 26],
  );
  expect(lock.errors).toEqual([]);
});

// A literal the code picks by a test on a text of the save, with no part the recording ties (the game's SuperBitType: a
// letter in Gaming[12]): the call goes down to that read, a condition (T195; fake-game.js, TreeBitRoot).
test("a call that returns a literal by a test on a text of the save goes down to that read, in the draft and in the lock (T195)", () => {
  const { rec, key, ops } = recorded("TreeBitRoot");
  const ref = { call: "TreeBitRoot", args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  const bit = draft.pools[0]?.groups
    .flatMap((g) => g.sources)
    .find((s) => s.ref && "call" in s.ref && s.ref.call === "TreeBit");
  expect(bit?.children?.map((c) => c.ref)).toEqual([{ read: "TreeLabel" }]);
  expect(draft.pending).not.toContainEqual({
    where: expect.stringMatching(/sources\/0$/) as string,
    kind: "descend",
  });
  const lock = lockWith(
    {
      children: [
        {
          key: "label",
          name: "Invented Label",
          ref: { read: "TreeLabel" },
          leaf: "condition",
          conditionKind: "owned",
        },
      ],
    },
    ["TreeBitRoot", "TreeBit", 26],
  );
  expect(lock.errors).toEqual([]);
});

// The same literal, with a second text of the save read aside, after the tested one (fake-game.js, TreeBitTwo) and
// before it (TreeBitTwoBefore): the call goes down to the read the test reads, by its place in the code, never by
// the order of the reads (T195).
test.each([
  ["TreeBitTwoRoot", "TreeBitTwo"],
  ["TreeBitTwoBeforeRoot", "TreeBitTwoBefore"],
])(
  "a call that reads two texts of the save and tests one goes down to that one only: %s (T195)",
  (root, call) => {
    const { rec, key, ops } = recorded(root, {
      TreeOtherLabel: "Other label",
    });
    const ref = { call: root, args: [0, 0, 0] };
    const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
    const bit = draft.pools[0]?.groups
      .flatMap((g) => g.sources)
      .find((s) => s.ref && "call" in s.ref && s.ref.call === call);
    expect(bit?.children?.map((c) => c.ref)).toEqual([{ read: "TreeLabel" }]);
  },
);

// ...and the lock takes that child only as a condition (T195).
test("a call that reads two texts of the save and tests one goes down to that one only, a condition (T195)", () => {
  const attrs = { TreeOtherLabel: "Other label" };
  const { rec, key, ops } = recorded("TreeBitTwoRoot", attrs);
  const ref = { call: "TreeBitTwoRoot", args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  const bit = draft.pools[0]?.groups
    .flatMap((g) => g.sources)
    .find((s) => s.ref && "call" in s.ref && s.ref.call === "TreeBitTwo");
  expect(bit?.children?.map((c) => c.ref)).toEqual([{ read: "TreeLabel" }]);
  const label = (leaf: Partial<BlueprintNode>) =>
    lockWith(
      {
        children: [
          {
            key: "label",
            name: "Invented Label",
            ref: { read: "TreeLabel" },
            ...leaf,
          },
        ],
      },
      ["TreeBitTwoRoot", "TreeBitTwo", 26],
      attrs,
    ).errors;
  expect(label({ leaf: "condition", conditionKind: "owned" })).toEqual([]);
  expect(label({ leaf: "quantity" })).toContainEqual({
    kind: "childNoValue",
    where: "invented-zeroed/0/cards/gate/label",
  });
});

test("the draft writes the text the test reads as a condition leaf, its kind left to the agent (T195)", () => {
  const attrs = { TreeOtherLabel: "Other label" };
  const { rec, key, ops } = recorded("TreeBitTwoRoot", attrs);
  const ref = { call: "TreeBitTwoRoot", args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  const places = draft.pools.flatMap((p, i) =>
    p.groups.flatMap((g, j) =>
      g.sources.map((s, k) => ({
        s,
        where: `pools/${String(i)}/groups/${String(j)}/sources/${String(k)}`,
      })),
    ),
  );
  const bit = places.find(
    ({ s }) => s.ref && "call" in s.ref && s.ref.call === "TreeBitTwo",
  );
  const label = bit?.s.children?.[0];
  expect(label?.leaf).toBe("condition");
  expect(label?.conditionKind).toBeUndefined();
  expect(draft.pending).not.toContainEqual({
    where: `${bit?.where ?? ""}/children/0`,
    kind: "leaf",
  });
});

test("the guide asks only for the condition's kind on the text the test reads (T195)", () => {
  const { rec, key, ops } = recorded("TreeBitTwoRoot", {
    TreeOtherLabel: "Other label",
  });
  const guide = stepsGuide(key, rec, ops);
  const at = guide
    .split("\n")
    .findIndex((l) => l.trim().startsWith("TreeLabel"));
  expect(guide.split("\n")[at + 1]?.trim()).toBe(
    "folha: condition; tipo da condição (conditionKind) pendente",
  );
});
