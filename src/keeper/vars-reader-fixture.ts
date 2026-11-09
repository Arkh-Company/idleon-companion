// The harness of the `_vars` reader's tests: a fake `send` that answers from an invented tree of objects.
import type { Cdp } from "./cdp.ts";
import type { EngineRef } from "./engine-ref.ts";

interface Remote {
  type: string;
  subtype?: string;
  objectId?: string;
  description?: string;
  value?: unknown;
  unserializableValue?: string;
}
export interface Prop {
  name: string;
  value?: Remote;
  get?: Remote;
}
interface Call {
  method: string;
  params: {
    objectId?: string;
    functionDeclaration?: string;
    returnByValue?: boolean;
    objectGroup?: string;
    arguments?: { value: unknown }[];
  };
  sessionId: string | undefined;
}

export const COPY = "COPY";
export const running = () => false;
export const REF: EngineRef = {
  sessionId: "S",
  objectId: "ENGINE",
  pausedMs: 1,
};
export const OTHER: EngineRef = {
  sessionId: "S",
  objectId: "ENGINE2",
  pausedMs: 1,
};

export const obj = (objectId: string, description = "Object"): Remote => ({
  type: "object",
  objectId,
  description,
});
export const prim = (value: unknown): Remote => ({ type: typeof value, value });
export const LISTED: Prop[] = [
  { name: "TomePct", value: prim(7) },
  { name: "TomeOn", value: prim("on") },
  { name: "HappyHours", value: prim(true) },
];
export const VALUES = { TomePct: 7, TomeOn: "on", HappyHours: true };

const strip = (id: string) => id.replace(/^(copy-)+/, "");

/** An invented game: `nodes` are the objects by id, reached from the scopes of the function. */
export function game(
  nodes: Record<string, Prop[]>,
  scopes: Remote[] = [obj("scope", "Closure")],
  byValue: Record<string, unknown> = {},
) {
  const h: {
    calls: Call[];
    nodes: Record<string, Prop[]>;
    fail: "reject" | "exception" | null;
    send: Cdp["send"];
  } = {
    calls: [],
    nodes,
    fail: null,
    send: async (method, params, sessionId) => {
      const p = params as Call["params"];
      h.calls.push({ method, params: p, sessionId });
      await Promise.resolve();
      if (h.fail === "reject") throw new Error("gone");
      if (h.fail === "exception" && method !== "Runtime.releaseObjectGroup")
        return { exceptionDetails: { text: "gone" } };
      if (method === "Runtime.getProperties") {
        const id = strip(p.objectId ?? "");
        if (id === "FN")
          return {
            result: [],
            internalProperties: [{ name: "[[Scopes]]", value: obj("SCOPES") }],
          };
        if (id === "SCOPES")
          return {
            result: scopes.map((value, i) => ({ name: String(i), value })),
          };
        const result = h.nodes[id];
        if (!result) throw new Error(`no object ${id}`);
        return { result };
      }
      if (method !== "Runtime.callFunctionOn") return {};
      if (p.functionDeclaration?.includes("createElement"))
        return { result: { type: "function", objectId: "FN" } };
      return p.returnByValue
        ? { result: { value: byValue[strip(p.objectId ?? "")] } }
        : { result: { type: "object", objectId: `copy-${p.objectId ?? ""}` } };
    },
  };
  return h;
}

/** `scope` then `depth` objects, one inside the other, with `end` on the last one. */
export function chain(depth: number, end: Prop[]): Record<string, Prop[]> {
  const nodes: Record<string, Prop[]> = {};
  const at = (d: number) => (d === 0 ? "scope" : `o${String(d)}`);
  for (let d = 0; d < depth; d++)
    nodes[at(d)] = [{ name: "next", value: obj(at(d + 1)) }];
  nodes[at(depth)] = end;
  return nodes;
}

export const inspected = (calls: Call[]) =>
  calls
    .filter((c) => c.method === "Runtime.getProperties")
    .map((c) => strip(c.params.objectId ?? ""))
    .filter((id) => id !== "FN" && id !== "SCOPES");
export const released = (calls: Call[]) =>
  calls
    .filter((c) => c.method === "Runtime.releaseObjectGroup")
    .map((c) => c.params.objectGroup);
export const functionCalls = (calls: Call[]) =>
  calls.filter((c) => c.method === "Runtime.callFunctionOn");
