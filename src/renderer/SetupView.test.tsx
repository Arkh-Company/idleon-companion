// @vitest-environment jsdom
// The setup screen (FR-005, FR-006, FR-008, FR-011, FR-014, FR-029, FR-034 and the Edge Cases).
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
import { SetupView } from "./SetupView.tsx";

const SET_UP = "Close Steam and set up";
const MANUAL = '"C:\\Apps\\IdleOn Companion.exe" --keeper %command%';
const FILE = "C:\\Steam\\userdata\\102\\config\\localconfig.vdf";
const BACKUP = "C:\\Data\\steam-backup\\102-localconfig.vdf";
const base: SteamState = {
  steam: "found",
  account: { id: "102", name: "Test Two" },
  game: "installed",
  option: {
    current: "",
    next: MANUAL,
    state: "not-set",
    consoleScript: false,
  },
  configured: false,
  gameOpen: false,
  details: { file: FILE, backup: BACKUP },
  manualOption: MANUAL,
};
const other = {
  current: "-windowed",
  next: `"C:\\App.exe" --keeper %command% -windowed`,
  state: "other",
  consoleScript: false,
} as const;

let companion: CompanionStub;
let emit: (p: SetupProgress) => void;
const onReload = vi.fn<() => void>();
const onFinished = vi.fn<() => void>();

beforeEach(() => {
  companion = stubCompanion();
  onReload.mockClear();
  onFinished.mockClear();
  companion.onSetupProgress.mockImplementation((cb) => {
    emit = cb;
    return () => undefined;
  });
});
afterEach(cleanup);

const view = (state: Partial<SteamState> = {}) =>
  render(
    <SetupView
      state={{ ...base, ...state }}
      onReload={onReload}
      onFinished={onFinished}
    />,
  );
const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const noButton = (name: string) =>
  screen.queryByRole("button", { name }) === null;
const never = () => new Promise<SetupProgress>(() => undefined);

test("shows Steam, the account, the game and an empty option", () => {
  view();
  expect(screen.getByText("Steam found")).toBeDefined();
  expect(screen.getByText("Account: Test Two")).toBeDefined();
  expect(screen.getByText("Legends of Idleon found")).toBeDefined();
  expect(screen.getByText("Launch option: not set")).toBeDefined();
  expect(button(SET_UP).disabled).toBe(false);
});

test("with the user's own option: the current text, the new text and that nothing is removed", () => {
  view({ option: other });
  expect(screen.getByText("-windowed")).toBeDefined();
  expect(screen.getByText(other.next)).toBeDefined();
  expect(
    screen.getByText(
      "The companion only adds to your launch option; nothing is removed.",
    ),
  ).toBeDefined();
  expect(screen.queryByText("Launch option: not set")).toBeNull();
});

test("the setup button calls setupSteam", () => {
  companion.setupSteam.mockReturnValue(never());
  view();
  fireEvent.click(button(SET_UP));
  expect(companion.setupSteam).toHaveBeenCalledTimes(1);
});

test("between the click and the first step the buttons are already disabled", () => {
  companion.setupSteam.mockReturnValue(never());
  view();
  fireEvent.click(button(SET_UP));
  expect(button(SET_UP).disabled).toBe(true);
  expect(button("Details").disabled).toBe(true);
});

test.each([
  ["closing-steam", "Closing Steam…"],
  ["setting-up", "Setting up…"],
  ["opening-steam", "Opening Steam…"],
] as const)("step %s shows %s, with the buttons disabled", (step, text) => {
  view();
  act(() => {
    emit(step);
  });
  expect(screen.getByText(text)).toBeDefined();
  expect(button(SET_UP).disabled).toBe(true);
  expect(button("Details").disabled).toBe(true);
});

test("with the game open the button is disabled and says to close the game first", () => {
  view({ gameOpen: true });
  expect(button(SET_UP).disabled).toBe(true);
  expect(screen.getByText("Close the game first")).toBeDefined();
});

test("without the game open there is no such line", () => {
  view();
  expect(screen.queryByText("Close the game first")).toBeNull();
});

test("a console script in the option shows the warning", () => {
  view({ option: { ...other, consoleScript: true } });
  expect(
    screen.getByText(
      "This launch option also runs a console script; the gem store may not open.",
    ),
  ).toBeDefined();
});

