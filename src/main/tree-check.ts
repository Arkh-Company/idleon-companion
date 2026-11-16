// The main's check of what leaves the tree worker, before it reaches the window (FR-010, FR-010b, contracts/tree-worker.md):
// the fields of a TreeNode with their types, a ceiling of nodes, and only atoms in the texts. Anything else is null, and the
// pipeline shows the tree as unavailable. No electron import, so tests can load it.
import {
  CAP_KINDS,
  CONDITION_KINDS,
  isObject,
  LEAF_KINDS,
  NODE_ROLES,
  SHARE_MODES,
  VALUE_FORMATS,
} from "../shared/index.ts";
import type { TreeNode } from "../shared/index.ts";

export const MAX_TEXT = 200;
/** A node's id is its path of names, with `#n` on repeats: a deep row is long. The window's `nodeId` has the same ceiling. */
export const MAX_NODE_ID = 2_000;
/** What code looks like and a name, a table text or a game path never does: a keyword counts only before `(` (a `{`
 * is code anywhere), because a player's sentence may say "1 if you have it". */
export const CODE_SIGNS =
  /[{};]|=>|&&|\|\||==|_customBlock_|\b(?:function|return|var|let|const|new|if)\s*\(/;
/** The `code` field is the game's call or path: there, a keyword alone is code too. */
const KEYWORD = /\b(?:function|return|var|let|const|new|if)\b/;

const textUpTo =
  (max: number) =>
  (v: unknown): v is string =>
    typeof v === "string" && v.length <= max && !CODE_SIGNS.test(v);
const isText = textUpTo(MAX_TEXT);
const isTextOrNull = (v: unknown) => v === null || isText(v);
const isNodeText = textUpTo(MAX_NODE_ID);
const isCode = (v: unknown) => v === null || (isText(v) && !KEYWORD.test(v));
/** A game-bug rule's id, as `GameBugRule.id` documents it (calculator tree/game-bugs.ts), never free text. */
const isRuleId = (v: unknown) =>
  typeof v === "string" && /^[A-Za-z][A-Za-z0-9]{0,59}$/.test(v);
const isFinite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isValue = (v: unknown) =>
  v === null || typeof v === "boolean" || isFinite(v);
const oneOf =
  (list: readonly unknown[]) =>
  (v: unknown): boolean =>
    list.includes(v);
const orNull =
  (f: (v: unknown) => boolean) =>
  (v: unknown): boolean =>
    v === null || f(v);
const isShare = (v: unknown) => isFinite(v) && v >= 0 && v <= 1;

const FLAGS: Record<string, (v: unknown) => boolean> = {
  unknown: (v) => typeof v === "boolean",
  unnamed: (v) => typeof v === "boolean",
  unavailable: (v) => typeof v === "boolean",
  fromCache: (v) => typeof v === "boolean",
  fromGame: (v) => typeof v === "boolean",
  runtime: (v) => typeof v === "boolean",
  truncated: (v) => typeof v === "boolean",
  closed: (v) => typeof v === "boolean",
  progress: (v) => typeof v === "boolean",
  gameBug: isRuleId,
};

const fieldsFit = (
  v: unknown,
  fields: Record<string, (x: unknown) => boolean>,
  required: readonly string[],
): v is Record<string, unknown> =>
  isObject(v) &&
  Object.keys(v).every((k) => Object.hasOwn(fields, k) && fields[k]?.(v[k])) &&
  required.every((k) => Object.hasOwn(v, k));

/** The fields of a TreeNode but `kids`, each with its check; `kids` is walked apart, without recursion. */
const NODE: Record<string, (v: unknown) => boolean> = {
  id: isNodeText,
  pieceKey: (v) => v === null || isNodeText(v),
  name: isText,
  value: isValue,
  was: isValue,
  fmt: orNull(oneOf(VALUE_FORMATS)),
  leaf: orNull(oneOf(LEAF_KINDS)),
  condition: orNull(oneOf(CONDITION_KINDS)),
  why: isTextOrNull,
  formula: orNull(
    (f) =>
      (Array.isArray(f) &&
        f.length === 2 &&
        Array.isArray(f[0]) &&
        f[0].every(isText) &&
        Array.isArray(f[1]) &&
        f[1].every(isFinite)) ||
      // a rule: its two lines of text, as they come
      fieldsFit(
        f,
        {
          rule: (r) => Array.isArray(r) && r.length === 2 && r.every(isText),
        },
        ["rule"],
      ),
  ),
  code: isCode,
  role: oneOf(NODE_ROLES),
  share: orNull(isShare),
  shareMode: orNull(oneOf(SHARE_MODES)),
  cap: oneOf(CAP_KINDS),
  maxReached: (m) =>
    fieldsFit(m, { share: isShare, max: isFinite }, ["share", "max"]),
  feeds: (n) => Number.isInteger(n) && (n as number) >= 2,
  flags: (f) => fieldsFit(f, FLAGS, []),
  kids: (k) => k === "lazy" || Array.isArray(k),
};
const REQUIRED = Object.keys(NODE).filter(
  (k) => !["was", "cap", "maxReached", "feeds"].includes(k),
);

/** The tree, unchanged, when every node fits and there are at most `maxNodes`; null otherwise. */
export function checkTree(raw: unknown, maxNodes: number): TreeNode | null {
  const pending: unknown[] = [raw];
  let seen = 0;
  while (pending.length > 0) {
    const n = pending.pop();
    seen++;
    if (seen > maxNodes || !fieldsFit(n, NODE, REQUIRED)) return null;
    const kids = n.kids === "lazy" ? [] : (n.kids as unknown[]);
    // Counted before the push: a list longer than the ceiling never spreads.
    if (seen + pending.length + kids.length > maxNodes) return null;
    pending.push(...kids);
  }
  return raw as TreeNode;
}
