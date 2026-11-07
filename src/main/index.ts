// App entry (Electron main process): one window for now.
import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { windowOptions } from "./window-options.ts";

function createWindow(): void {
  const win = new BrowserWindow(
    windowOptions(join(import.meta.dirname, "../preload/index.cjs")),
  );
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
