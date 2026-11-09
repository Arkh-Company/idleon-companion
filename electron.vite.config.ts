import { defineConfig } from "electron-vite";

// Entries follow electron-vite's defaults: src/main/index.ts, src/preload/index.ts, src/renderer/index.html → out/.
export default defineConfig({
  main: {
    build: {
      // One executable, three bundles: out/main/start.js picks the role and loads only the app's (index.js) or the
      // keeper's (keeper.js), so each role loads only its own code (research R1). calculator.js is the app's worker.
      rolldownOptions: {
        input: {
          start: "src/start/index.ts",
          index: "src/main/index.ts",
          keeper: "src/keeper/index.ts",
          calculator: "src/calculator/index.ts",
        },
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
