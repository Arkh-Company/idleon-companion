// The main's check of what leaves the tree worker, before it reaches the window (FR-010, FR-010b, contracts/tree-worker.md):
// the fields of a TreeNode with their types, a ceiling of nodes, and only atoms in the texts. Anything else is null, and the
// pipeline shows the tree as unavailable. No electron import, so tests can load it.
import {
  CONDITION_KINDS,
  isObject,
  LEAF_KINDS,
  NODE_ROLES,
} from "../shared/index.ts";
import type { TreeNode } from "../shared/index.ts";

const MAX_TEXT = 200;
/** What code looks like and a name, a table text or a game path never does. */
const CODE =
  /[{};]|=>|&&|\|\||==|\b(?:function|return|var|let|const|new|if)\b|_customBlock_/;

const isText = (v: unknown): v is string =>
  typeof v === "string" && v.length <= MAX_TEXT && !CODE.test(v);
const isTextOrNull = (v: unknown) => v === null || isText(v);
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
  gameBug: isText,
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
  id: isText,
  pieceKey: isTextOrNull,
  name: isText,
  value: isValue,
  was: isValue,
  fmt: orNull(oneOf(["x", "%", "+"])),
  leaf: orNull(oneOf(LEAF_KINDS)),
  condition: orNull(oneOf(CONDITION_KINDS)),
  why: isTextOrNull,
  formula: orNull(
    (f) =>
      Array.isArray(f) &&
      f.length === 2 &&
      Array.isArray(f[0]) &&
      f[0].every(isText) &&
      Array.isArray(f[1]) &&
      f[1].every(isFinite),
  ),
  code: isTextOrNull,
  role: oneOf(NODE_ROLES),
  share: orNull(isShare),
  shareMode: orNull(
    oneOf([
      "sum",
      "product",
      "productZero",
      "cap",
      "capZero",
      "mixed",
      "condition",
      "unknown",
    ]),
  ),
  cap: oneOf(["overTheCap", "notReached"]),
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
