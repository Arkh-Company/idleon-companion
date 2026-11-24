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
  expect(lockTally(lock(chainInput(bp)))).toEqual({
    passed: 24,
    failed: 0,
    pending: 1,
  });
  expect(
    lockTally({
      ok: false,
      errors: [
        { kind: "leafType", where: "b" },
        { kind: "pending", where: "pools/0/groups/0/sources/1", got: "name" },
        { kind: "pending", where: "pools/0/groups/0/sources/2", got: "leaf" },
      ],
      counts: { closed: 1, closedByRecorded: 0, leaves: 1, branches: 0 },
      closedAt: ["a"],
      pendingAt: ["b", "c"],
    }),
  ).toEqual({ passed: 1, failed: 1, pending: 1 });
});
