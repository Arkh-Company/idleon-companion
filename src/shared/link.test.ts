// The keeper ↔ app line codec (spec §5.4): one JSON message per line, junk skipped.
import { expect, test } from "vitest";
import { createLineDecoder, encodeLine, isObject } from "./link.ts";
import type { LinkMessage } from "./link.ts";

test("a line ends in a newline", () => {
  expect(encodeLine({ type: "confirm-attach" })).toBe(
    '{"type":"confirm-attach"}\n',
  );
});

test("the decoder joins split chunks and skips junk", () => {
  const got: LinkMessage[] = [];
  const decode = createLineDecoder((m) => got.push(m));
  decode('{"type":"confirm-at');
  decode('tach"}\nnot json\n{"type":"confirm-attach"}\n');
  expect(got).toEqual([{ type: "confirm-attach" }, { type: "confirm-attach" }]);
});

test("the decoder reads Buffers, also with a character split across them", () => {
  const got: LinkMessage[] = [];
  const decode = createLineDecoder((m) => got.push(m));
  const line = Buffer.from(
    encodeLine({
      type: "status",
      status: { game: "running", reader: "error", message: "é" },
    }),
  );
  const cut = line.indexOf(0xc3) + 1; // inside the two bytes of "é"
  decode(line.subarray(0, cut));
  decode(line.subarray(cut));
  expect(got).toEqual([
    {
      type: "status",
      status: { game: "running", reader: "error", message: "é" },
    },
  ]);
});

test("release and reconnect decode bare, also with extra fields", () => {
  const got: LinkMessage[] = [];
  createLineDecoder((m) => got.push(m))(
    '{"type":"release"}\n{"type":"reconnect"}\n{"type":"release","x":1}\n{"type":"reconnect","pid":2}\n',
  );
  expect(got).toEqual([
    { type: "release" },
    { type: "reconnect" },
    { type: "release" },
    { type: "reconnect" },
  ]);
});

test.each<LinkMessage>([
  { type: "release" },
  { type: "reconnect" },
  {
    type: "tables",
    tables: { maps: ["Vale"], monsters: null, items: { Ore: "Blue Ore" } },
  },
  {
    type: "state",
    slice: {
      sentinel: { char: "A", map: 7 },
      pieces: [{ path: ["Cards"], value: [1, 2] }],
      at: 5,
      cycles: { fast: 1, all: 0 },
    },
  },
  { type: "gameFiles", resources: "C:\\Game\\resources" },
])("$type round-trips through a line", (m) => {
  const got: LinkMessage[] = [];
  createLineDecoder((x) => got.push(x))(encodeLine(m));
  expect(got).toEqual([m]);
});

test.each([
  ["an unknown type", '{"type":"other"}'],
  ["a type close to release", '{"type":"release-all"}'],
  ["a reading without its body", '{"type":"reading"}'],
  ["a status without its body", '{"type":"status","status":null}'],
  ["tables without their body", '{"type":"tables"}'],
  ["tables that are not an object", '{"type":"tables","tables":[1]}'],
  ["a state without its slice", '{"type":"state"}'],
  ["a state whose slice is a list", '{"type":"state","slice":[1]}'],
  ["game files without their folder", '{"type":"gameFiles"}'],
  ["game files whose folder is a number", '{"type":"gameFiles","resources":1}'],
  ["JSON that is not an object", "42"],
])("the decoder skips %s", (_name, line) => {
  const got: LinkMessage[] = [];
  createLineDecoder((m) => got.push(m))(`${line}\n`);
  expect(got).toEqual([]);
});

test("an object is a plain object: not null, not an array", () => {
  expect(isObject({ a: 1 })).toBe(true);
  expect(isObject(null)).toBe(false);
  expect(isObject([])).toBe(false);
  expect(isObject("x")).toBe(false);
});
