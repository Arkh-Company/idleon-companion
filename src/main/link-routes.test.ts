// Where each thing the keeper sends goes, and what a new page of the window gets again. Every value here is invented.
import { expect, test, vi } from "vitest";
import { READ_NULLS } from "../shared/index.ts";
import type {
  LinkMessage,
  Reading,
  StateSlice,
  Status,
} from "../shared/index.ts";
import { NOT_CONNECTED } from "./lifecycle.ts";
import { routeLink } from "./link-routes.ts";

const READING: Reading = {
  ...READ_NULLS,
  t: 1,
  map: 5,
  menu: 0,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: "Invented",
  afk: null,
  codexTab: null,
};
const RUNNING: Status = { game: "running", reader: "attached" };
const CLOSED: Status = { game: "closed", reader: "error" };
const SLICE: StateSlice = {
  sentinel: { char: "Invented", map: 5 },
  pieces: [],
  at: 1,
  cycles: { fast: 0, all: 0 },
};

function setup(current: Status = RUNNING) {
  let loaded = (): void => undefined;
  const h = {
    tracker: { reading: vi.fn(), tables: vi.fn(), replay: vi.fn() },
    stats: {
      message: vi.fn(),
      reading: vi.fn(),
      status: vi.fn(),
      replay: vi.fn(),
    },
    formula: { status: vi.fn(), gameFiles: vi.fn(), replay: vi.fn() },
    updates: { replay: vi.fn() },
    setStatus: vi.fn((): Promise<void> => Promise.resolve()),
    sendStatus: vi.fn(),
    gameExited: vi.fn(),
    load: () => {
      loaded();
    },
  };
  const routes = routeLink({
    tracker: h.tracker,
    stats: h.stats,
    formula: h.formula,
    updates: h.updates,
    status: () => current,
    setStatus: h.setStatus,
    sendStatus: h.sendStatus,
    gameExited: h.gameExited,
    page: {
      on: (_event, listener) => {
        loaded = listener;
      },
    },
  });
  return { ...h, routes };
}
const bad = (m: unknown) => m as LinkMessage;

test("a reading goes to the screen tracker and to the Stats", () => {
  const h = setup();
  h.routes.message({ type: "reading", reading: READING });
  expect(h.tracker.reading).toHaveBeenCalledExactlyOnceWith(READING);
  expect(h.stats.reading).toHaveBeenCalledExactlyOnceWith(READING);
});

test("a reading of the wrong shape goes nowhere", () => {
  const h = setup();
  h.routes.message(bad({ type: "reading", reading: { t: "x" } }));
  expect(h.tracker.reading).not.toHaveBeenCalled();
  expect(h.stats.reading).not.toHaveBeenCalled();
});

test("the tables go to the screen tracker, checked", () => {
  const h = setup();
  h.routes.message(bad({ type: "tables", tables: { maps: 1, monsters: {} } }));
  expect(h.tracker.tables).toHaveBeenCalledExactlyOnceWith({
    maps: null,
    monsters: {},
  });
  expect(h.stats.message).not.toHaveBeenCalled();
});

test("a status goes to the Stats, the trees and the app", () => {
  const h = setup();
  h.routes.message({ type: "status", status: RUNNING });
  expect(h.stats.status).toHaveBeenCalledExactlyOnceWith(RUNNING);
  expect(h.formula.status).toHaveBeenCalledExactlyOnceWith(RUNNING);
  expect(h.setStatus).toHaveBeenCalledExactlyOnceWith(RUNNING);
});

test("a status of the wrong shape goes nowhere", () => {
  const h = setup();
  h.routes.message(bad({ type: "status", status: { game: "x" } }));
  expect(h.stats.status).not.toHaveBeenCalled();
  expect(h.setStatus).not.toHaveBeenCalled();
});

test("a closed game ends the app's lifecycle once the status settled", async () => {
  const h = setup();
  h.routes.message({ type: "status", status: CLOSED });
  expect(h.gameExited).not.toHaveBeenCalled();
  await Promise.resolve();
  await Promise.resolve();
  expect(h.gameExited).toHaveBeenCalledOnce();
});

test("a running game does not end it", async () => {
  const h = setup();
  h.routes.message({ type: "status", status: RUNNING });
  await Promise.resolve();
  await Promise.resolve();
  expect(h.gameExited).not.toHaveBeenCalled();
});

test.each<[string, LinkMessage]>([
  ["a slice", { type: "state", slice: SLICE }],
  ["the game's folder", { type: "gameFiles", resources: "C:\\x\\resources" }],
])("%s goes to the Stats", (_name, m) => {
  const h = setup();
  h.routes.message(m);
  expect(h.stats.message).toHaveBeenCalledExactlyOnceWith(m);
});

test("the game's folder goes to the trees too, and a folder of the wrong shape does not", () => {
  const h = setup();
  h.routes.message({ type: "gameFiles", resources: "C:\\x\\resources" });
  h.routes.message({ type: "gameFiles", resources: "C:\\x\\elsewhere" });
  expect(h.formula.gameFiles).toHaveBeenCalledExactlyOnceWith(
    "C:\\x\\resources",
  );
});

test("a dropped link is a status for the Stats, the trees and the app", () => {
  const h = setup();
  h.routes.connected(false);
  expect(h.stats.status).toHaveBeenCalledExactlyOnceWith(NOT_CONNECTED);
  expect(h.formula.status).toHaveBeenCalledExactlyOnceWith(NOT_CONNECTED);
  expect(h.setStatus).toHaveBeenCalledExactlyOnceWith(NOT_CONNECTED);
});

test("a link dropped after the game closed keeps the closed status", () => {
  const h = setup(CLOSED);
  h.routes.connected(false);
  expect(h.stats.status).toHaveBeenCalledExactlyOnceWith(CLOSED);
  expect(h.setStatus).toHaveBeenCalledExactlyOnceWith(CLOSED);
});

test("a link that comes up changes nothing", () => {
  const h = setup();
  h.routes.connected(true);
  expect(h.stats.status).not.toHaveBeenCalled();
  expect(h.setStatus).not.toHaveBeenCalled();
});

test("each page load gets the status, the context, the update, the Stats and the tree again", () => {
  const h = setup();
  h.load();
  expect(h.formula.replay).toHaveBeenCalledOnce();
  expect(h.sendStatus).toHaveBeenCalledExactlyOnceWith(RUNNING);
  expect(h.tracker.replay).toHaveBeenCalledOnce();
  expect(h.updates.replay).toHaveBeenCalledOnce();
  expect(h.stats.replay).toHaveBeenCalledOnce();
});
