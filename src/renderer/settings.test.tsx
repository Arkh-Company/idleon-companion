// @vitest-environment jsdom
// "Set up Steam" and "Remove from Steam" in Settings (spec US3, FR-012, FR-014, FR-029, FR-034).
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SetupProgress, SteamState } from "../shared/index.ts";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { SteamSettings } from "./SettingsView.tsx";

const SET_UP = "Set up Steam";
const REMOVE = "Remove from Steam";
const CONFIRM = "Close Steam and remove";
const QUESTION =
  "Steam will close to remove the companion from the launch option of Legends of Idleon. Continue?";
const FIRST = "Close the game first";
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
let emit: (p: SetupProgress) => void;
const onReload = vi.fn<() => void>();
const onSteam = vi.fn<(s: SteamState) => void>();
const onRemoveStart = vi.fn<() => void>();

beforeEach(() => {
  companion = stubCompanion();
  companion.onSetupProgress.mockImplementation((cb) => {
    emit = cb;
    return () => undefined;
  });
  onReload.mockClear();
  onSteam.mockClear();
  onRemoveStart.mockClear();
});
afterEach(cleanup);

const view = (gameOpen = false) =>
  render(
    <SteamSettings
      gameOpen={gameOpen}
      onReload={onReload}
      onSteam={onSteam}
      onRemoveStart={onRemoveStart}
    />,
  );
const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const click = (name: string) => {
  fireEvent.click(button(name));
};
const confirmRemoval = () => {
  click(REMOVE);
  click(CONFIRM);
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

test("Remove from Steam asks first: nothing runs until it is confirmed", () => {
  view();

  click(REMOVE);

  expect(screen.getByText(QUESTION)).toBeDefined();
  expect(companion.removeFromSteam).not.toHaveBeenCalled();
  expect(onRemoveStart).not.toHaveBeenCalled();
});

test("Cancel closes the question and removes nothing", () => {
  view();
  click(REMOVE);

  click("Cancel");

  expect(screen.queryByText(QUESTION)).toBeNull();
  expect(companion.removeFromSteam).not.toHaveBeenCalled();
});

test("confirming removes and shows each step, with the buttons off until it ends", async () => {
  let finish: (p: SetupProgress) => void = () => undefined;
  companion.removeFromSteam.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  view();

  confirmRemoval();

  expect(companion.removeFromSteam).toHaveBeenCalledOnce();
  expect(onRemoveStart).toHaveBeenCalledOnce();
  expect(screen.queryByText(QUESTION)).toBeNull();
  expect(button(REMOVE).disabled).toBe(true);
  expect(button(SET_UP).disabled).toBe(true);
  for (const [step, line] of [
    ["closing-steam", "Closing Steam…"],
    ["setting-up", "Removing…"],
    ["opening-steam", "Opening Steam…"],
  ] as const) {
    act(() => {
      emit(step);
    });
    expect(screen.getByRole("status").textContent).toBe(line);
  }

  await act(async () => {
    finish("done");
    await Promise.resolve();
  });

  expect(screen.getByRole("status").textContent).toBe("Removed from Steam.");
  expect(button(REMOVE).disabled).toBe(false);
  expect(button(SET_UP).disabled).toBe(false);
});

test.each([
  ["steam-did-not-close", "Steam did not close. Nothing was changed."],
  [
    "unreadable-config",
    "Some of Steam's settings could not be read. Those accounts were not changed.",
  ],
  ["steam-did-not-open", "Removed from Steam. Open Steam yourself."],
] as const)("a removal ending in %s says so", async (reason, line) => {
  companion.removeFromSteam.mockResolvedValue({ step: "failed", reason });
  view();

  confirmRemoval();

  expect(await screen.findByText(line)).toBeDefined();
  expect(onReload).not.toHaveBeenCalled();
});

test("the game opened meanwhile: the state is read again, which turns the button off", async () => {
  companion.removeFromSteam.mockResolvedValue({
    step: "failed",
    reason: "game-open",
  });
  view();

  confirmRemoval();

  await waitFor(() => {
    expect(onReload).toHaveBeenCalledOnce();
  });
  expect(screen.queryByRole("status")).toBeNull();
});

test("a removal that throws shows the error, without Electron's prefix", async () => {
  companion.removeFromSteam.mockRejectedValue(
    new Error("Error invoking remote method 'steam:remove': Error: disk full"),
  );
  view();

  confirmRemoval();

  expect(
    await screen.findByText("Remove did not finish: disk full"),
  ).toBeDefined();
  expect(button(REMOVE).disabled).toBe(false);
});

test.each([
  ["opening the question", REMOVE],
  ["Set up Steam", SET_UP],
])("%s clears the last line", async (_name, name) => {
  companion.removeFromSteam.mockResolvedValue("done");
  companion.steamState.mockReturnValue(new Promise(() => undefined));
  view();
  confirmRemoval();
  await screen.findByText("Removed from Steam.");

  click(name);

  expect(screen.queryByText("Removed from Steam.")).toBeNull();
});

test("with the game open: Remove from Steam is off and says why, Set up Steam still works", () => {
  view(true);

  expect(button(REMOVE).disabled).toBe(true);
  expect(screen.getByText(FIRST)).toBeDefined();
  expect(button(SET_UP).disabled).toBe(false);
});

test("with no game open there is no line about closing it", () => {
  view();

  expect(button(REMOVE).disabled).toBe(false);
  expect(screen.queryByText(FIRST)).toBeNull();
});

test("the game opening during the question turns the confirmation off", () => {
  const { rerender } = view();
  click(REMOVE);

  rerender(
    <SteamSettings
      gameOpen
      onReload={onReload}
      onSteam={onSteam}
      onRemoveStart={onRemoveStart}
    />,
  );

  expect(button(CONFIRM).disabled).toBe(true);
});

test("the window gaining focus reads Steam again, but not during a removal", () => {
  companion.removeFromSteam.mockReturnValue(new Promise(() => undefined));
  view();

  fireEvent(window, new Event("focus"));
  expect(onReload).toHaveBeenCalledOnce();

  confirmRemoval();
  fireEvent(window, new Event("focus"));
  expect(onReload).toHaveBeenCalledOnce();
});

// FR-034: a native <button> takes Tab and Enter from the browser; jsdom has no key activation.
test.each([SET_UP, REMOVE])("%s takes the keyboard focus", (name) => {
  view();

  const b = button(name);
  b.focus();

  expect(document.activeElement).toBe(b);
  expect(b.type).toBe("button");
  expect(b.tabIndex).toBe(0);
});

test("Set up Steam closes an open question", () => {
  companion.steamState.mockReturnValue(new Promise(() => undefined));
  view();
  click(REMOVE);

  click(SET_UP);

  expect(screen.queryByText(QUESTION)).toBeNull();
});

test("a second removal does not start with the last step of the first", async () => {
  companion.removeFromSteam.mockResolvedValueOnce("done");
  view();
  confirmRemoval();
  act(() => {
    emit("opening-steam");
  });
  await screen.findByText("Removed from Steam.");
  companion.removeFromSteam.mockReturnValue(new Promise(() => undefined));

  confirmRemoval();

  expect(screen.queryByRole("status")).toBeNull();
});
