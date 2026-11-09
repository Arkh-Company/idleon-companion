// @vitest-environment jsdom
// The window (spec §5.6): the Screen map panel, the status bar and the settings view.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import type { GameContext, Status } from "../shared/index.ts";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { ScreenMapPanel } from "./ScreenMapPanel.tsx";
import { SettingsView } from "./SettingsView.tsx";
import { StatusBar } from "./StatusBar.tsx";

let companion: CompanionStub;

beforeEach(() => {
  companion = stubCompanion();
});
afterEach(cleanup);

const ctx = (
  screenPart: Partial<GameContext["screen"]>,
  rest: Partial<Omit<GameContext, "screen">> = {},
): GameContext => ({
  screen: { world: 1, map: 0, label: "None", ...screenPart },
  character: null,
  afk: null,
  names: { map: "Unknown map", afk: "None" },
  updatedAt: 1,
  ...rest,
});

const send = () => Promise.resolve();

test("the panel has the rows Screen, World, Map, Character and AFK target, in that order", () => {
  render(<ScreenMapPanel ctx={ctx({})} send={send} />);

  expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
    "Screen",
    "World",
    "Map",
    "Character",
    "AFK target",
  ]);
});

test("the panel has no Menu, Window or Codex tab row", () => {
  render(<ScreenMapPanel ctx={ctx({})} send={send} />);

  for (const name of ["Menu", "Window", "Codex tab"])
    expect(screen.queryByRole("rowheader", { name })).toBe(null);
});

test("the panel shows the world, the map without its number, the character and the AFK target", () => {
  render(
    <ScreenMapPanel
      ctx={ctx(
        { world: 6, map: 264 },
        {
          character: "Tester",
          afk: "w6d3",
          names: { map: "Emperor's Castle Doorstep", afk: "Samurai Guardian" },
        },
      )}
      send={send}
    />,
  );

  expect(screen.getByText("6")).toBeDefined();
  expect(screen.getByText("Emperor's Castle Doorstep")).toBeDefined();
  expect(screen.queryByText(/264/)).toBe(null);
  expect(screen.getByText("Tester")).toBeDefined();
  expect(screen.getByText("Samurai Guardian")).toBeDefined();
});

test.each([
  "Codex › Cards › Sets",
  "Breeding › Unknown tab",
  "Unknown screen",
  "None",
])("the Screen row shows %s", (label) => {
  render(<ScreenMapPanel ctx={ctx({ label })} send={send} />);

  expect(screen.getByRole("row", { name: `Screen ${label}` })).toBeDefined();
});

test("a name with markup shows as literal text", () => {
  render(<ScreenMapPanel ctx={ctx({ label: "<b>Bold</b>" })} send={send} />);

  expect(screen.getByText("<b>Bold</b>")).toBeDefined();
  expect(document.querySelector("b")).toBe(null);
});

test("the panel says when no character is selected", () => {
  render(<ScreenMapPanel ctx={ctx({}, { character: null })} send={send} />);

  expect(screen.getByText("No character selected")).toBeDefined();
});

test("a map the tables lack shows Unknown map", () => {
  render(<ScreenMapPanel ctx={ctx({ map: 999 })} send={send} />);

  expect(screen.getByText("Unknown map")).toBeDefined();
});

test("an AFK target the tables lack shows Unknown monster", () => {
  render(
    <ScreenMapPanel
      ctx={ctx(
        {},
        {
          afk: "w9x",
          names: { map: "Unknown map", afk: "Unknown monster" },
        },
      )}
      send={send}
    />,
  );

  expect(screen.getByText("Unknown monster")).toBeDefined();
});

test("no AFK target shows None", () => {
  render(
    <ScreenMapPanel
      ctx={ctx({ label: "Sailing" }, { afk: null })}
      send={send}
    />,
  );

  expect(screen.getByText("None")).toBeDefined();
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
