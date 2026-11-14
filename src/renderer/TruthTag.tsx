// The honesty tags of a tree row (spec 008 FR-012, FR-016; design.md C7): each case that does not close has its tag,
// always in text, never by color alone, read aloud with no loose symbol, and its phrase in the row's detail. A game bug
// keeps the game's value: the tag says so, the number is never corrected. `zeroes the total` takes the share's place
// (tree-text.ts `shareText`), and the version band is one for the tree (VersionBand.tsx).
import type { TreeNode } from "../shared/index.ts";

export interface Truth {
  /** The tag on screen. */
  text: string;
  /** The tag in the row's accessible name. */
  spoken: string;
  /** What the row's detail says; null where design.md C7 has no phrase yet. */
  phrase: string | null;
}

const truth = (text: string, phrase: string | null, spoken = text): Truth => ({
  text,
  spoken,
  phrase,
});

const UNKNOWN = truth("?", null, "unknown type");
const UNNAMED = truth("no name yet", "No player name yet for this game value.");
const UNAVAILABLE = truth(
  "unavailable",
  "Could not be calculated with this reading. The rest is still right.",
);
const FROM_CACHE = truth(
  "saved by the game",
  "The game had this result saved. Open it to see how the game worked it out.",
);
const FROM_GAME = truth(
  "from the game",
  "Read straight from the running game. Nothing to open below it.",
);
const RUNTIME = truth(
  "changes while you play",
  "The game changes this value while it runs.",
);
// ponytail: C7's phrase without its "open it on its own" part, until that button exists.
const TRUNCATED = truth(
  "stopped here",
  "This part is too big to show whole here.",
);
const OVER_THE_CAP = truth(
  "over the cap",
  "A limit decides this number right now, so this part changes nothing today.",
);
const NOT_REACHED = truth("not reached", null);
const PROGRESS = truth("repeated step", null);
const GAME_BUG = truth(
  "game bug: counted twice",
  "The game itself counts this twice. The app shows what the game calculates.",
  "game bug, counted twice",
);

/** The honesty tags of a row, in the order of the FR-012 table; `unknown` is the "?" of the leaf tag when it has one. */
export function truthTags(n: TreeNode): Truth[] {
  const f = n.flags;
  const out: Truth[] = [];
  if (f.unknown && n.leaf !== "unknown") out.push(UNKNOWN);
  if (f.unnamed) out.push(UNNAMED);
  if (f.unavailable || n.value === null) out.push(UNAVAILABLE);
  if (f.fromCache) out.push(FROM_CACHE);
  if (f.fromGame) out.push(FROM_GAME);
  if (f.runtime) out.push(RUNTIME);
  if (f.truncated) out.push(TRUNCATED);
  if (n.cap === "overTheCap") out.push(OVER_THE_CAP);
  if (n.cap === "notReached") out.push(NOT_REACHED);
  if (f.progress) out.push(PROGRESS);
  if (f.gameBug) out.push(GAME_BUG);
  return out;
}

export function TruthTags({ tags }: { tags: readonly Truth[] }) {
  return tags.map((t) => (
    <span key={t.text} className="tag tag--truth">
      {t.text}
    </span>
  ));
}
