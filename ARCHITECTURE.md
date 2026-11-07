# Architecture

IdleOn Companion reads a few fields of Legends of Idleon every second, read-only, and shows them in a window next to
the game. This file describes the code as it is; the design and its reasons are in
[specs/001-screen-map/](specs/001-screen-map/spec.md).

## Two processes

```text
Steam ─▶ scripts/steam-launch.cmd ─▶ keeper (electron.exe, ELECTRON_RUN_AS_NODE=1, plain Node, no window)
                                       ├─ spawns the game with --remote-debugging-pipe (fd 3/4, no TCP port)
                                       ├─ reads it every 1000 ms (read.js: property reads only)
                                       ├─ named pipe \\.\pipe\idleon-companion ◀──▶ app (link client)
                                       └─ spawns the app detached with --from-steam
app (Electron main) ◀── IPC ──▶ preload (window.companion) ◀──▶ window (React)
```

- **Keeper** (`src/keeper/`, built to `out/main/keeper.js`). What Steam starts. It holds the game's debugging pipe for
  the whole session and exits only after the game: the game's Chromium closes when that pipe closes, so killing the
  keeper closes the game (the known limit in [docs/steam-setup.md](docs/steam-setup.md)). It takes an engine reference
  once per game load (a breakpoint in `getGameAttribute:function(`, one pause), then runs `read.js` on it every second
  and publishes a reading only when it changed; every good reading republishes the last status with `lastReadingAt`
  (the window's "last reading N s ago"). A failed reading is skipped; only a lost reference (a reload) takes the engine again.
- **App** (`src/main/`, `src/preload/`, `src/renderer/`, built to `out/main/index.js`, `out/preload/index.cjs` and
  `out/renderer/`). A link client: it turns readings into a `GameContext` with the catalog (`names.json`) and sends it
  to the window. It never launches the game and never touches its pipe, so it can close, crash or be killed with the
  game open; reopening it reconnects and gets the last status and reading. One instance (a second one focuses the
  first window); the window's X hides it in the tray, and only the tray's "Quit", the game exiting with "Close
  companion when the game closes", or the system ending the session end the app.

## Code folders

| Folder          | Runs in                                    | What it holds                                                                                                                                                                   |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/keeper/`   | the keeper (plain Node)                    | `index.ts` (entry), `keeper.ts` (the flow), `launch.ts`, `cdp.ts`, `engine-ref.ts`, `reader.ts`, `read.js`, `update-watch.ts`, `link-server.ts`; `mock-game/` is a test fixture |
| `src/main/`     | the app's main process                     | `index.ts` (entry: window, tray, link, IPC), `catalog/`, `context.ts`, `settings.ts`, `lifecycle.ts`, `link-client.ts`, `payloads.ts`, `window-options.ts`                      |
| `src/preload/`  | the window's preload (sandboxed, CommonJS) | `index.ts`: exposes `window.companion` (`CompanionApi`)                                                                                                                         |
| `src/renderer/` | the window (sandboxed, no Node)            | `App.tsx`, `StatusBar.tsx`, `SettingsView.tsx`, `ScreenMapPanel.tsx`, `NameIt.tsx`, `modules/screen-map.ts`, `styles.css`                                                       |
| `src/shared/`   | everywhere                                 | the contracts: `types.ts`, `link.ts` (line codec), `reading.ts` (`toReading`), `modules.ts` (`modulesFor`); other folders import `src/shared/index.ts` only                     |

Pure logic (`decide`, `modulesFor`, catalog, context, settings, payload checks, `windowOptions`) lives in files without
an `electron` import, so tests load it without Electron.

## Contracts

**Link, keeper ↔ app** (spec §5.4): the named pipe `\\.\pipe\idleon-companion` (Node `net`, never TCP), one JSON
message per line.

| Message                            | Direction    | Content                                                  |
| ---------------------------------- | ------------ | -------------------------------------------------------- |
| `{ "type": "reading", "reading" }` | keeper → app | a new `Reading`                                          |
| `{ "type": "status", "status" }`   | keeper → app | `Status`: `game`, `reader`, `message?`, `lastReadingAt?` |
| `{ "type": "confirm-attach" }`     | app → keeper | the user clicked "Connect next time"                     |

A new client first gets the last status and the last reading. A second keeper finds the pipe taken and exits without
launching anything. The app tries the pipe again every 5 s while it is missing.

**IPC, main ↔ window** (spec §5.4), through the preload only:

| Channel                         | Direction     | Content                                              |
| ------------------------------- | ------------- | ---------------------------------------------------- |
| `context:update`                | main → window | `GameContext`                                        |
| `status:update`                 | main → window | `Status`                                             |
| `catalog:name`                  | window → main | `{ table: "menu" \| "menu2" \| "codex", key, name }` |
| `settings:get` / `settings:set` | window ↔ main | `Settings`                                           |
| `reader:confirm-attach`         | window → main | sent on to the keeper as `confirm-attach`            |
| `module:<id>:*`                 | both          | reserved for modules (none in v1)                    |

The preload keeps the last `context:update` and `status:update` and replays them to a late subscriber.

## Boundaries (dependency-cruiser)

`.dependency-cruiser.cjs`, run by `just arch` inside `just check`. Every rule is an error.

| Rule                                 | Forbids                                                     | Why                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keeper-and-shared-without-electron` | `src/keeper/` and `src/shared/` importing `electron`        | the keeper runs as plain Node (`ELECTRON_RUN_AS_NODE`), and shared code runs everywhere                                                                           |
| `keeper-alone`                       | `src/keeper/` importing `src/main`, `preload` or `renderer` | the keeper holds the game's pipe and must not depend on the app                                                                                                   |
| `main-not-keeper-or-renderer`        | `src/main/` importing `src/keeper` or `renderer`            | the main process reaches the keeper over the link and the window over IPC, never by import                                                                        |
| `preload-alone`                      | `src/preload/` importing `src/main`, `keeper` or `renderer` | the preload is the window's thin bridge                                                                                                                           |
| `renderer-without-node`              | `src/renderer/` importing `src/main`, `keeper` or `preload` | the window reaches the main process only through `window.companion`                                                                                               |
| `renderer-without-node-core`         | `src/renderer/` importing Node core modules                 | the window is sandboxed, without Node. Exception, accepted on 07/11: `*.test.ts(x)` files, which run in Node and may read files (the CSP test reads `index.html`) |
| `shared-alone`                       | `src/shared/` importing any of the four process folders     | shared code is the common contract and depends on none of them                                                                                                    |

## Safety

- **Read-only inside the game.** `read.js` only reads properties; `src/keeper/read-only.test.ts` runs it against an
  engine whose every function throws when called.
- **Fail closed in the keeper** (`src/keeper/keeper.ts`). The game opens without `--remote-debugging-pipe`, and so
  without reading, when the game code is suspicious (changed, with debugger-detection markers: "The game code changed
  and contains: <markers>. Reading is off for this session."; "Connect next time" records its hash for the next
  session), when it cannot be checked (`app.asar` present, its `N.js` unreadable: "Could not check the game code: the
  reader needs an update."), or when the keeper fails before launching (the link server fails with anything but
  "already running", or the data folder cannot be created; logged when the log is writable). The game never depends on
  the app: in every one of these cases it still opens.
- **Navigation lockdown** (`src/main/window-options.ts`, `src/main/index.ts`): `sandbox`, `contextIsolation`, no
  `nodeIntegration`; `setWindowOpenHandler` denies every new window, and `will-navigate` is prevented for any URL but the
  window's own page (`isAllowedNavigation`). The page has the CSP `default-src 'self'`, so the UI has no inline styles.
- **IPC sender check**: every `ipcMain.handle` refuses a call whose sender frame is not the window's own page.
- **Shape checks on every message** (`src/main/payloads.ts`, `src/shared/link.ts`, `src/shared/reading.ts`): the line
  decoder skips junk lines and checks the message type; the main process checks a link `reading` (`toReading`) and
  `status` before use, and each IPC payload (`catalog:name`: a known table, a catalog key, a non-blank name;
  `settings:set`: the three booleans); a payload of the wrong shape is refused.
- **No network** anywhere: the link is a local named pipe, the debugging channel is a pipe, and the window's CSP allows
  only its own files.

## User data

`%APPDATA%\IdleOn Companion\`, never in the repository:

| File             | Written by | Content                                                                                                                   |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `names.json`     | app        | the user's catalog; `names.json.bak` before each save, `names.json.bad` for an invalid file (the default catalog is used) |
| `settings.json`  | app        | `Settings`; invalid or missing → defaults                                                                                 |
| `game-hash.json` | keeper     | the hash of the last game code read without a warning, or confirmed                                                       |
| `keeper.log`     | keeper     | one JSON line per entry (`t`, `label`, `id` = the game pid), the pause time included                                      |
| `game.log`       | keeper     | the game's own output                                                                                                     |

The default catalog ships in `src/main/catalog/default-names.json`.
