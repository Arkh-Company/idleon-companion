// The known bugs of the game (spec 008 FR-016; design.md C7): a block that counts the same source twice. Each row the rule
// finds keeps the value the game calculates and gets the rule's id in `flags.gameBug`; the window shows the tag and its
// phrase. A rule enters only with its proof by reference (the block, the argument and the place in the game's code that
// counts twice), never with the game's text (FR-032).
export interface GameBugRule {
  /** The id the row carries, never free text. */
  id: string;
  /** The call of the block that counts twice, by its game call. */
  in: RegExp;
  /** The source it counts twice, by its game call or path. */
  test: RegExp;
  proof: string;
}

/** Empty until the bench's audited rules are ported (US1b-3). */
export const GAME_BUGS: readonly GameBugRule[] = [];

/** The id of the rule a row matches, inside the call `parentCode`; null when none does. */
export function gameBugOf(
  rules: readonly GameBugRule[],
  parentCode: string | null,
  code: string | null,
): string | null {
  if (parentCode === null || code === null) return null;
  return (
    rules.find((r) => r.in.test(parentCode) && r.test.test(code))?.id ?? null
  );
}
