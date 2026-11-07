// @vitest-environment jsdom
// The window (spec §5.6): the Screen map panel, "Name it", the status bar and the settings view.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import type { CompanionApi, GameContext, Status } from "../shared/index.ts";
import { ScreenMapPanel } from "./ScreenMapPanel.tsx";
import { SettingsView } from "./SettingsView.tsx";
import { StatusBar } from "./StatusBar.tsx";

let companion: {
  [K in keyof CompanionApi]: ReturnType<typeof vi.fn<CompanionApi[K]>>;
};

beforeEach(() => {
  companion = {
    onContext: vi.fn<CompanionApi["onContext"]>(() => () => undefined),
    onStatus: vi.fn<CompanionApi["onStatus"]>(() => () => undefined),
    name: vi.fn<CompanionApi["name"]>(() => Promise.resolve()),
    getSettings: vi.fn<CompanionApi["getSettings"]>(() =>
      Promise.resolve({ ...DEFAULT_SETTINGS }),
    ),
    setSettings: vi.fn<CompanionApi["setSettings"]>(() => Promise.resolve()),
    confirmAttach: vi.fn<CompanionApi["confirmAttach"]>(() =>
      Promise.resolve(),
    ),
  };
  window.companion = companion;
});
afterEach(cleanup);

const ctx = (
  screenPart: Partial<GameContext["screen"]>,
  rest: Partial<Omit<GameContext, "screen">> = {},
): GameContext => ({
  screen: {
    world: 1,
    map: 0,
    menu: 0,
    window: 0,
    tab: 0,
    codexTab: null,
    codexSel: null,
    ...screenPart,
  },
  character: null,
  afk: null,
  names: {},
  unnamed: [],
  updatedAt: 1,
  ...rest,
});

const send = () => Promise.resolve();

test("the panel shows the map with its name and the window's name", () => {
  render(
    <ScreenMapPanel
      ctx={ctx(
        { map: 264, window: 44 },
        {
          names: {
            map: "Emperor's Castle Doorstep",
            window: { name: "Sailing", status: "confirmed" },
          },
        },
      )}
      send={send}
    />,
  );

  expect(screen.getByText("264 Emperor's Castle Doorstep")).toBeDefined();
  expect(screen.getByText("Sailing")).toBeDefined();
});

test("the panel shows the world, the menu, the Codex tab with its item, the character and the AFK target", () => {
  render(
    <ScreenMapPanel
      ctx={ctx(
        { world: 6, menu: 3, codexTab: 0, codexSel: "Scripticus" },
        {
          character: "Darkhe",
          afk: "w6d3",
          names: {
            menu: { name: "Codex", status: "confirmed" },
            codexTab: { name: "Quests", status: "confirmed" },
            afk: "Samurai Guardian",
          },
        },
      )}
      send={send}
    />,
  );

  expect(screen.getByText("6")).toBeDefined();
  expect(screen.getByText("Codex")).toBeDefined();
  expect(screen.getByText("Quests")).toBeDefined();
  expect(screen.getByText("Scripticus")).toBeDefined();
  expect(screen.getByText("Darkhe")).toBeDefined();
  expect(screen.getByText("Samurai Guardian")).toBeDefined();
});

test("the Codex tab row says the Codex is not open outside menu 3", () => {
  render(<ScreenMapPanel ctx={ctx({ menu: 0, codexTab: 2 })} send={send} />);

  expect(screen.getByText("Not open")).toBeDefined();
});

test("the panel says when no character is selected", () => {
  render(<ScreenMapPanel ctx={ctx({}, { character: null })} send={send} />);

  expect(screen.getByText("No character selected")).toBeDefined();
});

