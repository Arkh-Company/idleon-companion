// Type-only import: tests load this file without loading Electron (plan, Kit decision 7).
import type { BrowserWindowConstructorOptions } from "electron";

/** The companion window: no Node in the page, sandboxed, with the preload as the only bridge. */
export function windowOptions(
  preloadPath: string,
): BrowserWindowConstructorOptions {
  return {
    title: "IdleOn Companion",
    width: 420,
    height: 640,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}

/**
 * An IPC handler that runs `f` only for a call from the window's own page; any other sender, or none, is refused.
 * The event is typed by what is read, so tests pass plain objects (an IpcMainInvokeEvent fits).
 */
export function guardIpc(
  ownUrl: string,
  f: (payload: unknown) => unknown,
): (e: { senderFrame: { url: string } | null }, payload: unknown) => unknown {
  return (e, payload) => {
    const from = e.senderFrame?.url ?? "";
    if (!isAllowedNavigation(from, ownUrl))
      throw new Error(`IPC refused from ${from}`);
    return f(payload);
  };
}

/** The window never leaves its own page (Electron security checklist); only the hash may change. */
export function isAllowedNavigation(url: string, ownUrl: string): boolean {
  const withoutHash = (s: string) => {
    const u = new URL(s);
    u.hash = "";
    return u.href;
  };
  try {
    return withoutHash(url) === withoutHash(ownUrl);
  } catch {
    return false;
  }
}
