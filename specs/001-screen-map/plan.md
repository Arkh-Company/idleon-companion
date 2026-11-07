# Implementation Plan: IdleOn Companion v1 (Screen Map)

**Branch**: `spec/001-screen-map` (planning), `feat/001-screen-map` (code) | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

> Origin: the approved plan `C:\Users\Vinicius\idleon-companion\docs\plans\2026-11-06-idleon-companion-v1.md`
> (13 tasks, 0 → 12; Task 0 done on 06/11; Task 1 Step 1, the kit-base, done on 07/11). Goal, architecture, tech
> stack, global constraints and review focus are copied below as approved. The steps of Tasks 1–12 live in
> [tasks.md](tasks.md), in the kit's format, with the paths changed by the "Kit decisions" section. Where the original
> plan and `tasks.md` differ, `tasks.md` wins.

## Summary

**Goal:** An Electron app, started by Steam in place of the game, that launches Legends of Idleon with a private
debugging pipe, reads a few game fields every second (read-only), and shows a live "Screen map" panel where unnamed
screen numbers can be named.

**Architecture (revised after Task 0 — the game dies when the pipe closes):** Two processes. A **keeper**
(`electron.exe` with `ELECTRON_RUN_AS_NODE=1`, plain Node, no window) is what Steam starts: it spawns the game with
`--remote-debugging-pipe`, takes an engine reference once (breakpoint inside `getGameAttribute`), runs `read.js`
(property reads only) every 1000 ms, publishes changes over a local named pipe, starts the app detached, and exits only
after the game exits. The **app** (Electron main + React window) is a link client: it turns readings into a
`GameContext` with the catalog and sends it to the window over fixed IPC channels; it can close, crash or be killed
without touching the game. Features are modules (`CompanionModule`); v1 ships one: `screen-map`.

## Technical Context

**Language/Version**: TypeScript 6 (`module: nodenext`, strict), Node 24 (mise); Electron 45.2.3 for the app and the keeper
**Primary Dependencies**: `electron` 45.2.3, `electron-vite` 6.0.0, `vite` 8.3.6, `react`/`react-dom` 19.3.1;
dev: `jsdom` 31.0.0, `@testing-library/react` 16.3.3, `@types/react`/`@types/react-dom` 19.3.0, `dependency-cruiser` 18.7.2
**Storage**: JSON files in `%APPDATA%\IdleOn Companion\` (`names.json`, `settings.json`, `game-hash.json`, `keeper.log`)
**Testing**: vitest 5 (`just test`, `vitest run --dir src`), jsdom per file (`// @vitest-environment jsdom`), Edge
headless for the reader integration test (skipped when Edge is absent, as on the Linux CI)
**Target Platform**: Windows 11 (the game is Windows/Steam); the CI runs `just check` on Ubuntu
**Project Type**: desktop app (Electron: keeper + main + preload + renderer)
**Performance Goals**: panel follows the game within ~1 s (poll 1000 ms); debugger pause once per session (~268 ms measured)
**Constraints**: read-only inside the game; no network; CSP `default-src 'self'`; game files never in the repo
**Scale/Scope**: one player, one game instance, one window

## Global Constraints

