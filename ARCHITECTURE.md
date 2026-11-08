# Architecture

IdleOn Companion reads a few fields of Legends of Idleon every second, read-only, and shows them in a window next to
the game. This file describes the code as it is; the design and its reasons are in
[specs/001-screen-map/](specs/001-screen-map/spec.md) and [specs/002-install-and-setup/](specs/002-install-and-setup/spec.md).
The decisions that are hard to reverse are in [docs/adr/](docs/adr/) ([0001](docs/adr/0001-debugging-pipe-in-the-keeper.md):
the debugging pipe in a keeper process; [0002](docs/adr/0002-fail-closed-update-watch.md): the update watch fails closed;
[0003](docs/adr/0003-one-executable-launched-by-steam.md): one executable, launched by Steam directly;
[0004](docs/adr/0004-steam-launch-option-spliced-with-steam-closed.md): the launch option spliced with Steam closed;
[0005](docs/adr/0005-updates-from-a-public-releases-repository.md): updates from a public releases repository), and the
terms in [GLOSSARY.md](GLOSSARY.md).

## One executable, two processes

```text
Steam ─▶ "IdleOn Companion.exe" --keeper %command%
           └─ src/start/ picks the role ─▶ keeper (Electron's main process, no window, no electron import)
                                             ├─ spawns the game with --remote-debugging-pipe (fd 3/4, no TCP port)
                                             ├─ reads it every 1000 ms (read.js: property reads only)
                                             ├─ named pipe \\.\pipe\idleon-companion ◀──▶ app (link client)
                                             └─ spawns the same exe detached with --from-steam
app (Electron main) ◀── IPC ──▶ preload (window.companion) ◀──▶ window (React)
```

