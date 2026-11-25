// A block's function as the argument marks read it (spec 010; moved out of save-args.ts as it was): its code parsed once,
// its parameters, each node's parent, its calls of each block, and the last value given to a variable on every way to a
// place.
import { parse } from "acorn";
import { at, isNode, member, walk } from "./character-args.ts";
import type { AnyNode } from "./character-args.ts";

export interface Fn {
  text: string;
  all: AnyNode[];
  params: string[];
  up: Map<AnyNode, AnyNode>;
  /** Each block's calls in the function, by the block's name. */
  sites: Map<string, AnyNode[]>;
}

export function fnOf(fnText: string): Fn | null {
  const text = `(${fnText})`;
  let program: AnyNode;
  try {
    program = parse(text, { ecmaVersion: 2022, ranges: true }) as never;
  } catch {
    return null;
  }
  const all = walk(program);
  const up = new Map<AnyNode, AnyNode>();
  for (const n of all)
    for (const v of Object.values(n))
      for (const c of Array.isArray(v) ? (v as unknown[]) : [v])
        if (isNode(c)) up.set(c, n);
  const fn = all.find((n) => n.type === "FunctionExpression");
  const params = ((fn?.params ?? []) as AnyNode[]).map((p) => p.name as string);
  const sites = new Map<string, AnyNode[]>();
  for (const n of all) {
    const name = n.type === "CallExpression" ? member(at(n, "callee")) : "";
    if (!name?.startsWith("_customBlock_")) continue;
    const block = name.slice(13);
    sites.set(block, [...(sites.get(block) ?? []), n]);
  }
  return { text, all, params, up, sites };
}

// the sides of a node that run only on some ways through it
const SIDES: Readonly<Record<string, readonly string[]>> = {
  IfStatement: ["consequent", "alternate"],
  ConditionalExpression: ["consequent", "alternate"],
  LogicalExpression: ["right"],
  ForStatement: ["test", "update", "body"],
  ForInStatement: ["body"],
  WhileStatement: ["test", "body"],
  SwitchCase: ["consequent"],
};
const holds = (n: AnyNode, pos: number) =>
  n.range[0] <= pos && pos < n.range[1];

/** Whether `def` runs on every way to `pos`: each side it sits on holds `pos` too. */
export function onTheWay(f: Fn, def: AnyNode, pos: number): boolean {
  for (let c = def, p = f.up.get(c); p; c = p, p = f.up.get(p)) {
    const side = (SIDES[p.type] ?? []).some((k) => {
      const v = p[k];
      return v === c || (Array.isArray(v) && v.includes(c));
    });
    if (side && !holds(c, pos)) return false;
  }
  return true;
}

const defs = new WeakMap<Fn, Map<string, AnyNode | undefined>>();
/** The last value given to `name` before `pos` on every way there: its declaration or its assignment. */
export function defOf(f: Fn, name: string, pos: number): AnyNode | undefined {
  // once per function, name and place (part R: each argument's marks read it again over the whole function)
  let known = defs.get(f);
  if (!known) defs.set(f, (known = new Map<string, AnyNode | undefined>()));
  const k = `${name}@${String(pos)}`;
  if (known.has(k)) return known.get(k);
  const best = lastDef(f, name, pos);
  known.set(k, best);
  return best;
}

function lastDef(f: Fn, name: string, pos: number): AnyNode | undefined {
  let best: AnyNode | undefined;
  for (const n of f.all) {
    const set =
      n.type === "VariableDeclarator" && at(n, "id").name === name
        ? (n.init as AnyNode | null)
        : n.type === "AssignmentExpression" && at(n, "left").name === name
          ? at(n, "right")
          : null;
    if (
      set &&
      n.range[1] <= pos &&
      (!best || n.range[1] > best.range[1]) &&
      onTheWay(f, n, pos)
    )
      best = set;
  }
  return best;
}
