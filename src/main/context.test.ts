import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { identifyScreen, READ_NULLS, SCREEN_CATALOG } from "../shared/index.ts";
import type { GameContext, GameTables, Reading } from "../shared/index.ts";
import { contextTracker, toContext } from "./context.ts";

const base: Reading = {
  t: 1234,
  map: 1,
  menu: 0,
  menu2: 44,
  menu2tab: 2,
  skillTab: 0,
  char: "Tester",
  afk: "w6d3",
  codexTab: null,
  ...READ_NULLS,
};

const tables: GameTables = {
  maps: ["Vale", "Peak"],
  monsters: { w6d3: "Samurai Guardian", Nothing: "" },
};
const UNREAD: GameTables = { maps: null, monsters: null };

test("the world comes from the map", () => {
  expect(toContext({ ...base, map: 264 }, tables).screen.world).toBe(6);
  expect(toContext({ ...base, map: 41 }, tables).screen.world).toBe(1);
  expect(toContext({ ...base, map: 326 }, tables).screen.world).toBe(7);
});

test("the screen label is what identifyScreen gives", () => {
  const reading = { ...base, behaviors: { "H23._GenINFO[18]": 1 } };

  expect(toContext(reading, tables).screen.label).toBe("Sailing › Crew");
  expect(toContext(reading, tables).screen.label).toBe(
    identifyScreen(reading, SCREEN_CATALOG),
  );
});

test("the tables name the map and the AFK target", () => {
  const ctx = toContext(base, tables);

  expect(ctx.names).toEqual({ map: "Peak", afk: "Samurai Guardian" });
  expect(ctx.afk).toBe("w6d3");
  expect(ctx.screen).toEqual({
    world: 1,
    map: 1,
    label: "Sailing › Unknown tab",
  });
});

test("a screen with no rule is Unknown screen", () => {
  expect(toContext({ ...base, menu: 0.1, menu2: 0 }, tables).screen.label).toBe(
    "Unknown screen",
  );
  expect(toContext({ ...base, menu2: 999 }, tables).screen.label).toBe(
    "Unknown screen",
  );
});

test("the Codex is named only while it is open", () => {
  const codex = { ...base, menu2: 0, codexTab: 2, nd37: 1 };

  expect(toContext({ ...codex, menu: 3 }, tables).screen.label).toBe(
    "Codex › Quik Ref › EZ Access",
  );
  expect(toContext({ ...codex, menu: 0 }, tables).screen.label).toBe("None");
});

test.each([
  ["no tables", base, UNREAD],
  ["an unread map table", base, { ...tables, maps: null }],
  ["a map the table lacks", { ...base, map: 2 }, tables],
  ["a negative map", { ...base, map: -1 }, tables],
  ["a fractional map", { ...base, map: 0.5 }, tables],
  ["a blank map name", base, { ...tables, maps: ["Vale", " "] }],
])("%s gives Unknown map", (_name, reading, t) => {
  expect(toContext(reading, t).names.map).toBe("Unknown map");
});

test.each([
  ["no tables", base, UNREAD],
  ["an unread monster table", base, { ...tables, monsters: null }],
  ["an id the table lacks", { ...base, afk: "w9x" }, tables],
  ["an inherited id", { ...base, afk: "constructor" }, tables],
  ["a blank monster name", base, { ...tables, monsters: { w6d3: "" } }],
])("%s gives Unknown monster", (_name, reading, t) => {
  expect(toContext(reading, t).names.afk).toBe("Unknown monster");
});

test.each([
  ["null", null, tables],
  ["Nothing", "Nothing", tables],
  ["null without tables", null, UNREAD],
  ["Nothing without tables", "Nothing", UNREAD],
])("an AFK target of %s gives None", (_name, afk, t) => {
  expect(toContext({ ...base, afk }, t).names.afk).toBe("None");
});

test("no character gives a null character", () => {
  expect(toContext({ ...base, char: null }, tables).character).toBeNull();
});

test("the time comes from the reading", () => {
  expect(toContext({ ...base, t: 5678 }, tables).updatedAt).toBe(5678);
});

function tracked() {
  const sent: GameContext[] = [];
  const tracker = contextTracker((c) => {
    sent.push(c);
  });
  return { sent, tracker };
}

test("a reading before the tables says Unknown map, and the tables send the context again with the name", () => {
  const { sent, tracker } = tracked();

  tracker.reading(base);
  expect(sent.map((c) => c.names.map)).toEqual(["Unknown map"]);

  tracker.tables(tables);
  expect(sent.map((c) => c.names.map)).toEqual(["Unknown map", "Peak"]);
});

test("tables with no reading yet send nothing", () => {
  const { sent, tracker } = tracked();

  tracker.tables(tables);

  expect(sent).toEqual([]);
});

test("a reading after the tables is named at once", () => {
  const { sent, tracker } = tracked();

  tracker.tables(tables);
  tracker.reading(base);

  expect(sent.map((c) => c.names.afk)).toEqual(["Samurai Guardian"]);
});

test("new tables replace the old ones", () => {
  const { sent, tracker } = tracked();
  tracker.tables(tables);
  tracker.reading(base);

  tracker.tables(UNREAD);

  expect(sent.at(-1)?.names.map).toBe("Unknown map");
});

test("replay sends the last context again", () => {
  const { sent, tracker } = tracked();
  tracker.tables(tables);
  tracker.reading({ ...base, t: 1 });
  tracker.reading({ ...base, t: 2 });

  tracker.replay();

  expect(sent.map((c) => c.updatedAt)).toEqual([1, 2, 2]);
  expect(sent.at(-1)?.names.map).toBe("Peak");
});

test("replay with no reading yet sends nothing", () => {
  const { sent, tracker } = tracked();

  tracker.replay();

  expect(sent).toEqual([]);
});

// ponytail: reads the source because index.ts imports electron and no test may load it.
test("the app hands the link's tables, checked, to the tracker", () => {
  const source = readFileSync(join(import.meta.dirname, "index.ts"), "utf8");

  expect(source).toMatch(/tracker\.tables\(linkTables\(m\.tables\)\)/);
});
