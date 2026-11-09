// The `_vars` reader, against a fake `send` that answers from an invented tree of objects (FR-006, FR-007, SC-005).
import { expect, test } from "vitest";
import type { Cdp } from "./cdp.ts";
import { OBJECT_GROUP } from "./engine-ref.ts";
import type { EngineRef } from "./engine-ref.ts";
import { createVarsReader } from "./vars-reader.ts";

interface Remote {
  type: string;
  subtype?: string;
  objectId?: string;
  description?: string;
  value?: unknown;
}
interface Prop {
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
  };
  sessionId: string | undefined;
}

const REF: EngineRef = { sessionId: "S", objectId: "ENGINE", pausedMs: 1 };
const OTHER: EngineRef = { sessionId: "S", objectId: "ENGINE2", pausedMs: 1 };

const obj = (objectId: string, description = "Object"): Remote => ({
  type: "object",
  objectId,
  description,
});
const prim = (value: unknown): Remote => ({ type: typeof value, value });
const LISTED: Prop[] = [
  { name: "TomePct", value: prim(7) },
  { name: "TomeOn", value: prim("on") },
  { name: "HappyHours", value: prim(true) },
];
const VALUES = { TomePct: 7, TomeOn: "on", HappyHours: true };

const strip = (id: string) => id.replace(/^(copy-)+/, "");