- **One executable** (`src/start/`, built to `out/main/start.js`, the `main` of `package.json`). The per-user NSIS
  installer (`electron-builder.yml`) puts one `IdleOn Companion.exe` at a fixed path,
  `%LOCALAPPDATA%\Programs\idleon-companion\`, so Steam's launch option stays valid across versions. `roleFor` takes the
  first flag it knows from the command line, and the entry loads only that role's bundle: `--keeper` is the keeper,
  `--remove-from-steam` is the uninstaller's mode (`src/main/remove-from-steam.ts`: no window, no single-instance lock,
  the result in the exit code), and anything else is the app. No console script stands between Steam and the game: with
  one, Steam does not start its overlay and the gem store's purchase window cannot open.
- **Keeper** (`src/keeper/`, built to `out/main/keeper.js`). What Steam starts: the same executable in Electron's main
  process, without `ELECTRON_RUN_AS_NODE`, as plain Node code with no `electron` import. It holds the game's debugging
  pipe for the whole session and exits only after the game: the game's Chromium closes when that pipe closes, so killing
  the keeper closes the game (the known limit in [docs/steam-setup.md](docs/steam-setup.md)). It takes an engine
  reference once per game load (a breakpoint in `getGameAttribute:function(`, one pause), then runs `read.js` on it every
  second and publishes a reading only when it changed; every good reading republishes the last status with
  `lastReadingAt` (the window's "last reading N s ago"). A failed reading is skipped; only a lost reference (a reload)
  takes the engine again. Only a pause at the reader's own breakpoint is read. A game script without the anchor (a game
  update) ends the reader for that game load, with "Game updated: the reader needs an update", instead of trying again.
  "Let the game close" (the link's `release`) stops the reader, lets go of the engine reference and detaches from the
  page, so the game's X closes it again; the debugging pipe stays open, and the status becomes `reader: "released"`.
  "Reconnect" (`reconnect`) starts a new reader on that pipe, with one new pause. The two run one after the other, so two
  sessions never exist at once. Neither is offered during `connecting`, a known limit.
- **App** (`src/main/`, `src/preload/`, `src/renderer/`, built to `out/main/index.js`, `out/preload/index.cjs` and
  `out/renderer/`). A link client: it turns readings into a `GameContext` with the catalog (`names.json`) and sends it
  to the window. It never launches the game and never touches its pipe, so it can close, crash or be killed with the
  game open; reopening it reconnects and gets the last status and reading. While Steam is not set up for the most recent
  account, the window is only the setup screen (`SetupView`). One instance: a second manual launch brings the first
  window forward, and a second launch from Steam (`--from-steam`) follows "Show window when the game starts"
  (`launchEvent`). When the keeper ends after the game, the window keeps "Game closed · last reading N s ago"
  (`statusOnLinkDrop`). The window's X hides it in the tray, and only the tray's "Quit", the game exiting with "Close
  companion when the game closes", or the system ending the session end the app.

## Code folders

| Folder          | Runs in                                    | What it holds                                                                                                                                                                                                                |
| --------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/start/`    | Electron's main process, first of all      | `index.ts` (the entry: loads only the role's bundle), `dispatch.ts` (`roleFor`)                                                                                                                                              |
| `src/keeper/`   | the keeper (Electron's main process)       | `index.ts` (entry), `keeper.ts` (the flow), `command-line.ts`, `launch.ts`, `cdp.ts`, `engine-ref.ts`, `reader.ts`, `read-source.ts`, `read.js`, `update-watch.ts`, `link-server.ts`; `mock-game/` is a test fixture         |
| `src/main/`     | the app's main process                     | `index.ts` (entry: window, tray, link, IPC), `steam/`, `setup-store.ts`, `remove-from-steam.ts`, `updates.ts`, `catalog/`, `context.ts`, `settings.ts`, `lifecycle.ts`, `link-client.ts`, `payloads.ts`, `window-options.ts` |
| `src/preload/`  | the window's preload (sandboxed, CommonJS) | `index.ts`: exposes `window.companion` (`CompanionApi`); `channel.ts`: one main → window channel                                                                                                                             |
| `src/renderer/` | the window (sandboxed, no Node)            | `App.tsx`, `SetupView.tsx`, `StatusBar.tsx`, `SettingsView.tsx`, `ScreenMapPanel.tsx`, `NameIt.tsx`, `modules/screen-map.ts`, `styles.css`                                                                                   |
| `src/shared/`   | everywhere                                 | the contracts: `types.ts`, `link.ts` (line codec), `reading.ts` (`toReading`), `modules.ts` (`modulesFor`); other folders import `src/shared/index.ts` only                                                                  |

Pure logic (`roleFor`, `decide`, `modulesFor`, `channel`, catalog, context, settings, payload checks, `windowOptions`,
the VDF and launch-option code, the update decisions) lives in files without an `electron` import, so tests load it
without Electron.

`build/installer.nsh` holds the installer's and uninstaller's own macros (see [Steam](#steam)).

## Contracts

**Link, keeper ↔ app** (spec §5.4): the named pipe `\\.\pipe\idleon-companion` (Node `net`, never TCP), one JSON
message per line.

| Message                            | Direction    | Content                                                  |
| ---------------------------------- | ------------ | -------------------------------------------------------- |
| `{ "type": "reading", "reading" }` | keeper → app | a new `Reading`                                          |
| `{ "type": "status", "status" }`   | keeper → app | `Status`: `game`, `reader`, `message?`, `lastReadingAt?` |
| `{ "type": "confirm-attach" }`     | app → keeper | the user clicked "Connect next time"                     |
| `{ "type": "release" }`            | app → keeper | "Let the game close"; ignored with no reader running     |
| `{ "type": "reconnect" }`          | app → keeper | "Reconnect"; ignored unless `reader` is `"released"`     |

A new client first gets the last status and the last reading. A second keeper finds the pipe taken and exits without
launching anything. The app tries the pipe again every 5 s while it is missing.

**IPC, main ↔ window** (spec §5.4), through the preload only:

| Channel                         | Direction     | Content                                                |
| ------------------------------- | ------------- | ------------------------------------------------------ |
| `context:update`                | main → window | `GameContext`                                          |
| `status:update`                 | main → window | `Status`                                               |
| `catalog:name`                  | window → main | `{ table: "menu" \| "menu2" \| "codex", key, name }`   |
| `settings:get` / `settings:set` | window ↔ main | `Settings`                                             |
| `reader:confirm-attach`         | window → main | sent on to the keeper as `confirm-attach`              |
| `reader:release`                | window → main | sent on to the keeper as `release`                     |
| `reader:reconnect`              | window → main | sent on to the keeper as `reconnect`                   |
| `steam:state`                   | window ↔ main | `SteamState`, read now; nothing changes                |
| `steam:setup`                   | window ↔ main | sets up the most recent account; final `SetupProgress` |
| `steam:remove`                  | window ↔ main | removes the companion; final `SetupProgress`           |
| `steam:progress`                | main → window | `SetupProgress`, each step of a setup or removal       |
| `update:state`                  | main → window | `UpdateState`                                          |
| `update:install`                | window → main | installs a ready update; refused with the game open    |
| `module:<id>:*`                 | both          | reserved for modules (none in v1)                      |

The preload (`src/preload/channel.ts`) keeps the last `context:update`, `status:update` and `update:state` and replays
them to a late subscriber. `steam:progress` does not repeat its last value: a step goes only to whoever listens at that
moment, so a late screen never sees an old "done".

## Steam

`src/main/steam/` runs in the app's main process; the keeper has nothing of Steam.

- `vdf.ts` reads Steam's KeyValues with positions and replaces the text of one value, leaving the rest of the file byte
  for byte. `launch-option.ts` adds the companion's part (`"<exe>" --keeper `) before `%command%` and takes it out, never
  touching the player's text. `locate.ts` finds Steam, its most recent account and the game. All three are pure or get
  their reads injected.
- `setup.ts` is the flow, on an injected `SteamSystem`: with one click and the game closed, it runs `steam.exe -shutdown`,
  waits up to 30 s, reads the file again, keeps the first copy, writes the option through `.tmp` + rename, records what
  was added, and reopens Steam, also after an error.
- `system.ts` is the real `SteamSystem` and the only place of the main process that starts processes: Windows tools by
  full path through `execFile` (never a shell) and `steam.exe` detached. It has no way to kill a process.
- `remove.ts` is the undo, used by "Remove from Steam" and by the uninstaller (`--remove-from-steam`). It covers every
  account in `steam-setup.json`, and the most recent account when its option has the part. It takes out the recorded
  text; when that text is gone or there is no record (the undo without a record: a lost `steam-setup.json`, or a part
  pasted by hand), it takes out the companion's part, so the game never keeps pointing at an uninstalled exe. Without a
  record, the first write keeps a copy too.
- `build/installer.nsh` defines two macros. `customCheckAppRunning` replaces electron-builder's check, which stops every
  process of the installed folder before any custom macro runs and so would stop the keeper and the game: with
  `LegendsOfIdleon.exe` running, installing, uninstalling and updating stop with "Close the game first." `customUnInit`,
  except in an update (`--updated`), asks and runs `--remove-from-steam`: exit code 2 (the game opened meanwhile) aborts
  with the same message, and a refusal or any other failure shows the text to remove by hand and goes on.

## Updates

`src/main/updates.ts`, in the app only and only when packaged, runs electron-updater against the releases repository
named in `electron-builder.yml` (`Arkh-Company/idleon-companion-releases`): over HTTPS, the published sha512 checked, at
start and every 6 h. Nothing installs with the game open, because the keeper is the same executable: `canInstall` is
false when the link or `tasklist` says the game runs, and a `tasklist` that fails counts as open. While an update waits,
this is asked again every 5 s and on every status, and `autoInstallOnAppQuit` follows the answer; the installer itself
also refuses (`customCheckAppRunning`).

## Boundaries (dependency-cruiser)

`.dependency-cruiser.cjs`, run by `just arch` inside `just check`. Every rule is an error.

| Rule                                 | Forbids                                                     | Why                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keeper-and-shared-without-electron` | `src/keeper/` and `src/shared/` importing `electron`        | the keeper stays plain Node code inside Electron's main process (ADR 0003), and shared code runs everywhere                                                       |
| `start-only-dispatches`              | `src/start/` importing any `src/` file but the entries      | the entry only picks the role: the keeper's, the app's or the uninstaller mode's entry                                                                            |
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
  session), when it cannot be checked ("Could not check the game code: the reader needs an update."; the `N.js` comes
  from `resources\app.asar` or, without it, the unpacked `resources\app\`, and is unreadable, or `LegendsOfIdleon.exe`
  has neither; any other exe with neither, as Edge in the tests, is read without the check), or when the keeper fails
  before launching (the link server fails with anything but "already running", logged; or the data folder, made first,
  cannot be created: "Could not create the data folder: reading is off for this session."). The check itself only
  reads: the keeper records the hash of clean code afterwards, and a hash that cannot be saved is logged
  (`game-hash-not-saved`) without closing the pipe. The game never depends on the app: in every one of these cases it
  still opens. See [ADR 0002](docs/adr/0002-fail-closed-update-watch.md).
- **Navigation lockdown** (`src/main/window-options.ts`, `src/main/index.ts`): `sandbox`, `contextIsolation`, no
  `nodeIntegration`; `setWindowOpenHandler` denies every new window, and `will-navigate` is prevented for any URL but the
  window's own page (`isAllowedNavigation`). The page has the CSP `default-src 'self'`, so the UI has no inline styles.
- **IPC sender check** (`guardIpc` in `src/main/window-options.ts`): every `ipcMain.handle` refuses a call whose sender
  frame is not the window's own page, or that has none.
- **Shape checks on every message** (`src/main/payloads.ts`, `src/shared/link.ts`, `src/shared/reading.ts`): the line
  decoder skips junk lines and checks the message type; the main process checks a link `reading` (`toReading`) and
  `status` before use, and each IPC payload (`catalog:name`: a known table, a catalog key, a non-blank name;
  `settings:set`: the three booleans; the other window → main channels take no body); a payload of the wrong shape is
  refused.
- **The updater is the only network access** (see [Updates](#updates)): the link is a local named pipe, the debugging
  channel is a pipe, and the window's CSP allows only its own files. `src/main/no-network.test.ts` scans the source for
  anything else.
- **Steam is changed only on a click and with Steam closed**, never killed, and never with the game open (see
  [Steam](#steam)). The account's name is read on request and never saved.

## User data

`%APPDATA%\IdleOn Companion\`, never in the repository:

| File                                | Written by | Content                                                                                                                                                               |
| ----------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `names.json`                        | app        | the user's catalog, indented, written through `names.json.tmp`; `names.json.bak` before each save, `names.json.bad` for an invalid file (the default catalog is used) |
| `settings.json`                     | app        | `Settings`; invalid or missing → defaults                                                                                                                             |
| `steam-setup.json`                  | app        | per account (numeric id only, never a name): the text added, the option before, the copy's path and the time; written through `.tmp`, `.bad` for an invalid file      |
| `steam-backup\<id>-localconfig.vdf` | app        | the account's `localconfig.vdf` from before the companion's first write; never overwritten                                                                            |
| `game-hash.json`                    | keeper     | the hash of the last game code checked clean (recorded after the check), or confirmed                                                                                 |
| `keeper.log`                        | keeper     | one JSON line per entry (`t`, `label`, `id` = the game pid, null before the launch), the pause time included                                                          |
| `game.log`                          | keeper     | the game's own output                                                                                                                                                 |

The default catalog ships in `src/main/catalog/default-names.json`.