test.each([
  ["steam-did-not-close", "Steam did not close. Nothing was changed."],
  [
    "unreadable-config",
    "Steam's settings could not be read. Nothing was changed.",
  ],
] as const)(
  "%s: its message and Try again, which runs setup again",
  async (reason, text) => {
    companion.setupSteam.mockResolvedValue({ step: "failed", reason });
    view();
    fireEvent.click(button(SET_UP));
    expect(await screen.findByText(text)).toBeDefined();
    expect(noButton(SET_UP)).toBe(true);
    expect(button("Try again").disabled).toBe(false);
    expect(onFinished).not.toHaveBeenCalled();
    fireEvent.click(button("Try again"));
    expect(companion.setupSteam).toHaveBeenCalledTimes(2);
  },
);

test("a refused setup reloads the state and offers no Try again (the game was opened meanwhile)", async () => {
  companion.setupSteam.mockResolvedValue({
    step: "failed",
    reason: "game-open",
  });
  view();
  fireEvent.click(button(SET_UP));
  await waitFor(() => {
    expect(onReload).toHaveBeenCalledTimes(1);
  });
  expect(noButton("Try again")).toBe(true);
  expect(button(SET_UP).disabled).toBe(false);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("Steam not reopening: setup is done, only that line stays", async () => {
  companion.setupSteam.mockResolvedValue({
    step: "failed",
    reason: "steam-did-not-open",
  });
  view();
  fireEvent.click(button(SET_UP));
  expect(
    await screen.findByText("Setup is done. Open Steam yourself."),
  ).toBeDefined();
  expect(noButton("Try again")).toBe(true);
  expect(noButton(SET_UP)).toBe(true);
  expect(onFinished).toHaveBeenCalled();
  expect(onReload).not.toHaveBeenCalled();
});

test("done: only the final line stays", async () => {
  view();
  fireEvent.click(button(SET_UP));
  expect(
    await screen.findByText("All set. Press Play in Steam as usual."),
  ).toBeDefined();
  expect(noButton(SET_UP)).toBe(true);
  expect(noButton("Details")).toBe(true);
  expect(screen.queryByText("Steam found")).toBeNull();
  expect(onFinished).toHaveBeenCalled();
});

test("a done progress event finishes before the call answers", () => {
  companion.setupSteam.mockReturnValue(never());
  view();
  fireEvent.click(button(SET_UP));
  act(() => {
    emit("done");
  });
  expect(
    screen.getByText("All set. Press Play in Steam as usual."),
  ).toBeDefined();
  expect(onFinished).toHaveBeenCalled();
});

test("Details shows the exact option, the account, the file and the copy", () => {
  view({ option: other });
  expect(screen.queryByText(FILE)).toBeNull();
  // the new text is on the screen already; Details adds the second copy
  expect(screen.getAllByText(other.next)).toHaveLength(1);
  fireEvent.click(button("Details"));
  expect(screen.getAllByText(other.next)).toHaveLength(2);
  expect(screen.getByText("Test Two")).toBeDefined();
  expect(screen.getByText(FILE)).toBeDefined();
  expect(screen.getByText(BACKUP)).toBeDefined();
  fireEvent.click(button("Details"));
  expect(screen.queryByText(FILE)).toBeNull();
});

test.each<[string, Partial<SteamState>, string, string[]]>([
  [
    "Steam not found",
    {
      steam: "not-found",
      account: null,
      game: "not-installed",
      option: null,
      details: null,
    },
    "Steam not found",
    ["Legends of Idleon not found", "Sign in to Steam once, then come back."],
  ],
  [
    "the game not installed",
    { game: "not-installed" },
    "Legends of Idleon not found",
    ["Sign in to Steam once, then come back."],
  ],
  [
    "no account",
    { account: null, option: null, details: null },
    "Sign in to Steam once, then come back.",
    ["Legends of Idleon not found"],
  ],
])("%s: what is missing and no setup button", (_name, state, shown, hidden) => {
  view(state);
  expect(screen.getByText(shown)).toBeDefined();
  for (const text of hidden) expect(screen.queryByText(text)).toBeNull();
  expect(noButton(SET_UP)).toBe(true);
});

test.each<[string, Partial<SteamState>]>([
  [
    "Steam not found",
    {
      steam: "not-found",
      account: null,
      game: "not-installed",
      option: null,
      details: null,
    },
  ],
  ["the game not installed", { game: "not-installed", option: null }],
])("%s: Details has the text to paste by hand", (_name, state) => {
  view(state);
  expect(screen.queryByText(MANUAL)).toBeNull();
  fireEvent.click(button("Details"));
  expect(screen.getByText(MANUAL)).toBeDefined();
});

test("an unreadable file: the reason and the text to paste, and the error wins over a game not found", () => {
  view({
    account: null,
    game: "not-installed",
    option: null,
    details: null,
    error: "Steam's settings could not be read (not UTF-8).",
  });
  expect(screen.getByRole("alert").textContent).toBe(
    "Steam's settings could not be read (not UTF-8).",
  );
  expect(screen.getByText(MANUAL)).toBeDefined();
  expect(screen.queryByText("Legends of Idleon not found")).toBeNull();
  expect(
    screen.queryByText("Sign in to Steam once, then come back."),
  ).toBeNull();
  expect(noButton(SET_UP)).toBe(true);
  expect(noButton("Details")).toBe(true);
});

test("an unreadable file of a known account: Details has the file and does not repeat the text to paste", () => {
  view({ option: null, error: "Steam's settings could not be read (x)." });
  fireEvent.click(button("Details"));
  expect(screen.getByText(FILE)).toBeDefined();
  expect(screen.getAllByText(MANUAL)).toHaveLength(1);
});

test("setupSteam rejecting mid-flow: the error, Try again and the buttons active again", async () => {
  let reject: (e: Error) => void = () => undefined;
  companion.setupSteam.mockReturnValue(
    new Promise<SetupProgress>((_resolve, r) => {
      reject = r;
    }),
  );
  view();
  fireEvent.click(button(SET_UP));
  act(() => {
    emit("setting-up");
  });
  await act(async () => {
    reject(new Error("disk full"));
    await Promise.resolve();
  });
  expect(screen.getByRole("alert").textContent).toBe(
    "Setup did not finish: disk full",
  );
  expect(screen.queryByText("Setting up…")).toBeNull();
  expect(button("Try again").disabled).toBe(false);
  expect(button("Details").disabled).toBe(false);
  expect(onFinished).not.toHaveBeenCalled();
  // a save that failed after the write: reloading would swap the window and lose this error
  expect(onReload).not.toHaveBeenCalled();
  companion.setupSteam.mockResolvedValue("done");
  fireEvent.click(button("Try again"));
  expect(
    await screen.findByText("All set. Press Play in Steam as usual."),
  ).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the text of a rejected call comes without Electron's prefix", async () => {
  companion.setupSteam.mockRejectedValue(
    new Error("Error invoking remote method 'steam:setup': Error: disk full"),
  );
  view();
  fireEvent.click(button(SET_UP));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Setup did not finish: disk full",
  );
});

test("the window gaining focus reloads the state", () => {
  view();
  fireEvent(window, new Event("focus"));
  expect(onReload).toHaveBeenCalledTimes(1);
});

test("the window gaining focus does not reload while setup runs", () => {
  companion.setupSteam.mockReturnValue(never());
  view();
  fireEvent.click(button(SET_UP));
  fireEvent(window, new Event("focus"));
  act(() => {
    emit("closing-steam");
  });
  fireEvent(window, new Event("focus"));
  expect(onReload).not.toHaveBeenCalled();
});

test("the window gaining focus does not reload once setup is done", () => {
  view();
  act(() => {
    emit("done");
  });
  fireEvent(window, new Event("focus"));
  expect(onReload).not.toHaveBeenCalled();
});

// FR-034: a native <button> takes Tab and Enter from the browser; jsdom has no key activation, so this pins that the
// buttons stay native, in the tab order and never submit anything.
test("every button is native and in the tab order", () => {
  view();
  const buttons = screen.getAllByRole<HTMLButtonElement>("button");
  expect(buttons.map((b) => b.textContent)).toEqual([SET_UP, "Details"]);
  for (const b of buttons) {
    expect(b.tagName).toBe("BUTTON");
    expect(b.type).toBe("button");
    expect(b.tabIndex).toBe(0);
    b.focus();
    expect(document.activeElement).toBe(b);
  }
});
