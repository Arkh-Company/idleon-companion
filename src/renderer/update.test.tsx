// @vitest-environment jsdom
// The update lines of the status bar and of Settings (spec US4, FR-022, FR-023, FR-025, FR-034).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { Status, UpdateState } from "../shared/index.ts";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { SettingsView } from "./SettingsView.tsx";
import { StatusBar } from "./StatusBar.tsx";

let companion: CompanionStub;

beforeEach(() => {
  companion = stubCompanion();
});
afterEach(cleanup);

const STATUS: Status = { game: "closed", reader: "error" };
const READY = "Update ready";
const RESTART = "Restart to update";
const AFTER_GAME = "Update installs after the game closes";
const FAILED = "Could not check for updates";

function given(u: UpdateState) {
  companion.onUpdate.mockImplementation((cb) => {
    cb(u);
    return () => undefined;
  });
}
const restart = () => screen.queryByRole("button", { name: RESTART });
const barText = () => screen.getByRole("status").textContent;

test("a ready update with the game closed offers the restart", () => {
  given({ state: "ready", version: "1.2.3", canInstall: true });
  render(<StatusBar status={STATUS} />);

  expect(screen.getByText(READY)).toBeDefined();
  expect(barText()).not.toContain(AFTER_GAME);

  fireEvent.click(screen.getByRole("button", { name: RESTART }));
  expect(companion.installUpdate).toHaveBeenCalledOnce();
});

test("the restart button is reached with Tab", () => {
  given({ state: "ready", version: "1.2.3", canInstall: true });
  render(<StatusBar status={STATUS} />);

  const button = screen.getByRole("button", { name: RESTART });
  button.focus();
  expect(document.activeElement).toBe(button);
});

test("a ready update with the game open waits, button disabled", () => {
  given({ state: "ready", version: "1.2.3", canInstall: false });
  render(<StatusBar status={STATUS} />);

  expect(screen.getByText(READY)).toBeDefined();
  expect(screen.getByText(AFTER_GAME)).toBeDefined();
  expect(restart()).toHaveProperty("disabled", true);
});

test.each<UpdateState>([
  { state: "none" },
  { state: "downloading", version: "1.2.3" },
  { state: "check-failed" },
])("the status bar stays quiet for %j", (u) => {
  given(u);
  render(<StatusBar status={STATUS} />);

  expect(barText()).not.toContain(READY);
  expect(barText()).not.toContain(FAILED);
  expect(restart()).toBe(null);
});

test("a failed check is one line in Settings", async () => {
  given({ state: "check-failed" });
  render(<SettingsView />);

  expect(await screen.findByText(FAILED)).toBeDefined();
});

test.each<UpdateState>([
  { state: "none" },
  { state: "downloading", version: "1.2.3" },
  { state: "ready", version: "1.2.3", canInstall: true },
])("Settings says nothing about updates for %j", async (u) => {
  given(u);
  render(<SettingsView />);

  await screen.findByText("Always on top");
  expect(screen.queryByText(FAILED)).toBe(null);
});
