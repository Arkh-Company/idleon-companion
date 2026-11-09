# Architecture

IdleOn Companion reads a few fields of Legends of Idleon every second, read-only, and shows them in a window next to
the game. This file describes the code as it is; the design and its reasons are in
[specs/001-screen-map/](specs/001-screen-map/spec.md), [specs/002-install-and-setup/](specs/002-install-and-setup/spec.md)
and [specs/003-screen-base/](specs/003-screen-base/spec.md).
The decisions that are hard to reverse are in [docs/adr/](docs/adr/) ([0001](docs/adr/0001-debugging-pipe-in-the-keeper.md):
the debugging pipe in a keeper process; [0002](docs/adr/0002-fail-closed-update-watch.md): the update watch fails closed;
[0003](docs/adr/0003-one-executable-launched-by-steam.md): one executable, launched by Steam directly;
[0004](docs/adr/0004-steam-launch-option-spliced-with-steam-closed.md): the launch option spliced with Steam closed;
[0005](docs/adr/0005-updates-from-a-public-releases-repository.md): updates from a public releases repository;
[0006](docs/adr/0006-game-code-runs-in-an-isolated-worker.md): the game's code runs in an isolated worker;
[0007](docs/adr/0007-one-long-lived-calculation-context.md): one long-lived calculation context), and the
terms in [GLOSSARY.md](GLOSSARY.md).

## One executable, two processes

