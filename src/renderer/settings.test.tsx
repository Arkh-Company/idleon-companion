// @vitest-environment jsdom
// "Set up Steam" in Settings (spec FR-014, FR-029, FR-034). Undoing the setup is the uninstaller's alone (FR-013).
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SteamState } from "../shared/index.ts";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { SteamSettings } from "./SettingsView.tsx";

const SET_UP = "Set up Steam";
const state: SteamState = {
  steam: "found",
  account: { id: "102", name: "Test Two" },
  game: "installed",
  option: null,
  configured: true,
  gameOpen: false,
  details: null,
  manualOption: "",
};

let companion: CompanionStub;
const onReload = vi.fn<() => void>();
const onSteam = vi.fn<(s: SteamState) => void>();

beforeEach(() => {
  companion = stubCompanion();
  onReload.mockClear();
  onSteam.mockClear();
});
afterEach(cleanup);

const view = () =>
  render(<SteamSettings onReload={onReload} onSteam={onSteam} />);
const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const click = (name: string) => {
  fireEvent.click(button(name));
};

test("Set up Steam, already set up for the last account: says so and opens nothing", async () => {
  companion.steamState.mockResolvedValue(state);
  view();

  click(SET_UP);

  expect(
    await screen.findByText("Steam is already set up for Test Two"),
  ).toBeDefined();
  expect(onSteam).not.toHaveBeenCalled();
});

test("Set up Steam, the last account is not set up: hands the state over to open the setup screen", async () => {
  const other = {
    ...state,
    account: { id: "103", name: "Other" },
    configured: false,
  };
  companion.steamState.mockResolvedValue(other);
  view();

  click(SET_UP);

  await waitFor(() => {
    expect(onSteam).toHaveBeenCalledWith(other);
  });
  expect(screen.queryByText(/already set up/)).toBeNull();
});

test("Set up Steam when Steam cannot be checked: the error shows", async () => {
  companion.steamState.mockRejectedValue(new Error("tasklist failed"));
  view();

  click(SET_UP);

  expect(
    await screen.findByText("Steam could not be checked: tasklist failed"),
  ).toBeDefined();
});

test("Set up Steam clears the last line", async () => {
  companion.steamState.mockResolvedValueOnce(state);
  view();
  click(SET_UP);
  await screen.findByText("Steam is already set up for Test Two");
  companion.steamState.mockReturnValue(new Promise(() => undefined));

  click(SET_UP);

  expect(screen.queryByText("Steam is already set up for Test Two")).toBeNull();
});

test("Settings has no way to remove from Steam: that is the uninstaller's", () => {
  view();

  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
    SET_UP,
  ]);
});

test("the window gaining focus reads Steam again", () => {
  view();

  fireEvent(window, new Event("focus"));

  expect(onReload).toHaveBeenCalledOnce();
});

// FR-034: a native <button> takes Tab and Enter from the browser; jsdom has no key activation.
test("Set up Steam takes the keyboard focus", () => {
  view();

  const b = button(SET_UP);
  b.focus();

  expect(document.activeElement).toBe(b);
  expect(b.type).toBe("button");
  expect(b.tabIndex).toBe(0);
});
