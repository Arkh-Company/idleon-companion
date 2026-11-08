// Test helper (only the window's tests import it): a `window.companion` whose every method is a vi.fn.
import { vi } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import type { CompanionApi } from "../shared/index.ts";

export type CompanionStub = {
  [K in keyof CompanionApi]: ReturnType<typeof vi.fn<CompanionApi[K]>>;
};

/** Installs a fresh stub on `window.companion` and returns it; nothing is subscribed or saved. */
export function stubCompanion(): CompanionStub {
  const companion: CompanionStub = {
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
    // ponytail: Steam set up by default, so the 001 window's tests see the 001 window; setup tests override it.
    steamState: vi.fn<CompanionApi["steamState"]>(() =>
      Promise.resolve({
        steam: "found",
        account: { id: "1", name: "Player" },
        game: "installed",
        option: null,
        configured: true,
        gameOpen: false,
        details: null,
        manualOption: '"C:\\app.exe" --keeper %command%',
      }),
    ),
    setupSteam: vi.fn<CompanionApi["setupSteam"]>(() =>
      Promise.resolve("done"),
    ),
    onSetupProgress: vi.fn<CompanionApi["onSetupProgress"]>(
      () => () => undefined,
    ),
    releaseGame: vi.fn<CompanionApi["releaseGame"]>(() => Promise.resolve()),
    reconnect: vi.fn<CompanionApi["reconnect"]>(() => Promise.resolve()),
    onUpdate: vi.fn<CompanionApi["onUpdate"]>(() => () => undefined),
    installUpdate: vi.fn<CompanionApi["installUpdate"]>(() =>
      Promise.resolve(),
    ),
  };
  window.companion = companion;
  return companion;
}
