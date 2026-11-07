import { defineConfig } from "electron-vite";

// Entries follow electron-vite's defaults: src/main/index.ts, src/preload/index.ts, src/renderer/index.html → out/.
export default defineConfig({
  main: {
    build: {
      // The keeper is built next to the app's main: out/main/keeper.js (plain Node, run by scripts/steam-launch.cmd).
      rolldownOptions: {
        input: { index: "src/main/index.ts", keeper: "src/keeper/index.ts" },
      },
    },
  },
  preload: {
    build: {
      // The window keeps sandbox: true, which needs a CommonJS preload (plan, Kit decision 6).
      rolldownOptions: {
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    // React Fast Refresh injects an inline script that the CSP default-src 'self' blocks (plan, Kit decision 5).
    server: { hmr: false },
  },
});
