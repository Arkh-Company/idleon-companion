// Boundaries between the processes (ARCHITECTURE.md; plan, Kit decision 3). Run by `just arch`.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "keeper-and-shared-without-electron",
      comment:
        "The keeper stays plain Node code inside Electron's main process (ADR 0003) and shared code runs everywhere: neither may load Electron.",
      severity: "error",
      from: { path: "^src/(keeper|shared)/" },
      to: { path: "node_modules/electron/" },
    },
    {
      name: "start-only-dispatches",
      comment:
        "The entry only picks the role: it loads the keeper's, the app's or the uninstaller mode's entry, nothing else.",
      severity: "error",
      from: { path: "^src/start/" },
      to: {
        path: "^src/",
        pathNot: [
          "^src/start/",
          "^src/keeper/index\\.ts$",
          "^src/main/index\\.ts$",
          "^src/main/remove-from-steam\\.ts$",
        ],
      },
    },
    {
      name: "keeper-alone",
      comment:
        "The keeper holds the game's pipe and must not depend on the app: it imports only src/shared.",
      severity: "error",
      from: { path: "^src/keeper/" },
      to: { path: "^src/(main|preload|renderer)/" },
    },
    {
      name: "main-not-keeper-or-renderer",
      comment:
        "The main process talks to the keeper over the link and to the window over IPC, never by import.",
      severity: "error",
      from: { path: "^src/main/" },
      to: { path: "^src/(keeper|renderer)/" },
    },
    {
      name: "preload-alone",
      comment:
        "The preload is the thin bridge of the window: it imports only src/shared.",
      severity: "error",
      from: { path: "^src/preload/" },
      to: { path: "^src/(main|keeper|renderer)/" },
    },
    {
      name: "renderer-without-node",
      comment:
        "The window reaches the main process only through window.companion (the preload), never by import.",
      severity: "error",
      from: { path: "^src/renderer/" },
      to: { path: "^src/(main|keeper|preload)/" },
    },
    {
      name: "renderer-without-node-core",
      comment:
        "The window runs sandboxed, without Node; its tests run in Node and may read files.",
      severity: "error",
      from: { path: "^src/renderer/", pathNot: "\\.test\\.tsx?$" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "shared-alone",
      comment:
        "Shared code is the common contract: it depends on none of the processes.",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/(main|keeper|preload|renderer)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
