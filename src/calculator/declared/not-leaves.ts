// The parts that enter a sum without being a row (spec 010, FR-016, research R6): the prototype found 19 undeclared
// parts in the Drop Rate, all of these five kinds. The lock lets them through its coverage; their arguments are the
// parent's declared children, and the screen shows them only in the ⓘ. A new entry comes with its reason and passes
// the checks over the 289 trees, as a shape rule does.

export interface NotLeaf {
  /** A block (with its mode, its first argument) or a path; `[*]` stands for any index. */
  match: { call: string; mode?: string } | { read: string };
  role: "curve" | "log" | "context" | "loopCounter" | "otherCharacter";
  reason: string;
}

export const NOT_LEAVES: readonly NotLeaf[] = [
  {
    match: { call: "ArbitraryCode5Inputs", mode: "decay" },
    role: "curve",
    reason:
      "A talent's curve: its top, its middle and the level are the parent's children (prototype, Drop Rate).",
  },
  {
    match: { call: "getLOG" },
    role: "log",
    reason:
      "A logarithm of a value the parent declares; it shapes the sum, it is no bonus of its own.",
  },
  {
    match: { call: "Dungon" },
    role: "context",
    reason:
      "Whether the player is in a dungeon: it picks a branch, it adds nothing.",
  },
  {
    match: { read: "CurrentMap" },
    role: "context",
    reason:
      "The map the character stands on: it picks a branch, it adds nothing.",
  },
  {
    match: { call: "GurtBonuzz" },
    role: "loopCounter",
    reason:
      "A counter of the game's loop over a list; the list's entries are the rows.",
  },
  {
    match: { read: "PlayerDATABASE[*]" },
    role: "otherCharacter",
    reason:
      "A read of another character, compared in a choice of the best one (research R5).",
  },
];

const CALL = /^([A-Za-z_$][\w$]*)\((.*)\)$/;
const firstArg = (args: string): unknown => {
  try {
    return (JSON.parse(`[${args}]`) as unknown[])[0];
  } catch {
    return undefined;
  }
};
const readPattern = (read: string) =>
  new RegExp(
    `^${read
      .split("[*]")
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\[\\d+\\]")}(?:$|[.[])`,
  );

/** The entry a reference key (`Block(args)` or a path) falls under, or null for an ordinary part. */
export function notLeafOf(key: string): NotLeaf | null {
  const call = CALL.exec(key);
  return (
    NOT_LEAVES.find(({ match }) =>
      "call" in match
        ? call?.[1] === match.call &&
          (match.mode === undefined || firstArg(call[2] ?? "") === match.mode)
        : !call && readPattern(match.read).test(key),
    ) ?? null
  );
}
