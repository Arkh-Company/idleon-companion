// The gallery, a dev tool of feature 010 (contracts/gallery.md): `just gallery <lot>` builds it into TREES_OUT, outside
// the repository, and it never enters the installer. No plugins: nothing here touches the network.
import { resolve } from "node:path";
import { defineConfig } from "vite";

const out = process.env.TREES_OUT;
if (!out)
  throw new Error(
    "TREES_OUT is not set: the gallery is built outside the repository, into TREES_OUT",
  );

const dir = import.meta.dirname;
const outDir = resolve(out, "gallery-app");
// Three builds share the folder, so none of them empties it.
const shared = { outDir, emptyOutDir: false };

// eslint-disable-next-line no-restricted-syntax -- vite reads the config's default export; the lint exception covers only root configs
export default defineConfig({
  root: dir,
  base: "./",
  // With `builder`, `vite build` builds every environment below.
  builder: {},
  environments: {
    // The two pages: the tree page imports the app's FormulaTree.tsx and styles.css; the gallery page shows the cards.
    client: {
      build: {
        ...shared,
        rolldownOptions: {
          input: {
            tree: resolve(dir, "tree-page.html"),
            gallery: resolve(dir, "gallery-page.html"),
          },
        },
      },
    },
    // The tool's main process, CommonJS so main.js runs outside a "type": "module" package.
    main: {
      consumer: "server",
      build: {
        ...shared,
        rolldownOptions: {
          input: { main: resolve(dir, "main.ts") },
          output: { format: "cjs", entryFileNames: "[name].js" },
        },
      },
    },
    // The preload on its own build: a sandboxed preload must be one CommonJS file, with no shared chunk.
    preload: {
      consumer: "server",
      build: {
        ...shared,
        rolldownOptions: {
          input: { preload: resolve(dir, "preload.ts") },
          output: { format: "cjs", entryFileNames: "[name].cjs" },
        },
      },
    },
  },
});
