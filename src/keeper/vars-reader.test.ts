// The `_vars` reader, against a fake `send` that answers from an invented tree of objects (FR-006, FR-007, SC-005).
import { expect, test } from "vitest";
import type { Cdp } from "./cdp.ts";
import { OBJECT_GROUP } from "./engine-ref.ts";
import {
  chain,
  COPY,
  functionCalls,
  game,
  inspected,
  LISTED,
  obj,
  OTHER,
  prim,
  REF,
  released,
  running,
  VALUES,
} from "./vars-reader-fixture.ts";
import type { Prop } from "./vars-reader-fixture.ts";
import { createVarsReader } from "./vars-reader.ts";

test.each([1, 5])("the holder is found at depth %d", async (depth) => {
  const g = game(chain(depth, LISTED));
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toEqual(
    VALUES,
  );
});

test("a scope with the keys is a copy of the moment: the search goes past it", async () => {
  const g = game({
    scope: [...LISTED, { name: "next", value: obj("o1") }],
    o1: [...LISTED.slice(1), { name: "TomePct", value: prim(9) }],
  });
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toEqual({
    ...VALUES,
    TomePct: 9,
  });
});

test("an object deeper than 5 is not inspected", async () => {
  const g = game(chain(6, LISTED));
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toBeNull();
  expect(inspected(g.calls)).not.toContain("o6");
});

test("three list keys on one object make the holder, two do not", async () => {
  const g = game({
    scope: [{ name: "next", value: obj("o1") }],
    o1: [...LISTED.slice(0, 2), { name: "next", value: obj("o2") }],
    o2: LISTED.slice(1),
  });
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toBeNull();
});

test("a key that is an accessor does not count and is not read", async () => {
  const g = game(
    chain(1, [
      ...LISTED.slice(0, 2),
      { name: "ChipRepo", get: obj("getter", "function") },
    ]),
  );
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toBeNull();
  expect(JSON.stringify(g.calls)).not.toContain("getter");
});

test("only objects are walked: a function with an id is not inspected", async () => {
  const g = game({
    scope: [
      {
        name: "f",
        value: { type: "function", objectId: "gameFn", description: "fn" },
      },
    ],
    gameFn: LISTED,
  });
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toBeNull();
  expect(inspected(g.calls)).toEqual(["scope"]);
});

test("the global scopes are skipped", async () => {
  const g = game({ global: LISTED }, [obj("global", "Global")]);
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toBeNull();
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
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toBeNull();
  expect(inspected(g.calls)).toHaveLength(3000);
});

test("a stop in the middle of the search ends it long before the limit", async () => {
  const g = game(wide());
  let stopped = false;
  const send: Cdp["send"] = (method, params, sessionId) => {
    if (inspected(g.calls).length === 10) stopped = true;
    return g.send(method, params, sessionId);
  };
  expect(
    await createVarsReader(send, COPY).read(REF, () => stopped),
  ).toBeNull();
  expect(inspected(g.calls).length).toBeLessThan(20);
});

test("a search that found nothing is not repeated for the same engine, and a new engine searches", async () => {
  const g = game(wide());
  const r = createVarsReader(g.send, COPY);
  await r.read(REF, running);
  const before = g.calls.length;
  expect(await r.read(REF, running)).toBeNull();
  expect(g.calls).toHaveLength(before);
  await r.read(OTHER, running);
  expect(g.calls.length).toBeGreaterThan(before);
});

test("the same object id in another session is another engine", async () => {
  const g = game(chain(1, LISTED));
  const r = createVarsReader(g.send, COPY);
  await r.read(REF, running);
  g.calls.length = 0;
  await r.read({ ...REF, sessionId: "T" }, running);
  expect(
    functionCalls(g.calls).some((c) =>
      c.params.functionDeclaration?.includes("createElement"),
    ),
  ).toBe(true);
  expect(g.calls.every((c) => c.sessionId === "T")).toBe(true);
});

test("primitives, null and objects of the list come back with their values", async () => {
  const g = game(
    chain(1, [
      { name: "TomePct", value: prim(7) },
      {
        name: "TomeOn",
        value: { type: "object", subtype: "null", value: null },
      },
      { name: "voteCategories", value: obj("list", "Array(2)") },
      { name: "A_ResXP", value: obj("map") },
    ]),
    undefined,
    { list: [1, 2], map: { a: 1 } },
  );
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toEqual({
    TomePct: 7,
    TomeOn: null,
    voteCategories: [1, 2],
    A_ResXP: { a: 1 },
  });
});

test.each(["Infinity", "-Infinity", "NaN"])(
  "%s, which JSON cannot hold, comes back as $n",
  async (text) => {
    const g = game(
      chain(1, [
        ...LISTED.slice(1),
        {
          name: "TomePct",
          value: { type: "number", unserializableValue: text },
        },
      ]),
    );
    expect(await createVarsReader(g.send, COPY).read(REF, running)).toEqual({
      ...VALUES,
      TomePct: { $n: text },
    });
  },
);

