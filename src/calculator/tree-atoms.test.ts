// What leaves the tree worker is only atoms (spec 008, T018, FR-010, CHK001): over the invented game with a text value,
// two character names (one a prefix of the other) and a string literal in the code, the `treeResult` holds no code
// literal, no code snippet, and no character name outside a `name` field shown on screen.
import { beforeAll, expect, test, vi } from "vitest";
import { CHARACTERS, GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import { handleMessage } from "./index.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { createTreeEngine } from "./tree-engine.ts";

const ROOTS = {
  textValue: ["TreeTextValue", [0, 0, 0]],
  literal: ["TreeStringLiteral", [0, 0, 0]],
  player: ["TreePlayer", [0, 0, 0]],
} as const;
const LITERAL = "an invented literal";
const CODE =
  /[{};]|=>|_customBlock_|\bfunction\b|\breturn\b|__X|getGameAttribute/;

const port = { postMessage: vi.fn() };
beforeAll(() => {
  const init = {
    type: "init",
    mode: "tree",
    code: new TextEncoder().encode(GAME),
    pak: PAK,
  };
  handleMessage(init, port, undefined, (code, pak) =>
    createTreeEngine(code, pak, ROOTS),
  );
});

function resultOf(id: string): string {
  port.postMessage.mockClear();
  const request = { type: "number", id, character: 0 };
  handleMessage({ type: "tree", id: 1, request, mosaic: mosaicOf() }, port);
  return JSON.stringify(port.postMessage.mock.calls[0]?.[0]);
}

/** Every text of the tree, with its field: `name` is the only one the window may show a real name in. */
function texts(node: CalcTreeNode): [field: string, text: string][] {
  const own = Object.entries(node).flatMap(([k, v]): [string, string][] =>
    typeof v === "string"
      ? [[k, v]]
      : k === "formula"
        ? [[k, JSON.stringify(v)]]
        : [],
  );
  const kids = node.kids === "lazy" ? [] : node.kids.flatMap(texts);
  return [...own, ...kids];
}

test.each(Object.keys(ROOTS))("the %s tree is only atoms", (id) => {
  const text = resultOf(id);
  const { tree } = JSON.parse(text) as { tree: CalcTreeNode };
  expect(tree.value).not.toBeNull();
  expect(text).not.toContain(LITERAL);
  for (const [field, t] of texts(tree)) {
    expect(t).not.toMatch(CODE);
    if (field !== "name")
      for (const name of CHARACTERS) expect(t).not.toContain(name);
  }
});

test("no character name anywhere in the result, even the longer one", () => {
  const all = Object.keys(ROOTS).map(resultOf).join("\n");
  for (const name of CHARACTERS) expect(all).not.toContain(name);
});