/** An invented game: `nodes` are the objects by id, reached from the scopes of the function. */
function game(
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
function chain(depth: number, end: Prop[]): Record<string, Prop[]> {
  const nodes: Record<string, Prop[]> = {};
  const at = (d: number) => (d === 0 ? "scope" : `o${String(d)}`);
  for (let d = 0; d < depth; d++)
    nodes[at(d)] = [{ name: "next", value: obj(at(d + 1)) }];
  nodes[at(depth)] = end;
  return nodes;
}

const inspected = (calls: Call[]) =>
  calls
    .filter((c) => c.method === "Runtime.getProperties")
    .map((c) => strip(c.params.objectId ?? ""))
    .filter((id) => id !== "FN" && id !== "SCOPES");
const released = (calls: Call[]) =>
  calls
    .filter((c) => c.method === "Runtime.releaseObjectGroup")
    .map((c) => c.params.objectGroup);
const functionCalls = (calls: Call[]) =>
  calls.filter((c) => c.method === "Runtime.callFunctionOn");

test.each([0, 1, 5])("the holder is found at depth %d", async (depth) => {
  const g = game(chain(depth, LISTED));
  expect(await createVarsReader(g.send).read(REF)).toEqual(VALUES);
});

test("an object deeper than 5 is not inspected", async () => {
  const g = game(chain(6, LISTED));
  expect(await createVarsReader(g.send).read(REF)).toBeNull();
  expect(inspected(g.calls)).not.toContain("o6");
});

test("three list keys on one object make the holder, two do not", async () => {
  const g = game({
    scope: [...LISTED.slice(0, 2), { name: "next", value: obj("o1") }],
    o1: LISTED.slice(1),
  });
  expect(await createVarsReader(g.send).read(REF)).toBeNull();
});

test("a key that is an accessor does not count and is not read", async () => {
  const g = game({
    scope: [
      ...LISTED.slice(0, 2),
      { name: "ChipRepo", get: obj("getter", "function") },
    ],
  });
  expect(await createVarsReader(g.send).read(REF)).toBeNull();
  expect(JSON.stringify(g.calls)).not.toContain("getter");
});

test("the global scopes are skipped", async () => {
  const g = game({ global: LISTED }, [obj("global", "Global")]);
  expect(await createVarsReader(g.send).read(REF)).toBeNull();
  expect(inspected(g.calls)).toEqual([]);
});

function wide(): Record<string, Prop[]> {
  const nodes: Record<string, Prop[]> = {
    scope: Array.from({ length: 4000 }, (_, i) => ({
      name: `k${String(i)}`,
      value: obj(`w${String(i)}`),
    })),
  };
  for (let i = 0; i < 4000; i++)
    nodes[`w${String(i)}`] = i === 3999 ? LISTED : [];
  return nodes;
}

test("the search stops at 3000 objects and gives null", async () => {
  const g = game(wide());
  expect(await createVarsReader(g.send).read(REF)).toBeNull();
  expect(inspected(g.calls)).toHaveLength(3000);
});

test("a search that found nothing is not repeated for the same engine, and a new engine searches", async () => {
  const g = game(wide());
  const r = createVarsReader(g.send);
  await r.read(REF);
  const before = g.calls.length;
  expect(await r.read(REF)).toBeNull();
  expect(g.calls).toHaveLength(before);
  await r.read(OTHER);
  expect(g.calls.length).toBeGreaterThan(before);
});

test("the same object id in another session is another engine", async () => {
  const g = game(chain(0, LISTED));
  const r = createVarsReader(g.send);
  await r.read(REF);
  g.calls.length = 0;
  await r.read({ ...REF, sessionId: "T" });
  expect(
    functionCalls(g.calls).some((c) =>
      c.params.functionDeclaration?.includes("createElement"),
    ),
  ).toBe(true);
  expect(g.calls.every((c) => c.sessionId === "T")).toBe(true);
});

test("primitives, null and objects of the list come back with their values", async () => {
  const g = game(
    {
      scope: [
        { name: "TomePct", value: prim(7) },
        {
          name: "TomeOn",
          value: { type: "object", subtype: "null", value: null },
        },
        { name: "voteCategories", value: obj("list", "Array(2)") },
        { name: "A_ResXP", value: obj("map") },
      ],
    },
    undefined,
    { list: [1, 2], map: { a: 1 } },
  );
  expect(await createVarsReader(g.send).read(REF)).toEqual({
    TomePct: 7,
    TomeOn: null,
    voteCategories: [1, 2],
    A_ResXP: { a: 1 },
  });
});

test("a key outside the list never leaves, by name or by value", async () => {
  const g = game(
    {
      scope: [
        ...LISTED,
        { name: "bearerBlob", value: prim("FAKE-LOGIN-TOKEN") },
        { name: "bearerBox", value: obj("box") },
      ],
    },
    undefined,
    { box: { inner: "FAKE-LOGIN-TOKEN" } },
  );
  const r = createVarsReader(g.send);
  const results = [await r.read(REF), await r.read(REF)];
  await r.release(REF);
  expect(results).toEqual([VALUES, VALUES]);
  const everything = JSON.stringify([results, g.calls]);
  expect(everything).not.toContain("FAKE-LOGIN-TOKEN");
  expect(everything).not.toContain("bearer");
  expect(everything).not.toContain('"box"');
});

test("the next read uses only the holder and sees its new values", async () => {
  const g = game(chain(2, LISTED));
  const r = createVarsReader(g.send);
  await r.read(REF);
  g.calls.length = 0;
  g.nodes.o2 = [...LISTED.slice(1), { name: "TomePct", value: prim(9) }];
  expect(await r.read(REF)).toEqual({ ...VALUES, TomePct: 9 });
  expect(inspected(g.calls)).toEqual(["o2"]);
  expect(
    functionCalls(g.calls).some((c) =>
      c.params.functionDeclaration?.includes("createElement"),
    ),
  ).toBe(false);
});

test.each(["reject", "exception"] as const)(
  "a read of the holder that fails (%s) drops it, and only the next engine searches",
  async (fail) => {
    const g = game(chain(0, LISTED));
    const r = createVarsReader(g.send);
    await r.read(REF);
    g.fail = fail;
    expect(await r.read(REF)).toBeNull();
    g.fail = null;
    g.calls.length = 0;
    expect(await r.read(REF)).toBeNull();
    expect(g.calls).toEqual([]);
    expect(await r.read(OTHER)).toEqual(VALUES);
  },
);

test("a search that fails gives null and is not repeated for the same engine", async () => {
  const g = game(chain(0, LISTED));
  const r = createVarsReader(g.send);
  g.fail = "reject";
  expect(await r.read(REF)).toBeNull();
  g.fail = null;
  g.calls.length = 0;
  expect(await r.read(REF)).toBeNull();
  expect(g.calls).toEqual([]);
});

test("no [[Scopes]] gives null", async () => {
  const g = game({});
  g.send = (method) =>
    Promise.resolve(
      method === "Runtime.getProperties"
        ? { result: [] }
        : { result: { type: "function", objectId: "FN" } },
    );
  expect(await createVarsReader(g.send).read(REF)).toBeNull();
});

test("the holder stays in the reader's own group until release()", async () => {
  const g = game(chain(0, LISTED));
  const r = createVarsReader(g.send);
  await r.read(REF);
  await r.read(REF);
  const group = functionCalls(g.calls).find(
    (c) => c.params.objectId === "scope" && c.params.returnByValue === false,
  )?.params.objectGroup;
  expect(group).toEqual(expect.any(String));
  expect(group).not.toBe(OBJECT_GROUP);
  expect(released(g.calls)).not.toContain(group);
  await r.release(REF);
  expect(released(g.calls)).toContain(group);
  expect(g.calls.at(-1)?.sessionId).toBe("S");
});

test("every other handle a read opens is released with it", async () => {
  const g = game(chain(1, LISTED));
  const r = createVarsReader(g.send);
  await r.read(REF);
  const group = functionCalls(g.calls).find(
    (c) => c.params.objectId === "o1" && c.params.returnByValue === false,
  )?.params.objectGroup;
  const others = functionCalls(g.calls)
    .map((c) => c.params.objectGroup)
    .filter((x) => x !== group);
  expect(others.length).toBeGreaterThan(0);
  for (const other of others) expect(released(g.calls)).toContain(other);
});

test("after release() the next read searches again", async () => {
  const g = game(chain(0, LISTED));
  const r = createVarsReader(g.send);
  await r.read(REF);
  await r.release(REF);
  g.calls.length = 0;
  expect(await r.read(REF)).toEqual(VALUES);
  expect(inspected(g.calls)).toContain("scope");
});

test("release(null) sends nothing, and a release that fails resolves", async () => {
  const g = game(chain(0, LISTED));
  const r = createVarsReader(g.send);
  await r.release(null);
  expect(g.calls).toEqual([]);
  g.fail = "reject";
  await expect(r.release(REF)).resolves.toBeUndefined();
});

test("no declaration calls anything: each one only reads a property", async () => {
  const g = game(
    { scope: [...LISTED, { name: "A_ResXP", value: obj("map") }] },
    undefined,
    { map: { a: 1 } },
  );
  await createVarsReader(g.send).read(REF);
  const declarations = functionCalls(g.calls).map(
    (c) => c.params.functionDeclaration ?? "",
  );
  expect(new Set(declarations)).toEqual(
    new Set([
      "function () { return window.React.createElement; }",
      "function () { return this; }",
    ]),
  );
});

test("the function is taken from the engine by reference", async () => {
  const g = game(chain(0, LISTED));
  await createVarsReader(g.send).read(REF);
  expect(g.calls[0]).toMatchObject({
    method: "Runtime.callFunctionOn",
    sessionId: "S",
    params: { objectId: "ENGINE", returnByValue: false },
  });
});