test("a key outside the list never leaves, by name or by value", async () => {
  const g = game(
    chain(1, [
      ...LISTED,
      { name: "bearerBlob", value: prim("FAKE-LOGIN-TOKEN") },
      { name: "bearerBox", value: obj("box") },
    ]),
    undefined,
    { box: { inner: "FAKE-LOGIN-TOKEN" } },
  );
  const r = createVarsReader(g.send, COPY);
  const results = [await r.read(REF, running), await r.read(REF, running)];
  await r.release(REF);
  expect(results).toEqual([VALUES, VALUES]);
  const everything = JSON.stringify([results, g.calls]);
  expect(everything).not.toContain("FAKE-LOGIN-TOKEN");
  expect(everything).not.toContain("bearer");
  expect(everything).not.toContain('"box"');
});

test("the next read uses only the holder and sees its new values", async () => {
  const g = game(chain(2, LISTED));
  const r = createVarsReader(g.send, COPY);
  await r.read(REF, running);
  g.calls.length = 0;
  g.nodes.o2 = [...LISTED.slice(1), { name: "TomePct", value: prim(9) }];
  expect(await r.read(REF, running)).toEqual({ ...VALUES, TomePct: 9 });
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
    const g = game(chain(1, LISTED));
    const r = createVarsReader(g.send, COPY);
    await r.read(REF, running);
    g.fail = fail;
    expect(await r.read(REF, running)).toBeNull();
    g.fail = null;
    g.calls.length = 0;
    expect(await r.read(REF, running)).toBeNull();
    expect(g.calls).toEqual([]);
    expect(await r.read(OTHER, running)).toEqual(VALUES);
  },
);

test("a search that fails gives null and is not repeated for the same engine", async () => {
  const g = game(chain(1, LISTED));
  const r = createVarsReader(g.send, COPY);
  g.fail = "reject";
  expect(await r.read(REF, running)).toBeNull();
  g.fail = null;
  g.calls.length = 0;
  expect(await r.read(REF, running)).toBeNull();
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
  expect(await createVarsReader(g.send, COPY).read(REF, running)).toBeNull();
});

test("the holder stays in the reader's own group until release()", async () => {
  const g = game(chain(1, LISTED));
  const r = createVarsReader(g.send, COPY);
  await r.read(REF, running);
  await r.read(REF, running);
  const group = functionCalls(g.calls).find(
    (c) => c.params.objectId === "o1" && c.params.returnByValue === false,
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
  const r = createVarsReader(g.send, COPY);
  await r.read(REF, running);
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
  const g = game(chain(1, LISTED));
  const r = createVarsReader(g.send, COPY);
  await r.read(REF, running);
  await r.release(REF);
  g.calls.length = 0;
  expect(await r.read(REF, running)).toEqual(VALUES);
  expect(inspected(g.calls)).toContain("scope");
});

test("release(null) sends nothing, and a release that fails resolves", async () => {
  const g = game(chain(1, LISTED));
  const r = createVarsReader(g.send, COPY);
  await r.release(null);
  expect(g.calls).toEqual([]);
  g.fail = "reject";
  await expect(r.release(REF)).resolves.toBeUndefined();
});

test("the only declarations are two property reads and the proven copy", async () => {
  const g = game(
    chain(1, [...LISTED, { name: "A_ResXP", value: obj("map") }]),
    undefined,
    { map: { a: 1 } },
  );
  await createVarsReader(g.send, COPY).read(REF, running);
  const declarations = functionCalls(g.calls).map(
    (c) => c.params.functionDeclaration ?? "",
  );
  expect(new Set(declarations)).toEqual(
    new Set([
      "function () { return window.React.createElement; }",
      "function () { return this; }",
      COPY,
    ]),
  );
});

test("only the copy comes by value, and it is told to copy its this", async () => {
  const g = game(
    chain(1, [...LISTED, { name: "A_ResXP", value: obj("map") }]),
    undefined,
    { map: { a: 1 } },
  );
  await createVarsReader(g.send, COPY).read(REF, running);
  const byValue = functionCalls(g.calls).filter(
    (c) => c.params.returnByValue === true,
  );
  expect(byValue).toHaveLength(1);
  expect(byValue[0]?.params).toMatchObject({
    objectId: "map",
    functionDeclaration: COPY,
    arguments: [{ value: null }],
  });
});

test("the function is taken from the engine by reference", async () => {
  const g = game(chain(1, LISTED));
  await createVarsReader(g.send, COPY).read(REF, running);
  expect(g.calls[0]).toMatchObject({
    method: "Runtime.callFunctionOn",
    sessionId: "S",
    params: { objectId: "ENGINE", returnByValue: false },
  });
});
