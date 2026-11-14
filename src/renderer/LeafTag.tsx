// The tags of a tree row (spec 008 FR-012, FR-013; design.md C4, C7, C8): the leaf type with the color of its family, the
// honesty tags, always in text, never by color alone, and the level of a row past the indent's cap.
import { LEAF_FAMILY } from "../shared/index.ts";
import type { ConditionKind, LeafKind, TreeNode } from "../shared/index.ts";

const LEAF_LABEL: Record<LeafKind, string> = {
  level: "Level",
  quantity: "Quantity",
  investedPoints: "Invested points",
  tier: "Tier",
  record: "Record",
  condition: "Condition",
  choice: "Choice",
  fixedValue: "Fixed value",
  rawBonus: "Raw bonus",
  unknown: "?",
};

const CONDITION_LABEL: Record<ConditionKind, string> = {
  owned: "owned",
  done: "done",
  active: "active",
  equalsValue: "equals a value",
  max: "max",
  limit: "limit",
};

const CONDITION_QUESTION: Record<ConditionKind, string> = {
  owned: "Do you have it (bought, built, found or unlocked)?",
  done: "Did you finish it?",
  active: "Is it on or equipped right now?",
  equalsValue: "Is it set to exactly this value, like the vote of the week?",
  max: "Is it at max level?",
  limit: "Did it pass this limit, like level above 0?",
};

const LEAF_PHRASE: Record<LeafKind, string> = {
  level: "A level you upgraded. Raise it in this item's menu.",
  quantity: "A count you grow by collecting or killing more.",
  investedPoints: "Points you put in. Spend more points here to raise it.",
  tier: "A rank step, like a sigil colour or an artifact form. The next tier gives more.",
  record: "Your best result so far. Beat it to raise the bonus.",
  condition:
    "A yes or no check the calculation uses. How it adds up shows what each answer does.",
  choice: "Something you selected. Change the pick to change the bonus.",
  fixedValue: "Set by the game. You can't change it.",
  // FR-013: the spec's phrase and family, over the design's.
  rawBonus: "Set by the game: the bonus this source gives.",
  unknown:
    "We don't know yet what kind of number this is. The number itself is right: it comes from the game.",
};

const FAMILY_SENTENCE = {
  grows: "You can raise this.",
  pick: "You unlock or pick this.",
  set: "",
} as const;

const familyOf = (leaf: LeafKind) => LEAF_FAMILY[leaf] ?? "unknown";

/** The tag's text, also for the row's accessible name. */
export function leafLabel(n: Pick<TreeNode, "leaf" | "condition">): string {
  if (!n.leaf) return "";
  if (n.leaf === "unknown") return "unknown type";
  const label = LEAF_LABEL[n.leaf];
  return n.leaf === "condition" && n.condition
    ? `${label}, ${CONDITION_LABEL[n.condition]}`
    : label;
}

/** What the leaf's detail says first: the family in text, then the type's phrase (design.md C4). */
export function leafPhrase(n: Pick<TreeNode, "leaf" | "condition">): string {
  if (!n.leaf) return "";
  const family = LEAF_FAMILY[n.leaf];
  return [
    family ? FAMILY_SENTENCE[family] : "",
    LEAF_PHRASE[n.leaf],
    n.leaf === "condition" && n.condition
      ? CONDITION_QUESTION[n.condition]
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function LeafTag({ n }: { n: Pick<TreeNode, "leaf" | "condition"> }) {
  if (!n.leaf) return null;
  const family = familyOf(n.leaf);
  return (
    <span className={`tag tag--${family}`}>
      {LEAF_LABEL[n.leaf]}
      {n.leaf === "condition" && n.condition && (
        <>
          <span aria-hidden="true"> · </span>
          {CONDITION_LABEL[n.condition]}
        </>
      )}
    </span>
  );
}

/** The honesty tags of a row (FR-012), in the order of the table; `unknown` is the "?" of the leaf tag when it has one. */
export function truthTags(n: TreeNode): string[] {
  const f = n.flags;
  const out: string[] = [];
  if (f.unknown && n.leaf !== "unknown") out.push("?");
  if (f.unnamed) out.push("no name yet");
  if (f.unavailable || n.value === null) out.push("unavailable");
  if (f.fromCache) out.push("saved by the game");
  if (f.fromGame) out.push("from the game");
  if (f.runtime) out.push("changes while you play");
  if (f.truncated) out.push("stopped here");
  if (n.cap === "overTheCap") out.push("over the cap");
  if (n.cap === "notReached") out.push("not reached");
  if (f.progress) out.push("repeated step");
  if (f.gameBug) out.push("game bug: counted twice");
  return out;
}

export function TruthTags({ tags }: { tags: string[] }) {
  return tags.map((t) => (
    <span key={t} className="tag tag--truth">
      {t}
    </span>
  ));
}

/** The indent stops growing past these depths: 6 levels, 4 in a narrow panel (styles.css, FR-031). */
export const WIDE_CAP = 6;
const NARROW_CAP = 4;

/** Past the indent's cap the row says its level; aria-level says it to the reader (design.md C8). */
export function LevelTag({ level }: { level: number }) {
  if (level - 1 <= NARROW_CAP) return null;
  return (
    <span
      className={level - 1 > WIDE_CAP ? "lvl-tag" : "lvl-tag lvl-tag--narrow"}
      aria-hidden="true"
    >
      {`L${String(level)}`}
    </span>
  );
}
