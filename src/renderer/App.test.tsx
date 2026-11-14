// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type {
  GameContext,
  SetupProgress,
  Status,
  SteamState,
} from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";

const ctx: GameContext = {
  screen: { world: 6, map: 264, label: "None" },
  character: null,
  afk: null,
  names: { map: "Emperor's Castle Doorstep", afk: "None" },
  updatedAt: 1,
};
const status: Status = { game: "running", reader: "attached" };
const notSetUp: SteamState = {
  steam: "found",
  account: { id: "102", name: "Test Two" },
  game: "installed",
  option: {
    current: "",
    next: '"C:\\App.exe" --keeper %command%',
    state: "not-set",
    consoleScript: false,
  },
  configured: false,
  gameOpen: false,
  details: null,
  manualOption: '"C:\\App.exe" --keeper %command%',
};
const SET_UP = "Close Steam and set up";

let companion: CompanionStub;
let emit: (p: SetupProgress) => void;

beforeEach(() => {
  companion = stubCompanion();
  companion.onSetupProgress.mockImplementation((cb) => {
    emit = cb;
    return () => undefined;
  });
  // The preload replays the last value to a late subscriber at once.
  companion.onContext.mockImplementation((cb) => {
    cb(ctx);
    return () => undefined;
  });
  companion.onStatus.mockImplementation((cb) => {
    cb(status);
    return () => undefined;
  });
});
afterEach(cleanup);

test("index.html allows only the app's own resources", () => {
  const html = readFileSync(join(import.meta.dirname, "index.html"), "utf8");
  const page = new DOMParser().parseFromString(html, "text/html");
  const csp = page.querySelector('meta[http-equiv="Content-Security-Policy"]');

  expect(csp?.getAttribute("content")).toBe("default-src 'self'");
  expect(page.title).toBe("IdleOn Companion");
});

test("App shows the companion heading", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: "IdleOn Companion" }),
  ).toBeDefined();
});

test("App shows the status and the Screen map panel of the last context", async () => {
  render(<App />);

  expect(await screen.findByText("Reader attached")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Screen map" })).toBeDefined();
  expect(screen.getByText("Emperor's Castle Doorstep")).toBeDefined();
  expect(await screen.findByLabelText("Always on top")).toBeDefined();
});

test("no text box exists in the whole window (SC-004)", async () => {
  render(<App />);

  expect(await screen.findByLabelText("Always on top")).toBeDefined();
  expect(screen.queryAllByRole("textbox")).toEqual([]);
});

const expectOnlySetup = () => {
  expect(screen.queryByText("Reader attached")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Screen map" })).toBeNull();
  expect(screen.queryByLabelText("Always on top")).toBeNull();
};

test("Steam not set up: only the setup screen", async () => {
  companion.steamState.mockResolvedValue(notSetUp);
  render(<App />);

  expect(await screen.findByRole("button", { name: SET_UP })).toBeDefined();
  expectOnlySetup();
});

test("Steam set up: the 001 window and no setup screen", async () => {
  render(<App />);

  expect(await screen.findByText("Reader attached")).toBeDefined();
  expect(screen.queryByRole("button", { name: SET_UP })).toBeNull();
});

test("before steamState answers neither the setup screen nor the 001 window shows (FR-005)", () => {
  companion.steamState.mockReturnValue(new Promise(() => undefined));
  render(<App />);

  expect(
    screen.getByRole("heading", { name: "IdleOn Companion" }),
  ).toBeDefined();
  expectOnlySetup();
  expect(screen.queryByRole("button", { name: SET_UP })).toBeNull();
});

/** Under the load of a whole run, a page's first answers can take longer than findBy's 1 s (it failed 3 times so). */
const SLOW = { timeout: 5_000 };

test("a done progress switches to the 001 window and keeps the final line", async () => {
  companion.steamState.mockResolvedValue(notSetUp);
  render(<App />);
  await screen.findByRole("button", { name: SET_UP }, SLOW);

  act(() => {
    emit("done");
  });

  expect(screen.getByText("Reader attached")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Screen map" })).toBeDefined();
  expect(await screen.findByLabelText("Always on top", {}, SLOW)).toBeDefined();
  expect(
    screen.getByText("All set. Press Play in Steam as usual."),
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: SET_UP })).toBeNull();
}, 15_000);

test("Steam not reopening also switches to the 001 window, with its line", async () => {
  companion.steamState.mockResolvedValue(notSetUp);
  companion.setupSteam.mockResolvedValue({
    step: "failed",
    reason: "steam-did-not-open",
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: SET_UP }));

  expect(await screen.findByText("Reader attached")).toBeDefined();
  expect(screen.getByText("Setup is done. Open Steam yourself.")).toBeDefined();
});