```text
Steam ─▶ "IdleOn Companion.exe" --keeper %command%
           └─ src/start/ picks the role ─▶ keeper (Electron's main process, no window, no electron import)
                                             ├─ spawns the game with --remote-debugging-pipe (fd 3/4, no TCP port)
                                             ├─ reads it every 1000 ms (read.js: property reads only)
                                             ├─ reads the state in slices, 12 a second by the catalog (state-slice.js: property reads only)
                                             ├─ named pipe \\.\pipe\idleon-companion ◀──▶ app (link client)
                                             └─ spawns the same exe detached with --from-steam
app (Electron main) ◀── IPC ──▶ preload (window.companion) ◀──▶ window (React)
  └─ worker_threads ──▶ calculator (src/calculator/, no network, no app APIs): the game's code over the mosaic
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
  sessions never exist at once. Neither is offered during `connecting`, a known limit. Once per game launch, right after
  starting the app, it takes the map and monster names out of the text of the installed game code (`game-tables.ts`,
  which never runs that text) and sends them to the app as `tables`.
- **App** (`src/main/`, `src/preload/`, `src/renderer/`, built to `out/main/index.js`, `out/preload/index.cjs` and
  `out/renderer/`). A link client: it turns readings into a `GameContext` with the screen catalog
  (`src/shared/screens/`) and the last game tables, kept only in memory, and sends it to the window. It never launches the game and never touches its pipe, so it can close, crash or be killed with the
  game open; reopening it reconnects and gets the last status and reading. While Steam is not set up for the most recent
  account, the window is only the setup screen (`SetupView`). One instance: a second manual launch brings the first
  window forward, and a second launch from Steam (`--from-steam`) follows "Show window when the game starts"
  (`launchEvent`). When the keeper ends after the game, the window keeps "Game closed · last reading N s ago"
  (`statusOnLinkDrop`). The window's X hides it in the tray, and only the tray's "Quit", the game exiting with "Close
  companion when the game closes", or the system ending the session end the app.
- **Calculator** (`src/calculator/`, built to `out/main/calculator.js`, unpacked next to the asar). The fourth part: a
  worker owned by the app, never by the keeper, so its crash or hang cannot reach the game
  ([ADR 0006](docs/adr/0006-game-code-runs-in-an-isolated-worker.md)). The keeper reads the state in **slices** of up to
  25 KB, 12 a second (`state-reader.ts`) and never two in flight, by property reads only, and publishes them. What each
  read brings comes from the **catalog** (`src/shared/reading-catalog.md`), the single source of the reading lists: a
  test fails on a row that breaks its rules. The **fast reading** is every piece with a proven impact on a number shown,
  except the pieces of other characters; the **slow reading** is all the rest, a piece the catalog does not know
  included, so no piece goes unread. Of the 12 slots of each second, 3 go to the **actions slice** (the catalog's group
  `ações`), 7 to the other fast slices and 2 to the slow reading, and a slot whose lane has nothing to read goes to
  another lane. On entering a character the first lap takes every slot, a pass of the fast reading and then the slow
  one, and no number is shown before it ends. After a game patch, `node scripts/reading-inventory.ts <state.json>` lists
  the pieces new to the catalog and the rows that state no longer has, only names, to decide what to measure.
  The app assembles the slices in a **mosaic** kept only in memory (`state-store.ts`), and starts over when the
  **sentinel** of a slice names another character; a new map holds the calculation until a whole pass of the fast
  reading on it. A calculation is due when a piece of the fast reading changes. A change in the actions slice waits
  until its next read comes equal, because the game rebuilds its caches after an item swap, so the number moves in one
  step; that confirmation has a ceiling of 3 reads in a row that keep changing it, about 1 s, after which it is
  calculated anyway and the number never freezes. What crosses into the worker is only data: the bytes of the installed
  `N.js` and `default.pak`, read by the app (`game-files.ts`), never a path, and the mosaic as JSON text. Inside, the
  game's code runs in a `node:vm` context with no network, no code generation and no host object. The worker keeps that
  one context for its whole life and rebuilds the state and the helper actors for each calculation
  ([ADR 0007](docs/adr/0007-one-long-lived-calculation-context.md)). `calculator-host.ts` feeds it the newest mosaic, one
  calculation at a time and 60 ms apart. A limit exceeded inside the context gives `null` numbers for that calculation,
  and the next one tries again in the same context; a failed start, the worker's death or the host's limits (60 s to
  start, 15 s for a calculation) bring the worker down and make the tab "unavailable". `stats-pipeline.ts` joins all of
  this into the `Stats` the window shows. With a character and the reader `attached`, 30 s without a slice also make the
  tab "unavailable", until the next slice.

## Code folders

| Folder            | Runs in                                    | What it holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/start/`      | Electron's main process, first of all      | `index.ts` (the entry: loads only the role's bundle), `dispatch.ts` (`roleFor`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/keeper/`     | the keeper (Electron's main process)       | `index.ts` (entry), `keeper.ts` (the flow), `command-line.ts`, `launch.ts`, `cdp.ts`, `engine-ref.ts`, `reader.ts`, `readers.ts` (joins the two readers and their turn), `read-source.ts`, `read.js`, `game-tables.ts`, `update-watch.ts`, `link-server.ts`, `state-reader.ts`, `state-list.js`, `state-slice.js`, `vars-reader.ts`; `mock-game/` is a test fixture                                                                                                                                                                                                                 |
| `src/main/`       | the app's main process                     | `index.ts` (entry: window, tray, link, IPC), `steam/`, `setup-store.ts`, `remove-from-steam.ts`, `updates.ts`, `forget-names.ts`, `context.ts`, `settings.ts`, `lifecycle.ts`, `link-client.ts`, `link-routes.ts`, `payloads.ts`, `window-options.ts`, `state-store.ts`, `game-files.ts`, `calculator-host.ts`, `stats.ts`, `stats-pipeline.ts`                                                                                                                                                                                                                                     |
| `src/preload/`    | the window's preload (sandboxed, CommonJS) | `index.ts`: exposes `window.companion` (`CompanionApi`); `channel.ts`: one main → window channel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/renderer/`   | the window (sandboxed, no Node)            | `App.tsx`, `SetupView.tsx`, `StatusBar.tsx`, `SettingsView.tsx`, `ScreenMapPanel.tsx`, `StatsPanel.tsx`, `modules/screen-map.ts`, `styles.css`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/calculator/` | a worker of the app's main process         | `index.ts` (the worker's entry), `engine.ts`, `context.js` (what runs inside the `node:vm` context), `targets.ts` (the 10 numbers); `fixtures/` is an invented game for the tests                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/shared/`     | everywhere                                 | the contracts: `types.ts`, `state.ts` (the pieces of the state, the classes and the numbers), `reading-catalog.md` (the table of the state's pieces), `reading-catalog.ts`, `reading-catalog-rules.ts`, `link.ts` (line codec), `reading.ts` (`toReading`), `modules.ts` (`modulesFor`), `screens/` (the screen catalog: `identify.ts`, `catalog.ts`, `rules/*.json`); other folders import `src/shared/index.ts` only, except that the keeper and the app load the catalog from its own entry, `src/shared/screens/index.ts`, so the preload and the window do not carry its rules |

Pure logic (`roleFor`, `decide`, `modulesFor`, `channel`, catalog, context, settings, payload checks, `windowOptions`,
the VDF and launch-option code, the update decisions) lives in files without an `electron` import, so tests load it
without Electron.

`build/installer.nsh` holds the installer's and uninstaller's own macros (see [Steam](#steam)).

## Contracts

**Reading** (`src/keeper/read.js`, shape checked by `toReading`): the map, the menus, the Codex tab, the character and
the AFK target, plus what tells one screen from another: `scene`, `attack`, `bag`, `ol1`, `ol3`, `ol18`, `ol19`,
`ola489`, `nd37`, `hole` and `behaviors` (fields of the game's actors, keyed `H<n>.<field>[<index>]`; a behavior not yet
in the game has no key and is no error). The usernames list only finds the character's place for `hole`: no name from it
is in the reading. The full list is in
[contracts/read-fields.md](specs/003-screen-base/contracts/read-fields.md).

**Screen catalog** (`src/shared/screens/`): the rules in `rules/*.json`, each with equalities over `Reading` fields or
behavior keys, a name and its proof; a rule without proof fails at load (`parseScreenCatalog`). `identifyScreen` tries
the overlays and then the screens: the rule with the most conditions wins, and a tie or no rule is "Unknown screen". It
sits in `src/shared/` because the keeper needs `KNOWN_WINDOWS` and `keeper-alone` keeps it out of `src/main/`.

**Link, keeper ↔ app** (spec §5.4): the named pipe `\\.\pipe\idleon-companion` (Node `net`, never TCP), one JSON
message per line.

| Message                                | Direction    | Content                                                                           |
| -------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| `{ "type": "reading", "reading" }`     | keeper → app | a new `Reading`                                                                   |
| `{ "type": "status", "status" }`       | keeper → app | `Status`: `game`, `reader`, `message?`, `lastReadingAt?`                          |
| `{ "type": "tables", "tables" }`       | keeper → app | `GameTables`: map and monster names, `null` for a table not read                  |
| `{ "type": "state", "slice" }`         | keeper → app | `StateSlice`: one slice of the state, never logged and never stored by the keeper |
| `{ "type": "gameFiles", "resources" }` | keeper → app | the `resources` folder of the game launched, once per launch                      |
| `{ "type": "confirm-attach" }`         | app → keeper | the user clicked "Connect next time"                                              |
| `{ "type": "release" }`                | app → keeper | "Let the game close"; ignored with no reader running                              |
| `{ "type": "reconnect" }`              | app → keeper | "Reconnect"; ignored unless `reader` is `"released"`                              |

A new client first gets the last tables, the last status, the last reading and the last `gameFiles`; slices are not resent, because the mosaic builds up again in one rotation. The keeper sends `tables` once per game
launch, and on each one the app builds the context again from the last reading. A second keeper finds the pipe taken and exits without
launching anything. The app tries the pipe again every 5 s while it is missing.

**IPC, main ↔ window** (spec §5.4), through the preload only:

| Channel                         | Direction     | Content                                                |
| ------------------------------- | ------------- | ------------------------------------------------------ |
| `context:update`                | main → window | `GameContext`                                          |
| `status:update`                 | main → window | `Status`                                               |
| `settings:get` / `settings:set` | window ↔ main | `Settings`                                             |
| `reader:confirm-attach`         | window → main | sent on to the keeper as `confirm-attach`              |
| `reader:release`                | window → main | sent on to the keeper as `release`                     |
| `reader:reconnect`              | window → main | sent on to the keeper as `reconnect`                   |
| `steam:state`                   | window ↔ main | `SteamState`, read now; nothing changes                |
| `steam:setup`                   | window ↔ main | sets up the most recent account; final `SetupProgress` |
| `steam:progress`                | main → window | `SetupProgress`, each step of a setup                  |
| `update:state`                  | main → window | `UpdateState`                                          |
| `update:install`                | window → main | installs a ready update; refused with the game open    |
| `stats:update`                  | main → window | `Stats`: the Stats tab's state                         |
| `module:<id>:*`                 | both          | reserved for modules (none in v1)                      |

The preload (`src/preload/channel.ts`) keeps the last `context:update`, `status:update`, `update:state` and `stats:update` and replays
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
- `remove.ts` is the undo, run only by the uninstaller (`--remove-from-steam`); the window has no button for it. It
  covers every account in `steam-setup.json`, and the most recent account when its option has the part. It takes out the recorded
  text; when that text is gone or there is no record (the undo without a record: a lost `steam-setup.json`, or a part
  pasted by hand), it takes out the companion's part, so the game never keeps pointing at an uninstalled exe. Without a
  record, the first write keeps a copy too.
- `build/installer.nsh` defines three macros. electron-builder's check stops every process of the installed folder before
  any custom macro runs, and so would stop the keeper and the game. `customCheckAppRunning` runs in its place: it stops
  when `LegendsOfIdleon.exe` runs (installing, uninstalling and updating end with "Close the game first.") and otherwise
  calls electron-builder's own check. `customUnInit`, except in an update (`--updated`), asks and runs
  `--remove-from-steam`: exit code 2 (the game opened meanwhile) aborts with the same message, and a refusal or any other
  failure shows the text to remove by hand and goes on. `unregisterFileAssociations` shows the closing box, except in an
  update: "IdleOn Companion was uninstalled.", or the folder that could not be removed. It is not a documented hook, but
  the only one with the files and shortcuts already gone: `customUnInstall` runs before them, and the one-click
  uninstaller quits at the end of its section, before any later hook. electron-builder generates a macro of that name
  only with `fileAssociations`, so adding any makes the name collide and the build fail until the box moves.

## Updates

`src/main/updates.ts`, in the app only and only when packaged, runs electron-updater against the releases repository
named in `electron-builder.yml` (`Arkh-Company/idleon-companion-releases`): over HTTPS, the published sha512 checked, at
start and every 6 h. Nothing installs with the game open, because the keeper is the same executable: `canInstall` is
false when the link or `tasklist` says the game runs, and a `tasklist` that fails counts as open. While an update waits,
this is asked again every 5 s and on every status, and `autoInstallOnAppQuit` follows the answer; the installer itself
also refuses (`customCheckAppRunning`).

## Boundaries (dependency-cruiser)

`.dependency-cruiser.cjs`, run by `just arch` inside `just check`. Every rule is an error.

| Rule                                 | Forbids                                                                   | Why                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keeper-and-shared-without-electron` | `src/keeper/` and `src/shared/` importing `electron`                      | the keeper stays plain Node code inside Electron's main process (ADR 0003), and shared code runs everywhere                                                       |
| `start-only-dispatches`              | `src/start/` importing any `src/` file but the entries                    | the entry only picks the role: the keeper's, the app's or the uninstaller mode's entry                                                                            |
| `keeper-alone`                       | `src/keeper/` importing `src/main`, `preload` or `renderer`               | the keeper holds the game's pipe and must not depend on the app                                                                                                   |
| `main-not-keeper-or-renderer`        | `src/main/` importing `src/keeper` or `renderer`                          | the main process reaches the keeper over the link and the window over IPC, never by import                                                                        |
| `preload-alone`                      | `src/preload/` importing `src/main`, `keeper` or `renderer`               | the preload is the window's thin bridge                                                                                                                           |
| `renderer-without-node`              | `src/renderer/` importing `src/main`, `keeper` or `preload`               | the window reaches the main process only through `window.companion`                                                                                               |
| `renderer-without-node-core`         | `src/renderer/` importing Node core modules                               | the window is sandboxed, without Node. Exception, accepted on 07/11: `*.test.ts(x)` files, which run in Node and may read files (the CSP test reads `index.html`) |
| `shared-alone`                       | `src/shared/` importing any of the four process folders                   | shared code is the common contract and depends on none of them                                                                                                    |
| `calculator-alone`                   | `src/calculator/` importing any other `src/` folder, tests excepted       | its bundle stays one file, and it reaches nothing of the app                                                                                                      |
| `nothing-imports-the-calculator`     | `src/main`, `keeper`, `preload` or `renderer` importing `src/calculator/` | the game's code only runs inside the worker (ADR 0006)                                                                                                            |
| `vm-only-in-the-calculator`          | any `src/` file but `src/calculator/` and tests using `node:vm`           | elsewhere the game's files stay text                                                                                                                              |

## Safety

- **Read-only inside the game.** `read.js` only reads properties; `src/keeper/read-only.test.ts` runs it against an
  engine whose every function throws when called.
- **The game's file is only text.** `src/keeper/game-tables.ts` reads the installed code with regular expressions and
  never runs it; `game-tables.test.ts` fails if `game-tables.ts`, `keeper.ts` or `update-watch.ts`, where that text
  passes, gains `eval`, `new Function`, the `vm` module or `require(`. Any sign of a new format drops that whole table,
  so no name is guessed.
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
- **The game's code runs only in the calculator.** The one exception to the rule above, in `src/calculator/`, in a worker
  of the app with no `env`, no network and no code generation; the state in memory only, never in `keeper.log` (see the
  Calculator part and [ADR 0006](docs/adr/0006-game-code-runs-in-an-isolated-worker.md)).
- **Navigation lockdown** (`src/main/window-options.ts`, `src/main/index.ts`): `sandbox`, `contextIsolation`, no
  `nodeIntegration`; `setWindowOpenHandler` denies every new window, and `will-navigate` is prevented for any URL but the
  window's own page (`isAllowedNavigation`). The page has the CSP `default-src 'self'`, so the UI has no inline styles.
- **IPC sender check** (`guardIpc` in `src/main/window-options.ts`): every `ipcMain.handle` refuses a call whose sender
  frame is not the window's own page, or that has none.
- **Shape checks on every message** (`src/main/payloads.ts`, `src/shared/link.ts`, `src/shared/reading.ts`): the line
  decoder skips junk lines and checks the message type; the main process checks a link `reading` (`toReading`),
  `status` and `tables` (`linkTables`: a table out of shape counts as not read), a `state` slice (`linkState`) and a
  `gameFiles` folder (`linkGameFiles`) before use, and each IPC payload
  (`settings:set`: the three booleans; the other window → main channels take no body); a payload of the wrong shape is
  refused.
- **The updater is the only network access** (see [Updates](#updates)): the link is a local named pipe, the debugging
  channel is a pipe, and the window's CSP allows only its own files. `src/main/no-network.test.ts` scans the source for
  anything else.
- **Steam is changed only on a click and with Steam closed**, never killed, and never with the game open (see
  [Steam](#steam)). The account's name is read on request and never saved.

## User data

`%APPDATA%\IdleOn Companion\`, never in the repository:

| File                                | Written by | Content                                                                                                                                                          |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.json`                     | app        | `Settings`; invalid or missing → defaults                                                                                                                        |
| `steam-setup.json`                  | app        | per account (numeric id only, never a name): the text added, the option before, the copy's path and the time; written through `.tmp`, `.bad` for an invalid file |
| `steam-backup\<id>-localconfig.vdf` | app        | the account's `localconfig.vdf` from before the companion's first write; never overwritten                                                                       |
| `game-hash.json`                    | keeper     | the hash of the last game code checked clean (recorded after the check), or confirmed                                                                            |
| `keeper.log`                        | keeper     | one JSON line per entry (`t`, `label`, `id` = the game pid, null before the launch), the pause time included                                                     |
| `game.log`                          | keeper     | the game's own output                                                                                                                                            |

Three labels of `keeper.log` come from the scan of the game code: `unknown-screen-numbers` (`numbers`: the `MenuType2`
numbers outside `KNOWN_WINDOWS`), `game-tables-unreadable` (`unreadable`: the names of the tables not read) and
`game-scan-failed` (`error`). The player sees none of them, and they carry only numbers, the names of the tables and text
of the error: no text of the game's file and no player name.

The screen catalog ships in the code (`src/shared/screens/`), and nothing the player types is saved. On every start the
app deletes the files where earlier versions kept the names the player typed (`src/main/forget-names.ts`); a file it
cannot delete stops nothing, and the next start tries again.
