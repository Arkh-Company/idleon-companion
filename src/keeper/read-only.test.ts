// Read-only proof (spec §7.2): read.js runs against a fake engine where every function throws when called.
import { join } from "node:path";
import { Script, runInNewContext } from "node:vm";
import { expect, test } from "vitest";
import { loadReadSource } from "./read-source.ts";

const trap = () =>
  new Proxy(() => undefined, {
    apply() {
      throw new Error("game function called");
    },
  });

function engine(attrs: Record<string, unknown>) {
  const g = {
    CurrentMap: 264,
    MenuType: 3,
    MenuType2: 44,
    MenuType2TabSelected: 2,
    SkillTabSelected: 18,
    UserInfo: ["Darkhe"],
    AFKtarget: "w6d3",
    OptionsList: Object.assign([], { 12: 0, 13: [1, 0, "Scripticus", 0] }),
    NonCloudsave: [[0, 0, null, 0]],
    someFn: trap(),
    ...attrs,
  };
  return { gameAttributes: { h: g }, getGameAttribute: trap() };
}

function read(attrs: Record<string, unknown> = {}): Record<string, unknown> {
  const src = loadReadSource(join(import.meta.dirname, "read.js"));
  const fn = runInNewContext(src) as (this: unknown) => Record<string, unknown>;
  return fn.call(engine(attrs));
}

test("read.js calls no game function", () => {
  expect(read()).toEqual({
    map: 264,
    menu: 3,
    menu2: 44,
    menu2tab: 2,
    skillTab: 18,
    char: "Darkhe",
    afk: "w6d3",
    codexTab: 0,
    codexSel: "Scripticus",
  });
});

test("no AFK target reads as null", () => {
  expect(read({ AFKtarget: undefined }).afk).toBeNull();
});

test("the Friends tab selects the friend's name", () => {
  const out = read({
    OptionsList: Object.assign([], { 12: 5 }),
    NonCloudsave: [[0, 0, "Bob", 0]],
  });
  expect(out.codexSel).toBe("Bob");
});

test("outside a character the character is null", () => {
  expect(read({ UserInfo: undefined }).char).toBeNull();
});

test("an empty UserInfo reads the character as null", () => {
  expect(read({ UserInfo: [] }).char).toBeNull();
});

test("a short OptionsList reads the Codex tab as null", () => {
  expect(read({ MenuType: 0, OptionsList: [] }).codexTab).toBeNull();
});

test("the reading has no probe section", () => {
  expect(read()).not.toHaveProperty("probe");
});

test("the loader drops whole-line comments and the final semicolon", () => {
  const src = loadReadSource(join(import.meta.dirname, "read.js"));
  expect(src.startsWith("(function")).toBe(true);
  expect(src).not.toMatch(/^\s*\/\//m);
  // Runtime.callFunctionOn wraps the declaration in parentheses, where a `;` is a syntax error.
  expect(src.endsWith(")")).toBe(true);
  expect(() => new Script(`(${src})`)).not.toThrow();
});
