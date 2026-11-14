// Game details, the last layer of a row (spec 008 US13, FR-030; design.md C10): the game's call and the exact value, and
// Copy, which puts only the row's name, the call and the raw number on the clipboard, one line separated by tabs. The
// call keeps the character's index the calculator wrote, never a name. After a copy the row says "Copied" for 2 s, and
// the sentence goes through the page's polite region (§3.8), never an aria-live of its own.
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { TreeNode } from "../shared/index.ts";
import { valueText } from "./tree-text.ts";

const COPY = "Copy";
const COPIED = "Copied";
const COPY_FAILED = "Could not copy";
const COPIED_MS = 2_000;

const detail = (term: string, text: string) => (
  <>
    <span className="name">{term}</span>
    <span className="code">{text}</span>
  </>
);

/** Every decimal up to 6, no trailing zeros and no thousands separator; a yes, a no or a dash as on screen. */
const exactText = (n: TreeNode): string =>
  typeof n.value === "number"
    ? String(Number(n.value.toFixed(6)))
    : valueText(n);

/** A tab or a line break inside a field would make another field or line: it becomes a space. */
const field = (text: string) => text.replace(/[\t\r\n]+/g, " ");

type Rows = [label: string, line: ReactNode][];

/** A state read: a path, never a call, which always ends with its arguments. */
const isRead = (code: string | null): boolean =>
  code !== null && !code.endsWith(")");

/** The rows of a part's Game details, and the line its Copy puts on the clipboard. A read says what it reads, and a
 * call the reads among its rows open now. */
export function gameDetails(
  n: TreeNode,
  name: string,
): { rows: Rows; line: string } {
  const call = n.code ?? "";
  const exact = exactText(n);
  const own = isRead(n.code);
  const reads = own
    ? [n]
    : n.kids === "lazy"
      ? []
      : n.kids.filter((k) => isRead(k.code));
  // ponytail: every read in one line; a cap with "and N more" when a call reads dozens.
  const readLine = reads
    .map((r) => `${r.code ?? ""} = ${exactText(r)}`)
    .join(", ");
  return {
    rows: [
      ...(own ? [] : [[`Game call: ${call}`, detail("Game call", call)]]),
      ...(reads.length
        ? [[`Reads: ${readLine}`, detail("Reads", readLine)]]
        : []),
      [`Exact value: ${exact}`, detail("Exact value", exact)],
    ] as Rows,
    line: [name, call, exact].map(field).join("\t"),
  };
}

/** What the root's Game details counts of the whole tree, from the data, for whoever compares it with the bench. */
export function treeCounts(root: TreeNode): {
  rows: number;
  formulas: number;
  unknown: number;
  repeated: number;
  lazy: number;
} {
  const c = { rows: 0, formulas: 0, unknown: 0, repeated: 0, lazy: 0 };
  const stack = [root];
  for (let n = stack.pop(); n; n = stack.pop()) {
    c.rows++;
    if (n.formula) c.formulas++;
    if (n.leaf === "unknown" || n.flags.unknown) c.unknown++;
    if (n.flags.progress) c.repeated++;
    if (n.kids === "lazy") c.lazy++;
    else stack.push(...n.kids);
  }
  return c;
}

/** The lines of those counts: on screen the tags as the rows show them, read aloud in words. */
export function countRows(c: ReturnType<typeof treeCounts>): Rows {
  const line = (label: string, term: string, k: number): Rows[number] => {
    const text = k.toLocaleString("en-US");
    return [`${label}: ${text}`, detail(term, text)];
  };
  return [
    line("Rows in this tree", "Rows", c.rows),
    line("Rows with How it adds up", "With How it adds up", c.formulas),
    line("Rows of unknown type", "Unknown type (?)", c.unknown),
    line("Repeated steps", "Repeated steps", c.repeated),
    ...(c.lazy
      ? [line("Branches not calculated yet", "Not calculated yet", c.lazy)]
      : []),
  ];
}

/** The tree's Copy rows: the one that copied says so for 2 s; `copy` writes the line and says how it went once. */
export function useCopy(announce?: (text: string) => void): {
  label: (key: string) => string;
  copy: (key: string, line: string) => void;
} {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return {
    label: (key) => (key === copied ? COPIED : COPY),
    copy: (key, line) => {
      navigator.clipboard.writeText(line).then(
        () => {
          announce?.(COPIED);
          clearTimeout(timer.current);
          setCopied(key);
          timer.current = setTimeout(() => {
            setCopied(null);
          }, COPIED_MS);
        },
        () => {
          announce?.(COPY_FAILED);
        },
      );
    },
  };
}
