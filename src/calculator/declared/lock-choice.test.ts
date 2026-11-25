// The choice among members (spec 010, T212; research R5; data-model "Escolha entre personagens"): the cache is the best
// of the members, and the descent goes on in the chosen one, by the turn that wrote it. The invented game's
// TreeAuthorBestMe keeps the best of TreeList's members, with a factor only when the best one is TreeMe, as the game's
// TalentCalc(-3) gives the talent 144 only when the best family bonus is the active character's.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { answerKey } from "./answer-key.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockMessage } from "./lock.ts";
import { lockNumber } from "./real-trees-check.ts";
import type { RecordFn } from "./real-trees-check.ts";
import { refKey } from "./refs.ts";

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const call = (
  key: string,
  ref: { call: string; args: (string | number)[] },
  children: BlueprintNode[],
): BlueprintNode => ({ key, name: key, ref, children });
const blueprint: Blueprint = {
  id: "invented-choice",
  root: { name: "Invented", ref: { call: "TreeAuthorRead", args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        {
          system: "cards",
          sources: [
            {
              key: "cache",
              name: "cache",
              ref: { read: "DNSM.TreeAuthor.v" },
              children: [
                call("author", { call: "TreeAuthorBestMe", args: [] }, [
                  call("item", { call: "TreeTurnItem", args: [1] }, [
                    leaf("list", "TreeList[1]"),
                  ]),
                  call("factor", { call: "TreeWriteCall", args: [] }, [
                    leaf("base", "TreeBase"),
                  ]),
                ]),
              ],
            },
          ],
        },
        { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
      ],
    },
  ],
};

/** The recording with TreeMe `me`, the running game's cache as its best: 6 × 1.08 when TreeMe is the best member, else 6. */
const recordMe = (me: number, roots: Parameters<RecordFn>[2]) => {
  const v = me === 1 ? 6 * 1.08 : 6;
  return inventedRecorder().record(
    mosaicOf({
      TreeList: [1, 3, 2],
      TreeMe: me,
      DNSM: { $m: { ...activeAs(0).DNSM.$m, TreeAuthor: { $m: { v } } } },
    }),
    roots,
    {
      recompute: [],
      builders: [
        {
          cache: "TreeAuthor",
          run: { block: "TreeAuthorBestMe", args: [] },
        },
      ],
    },
  );
};

/** One run per TreeMe. */
function lockMes(mes: readonly number[]) {
  const runs = mes.map(() => ({ character: 0, characterClass: 3 }));
  let i = 0;
  const record: RecordFn = (_mosaic, _scene, roots) =>
    recordMe(mes[i++] ?? 0, roots);
  return lockNumber(
    record,
    inventedRecorder().ops,
    blueprint,
    mosaicOf(),
    runs,
  ).lock.errors.map(lockMessage);
}

test("the chosen member's descent: a part only the run whose best is TreeMe has is no failure of the other run (T212)", () => {
  expect(lockMes([1, 0])).toEqual([]);
});

test("a part no run's chosen member has is still refused when the runs join (T212)", () => {
  expect(lockMes([0, 0])).toEqual([
    "filho fora da conta: invented-choice/0/cards/cache/author/factor",
  ]);
});

test("the draft goes down the chosen member's turn: its item and the factor of TreeMe (T212)", () => {
  const rec = recordMe(1, [["TreeAuthorRead", [0, 0, 0]]]);
  const { ops } = inventedRecorder();
  const key = answerKey(rec, ops);
  if ("error" in key) throw new Error(key.reason);
  const ref = { call: "TreeAuthorRead", args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, [
    ...ops,
  ]);
  const shape = (n: DraftNode): unknown => [
    n.ref ? refKey(n.ref, 0) : "",
    (n.children ?? []).map(shape),
  ];
  expect(draft.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    [
      "DNSM.TreeAuthor.v",
      [
        [
          "TreeAuthorBestMe()",
          [
            ["TreeTurnItem(1)", [["TreeList[1]", []]]],
            ["TreeWriteCall()", [["TreeBase", []]]],
          ],
        ],
      ],
    ],
  ]);
});
