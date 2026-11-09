// Nothing reaches the network except the updater (FR-026, SC-007; constitution 1.1.0): a scan of the source text.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const SRC = join(import.meta.dirname, "..");
const UPDATER = "src/main/updates.ts";
// The link between the keeper and the app: node:net on the named pipe's path only.
const PIPE_ONLY = ["src/keeper/link-server.ts", "src/main/link-client.ts"];

const loads = (module: string) =>
  new RegExp(
    `(?:\\bfrom|\\bimport|\\brequire\\()\\s*\\(?\\s*["']${module}["']`,
  );

const UPDATER_MODULE = loads("electron-updater");
const NET_MODULE = loads("(?:node:)?net");
const STUB_WORDS = /\bXMLHttpRequest\b|\bWebSocket\b/;
const FORBIDDEN = [
  UPDATER_MODULE,
  loads("(?:node:)?(?:https?|http2|tls|dgram)"),
  /\bfetch\s*\(/,
  /\bnet\.(?:request|fetch)\b/,
  STUB_WORDS,
];
// FR-008, the one exception: the calculator's context defines the stubs that throw under these two words. Every other
// pattern still applies to it.
const STUBS_ONLY = "src/calculator/context.js";

function networkUses(file: string, text: string): string[] {
  if (file === UPDATER) return [];
  const hits = FORBIDDEN.filter(
    (p) => p.test(text) && !(file === STUBS_ONLY && p === STUB_WORDS),
  ).map(String);
  if (!PIPE_ONLY.includes(file) && NET_MODULE.test(text))
    hits.push(String(NET_MODULE));
  return hits;
}

// Tests may open a pipe of their own; they never ship, and neither does the invented game of the calculator's tests.
const sources = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .map((f) => f.replaceAll("\\", "/"))
  .filter(
    (f) =>
      /\.(?:tsx?|c?js|mjs)$/.test(f) &&
      !/\.test\.tsx?$/.test(f) &&
      !f.startsWith("calculator/fixtures/"),
  )
  .map((f) => ({
    file: `src/${f}`,
    text: readFileSync(join(SRC, f), "utf8"),
  }));

test("the scan reads the app, the keeper, the window and the calculator", () => {
  const files = sources.map((s) => s.file);
  for (const f of [
    "src/main/index.ts",
    "src/keeper/keeper.ts",
    "src/keeper/read.js",
    "src/renderer/App.tsx",
    "src/calculator/engine.ts",
    "src/calculator/context.js",
  ])
    expect(files).toContain(f);
});

test("the invented game of the tests is not scanned", () => {
  expect(
    sources.filter((s) => s.file.includes("/fixtures/")).map((s) => s.file),
  ).toEqual([]);
});

test("the calculator's context may only name the two stubs", () => {
  expect(networkUses(STUBS_ONLY, "G.XMLHttpRequest = refuse;")).toEqual([]);
  expect(networkUses(STUBS_ONLY, "G.WebSocket = refuse;")).toEqual([]);
  expect(networkUses(STUBS_ONLY, "await fetch(url);")).not.toEqual([]);
  expect(
    networkUses(STUBS_ONLY, 'import https from "node:https";'),
  ).not.toEqual([]);
  expect(
    networkUses("src/calculator/engine.ts", "new WebSocket(url);"),
  ).not.toEqual([]);
});

test("only updates.ts loads the updater", () => {
  expect(
    sources.filter((s) => UPDATER_MODULE.test(s.text)).map((s) => s.file),
  ).toEqual([UPDATER]);
});

test("nothing else reaches the network", () => {
  expect(
    sources.flatMap((s) =>
      networkUses(s.file, s.text).map((hit) => `${s.file}: ${hit}`),
    ),
  ).toEqual([]);
});

test.each([
  'import { autoUpdater } from "electron-updater";',
  'import http from "node:http";',
  'import https from "https";',
  'const h = await import("node:https");',
  'const h = require("node:http");',
  'import { connect } from "node:net";',
  "await fetch(url);",
  "net.request(url);",
  "new WebSocket(url);",
])("the scan catches %s", (line) => {
  expect(networkUses("src/main/other.ts", line)).not.toEqual([]);
});

test("the pipe files are allowed node:net and nothing more", () => {
  const file = "src/main/link-client.ts";
  expect(networkUses(file, 'import { connect } from "node:net";')).toEqual([]);
  expect(networkUses(file, 'import https from "node:https";')).not.toEqual([]);
});
