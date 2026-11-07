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