- Inside the game only property reads run: no game function is ever called, nothing is written to game state or the save.
- No network access anywhere in the app (no Firebase, no HTTP); renderer CSP `default-src 'self'`.
- Game files (N.js, default.pak, anything under the Steam folder) never go into the repo; they are read from the user's install.
- UI copy is in English.
- User data lives in `%APPDATA%\IdleOn Companion\` (`names.json`, `settings.json`, logs).
- Settings defaults: `showWindowOnGameStart: true`, `closeWithGame: true`, `alwaysOnTop: false`.
- Poll interval 1000 ms; CDP request timeout 20000 ms; reconnect/re-acquire retry 5000 ms.
- Breakpoint anchor text: `getGameAttribute:function(`; game script URL suffix: `/static/game/N.js`.
- IPC channels exactly: `context:update`, `status:update`, `catalog:name`, `settings:get`, `settings:set`, `reader:confirm-attach`, `module:<id>:*`.
- Keeper ↔ app link: named pipe `\\.\pipe\idleon-companion` (Node `net`, never TCP), one JSON message per line: `{type:"reading",reading}`, `{type:"status",status}` (keeper → app), `{type:"confirm-attach"}` (app → keeper). A new client first gets the last status and the last reading.
- The keeper runs as `electron.exe` with `ELECTRON_RUN_AS_NODE=1`; it never exits before the game; if the link pipe already exists it exits without launching anything. The app is started by the keeper with `--from-steam`, detached, without `ELECTRON_RUN_AS_NODE` in its env.
- Update-warning copy: "The game code changed and contains: <markers>. Connect anyway?" with a button "Connect anyway".
- `world = Math.floor(map / 50) + 1`.
- Missing-live-reading copy: "Live reading needs the game to be launched through Steam with the companion launch option."
- Game-updated copy: "Game updated: the reader needs an update".

## Kit decisions (07/11/2026)

Decided with the user on 07/11 (spec, Open Questions) or found by a throwaway scaffold outside the repo
(`electron-vite build`, `tsc`, `eslint`, `vitest` and `depcruise` run against the kit's own configuration):

1. **Process.** The kit's flow replaces `superpowers:subagent-driven-development`: this folder goes in the spec PR,
   then `/implementar 001` runs the Done gate phase (the session, each edit confirmed by the user) and six code phases
   (Executor + Revisor, a stop after each), and opens one code PR.
2. **Tests next to the code in `src/`** (`src/main/catalog/catalog.test.ts`, ...), because `just test` runs
   `vitest run --dir src`. The link test, which uses both the keeper's server and the app's client, lives at
   `src/link.test.ts`, outside the boundary folders. The mock game is a fixture in `src/keeper/mock-game/`.
3. **Boundaries in dependency-cruiser** (`.dependency-cruiser.cjs`, recipe `just arch` inside `just check`):
   `src/keeper` and `src/shared` never import `electron`; `src/keeper` imports only `src/shared`; `src/main` never
   imports `src/keeper` or `src/renderer`; `src/preload` imports only `src/shared`; `src/renderer` imports neither
   `src/main`, `src/keeper`, `src/preload` nor Node core modules; `src/shared` imports none of the four.
   `ARCHITECTURE.md` describes them (last phase).
4. **Placement that follows from 3.** `read.js` and `read-source.ts` live in `src/keeper/` (the keeper runs them),
   not in `src/main/reader/`. `modulesFor` is pure and lives in `src/shared/modules.ts`; the `screen-map` module (its
   `Panel` is a React component) lives in `src/renderer/modules/screen-map.ts`, and the window picks the panels: the
   main process imports no React (spec §6.3: v1 has no `service`). `CompanionModule` in `src/shared/types.ts` uses
   `import type` from `react` only.
5. **No `@vitejs/plugin-react`.** The CSP `default-src 'self'` blocks the inline preamble of React Fast Refresh, so the
   renderer runs with `server.hmr: false` (`electron.vite.config.ts`), and then the plugin changes nothing: Vite 8's
   oxc transforms the JSX on its own (same bundle with and without it), and vitest renders `.tsx` without config.
6. **Preload as CommonJS** (`out/preload/index.cjs`): the window keeps the default `sandbox: true`, which needs a
   CommonJS preload, with `contextIsolation: true` and `nodeIntegration: false`. `rolldownOptions` (Vite 8), not the
   deprecated `rollupOptions`. No inline `style` attributes in the UI (the CSP blocks them): styles in
   `src/renderer/styles.css`.
7. **Electron 45 downloads its binary on first use** (no `postinstall`): no `pnpm-workspace.yaml` change. A test must
   never import a module that imports `electron` (that would download the binary, and tests use no network): pure
   logic (`decide`, `modulesFor`, catalog, context, settings) lives in files without `electron` imports.
8. **Named pipes on the Linux CI.** Tests build the pipe path with `process.platform === "win32" ? "\\\\.\\pipe\\<name>"
   : join(tmpdir(), "<name>.sock")`; the code takes the path as a parameter.
9. **Catalog names in English.** `scripts/convert-prototype-names.ts` translates the prototype's Portuguese names with a
   fixed table (Bigorna → Anvil, Baú → Storage, Itens → Items, Amigos → Friends, ...); the UI is in English.
10. **The Steam launch script and its doc** (original Task 12, Steps 1–2) go in the last code phase. The in-game
    checklist (Task 12, Step 3) runs with the user after the code PR merge, with explicit OK before touching Steam.
11. **Done-gate changes** found by the scaffold: `tsconfig.json` (`"jsx": "react-jsx"`; `include` gains `scripts` and
    `electron.vite.config.ts`, which ESLint's project service needs), `eslint.config.mjs` (ignore `out/**`, the build
    output, and `src/keeper/mock-game/**`, browser fixture code), `.prettierignore` (`src/keeper/mock-game/`: Prettier
    would rewrite the anchor `getGameAttribute:function(` that the reader looks for), `justfile` (`dev`, `build` and
    `clean` go through electron-vite and `out/`; `arch` joins `check`), `.dependency-cruiser.cjs` (new) and
    `tsconfig.build.json` removed (the build is electron-vite now).

## Constitution Check

| Principle | How this plan meets it |
| --- | --- |
| Product scope (mission, non-goals) | Read-only property reads; no game function, no save write, no network, no clicks, no game files in the repo. Proof test in Phase 3 (T030). |
| Done gate (TDD, `just check`) | Every code task writes its failing test first; every phase ends with `just check`. Tests use no network (Edge only on a local `file://` page). |
| Simplicity | No speculative module system beyond the spec's `CompanionModule`; probe mode and game-tables left out (spec Out of Scope); `@vitejs/plugin-react` dropped. |
| Architecture (`ARCHITECTURE.md`, dependency-cruiser) | Decision 3: rules in the Done gate, `ARCHITECTURE.md` in Phase 6 (T064). |
| Code (index.ts public API, English names, ≤ 400 lines, structured logs) | `src/shared/index.ts` re-exports the shared API and other folders import it from there; the keeper log writes one JSON line per entry with `label` and `id` (the game pid). |
| Security | No secrets; the only external inputs are the game's readings (validated shape before use), the user's JSON files (invalid → defaults) and the link messages (junk lines skipped). |

## Project Structure

```text
electron.vite.config.ts            # main (index + keeper entries), preload (cjs), renderer (hmr off)
.dependency-cruiser.cjs            # boundaries (Done gate)
scripts/
├── convert-prototype-names.ts     # prototype names.json → src/main/catalog/default-names.json
└── steam-launch.cmd               # Steam launch option → keeper
docs/steam-setup.md
ARCHITECTURE.md
src/
├── main.ts, main.test.ts          # kit smoke (unchanged)
├── link.test.ts                   # keeper server ↔ app client over the named pipe
├── shared/                        # index.ts (public API), types.ts, link.ts, modules.ts
├── keeper/                        # index.ts (entry), cdp.ts, launch.ts, engine-ref.ts, reader.ts,
│   │                              # update-watch.ts, link-server.ts, read.js, read-source.ts
│   └── mock-game/                 # fixture: app.html, static/game/index.html, static/game/N.js
├── main/                          # index.ts (entry), catalog/, context.ts, settings.ts, lifecycle.ts, link-client.ts
├── preload/index.ts
└── renderer/                      # index.html, main.tsx, App.tsx, ScreenMapPanel.tsx, StatusBar.tsx, NameIt.tsx,
                                   # SettingsView.tsx, styles.css, modules/screen-map.ts
```

## Review Focus

1. Game reloads or changes scene so the engine `objectId` dies → reader must re-acquire within ~5 s and keep emitting, not freeze on the last reading. (Test in Phase 3.)
2. Steam passes the exe path with spaces and parentheses (`C:\Program Files (x86)\...\LegendsOfIdleon.exe`) plus extra args → the game must start with every arg intact plus `--remote-debugging-pipe`. (Test in Phase 3.)
3. Fractional `MenuType` values (`0.1`, `0.2`, `0.78`) must map to catalog keys `"0.1"`, `"0.2"`, `"0.78"`, not `"0"`. (Test in Phase 2.)
4. The game closes while a CDP request is in flight → pending requests reject, no unhandled rejection, status becomes `closed`. (Test in Phase 3.)
5. The user starts the app by hand while the Steam-launched copy runs → second copy only focuses the first window and never launches the game twice; a second keeper finds the link pipe taken and exits. (Tests in Phases 4 and 5.)
6. The app is killed while the game runs → keeper and game keep going; reopening the app reconnects and gets the last status/reading. (Test in Phase 4; manual after the merge.)
