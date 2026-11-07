// Steam's text KeyValues (research R4): a small reader that keeps where each value sits, so writing the launch option
// replaces only that value's text and the rest of the file stays byte for byte. No electron, no child_process.

/** A key with a string `value` or a block of `children`; `[start, end)` is the value's raw text (inside the quotes, or
 * between `{` and `}`). */
export interface VdfNode {
  key: string;
  value?: string;
  children?: VdfNode[];
  start: number;
  end: number;
}

/** The text is not the KeyValues shape expected: nothing is written. */
export class VdfShapeError extends Error {
  override name = "VdfShapeError";
}

const LOCAL_APPS = [
  "UserLocalConfigStore",
  "Software",
  "Valve",
  "Steam",
  "apps",
];
const UNESCAPE: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  n: "\n",
  t: "\t",
};

type Token =
  | { kind: "string"; value: string; start: number; end: number }
  | { kind: "{" | "}"; start: number }
  | { kind: "eof"; start: number };

function tokenizer(text: string): () => Token {
  let i = 0;
  return () => {
    for (;;) {
      while (i < text.length && /\s/.test(text.charAt(i))) i++;
      if (!text.startsWith("//", i)) break;
      const nl = text.indexOf("\n", i);
      i = nl < 0 ? text.length : nl + 1;
    }
    const start = i;
    const c = text.charAt(i);
    if (i >= text.length) return { kind: "eof", start };
    if (c === "{" || c === "}") {
      i++;
      return { kind: c, start };
    }
    if (c !== '"')
      throw new VdfShapeError(`unexpected character at ${String(i)}`);
    let value = "";
    i++;
    for (;;) {
      if (i >= text.length) throw new VdfShapeError("unterminated string");
      const ch = text.charAt(i);
      if (ch === '"') break;
      if (ch === "\\" && i + 1 < text.length) {
        const next = text.charAt(i + 1);
        value += UNESCAPE[next] ?? ch + next; // an unknown escape stays as it was written
        i += 2;
      } else {
        value += ch;
        i++;
      }
    }
    i++;
    return { kind: "string", value, start: start + 1, end: i - 1 };
  };
}

/** Parses the whole text; the root has key "" and the top-level keys as children. Throws VdfShapeError. */
export function parseVdf(text: string): VdfNode {
  const next = tokenizer(text);
  const block = (inner: boolean): { children: VdfNode[]; end: number } => {
    const children: VdfNode[] = [];
    for (;;) {
      const key = next();
      if (key.kind === "eof") {
        if (inner) throw new VdfShapeError("unclosed block");
        return { children, end: text.length };
      }
      if (key.kind === "}") {
        if (!inner) throw new VdfShapeError("closing brace without a block");
        return { children, end: key.start };
      }
      if (key.kind !== "string")
        throw new VdfShapeError("a block without a key");
      const v = next();
      if (v.kind === "string") {
        children.push({
          key: key.value,
          value: v.value,
          start: v.start,
          end: v.end,
        });
      } else if (v.kind === "{") {
        const b = block(true);
        children.push({
          key: key.value,
          children: b.children,
          start: v.start + 1,
          end: b.end,
        });
      } else {
        throw new VdfShapeError(`key "${key.value}" without a value`);
      }
    }
  };
  const b = block(false);
  return { key: "", children: b.children, start: 0, end: b.end };
}

const child = (n: VdfNode, key: string): VdfNode | undefined =>
  n.children?.find((c) => c.key.toLowerCase() === key.toLowerCase());

/** The node at `path` under `root`, keys compared case-insensitively (Steam has written both `apps` and `Apps`). */
export function findPath(root: VdfNode, path: string[]): VdfNode | undefined {
  let n: VdfNode | undefined = root;
  for (const key of path) n = n && child(n, key);
  return n;
}

/** The launch option of `appId` in a localconfig.vdf text, unescaped; undefined when it is not there. */
export function getLaunchOptions(
  text: string,
  appId: string,
): string | undefined {
  return findPath(parseVdf(text), [...LOCAL_APPS, appId, "LaunchOptions"])
    ?.value;
}

const escape = (s: string) => s.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

/** Inserts `lines` (each without indentation or line end) as the last children of `block`, one tab deeper than the
 * line of its closing brace. */
function insertInto(text: string, block: VdfNode, lines: string[]): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lineStart = text.lastIndexOf("\n", block.end - 1) + 1;
  const indent = text.slice(lineStart, block.end);
  if (/^[ \t]*$/.test(indent)) {
    const body = lines.map((l) => `${indent}\t${l}${eol}`).join("");
    return text.slice(0, lineStart) + body + text.slice(lineStart);
  }
  // ponytail: a closing brace sharing its line (Steam never writes it so): the lines go before it, unindented
  const body = lines.map((l) => `${eol}${l}`).join("") + eol;
  return text.slice(0, block.end) + body + text.slice(block.end);
}

/** The localconfig.vdf text with `appId`'s launch option set to `option`: only that value's text changes, or one line
 * (or the app's block) is inserted. Throws VdfShapeError when the text has no apps block. */
export function setLaunchOptions(
  text: string,
  appId: string,
  option: string,
): string {
  const apps = findPath(parseVdf(text), LOCAL_APPS);
  if (!apps?.children)
    throw new VdfShapeError("no apps block in localconfig.vdf");
  const line = `"LaunchOptions"\t\t"${escape(option)}"`;
  const app = child(apps, appId);
  if (!app)
    return insertInto(text, apps, [
      `"${escape(appId)}"`,
      "{",
      `\t${line}`,
      "}",
    ]);
  if (!app.children) throw new VdfShapeError(`app ${appId} is not a block`);
  const lo = child(app, "LaunchOptions");
  if (!lo) return insertInto(text, app, [line]);
  if (lo.value === undefined)
    throw new VdfShapeError("LaunchOptions is not a string");
  return text.slice(0, lo.start) + escape(option) + text.slice(lo.end);
}
