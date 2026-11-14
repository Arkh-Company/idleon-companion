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

/** The rows of a part's Game details, and the line its Copy puts on the clipboard. */
export function gameDetails(
  n: TreeNode,
  name: string,
): { rows: [label: string, line: ReactNode][]; line: string } {
  const call = n.code ?? "";
  const exact = exactText(n);
  return {
    rows: [
      [`Game call: ${call}`, detail("Game call", call)],
      [`Exact value: ${exact}`, detail("Exact value", exact)],
    ],
    line: [name, call, exact].map(field).join("\t"),
  };
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
      // The region empties first: the same sentence again is a change, so the reader says it at each Copy.
      announce?.("");
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
