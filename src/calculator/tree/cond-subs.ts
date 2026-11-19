// The rules that give a check its subtype (pieces.cjs `condSub`, tree/conditions.ts), apart so that file stays short.
import type { CALC_CONDITION_KINDS } from "../tree-contract.ts";

type Condition = (typeof CALC_CONDITION_KINDS)[number];

/**
 * The rules of pieces.cjs `condSub`, in the bench's order (the first that holds wins, else equalsValue): each tests the
 * compared sides (`paths`), the sides with the check's text (`text`) or the comparison itself (`cmp`); `big` asks for a
 * number of 50 or more on the right, `eq` for an equality.
 */
export const COND_SUBS: readonly {
  test: RegExp;
  on: "paths" | "text" | "cmp";
  big?: true;
  eq?: true;
  condition: Condition;
  proof: string;
}[] = [
  {
    test: /AchieveReg|WeeklyBoss|QuestComplete|KillsLeft2Advance|"Tasks/,
    on: "paths",
    condition: "done",
    proof: "bench pieces.cjs condSub done",
  },
  {
    test: /BundlesReceived|Ninja[107]|Bribe|Menagerie|owned|unlock|built|bought/i,
    on: "text",
    condition: "owned",
    proof: "bench pieces.cjs condSub owned",
  },
  {
    test: /level|Upg|Lv/i,
    on: "text",
    big: true,
    eq: true,
    condition: "max",
    proof: "bench pieces.cjs condSub max, equality",
  },
  {
    test: /PrayersActive|CompanionLVz|Prisma|equipped|active/i,
    on: "text",
    condition: "active",
    proof: "bench pieces.cjs condSub active",
  },
  {
    test: /^(>|<|>=|<=)$/,
    on: "cmp",
    condition: "limit",
    proof: "bench pieces.cjs condSub limit",
  },
  {
    test: /OptionsListAccount|_GenINFO|CurrentMap|vote/i,
    on: "text",
    condition: "equalsValue",
    proof: "bench pieces.cjs condSub equal to a value",
  },
  {
    test: /level|Upg|Lv/i,
    on: "text",
    big: true,
    condition: "max",
    proof: "bench pieces.cjs condSub max",
  },
];
