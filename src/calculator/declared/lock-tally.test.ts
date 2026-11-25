// The tally of a checked blueprint (T199 r1, r2; `summary.txt`): it counts nodes, each in one of passed, failed and
// pending. The invented Drop Rate: TreeDeclChain and its blueprint decl-chain.
import { expect, test } from "vitest";
import { chainInput, inventedBlueprint } from "./lock-fixture.ts";
import { lockBlueprint as lock, lockTally } from "./lock.ts";

test("the tally counts nodes: a pending one with two kinds once, and a failed one only as failed (r2)", () => {
  const bp = inventedBlueprint("decl-chain");
  bp.pending = [
    { where: "pools/0/groups/2/sources/0", kind: "name" },
    { where: "pools/0/groups/2/sources/0", kind: "descend" },
  ];
  expect(lockTally(lock(chainInput(bp)), bp)).toEqual({
    passed: 24,
    failed: 0,
    pending: 1,
  });
  const [a, b, c] = [
    "decl-chain/0/cards/capped",
    "decl-chain/0/shrines/stock",
    "decl-chain/0/bundles/bundle",
  ];
  expect(
    lockTally(
      {
        ok: false,
        errors: [
          { kind: "leafType", where: b },
          { kind: "pending", where: "pools/0/groups/0/sources/1", got: "name" },
          { kind: "pending", where: "pools/0/groups/0/sources/2", got: "leaf" },
        ],
        counts: { closed: 1, closedByRecorded: 0, leaves: 1, branches: 0 },
        closedAt: [a],
        pendingAt: [b, c],
      },
      bp,
    ),
  ).toEqual({ passed: 1, failed: 1, pending: 1 });
});

test("the tally counts as failed only a node: a model child's items as the model, never the root nor a pool (r3)", () => {
  const at = "decl-chain/0/family-bonuses/best";
  expect(
    lockTally(
      {
        ok: false,
        errors: [
          { kind: "rootForm", where: "root", got: "two" },
          { kind: "missingSource", where: "pool:0" },
          { kind: "leafType", where: `${at}/best-lv` },
          { kind: "notClosing", where: `${at}/best-lv-3` },
          { kind: "notClosing", where: `${at}/best-lv-4` },
        ],
        counts: { closed: 2, closedByRecorded: 0, leaves: 1, branches: 1 },
        closedAt: ["root", at, `${at}/best-lv-5`],
        pendingAt: [],
      },
      inventedBlueprint("decl-chain"),
    ),
  ).toEqual({ passed: 2, failed: 1, pending: 0 });
});

test("an error inside a piece fails the node that calls it, and the piece's places below it are no pass", () => {
  const line = "decl-chain/0/cards/capped";
  expect(
    lockTally(
      {
        ok: false,
        errors: [{ kind: "notClosing", where: `${line}/1/chips/chip` }],
        counts: { closed: 2, closedByRecorded: 0, leaves: 1, branches: 1 },
        closedAt: ["decl-chain/0/shrines/stock", `${line}/0/signs/sign-3`],
        pendingAt: [],
      },
      inventedBlueprint("decl-chain"),
    ),
  ).toEqual({ passed: 1, failed: 1, pending: 0 });
});