test("an unnamed window is named with Enter in the Name it field", () => {
  render(
    <ScreenMapPanel
      ctx={ctx({ window: 999 }, { unnamed: [{ table: "menu2", key: "999" }] })}
      send={send}
    />,
  );

  expect(screen.getByText("unnamed #999")).toBeDefined();
  const field = screen.getByLabelText("Name it");
  fireEvent.change(field, { target: { value: "Test" } });
  fireEvent.keyDown(field, { key: "Enter" });

  expect(companion.name).toHaveBeenCalledWith("menu2", "999", "Test");
});

test("a blank name is not sent", () => {
  render(
    <ScreenMapPanel
      ctx={ctx({ window: 999 }, { unnamed: [{ table: "menu2", key: "999" }] })}
      send={send}
    />,
  );

  const field = screen.getByLabelText("Name it");
  fireEvent.change(field, { target: { value: "  " } });
  fireEvent.keyDown(field, { key: "Enter" });

  expect(companion.name).not.toHaveBeenCalled();
});

test("a deduced entry is marked as from game code, a confirmed one is not", () => {
  render(
    <ScreenMapPanel
      ctx={ctx(
        { menu: 1, window: 44 },
        {
          names: {
            menu: { name: "Items", status: "confirmed" },
            window: { name: "Sailing", status: "deduced" },
          },
        },
      )}
      send={send}
    />,
  );

  expect(screen.getAllByTitle("from game code")).toHaveLength(1);
});

test("the status bar explains how to get a live reading when the game was not launched", () => {
  render(<StatusBar status={{ game: "not-launched", reader: "error" }} />);

  expect(
    screen.getByText(
      "Live reading needs the game to be launched through Steam with the companion launch option.",
    ),
  ).toBeDefined();
});

test.each<[Status, string]>([
  [{ game: "running", reader: "attached" }, "Game running"],
  [{ game: "closed", reader: "error" }, "Game closed"],
  [{ game: "running", reader: "attached" }, "Reader attached"],
  [{ game: "running", reader: "connecting" }, "Reader connecting"],
  [{ game: "running", reader: "error" }, "Reader off"],
])("the status bar shows %o as %s", (status, text) => {
  render(<StatusBar status={status} />);

  expect(screen.getByText(text)).toBeDefined();
});

test("the status bar shows how long ago the last reading came", () => {
  render(
    <StatusBar
      status={{
        game: "running",
        reader: "attached",
        lastReadingAt: Date.now() - 5000,
      }}
    />,
  );

  expect(screen.getByText("last reading 5 s ago")).toBeDefined();
});

test("the update warning offers Connect next time, which confirms and says when reading starts", async () => {
  render(
    <StatusBar
      status={{
        game: "running",
        reader: "error",
        message:
          "The game code changed and contains: debugger. Reading is off for this session.",
      }}
    />,
  );

  expect(
    screen.getByText(
      "The game code changed and contains: debugger. Reading is off for this session.",
    ),
  ).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Connect next time" }));

  expect(companion.confirmAttach).toHaveBeenCalledOnce();
  expect(
    await screen.findByText("Reading starts next time the game opens."),
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: "Connect next time" })).toBe(
    null,
  );
});

test.each([
  "Could not check the game code: the reader needs an update.",
  "Could not create the data folder: reading is off for this session.",
  "Reading failed: boom",
  "Game updated: the reader needs an update",
])("the message %s shows without a Connect next time button", (message) => {
  render(<StatusBar status={{ game: "running", reader: "error", message }} />);

  expect(screen.getByText(message)).toBeDefined();
  expect(screen.queryByRole("button")).toBe(null);
});

test.each([
  ["Show window when the game starts", "showWindowOnGameStart"],
  ["Close companion when the game closes", "closeWithGame"],
  ["Always on top", "alwaysOnTop"],
] as const)("the %s checkbox saves the toggled value", async (label, key) => {
  render(<SettingsView />);

  fireEvent.click(await screen.findByLabelText(label));

  expect(companion.setSettings).toHaveBeenCalledWith({
    ...DEFAULT_SETTINGS,
    [key]: !DEFAULT_SETTINGS[key],
  });
});
