// A tier (spec 010, T229; FR-018 of 009): a call that returns what it set in the last turn of its loop whose test
// passed is a leaf `tier`; its ladder's tests are no children. The lock checks its value is that turn's step, by its
// place. The invented game's TreeTier over TreeLevel 25 and TreeList [1, 2, 3]: the tests 25 > 10, 25 > 20 pass and
// 25 > 30 does not, so it returns 1 + 2 = 3.
import { expect, test } from "vitest";
import { recordingOf } from "../fixtures/recording-fixture.ts";
import { instrument } from "../instrument.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { stepsGuide } from "./draft-steps.ts";
import { draftBlueprint } from "./draft.ts";
import { levelContext, recorded } from "./lock-fixture.ts";
import { lockLevels } from "./lock-levels.ts";
import { lockBlueprint } from "./lock.ts";

const TIER: BlueprintNode = {
  key: "tier",
  name: "Invented Tier",
  ref: { call: "TreeTier", args: [] },
  leaf: "tier",
};

test("the draft writes the last passing turn's call as a tier leaf: no child for its ladder's tests, nothing pending below it (T229)", () => {
  const { rec, key, ops } = recorded("TreeTierRoot");
  const ref = { call: "TreeTierRoot", args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  const groups = draft.pools[0]?.groups ?? [];
  const g = groups.findIndex((x) => {
    const ref = x.sources[0]?.ref;
    return !!ref && "call" in ref && ref.call === "TreeTier";
  });
  const tier = groups[g]?.sources[0];
  expect([tier?.ref, tier?.leaf, tier?.children]).toEqual([
    { call: "TreeTier", args: [] },
    "tier",
    undefined,
  ]);
  const at = `pools/0/groups/${String(g)}/sources/0`;
  const kinds = draft.pending.filter((p) => p.where === at).map((p) => p.kind);
  expect(kinds).not.toContain("descend");
  expect(kinds).not.toContain("leaf");
});

test("the lock passes a tier leaf on the call whose value is its last passing turn's: its ladder's reads are no children (T229)", () => {
  const out = lockBlueprint({
    blueprint: {
      id: "invented-tier",
      root: {
        name: "Invented",
        ref: { call: "TreeTierRoot", args: [0, 0, 0] },
      },
      pools: [
        {
          kind: "additive",
          groups: [
            { system: "cards", sources: [TIER] },
            {
              system: "stamps",
              sources: [
                {
                  key: "capped",
                  name: "capped",
                  ref: { read: "TreeCapped" },
                  leaf: "level",
                },
              ],
            },
          ],
        },
      ],
    },
    ...recorded("TreeTierRoot"),
    character: 0,
    characterClass: 3,
  });
  expect(out.errors).toEqual([]);
});

test("the draft waits on a descent, with the reason, for a call whose ladder's last passing test has no step after it (T229 r1)", () => {
  const { rec, key, ops } = recorded("TreeTierRoot");
  const tier = rec.nodes.find((n) => n.b === "TreeTier");
  const log = (tier?.x ?? []) as [number, unknown][];
  const last = log.findLastIndex(([o]) => ops[o]?.kind === "test");
  const end = log[last];
  if (end?.[1] !== false) throw new Error("no failing test");
  end[1] = true; // the third test passes too, and no step follows it
  const ref = { call: "TreeTierRoot", args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  const g = (draft.pools[0]?.groups ?? []).findIndex((x) => {
    const ref = x.sources[0]?.ref;
    return !!ref && "call" in ref && ref.call === "TreeTier";
  });
  expect(draft.pending).toContainEqual({
    where: `pools/0/groups/${String(g)}/sources/0`,
    kind: "descend",
  });
  expect(stepsGuide(key, rec, ops)).toContain(
    "descer: pendente (o valor de TreeTier() não é o passo da volta do último teste que passou, pelo lugar: não é a forma do tier (T229))",
  );
});

/** A ladder written by hand, `lv = r + 2` under each turn's test, its step log `log` of tests and steps; the lock's errors. */
function ladder(log: ("pass" | "fail" | "step")[]) {
  const { ops } = instrument(
    "Blocks._customBlock_T = function () { var lv = 1; for (var r = 0; r < 3; r++) if (s.L[r] > 0) lv = r + 2; return lv; };",
  );
  const test = ops.findIndex((o) => o.kind === "test");
  const step = ops.findIndex((o) => o.kind === "op");
  const r = ops.findIndex(
    (o, i) => o.kind === "leaf" && o.parent === step && i > step,
  );
  let turn = -1;
  const x = log.flatMap((e): [number, number | boolean][] => {
    if (e !== "step") {
      turn++;
      return [[test, e === "pass"]];
    }
    return [
      [r, turn],
      [step, turn + 2],
    ];
  });
  const rec = recordingOf([{ b: "T", v: 3, x, r: [["L[0]", 1]] }]);
  return lockLevels(TIER_T, rec.nodes[0] as never, {
    ...levelContext(rec, ops, "t"),
    ops,
  }).errors;
}
const TIER_T: BlueprintNode = { ...TIER, ref: { call: "T", args: [] } };
const NOT_TIER =
  "o valor de T() não é o passo da volta do último teste que passou, pelo lugar: não é a forma do tier (T229)";

test("the tier's value is the step of the last turn whose test passed, by its place: never an earlier passing turn's, nor one after a test that failed (T229)", () => {
  // the step right after the last passing test, before the next test
  expect(ladder(["pass", "step", "pass", "step", "fail"])).toEqual([]);
  // the last passing test has no step after it: the value is an earlier passing turn's, which the order would take
  expect(ladder(["pass", "step", "pass", "step", "pass", "fail"])).toEqual([
    { kind: "openingRefused", where: "t", got: NOT_TIER },
  ]);
  // the step comes after a test that failed
  expect(ladder(["pass", "step", "fail", "step"])).toEqual([
    { kind: "openingRefused", where: "t", got: NOT_TIER },
  ]);
});
