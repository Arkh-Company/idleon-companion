// @vitest-environment jsdom
// "Let the game close" and "Reconnect" in the status bar (spec US2, FR-015 to FR-018, FR-034, Edge Cases).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { GAME_UPDATED } from "../shared/index.ts";
import type { Status } from "../shared/index.ts";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { StatusBar } from "./StatusBar.tsx";

let companion: CompanionStub;

beforeEach(() => {
  companion = stubCompanion();
});
afterEach(cleanup);

const REMINDER = "To close the game, press Let the game close first.";
const ATTACHED: Status = { game: "running", reader: "attached" };
const RELEASED: Status = { game: "running", reader: "released" };
const button = (name: string) => screen.queryByRole("button", { name });
const barText = () => screen.getByRole("status").textContent;

test("while reading, the bar offers Let the game close and says why", () => {
  render(<StatusBar status={ATTACHED} />);

  expect(button("Let the game close")).not.toBe(null);
  expect(screen.getByText(REMINDER)).toBeDefined();
  expect(button("Reconnect")).toBe(null);
  expect(barText()).not.toContain("You can close the game now");
});

test("Let the game close asks the keeper to let go", () => {
  render(<StatusBar status={ATTACHED} />);

  fireEvent.click(screen.getByRole("button", { name: "Let the game close" }));

  expect(companion.releaseGame).toHaveBeenCalledOnce();
  expect(companion.reconnect).not.toHaveBeenCalled();
});

test("once released, the bar says the game can close and offers Reconnect", () => {
  render(<StatusBar status={RELEASED} />);

  expect(barText()).toContain("Reader off · You can close the game now");
  expect(button("Reconnect")).not.toBe(null);
  expect(button("Let the game close")).toBe(null);
  expect(screen.queryByText(REMINDER)).toBe(null);
});

test("Reconnect asks the keeper to read again", () => {
  render(<StatusBar status={RELEASED} />);

  fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));

  expect(companion.reconnect).toHaveBeenCalledOnce();
  expect(companion.releaseGame).not.toHaveBeenCalled();
});

test.each<Status>([
  { game: "closed", reader: "attached" },
  { game: "closed", reader: "released" },
  { game: "closed", reader: "error" },
  { game: "not-launched", reader: "attached" },
  { game: "not-launched", reader: "released" },
  { game: "not-launched", reader: "error" },
])("no game open (%o): no button and no line about closing it", (status) => {
  render(<StatusBar status={status} />);

  expect(screen.queryByRole("button")).toBe(null);
  expect(screen.queryByText(REMINDER)).toBe(null);
  expect(barText()).not.toContain("You can close the game now");
});

test.each<Status>([
  { game: "running", reader: "connecting" },
  { game: "running", reader: "error" },
])("not reading and not released (%o): no button", (status) => {
  render(<StatusBar status={status} />);

  expect(screen.queryByRole("button")).toBe(null);
  expect(screen.queryByText(REMINDER)).toBe(null);
});

test("a reconnect that fails shows its message and keeps Reconnect", () => {
  const message = "no game page appeared";
  const { rerender } = render(<StatusBar status={RELEASED} />);

  rerender(<StatusBar status={{ game: "running", reader: "connecting" }} />);
  expect(screen.queryByRole("button")).toBe(null); // the new reader is trying: nothing to press yet
  rerender(
    <StatusBar status={{ game: "running", reader: "error", message }} />,
  );

  expect(screen.getByText(message)).toBeDefined();
  expect(button("Reconnect")).not.toBe(null);
});

test("reading again ends the reconnect offer: a later error has no Reconnect", () => {
  const { rerender } = render(<StatusBar status={RELEASED} />);

  rerender(<StatusBar status={ATTACHED} />);
  rerender(<StatusBar status={{ game: "running", reader: "error" }} />);

  expect(button("Reconnect")).toBe(null);
});

test("a game that closed ends the reconnect offer: the next game has no Reconnect", () => {
  const { rerender } = render(<StatusBar status={RELEASED} />);

  rerender(<StatusBar status={{ game: "closed", reader: "error" }} />);
  rerender(<StatusBar status={{ game: "running", reader: "error" }} />);

  expect(button("Reconnect")).toBe(null);
});

// FR-034: a native <button> takes Tab and Enter from the browser; jsdom has no key activation.
test.each([
  [ATTACHED, "Let the game close"],
  [RELEASED, "Reconnect"],
] as const)("the button of %o takes the keyboard focus", (status, name) => {
  render(<StatusBar status={status} />);

  const b = screen.getByRole<HTMLButtonElement>("button", { name });
  b.focus();

  expect(document.activeElement).toBe(b);
  expect(b.tagName).toBe("BUTTON");
  expect(b.type).toBe("button");
  expect(b.tabIndex).toBe(0);
});

test.each<Status["reader"]>(["error", "released"])(
  "a game update (reader %s): the message stays and Reconnect is gone, it would do nothing",
  (reader) => {
    const message = GAME_UPDATED;
    const { rerender } = render(<StatusBar status={RELEASED} />);

    rerender(<StatusBar status={{ game: "running", reader, message }} />);

    expect(screen.getByText(message)).toBeDefined();
    expect(button("Reconnect")).toBe(null);
  },
);