/** The screen's focus listener comes from a passive effect that can still be pending, so the focus repeats until the
 * second steamState call (the first is the window's load). */
const focusReloads = () =>
  waitFor(() => {
    fireEvent(window, new Event("focus"));
    expect(companion.steamState).toHaveBeenCalledTimes(2);
  });

test("the window gaining focus reloads: the game closed, the button is active", async () => {
  companion.steamState.mockResolvedValue({ ...notSetUp, gameOpen: true });
  render(<App />);
  const before = await screen.findByRole<HTMLButtonElement>("button", {
    name: SET_UP,
  });
  expect(before.disabled).toBe(true);

  companion.steamState.mockResolvedValue(notSetUp);
  await focusReloads();

  await waitFor(() => {
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: SET_UP }).disabled,
    ).toBe(false);
  });
});

test("the option pasted by hand: the next focus switches to the 001 window", async () => {
  companion.steamState.mockResolvedValue(notSetUp);
  render(<App />);
  await screen.findByRole("button", { name: SET_UP });

  companion.steamState.mockResolvedValue({ ...notSetUp, configured: true });
  await focusReloads();

  expect(await screen.findByText("Reader attached")).toBeDefined();
});

test("steamState rejecting: the error shows and the next focus asks again", async () => {
  companion.steamState.mockRejectedValue(new Error("tasklist failed"));
  render(<App />);

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Steam could not be checked (tasklist failed).",
  );
  expect(screen.queryByText("Steam not found")).toBeNull();
  expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
  expectOnlySetup();

  companion.steamState.mockResolvedValue(notSetUp);
  await focusReloads();

  expect(await screen.findByRole("button", { name: SET_UP })).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("another companion in the launch option: the warning, no setup button, nothing to paste", async () => {
  const next = '"C:\\Old.exe" --keeper "C:\\App.exe" --keeper %command%';
  companion.steamState.mockResolvedValue({
    ...notSetUp,
    option: {
      current: '"C:\\Old.exe" --keeper %command%',
      next,
      state: "other-companion",
      consoleScript: false,
    },
  });
  render(<App />);

  expect(
    await screen.findByText(
      "Another companion is already in the launch option",
    ),
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: SET_UP })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Details" }));
  expect(screen.getByText("Test Two", { selector: "dd" })).toBeDefined();
  expect(screen.queryByText(next)).toBeNull();
});

test("Set up Steam with another account now last used: the setup screen for that account", async () => {
  render(<App />);
  const open = await screen.findByRole("button", { name: "Set up Steam" });

  companion.steamState.mockResolvedValue(notSetUp);
  fireEvent.click(open);

  expect(await screen.findByRole("button", { name: SET_UP })).toBeDefined();
  expect(screen.getByText("Account: Test Two")).toBeDefined();
  expectOnlySetup();
});

test("Steam no longer set up for the last account: the next focus shows the setup screen", async () => {
  render(<App />);
  await screen.findByRole("button", { name: "Set up Steam" });

  companion.steamState.mockResolvedValue(notSetUp);
  await focusReloads();

  expect(await screen.findByRole("button", { name: SET_UP })).toBeDefined();
  expectOnlySetup();
});

test("Set up Steam for another account after a setup: a fresh setup screen, without the old last line", async () => {
  companion.steamState.mockResolvedValue(notSetUp);
  render(<App />);
  await screen.findByRole("button", { name: SET_UP });
  act(() => {
    emit("done");
  });

  fireEvent.click(await screen.findByRole("button", { name: "Set up Steam" }));

  expect(await screen.findByRole("button", { name: SET_UP })).toBeDefined();
  expect(
    screen.queryByText("All set. Press Play in Steam as usual."),
  ).toBeNull();
  expectOnlySetup();
});
