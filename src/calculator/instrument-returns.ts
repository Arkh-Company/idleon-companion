// The returns of a block's function (spec 010, Fase 4 r2): each one that gives a block's call or a read gets
// `__R("call")` or `__R("read")` before its value, and the recorder notes the one that ran (RecNode.rt). With acorn's
// nodes as instrument.ts walks them.
import type { Node } from "acorn";

/** acorn's nodes, read by field name: the walk visits every child, whatever its type. */
export type AnyNode = Node &
  Record<string, unknown> & { range: [number, number] };

export const isNode = (v: unknown): v is AnyNode =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { type?: unknown }).type === "string";
export const at = (n: AnyNode, k: string) => n[k] as AnyNode;

export function children(node: AnyNode): AnyNode[] {
  const out: AnyNode[] = [];
  for (const [k, v] of Object.entries(node)) {
    if (k === "parent") continue;
    const list: unknown[] = Array.isArray(v) ? v : [v];
    out.push(...list.filter(isNode));
  }
  return out;
}

/** The notes of the returns of `fn`'s own body (none of a function inside it), by their place in its text. */
export function returnNotes(
  fn: AnyNode,
  kindOf: (arg: AnyNode) => "call" | "read" | null,
): [number, string][] {
  const out: [number, string][] = [];
  (function walk(n: AnyNode, top: boolean) {
    if (!top && n.type.includes("Function")) return;
    const arg =
      n.type === "ReturnStatement" && isNode(n.argument)
        ? at(n, "argument")
        : null;
    const kind = arg && kindOf(arg);
    // the ranges count from 1 inside the text (instrument.ts parses it as `(text)`)
    if (arg && kind) out.push([arg.range[0] - 1, `__R("${kind}"), `]);
    children(n).forEach((c) => {
      walk(c, false);
    });
  })(fn, true);
  return out.sort((a, b) => a[0] - b[0]);
}

/** `text` from a to b with each note at its place; a return is a statement, so no marked node holds one. */
export const noted =
  (text: string, notes: readonly [number, string][]) =>
  (a: number, b: number): string => {
    let out = "";
    let from = a;
    for (const [p, note] of notes)
      if (p > a && p <= b) {
        out += text.slice(from, p) + note;
        from = p;
      }
    return out + text.slice(from, b);
  };
