# Tasks: Instalação e configuração (install-and-setup)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Tests are mandatory. Every phase writes its tests first, next to the code in `src/`, and sees them fail
before the implementation exists. `just check` passes at the end of every phase.

**Organization**: Done gate, Setup (one executable), Foundational (shared contracts), User Story 1 in two phases (Steam
files; setup flow and screen), then one phase per remaining story, then Polish. Phases are cut by size too (lesson 5 of
001).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[sessão]**: done-gate file, applied by the session with the user's confirmation, never by the Executor
- **[USn]**: the user story of spec.md the task serves

## Rules for every phase

- Inside the game only property reads run; no game function call, no write, no network. Releasing and reattaching
  reuse the 001 reader (FR-019).
- Nothing touches the network except `src/main/updates.ts` (constitution 1.1.0, FR-026). Tests never touch the
  network, Steam, the registry or real processes: system operations are injected (like `KeeperDeps`) and faked.
- Never write Steam's `localconfig.vdf` with Steam open, never kill Steam (FR-010); the file changes only in the
  launch option's text (FR-007); adding never removes the user's text (FR-008).
- A test never imports a module that imports `electron`. Pure code (`vdf.ts`, `launch-option.ts`, decisions) imports
  neither `electron` nor `node:child_process`.
- Identifiers and UI copy in English; files up to 400 lines (`src/keeper/keeper.test.ts`, 463 lines, does not grow: new
  keeper tests go to `src/keeper/keeper-release.test.ts`); other folders import shared code from `src/shared/index.ts`.
- `.ts` relative imports keep their extension. A named-pipe path in a test:
  `process.platform === "win32" ? \`\\\\.\\pipe\\${name}\` : join(tmpdir(), \`${name}.sock\`)` (the CI is Linux).
- New IPC channels follow 001: fixed names in `IPC`, `guardIpc`, a payload check in `src/main/payloads.ts` (FR-030).
- A hook that blocks is never worked around (lesson 4 of 001).

---

## Phase 0: Done gate

**Purpose**: the recipes and scan settings the packaging needs, before any code.

**Independent Test**: `just check` passes with the code of `main` as it is; `just --list` shows `package` and
`release`.

- [X] T001 [sessão] Recipes `package` and `release` in `justfile`
  - Files: `justfile`
  - Change: `package: just build` then `pnpm exec electron-builder --win nsis --publish never` (writes `dist\`);
    `release: just build` then `pnpm exec electron-builder --win nsis --publish always`, with a comment: run only in
    the user's own terminal with `GH_TOKEN` set; the session never reads or asks for the token (research R8). Neither
    joins `check` (electron-builder arrives in Phase 1; the recipes are not run before it).
- [X] T002 [sessão] Keep the packaged output out of the secret scan in `.gitleaks-dir.toml`
  - Files: `.gitleaks-dir.toml`
  - Change: the allowlist that has `'(^|/)out/'` gains `'(^|/)dist/'`, with the reason in its description (electron-builder
    output, already in `.gitignore`; scanning the installer binary is slow and pointless).

**Verify**: `just check` — every step passes; `just --list` lists `package` and `release`.

---

## Phase 1: Setup — one executable (US1, part 1)

**Goal**: one `IdleOn Companion.exe`, installed per user at the fixed path, that is the keeper with `--keeper` and the
app without it; Steam launches it directly (research R1, R2; ADR 0003).

**Independent Test**: the dispatch and keeper-argument tests pass; `just package` writes
`dist\IdleOn Companion Setup <version>.exe`; installed, and with the Steam option pasted by hand as
`"<exe>" --keeper %command%`, the game opens reading (quickstart §1, and §3 step 1 with Vinicius).

### Tests for Phase 1

- [X] T010 [P] [US1] Dispatch test in `src/start/dispatch.test.ts`
  - Files: `src/start/dispatch.test.ts`
  - Signatures tested: `roleFor(argv: string[]): "keeper" | "remove-from-steam" | "app"` in `src/start/dispatch.ts`.
  - Cases: `["exe", "--keeper", "C:\\Game\\LegendsOfIdleon.exe"]` → `"keeper"`; dev shape
    `["electron.exe", "C:\\repo", "--keeper", "x.exe"]` → `"keeper"`; `["exe", "--remove-from-steam"]` →
    `"remove-from-steam"`; `["exe"]` and `["exe", "--from-steam"]` → `"app"`; a game arg that is literally
    `--remove-from-steam` after `--keeper` still → `"keeper"` (the first recognized flag wins).
- [X] T011 [P] [US1] Keeper command-line and paths test in `src/keeper/command-line.test.ts`
  - Files: `src/keeper/command-line.test.ts`
  - Signatures tested (in `src/keeper/command-line.ts`, no `electron` import):
    `gameCommand(argv: string[]): { exe: string; args: string[] } | null` (everything after `--keeper`, unchanged);
    `appCommand(p: { execPath: string; defaultApp: boolean; appPath: string }): { file: string; args: string[] }`;
    `readJsPath(p: { defaultApp: boolean; resourcesPath: string; repoRoot: string }): string`.
  - Cases: exe path with spaces and parentheses and Steam's own args kept byte for byte; nothing after `--keeper` →
    `null`; packaged → `{ file: execPath, args: ["--from-steam"] }`; dev (`defaultApp: true`) →
    `{ file: execPath, args: [appPath, "--from-steam"] }`; packaged `read.js` = `join(resourcesPath, "read.js")`, dev =
    `join(repoRoot, "src/keeper/read.js")`.

### Implementation for Phase 1

- [X] T012 [US1] Add electron-builder (approved by Vinicius on 07/11)
  - Files: `package.json`, `pnpm-lock.yaml` (through pnpm)
  - Command: `pnpm add -D electron-builder@26.18.0`. `package.json`: `"main": "out/main/start.js"`, `"productName":
    "IdleOn Companion"` (the `version` stays as release-please keeps it).
- [X] T013 [US1] The dispatching entry `src/start/`
  - Files: `src/start/dispatch.ts`, `src/start/index.ts`, `electron.vite.config.ts`
  - `roleFor` as tested in T010. `index.ts`: `await import()` of `../keeper/index.ts` for `"keeper"`, of
    `../main/index.ts` for `"app"`; `"remove-from-steam"` imports `../main/remove-from-steam.ts`, which in this phase
    only exits with code 0 (filled in Phase 6). No other code in `src/start/`.
  - `electron.vite.config.ts`: the main build's inputs become `{ start: "src/start/index.ts", index:
    "src/main/index.ts", keeper: "src/keeper/index.ts" }`, so each role loads only its own bundle.
- [X] T014 [US1] The keeper runs in Electron's main process
  - Files: `src/keeper/command-line.ts`, `src/keeper/index.ts`
  - `index.ts` uses `gameCommand(process.argv)` (no `process.argv.slice(2)`), `appCommand({ execPath:
    process.execPath, defaultApp: process.defaultApp === true, appPath: repoRoot })` in `startApp` (still removing
    `ELECTRON_RUN_AS_NODE` from the env, harmless), and `readJsPath({ defaultApp, resourcesPath:
    process.resourcesPath, repoRoot })`. Still no `electron` import (`just arch`). The header comment says Steam starts
    it as `"<exe>" --keeper %command%`.
- [X] T015 [US1] Packaging config `electron-builder.yml`
  - Files: `electron-builder.yml` (new), `build/` (new folder, empty until Phase 6)
  - `appId: com.arkh.idleon-companion`, `productName: IdleOn Companion`, `executableName: IdleOn Companion`,
    `directories.output: dist`, `files: ["out/**", "package.json"]`, `extraResources: [{ from: "src/keeper/read.js",
    to: "read.js" }]`, `win.target: nsis`, `nsis: { oneClick: true, perMachine: false, createStartMenuShortcut: true,
    runAfterFinish: true }`, `publish: { provider: github, owner: Arkh-Company, repo: idleon-companion-releases }`. No
    game file and no code signing (FR-002, Assumptions).
- [X] T016 [US1] Boundary rule for the entry in `.dependency-cruiser.cjs`
  - Files: `.dependency-cruiser.cjs`
  - Rule `start-only-dispatches` (error): from `^src/start/` to anything in `^src/` except `^src/start/`,
    `^src/keeper/index\.ts$`, `^src/main/index\.ts$`, `^src/main/remove-from-steam\.ts$`; comment: the entry only
    picks the role. `keeper-alone` and `main-not-keeper-or-renderer` stay as they are.
- [X] T017 [US1] The `.cmd` launcher leaves
  - Files: `scripts/steam-launch.cmd` (removed); `docs/steam-setup.md` (short note at the top: the option is now
    `"<exe>" --keeper %command%` and the installer's setup screen writes it; full rewrite in Polish)

**Verify**: `just test-one src/start/dispatch.test.ts` and `just test-one src/keeper/command-line.test.ts` pass;
`just arch` prints `no dependency violations found`; `just package` lists `dist\IdleOn Companion Setup <version>.exe`;
`just check` passes.

---

## Phase 2: Foundational — shared contracts

**Goal**: the types, link messages and IPC names every story uses (data-model.md, contracts/).

**Independent Test**: the shared and link tests pass with no process code changed.

### Tests for Phase 2

- [X] T020 [P] Shared types and IPC names in `src/shared/types.test.ts`
  - Files: `src/shared/types.test.ts`
  - Cases: `IPC` gains exactly `steamState: "steam:state"`, `steamSetup: "steam:setup"`, `steamRemove: "steam:remove"`,
    `steamProgress: "steam:progress"`, `readerRelease: "reader:release"`, `readerReconnect: "reader:reconnect"`,
    `updateState: "update:state"`, `updateInstall: "update:install"` (the six of 001 unchanged).
- [X] T021 [P] Link messages in `src/shared/link.test.ts`
  - Files: `src/shared/link.test.ts`
  - Cases: `{"type":"release"}` and `{"type":"reconnect"}` decode to those messages; with extra fields they decode to
    the bare message; `{"type":"release-all"}` and junk lines are skipped; `encodeLine` round-trips both.

### Implementation for Phase 2

- [X] T022 Shared types
  - Files: `src/shared/types.ts`, `src/shared/index.ts`
  - `Status.reader`: `"attached" | "connecting" | "error" | "released"`. New types, quoted from data-model.md:
    `SteamState`, `SetupProgress` (`"closing-steam" | "setting-up" | "opening-steam" | "done"` or
    `{ step: "failed"; reason: "game-open" | "steam-did-not-close" | "unreadable-config" | "steam-did-not-open" }`),
    `UpdateState` (`none` | `downloading` with `version` | `ready` with `version` and `canInstall` | `check-failed`).
    `IPC` gains the eight names of T020. `CompanionApi` gains `steamState(): Promise<SteamState>`,
    `setupSteam(): Promise<SetupProgress>`, `removeFromSteam(): Promise<SetupProgress>`,
    `onSetupProgress(cb): () => void`, `releaseGame(): Promise<void>`, `reconnect(): Promise<void>`,
    `onUpdate(cb: (u: UpdateState) => void): () => void`, `installUpdate(): Promise<void>`.
- [X] T023 Link messages
  - Files: `src/shared/link.ts`
  - `LinkMessage` gains `{ type: "release" }` and `{ type: "reconnect" }`; `toMessage` returns them bare.
- [X] T024 Status shape check accepts `"released"`
  - Files: `src/main/payloads.ts`, `src/main/payloads.test.ts` (test first: a link status with `reader: "released"` is
    accepted; `reader: "paused"` is refused)
  - `linkStatus` adds `"released"` to the allowed readers.

**Verify**: `just test-one src/shared/types.test.ts`, `just test-one src/shared/link.test.ts` and
`just test-one src/main/payloads.test.ts` pass; `just check` passes.

---

## Phase 3: User Story 1 — Steam files (Priority: P1, part 2) 🎯 MVP

**Goal**: read Steam's files and compute the new launch option without touching anything (research R4, R5; ADR 0004).

**Independent Test**: the VDF, launch-option, locate and setup-store tests pass against fixture text; nothing in these
modules writes a Steam file.

### Tests for Phase 3

- [X] T030 [P] [US1] VDF reader and splice in `src/main/steam/vdf.test.ts`
  - Files: `src/main/steam/vdf.test.ts`, `src/main/steam/fixtures/localconfig.vdf` (a small hand-made file with
    `UserLocalConfigStore > Software > Valve > Steam > apps > 1476970 { LastPlayed, LaunchOptions }`, another app, a
    `//` comment, escaped quotes and backslashes; no real account data)
  - Signatures tested: `parseVdf(text: string): VdfNode` (each node: `key`, `value` or `children`, and the
    `[start, end)` span of its value text); `findPath(root: VdfNode, path: string[]): VdfNode | undefined` (keys
    compared case-insensitively: `apps` and `Apps`); `setLaunchOptions(text: string, appId: string, option: string):
    string`; `getLaunchOptions(text: string, appId: string): string | undefined`.
  - Cases: unescapes `\"` `\\` `\n` `\t`; `setLaunchOptions` changes only the bytes of that value (the output equals the
    input outside the span); escapes `"` and `\` in the new value; with the app block but no `LaunchOptions` it inserts
    one line inside the block with the block's indentation; with no app block it inserts the block inside `apps`;
    with no `apps` path it throws `VdfShapeError`; unbalanced braces or an unterminated string throw `VdfShapeError`;
    `\r\n` line endings are kept.
- [X] T031 [P] [US1] Adding and removing the companion's part in `src/main/steam/launch-option.test.ts`
  - Files: `src/main/steam/launch-option.test.ts`
  - Signatures tested: `companionPart(p: { execPath: string; defaultApp: boolean; appPath: string }): string`
    (`"<exe>" --keeper ` packaged; `"<electron.exe>" "<repo>" --keeper ` dev); `addPart(current: string, part:
    string): { next: string; inserted: string }`; `removePart(current: string, inserted: string): string`;
    `optionState(current: string, part: string): "not-set" | "companion" | "other"`;
    `hasConsoleScript(current: string): boolean`.
  - Cases: `""` → `next` = part + `%command%`; `"-windowed"` → `'"<exe>" --keeper %command% -windowed'`;
    `"FOO %command% -bar"` → part inserted right before `%command%`, `FOO ` and ` -bar` kept; two `%command%` → only
    the first; already containing the part → unchanged (`inserted: ""`); `removePart` of each `next` gives back the
    original text; `removePart` when the user edited the rest keeps the edit; `removePart` when the inserted text is
    gone → unchanged; `hasConsoleScript('"C:\\x\\run.cmd" %command%')` true, `.BAT` true, `-windowed` false, a `.cmd`
    after `%command%` false.
- [X] T032 [P] [US1] Locating Steam, the account and the game in `src/main/steam/locate.test.ts`
  - Files: `src/main/steam/locate.test.ts`, `src/main/steam/fixtures/loginusers.vdf`,
    `src/main/steam/fixtures/libraryfolders.vdf` (made up, no real data)
  - Signatures tested (pure, text in): `mostRecentAccount(loginusersText: string): { id: string; name: string } | null`
    (`id` = SteamID64 − 76561197960265728 as a decimal string, `name` = `PersonaName`);
    `libraryPaths(libraryfoldersText: string): string[]`; `steamPathFromReg(regOutput: string): string | null` (parses
    `reg query` output for `SteamPath`, forward slashes turned to backslashes).
  - Cases: two users, the one with `"MostRecent" "1"` wins; none marked → `null`; a SteamID64 near 2^63 is converted
    with `BigInt`, not floats; libraries with `\\` escapes; `reg` output without `SteamPath` → `null`.
- [X] T033 [P] [US1] Setup records in `src/main/setup-store.test.ts`
  - Files: `src/main/setup-store.test.ts`
  - Signatures tested: `loadSetup(file: string): SteamSetupFile`; `saveSetup(file: string, s: SteamSetupFile): void`;
    `recordSetup(s, accountId, rec): SteamSetupFile`; `forgetAccount(s, accountId): SteamSetupFile`.
  - Cases (temp dir): missing file → `{ accounts: {} }`; invalid JSON → empty and the file renamed to
    `steam-setup.json.bad`; an account id that is not digits is dropped on load; save writes through `.tmp` + rename;
    a second `recordSetup` for the same account keeps the first `before` and `backupFile` (FR-027) and updates
    `inserted` and `setAt`; the saved JSON has no `name` field anywhere (FR-028).

### Implementation for Phase 3

- [X] T034 [US1] `src/main/steam/vdf.ts` as tested in T030 (about 100 lines; no dependency, research R4)
  - Files: `src/main/steam/vdf.ts`
  - Signatures: `parseVdf`, `findPath`, `getLaunchOptions`, `setLaunchOptions`, `class VdfShapeError extends Error` (T030)
- [X] T035 [US1] `src/main/steam/launch-option.ts` as tested in T031 (pure; research R5)
  - Files: `src/main/steam/launch-option.ts`
  - Signatures: `companionPart`, `addPart`, `removePart`, `optionState`, `hasConsoleScript` (T031)
- [X] T036 [US1] `src/main/steam/locate.ts` as tested in T032, plus the system side in the same file behind an
  injected runner: `readSteam(run: Runner, fs: FsLike): Promise<SteamFiles>` — `reg query HKCU\Software\Valve\Steam /v
  SteamPath` through `execFile` (never a shell), `config\loginusers.vdf`, `config\libraryfolders.vdf`,
  `steamapps\appmanifest_1476970.acf` in any library, `userdata\<id>\config\localconfig.vdf`
  - Files: `src/main/steam/locate.ts`
  - Signatures: `mostRecentAccount`, `libraryPaths`, `steamPathFromReg` (T032); `readSteam(run, fs)` returns the Steam
    folder, the account, whether the game is installed and the account's `localconfig.vdf` text and path
- [X] T037 [US1] `src/main/setup-store.ts` as tested in T033 (`%APPDATA%\IdleOn Companion\steam-setup.json`,
  data-model.md `SteamSetupRecord`: `inserted`, `before`, `backupFile`, `setAt`)
  - Files: `src/main/setup-store.ts`
  - Signatures: `loadSetup`, `saveSetup`, `recordSetup`, `forgetAccount` (T033)
- [X] T038 [US1] `src/main/steam/index.ts` re-exports the public API of the module (constitution: the entry file)
  - Files: `src/main/steam/index.ts`
  - Re-exports what `src/main/index.ts` and `remove-from-steam.ts` use; nothing imports deeper paths

**Verify**: `just test-one src/main/steam` and `just test-one src/main/setup-store.test.ts` pass; `just check` passes.

---

## Phase 4: User Story 1 — setup flow and screen (Priority: P1, part 3) 🎯 MVP

**Goal**: the one setup screen; one click closes Steam, keeps a copy, adds the companion's part, reopens Steam.

**Independent Test**: the flow tests with fake system operations show the order and every refusal; the screen tests show
each state; with Vinicius, quickstart §2 and §3 (option written, purchase window opens 3 of 3).

### Tests for Phase 4

- [X] T040 [P] [US1] Setup flow in `src/main/steam/setup.test.ts`
  - Files: `src/main/steam/setup.test.ts`
  - Signatures tested: `steamState(sys: SteamSystem, store: SetupStoreLike, part: string): Promise<SteamState>`;
    `runSetup(sys, store, part, onProgress: (p: SetupProgress) => void): Promise<SetupProgress>`, where
    `SteamSystem` = `{ readSteam(); isRunning(image: string): Promise<boolean>; shutdownSteam(); startSteam();
    copyFile(from, to); writeFileAtomic(path, text); readFile(path); now(); sleep(ms) }`.
  - Cases: order is closing-steam → (Steam gone) → copy → write → opening-steam → done; the copy is made only when
    the backup file does not exist yet; the written text differs from the read text only in the option; with
    `LegendsOfIdleon.exe` running → `failed: game-open` and no shutdown call; Steam still running after 30 s of fake
    time → `failed: steam-did-not-close`, no copy, no write, no kill call exists in `SteamSystem`; a `VdfShapeError` →
    `failed: unreadable-config`, nothing written; `startSteam` throwing → `failed: steam-did-not-open` after the write;
    option already the companion's → `done` with no shutdown ("Steam is already set up for <name>");
    `steamState` gives `option.state`, `consoleScript`, `configured`, `gameOpen`, `details` and never writes.
- [X] T041 [P] [US1] Setup screen in `src/renderer/SetupView.test.tsx` (`// @vitest-environment jsdom`)
  - Files: `src/renderer/SetupView.test.tsx`
  - Cases: shows "Steam found", the account name, "Legends of Idleon found" and the option state ("not set" /
    the current text and the new text with "The companion only adds to your launch option; nothing is removed.");
    "Close Steam and set up" calls `setupSteam`; while running, the step text ("Closing Steam…", "Setting up…",
    "Opening Steam…") and the button disabled (FR-029); `gameOpen` → button disabled with "Close the game first"
    (FR-014); `consoleScript` → "This launch option also runs a console script; the gem store may not open.";
    `steam-did-not-close` → its message and "Try again"; `steam-did-not-open` → "Setup is done. Open Steam yourself.";
    done → "All set. Press Play in Steam as usual."; "Details" shows the exact option, the file and the copy (FR-011);
    Steam not found / game not installed / no account → what is missing and no setup button; buttons reachable with
    Tab and pressed with Enter (FR-034).
- [X] T042 [P] [US1] App shows only the setup screen when not configured in `src/renderer/App.test.tsx`
  - Files: `src/renderer/App.test.tsx`
  - Cases: `steamState` with `configured: false` → only `SetupView` (no panel, no settings); `configured: true` → the
    001 window; after a `done` progress the window switches to the 001 window.
- [X] T043 [P] [US1] Payload checks for the new channels in `src/main/payloads.test.ts`
  - Files: `src/main/payloads.test.ts`
  - Cases: `steam:setup`, `steam:remove`, `reader:release`, `reader:reconnect` and `update:install` accept only an
    empty or missing body and refuse anything else.

### Implementation for Phase 4

- [X] T044 [US1] `src/main/steam/setup.ts` as tested in T040; the real `SteamSystem` in `src/main/steam/system.ts`
  (`tasklist /FI "IMAGENAME eq <image>" /NH` through `execFile`; `steam.exe -shutdown`; `steam.exe` detached;
  `writeFileAtomic` = write `.tmp` + rename; poll every 500 ms up to 30 s)
- [X] T045 [US1] IPC and preload
  - Files: `src/main/index.ts`, `src/main/payloads.ts`, `src/preload/index.ts`
  - `steam:state`, `steam:setup`, `steam:remove` (wired in Phase 6), `steam:progress`, through `guardIpc` and the
    payload checks of T043; the part from `companionPart({ execPath: process.execPath, defaultApp:
    process.defaultApp === true, appPath: app.getAppPath() })`; the backup at
    `join(dataDir, "steam-backup", `${id}-localconfig.vdf`)`. The preload gains the `CompanionApi` methods of T022.
- [X] T046 [US1] `src/renderer/SetupView.tsx` and `src/renderer/App.tsx` as tested in T041 and T042 (styles in
  `styles.css`, no inline styles: CSP)

**Verify**: `just test-one src/main/steam/setup.test.ts`, `just test-one src/renderer/SetupView.test.tsx`,
`just test-one src/renderer/App.test.tsx` and `just test-one src/main/payloads.test.ts` pass; `just check` passes.

---

## Phase 5: User Story 2 — let the game close and reconnect (Priority: P2)

**Goal**: "Let the game close" detaches the keeper from the page (the game's X works), "Reconnect" takes the engine again
with one pause (research R7, contracts/link.md).

**Independent Test**: the keeper tests with the fake `Cdp` show the detach, the pipe kept and exactly one new pause;
with Vinicius, quickstart §3 steps 3–5.

### Tests for Phase 5

- [X] T050 [P] [US2] Reader stop resolves after the release in `src/keeper/reader.test.ts`
  - Files: `src/keeper/reader.test.ts` (343 lines: add at most ~40; if it would pass 400, put the cases in
    `src/keeper/reader-stop.test.ts`)
  - Cases: `await reader.stop()` resolves only after `Runtime.releaseObjectGroup` and `Target.detachFromTarget` were
    sent for the held session; a stop while `acquireEngine` is still running resolves after that engine is let go;
    a second `stop()` resolves too.
- [X] T051 [P] [US2] Release and reconnect in `src/keeper/keeper-release.test.ts`
  - Files: `src/keeper/keeper-release.test.ts` (new; same fakes as `keeper.test.ts`)
  - Cases: a link `release` while reading → reader stopped, status `{ game: "running", reader: "released" }`, the game
    process and its pipe untouched (no close call on the `Cdp`); `reconnect` after it → a new `read` call (one new
    pause), status back to `attached`; `reconnect` without a prior `release` → ignored; `release` with no reader (game
    opened without the pipe) → ignored; `release` then `reconnect` sent at once → the new reader starts only after the
    old stop resolved; the game exiting while released → the keeper ends as in 001; log lines `released` and
    `reconnect` carry the game pid as `id`.
- [X] T052 [P] [US2] Status bar and tray in `src/renderer/ui.test.tsx` and `src/main/lifecycle.test.ts`
  - Files: `src/renderer/ui.test.tsx` (318 lines: new cases in `src/renderer/status-bar.test.tsx` if it would pass
    400), `src/main/lifecycle.test.ts`
  - Cases: `reader: "attached"` → button "Let the game close" and the line "To close the game, press Let the game close
    first." (FR-018); click → `releaseGame`; `reader: "released"` → "Reader off · You can close the game now" and
    "Reconnect" → `reconnect`; `game: "closed"` or `"not-launched"` → no button; a reconnect failure (`reader:
    "error"` after `released`) shows its message and keeps "Reconnect". Pure `trayItems(status: Status): string[]` in
    `src/main/lifecycle.ts`: attached → `["Show/Hide", "Let the game close", "Quit"]`; released → `["Show/Hide",
    "Reconnect", "Quit"]`; no game → `["Show/Hide", "Quit"]` (FR-031).

### Implementation for Phase 5

- [X] T053 [US2] `stop(): Promise<void>` in `src/keeper/reader.ts` as tested in T050 (callers in
  `src/keeper/index.ts` and `keeper.ts` updated)
- [X] T054 [US2] Release and reconnect in `src/keeper/keeper.ts` and `src/keeper/link-server.ts`
  - `startLinkServer(pipePath, onMessage: (m: "confirm-attach" | "release" | "reconnect") => void)`; `runKeeper`
    keeps the `Cdp` of the launched game, and on `release` awaits `reader.stop()` and publishes `released`; on
    `reconnect` (only when released and `game.cdp` exists) calls `startReading(game.cdp)` again (contracts/link.md).
- [X] T055 [US2] Window and tray
  - Files: `src/renderer/StatusBar.tsx`, `src/main/lifecycle.ts`, `src/main/index.ts`, `src/main/payloads.ts`,
    `src/preload/index.ts`
  - `READER` gains `released: "Reader off"`; the buttons and the line of T052; `reader:release` and
    `reader:reconnect` IPC send `{ type: "release" }` / `{ type: "reconnect" }` on the link; the tray menu is rebuilt
    from `trayItems(status)` on every status.

**Verify**: `just test-one src/keeper/keeper-release.test.ts`, `just test-one src/keeper/reader.test.ts`,
`just test-one src/renderer/ui.test.tsx` and `just test-one src/main/lifecycle.test.ts` pass; `just check` passes.

---

## Phase 6: User Story 3 — undo the Steam setup (Priority: P3)

**Goal**: "Remove from Steam" and the uninstaller take out only the companion's part, from every configured account
(research R5, R6; contracts/command-line.md).

**Independent Test**: the removal tests with fakes; with Vinicius, quickstart §4.

### Tests for Phase 6

- [X] T060 [P] [US3] Removal flow in `src/main/steam/remove.test.ts`
  - Files: `src/main/steam/remove.test.ts`
  - Signatures tested: `runRemove(sys: SteamSystem, store: SetupStoreLike, onProgress): Promise<SetupProgress>`.
  - Cases: two configured accounts → both files lose only their `inserted` text, and both leave `steam-setup.json`;
    the user edited the rest after setup → the edit stays (SC-005); the inserted text already gone → that file is not
    written; game open → `failed: game-open`, nothing touched; Steam not closing in 30 s → `failed:
    steam-did-not-close`, nothing written; one account's file unreadable → that account is kept in the store, the other
    is done, result `failed: unreadable-config`; nothing configured → `done` without closing Steam.
- [X] T061 [P] [US3] Uninstaller mode exit codes in `src/main/remove-from-steam.test.ts`
  - Files: `src/main/remove-from-steam.test.ts`
  - Signatures tested: `exitCodeFor(p: SetupProgress): 0 | 2 | 3 | 4` — done → 0; `game-open` → 2;
    `steam-did-not-close` → 3; `unreadable-config` → 4; `steam-did-not-open` → 0 (the option is already clean).
- [X] T062 [P] [US3] Settings in `src/renderer/ui.test.tsx` (or `src/renderer/settings.test.tsx` past 400 lines)
  - Cases: "Set up Steam" opens the setup screen for the last-used account (or "Steam is already set up for <name>");
    "Remove from Steam" asks for a confirmation, then calls `removeFromSteam` and shows the steps; disabled with
    "Close the game first" while the game is open.

### Implementation for Phase 6

- [X] T063 [US3] `src/main/steam/remove.ts` as tested in T060; `steam:remove` IPC wired in `src/main/index.ts`
  - Files: `src/main/steam/remove.ts`, `src/main/steam/index.ts`, `src/main/index.ts`
  - Signature: `runRemove(sys, store, onProgress)` (T060)
- [X] T064 [US3] `src/main/remove-from-steam.ts`: runs `runRemove` with the real system, no window, no single-instance
  lock, then `app.exit(exitCodeFor(result))` (T061)
  - Files: `src/main/remove-from-steam.ts`
  - Signature: `exitCodeFor(p: SetupProgress): 0 | 2 | 3 | 4` (T061); the default export runs the flow and exits
- [X] T065 [US3] Uninstaller script `build/installer.nsh`
  - Files: `build/installer.nsh`, `electron-builder.yml` (`nsis.include: build/installer.nsh`)
  - Macro `customUnInit`, inside `${ifNot} ${isUpdated}`: `MessageBox MB_YESNO` "Steam will close to remove the
    companion from the launch option of Legends of Idleon. Continue?"; yes → `ExecWait '"$INSTDIR\IdleOn
    Companion.exe" --remove-from-steam' $0`; `$0 == 2` → `MessageBox` "Close the game first." and `Abort`; no, `3` or
    `4` → `MessageBox` with the text to remove, `"$INSTDIR\IdleOn Companion.exe" --keeper`, and go on (FR-013).
  - Check (manual, quickstart §4): the macro runs before any file is removed; an update (`--updated`) skips it.
- [X] T066 [US3] Settings buttons in `src/renderer/SettingsView.tsx` as tested in T062
  - Files: `src/renderer/SettingsView.tsx`
  - Cases: T062

**Verify**: `just test-one src/main/steam/remove.test.ts`, `just test-one src/main/remove-from-steam.test.ts` and the
settings test pass; `just package` still builds; `just check` passes.

---

## Phase 7: User Story 4 — automatic updates (Priority: P4)

**Goal**: the app finds, downloads and checks new versions from the public releases repository and never installs with
the game open (research R3; ADR 0005; constitution 1.1.0).

**Independent Test**: the update-decision tests; with Vinicius, quickstart §6.

### Tests for Phase 7

- [ ] T070 [P] [US4] Update decisions in `src/main/updates.test.ts`
  - Files: `src/main/updates.test.ts`
  - Signatures tested (pure part of `src/main/updates.ts`): `canInstall(p: { status: Status | null; gameRunning:
    boolean }): boolean`; `updateStateFrom(event: "checking" | "available" | "progress" | "downloaded" | "error",
    version?: string, canInstall?: boolean): UpdateState`; `shouldCheck(p: { isPackaged: boolean }): boolean`.
  - Cases: `status.game === "running"` → false; `LegendsOfIdleon.exe` running with the link down → false; game closed
    and no process → true; `downloaded` → `ready` with `canInstall`; `error` → `check-failed`; not packaged → never
    checks (research R9).
- [ ] T071 [P] [US4] Status bar and settings lines in `src/renderer/ui.test.tsx` (or `src/renderer/update.test.tsx`)
  - Cases: `ready` + `canInstall` → "Update ready" and "Restart to update" (calls `installUpdate`); `ready` without
    `canInstall` → button disabled with "Update installs after the game closes"; `check-failed` → only Settings shows
    "Could not check for updates" (FR-025); `downloading` → nothing in the status bar.
- [ ] T072 [P] [US4] No network outside the updater in `src/main/no-network.test.ts`
  - Files: `src/main/no-network.test.ts`
  - Cases: no file under `src/` except `src/main/updates.ts` imports `electron-updater`, `node:http`, `node:https`,
    `node:net` with a host, `fetch` or `net.request` (`src/keeper/link-server.ts` and `src/main/link-client.ts` use
    `node:net` on the pipe path only and are allowed by name) — a scan of the source text (FR-026, SC-007).

### Implementation for Phase 7

- [ ] T073 [US4] Add electron-updater (approved by Vinicius on 07/11): `pnpm add electron-updater@6.8.11`
  (`package.json`, `pnpm-lock.yaml` through pnpm)
  - Files: `package.json`, `pnpm-lock.yaml`
- [ ] T074 [US4] `src/main/updates.ts` as tested in T070: `autoUpdater` with `autoDownload = true`, `allowDowngrade =
  false`, `autoInstallOnAppQuit = canInstall(...)` recomputed on every status; check at start and every 6 h when
  packaged; `update:state` sent and replayed; `update:install` → `quitAndInstall(true, true)` only when `canInstall`
  - Files: `src/main/updates.ts`, `src/main/index.ts`, `src/main/payloads.ts`
  - Signatures: `canInstall`, `updateStateFrom`, `shouldCheck` (T070); `startUpdates(send: (u: UpdateState) => void,
    canInstallNow: () => boolean): { install(): void; onStatus(): void }`
- [ ] T075 [US4] Status bar and settings lines as tested in T071 (`src/renderer/StatusBar.tsx`,
  `src/renderer/SettingsView.tsx`, `src/preload/index.ts`)
  - Files: `src/renderer/StatusBar.tsx`, `src/renderer/SettingsView.tsx`, `src/preload/index.ts`
  - Cases: T071

**Verify**: `just test-one src/main/updates.test.ts` and `just test-one src/main/no-network.test.ts` pass; `just check`
passes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: the documents that hold the current truth, and the end-to-end check with Vinicius.

**Independent Test**: `just check` passes; the quickstart runs end to end with Vinicius.

- [ ] T080 [P] `ARCHITECTURE.md`: one executable and `src/start/` (with `start-only-dispatches`), the keeper in
  Electron's main process, `src/main/steam/`, the link's `release`/`reconnect`, the new IPC channels, the updater as the
  only network access, the new user-data files (`steam-setup.json`, `steam-backup\`), links to ADRs 0003–0005
  - Files: `ARCHITECTURE.md`
- [ ] T081 [P] `GLOSSARY.md`: **Launch option**, **Setup screen**, **Companion part** (what the companion adds to the
  launch option), **Let the game close** / **Reconnect**, **Releases repository**; the keeper's entry updated (no
  `ELECTRON_RUN_AS_NODE`)
  - Files: `GLOSSARY.md`
- [ ] T082 [P] `docs/steam-setup.md` rewritten: install from the release page (SmartScreen: "More info" → "Run
  anyway"), the setup screen, "Let the game close", "Remove from Steam" and uninstalling, the dev option without `.cmd`
  - Files: `docs/steam-setup.md`
- [ ] T083 Quickstart with Vinicius (quickstart.md §1–§6), touching Steam only with Vinicius's explicit OK; the releases
  repository created only with Vinicius's explicit OK; findings recorded in `docs/licoes/002-install-and-setup.md`
  - Files: `docs/licoes/002-install-and-setup.md` (new)

**Verify**: `just check` passes; quickstart §1–§6 done with Vinicius, results noted in the lessons file.

---

## Dependencies & Execution Order

- Phase 0 → Phase 1 → Phase 2 → the stories. Phase 3 → Phase 4 (US1). Phase 5 (US2) needs only Phase 2. Phase 6 (US3)
  needs Phases 3–4. Phase 7 (US4) needs Phase 1 (packaging) and Phase 2. Phase 8 last.
- Inside each phase: tests (fail) → implementation → `just check`.

## Parallel Opportunities

- Tests marked [P] in a phase touch different files and can be written together.
- After Phase 2, US2 (Phase 5) could run beside US1 (Phases 3–4); the Executor runs one phase at a time, so this only
  matters for the order.

## Implementation Strategy

- MVP: Phases 0–4 — installed app, setup screen, Steam launches the exe, the gem store works.
- Then US2 (the X), US3 (undo), US4 (updates), each shippable on its own as a new installer.

## Review Focus

1. Steam still running when the write would happen (slow shutdown, user reopens it): a reasonable user expects nothing
   written and "Steam did not close". Pinned by "Steam still running after 30 s → steam-did-not-close, no write", task
   T040 in Phase 4.
2. A launch option with the user's own text, wrappers or two `%command%`: the user expects every character of theirs to
   survive setup and removal. Pinned by the `addPart`/`removePart` round-trip cases, task T031 in Phase 3, and "the user
   edited the rest after setup", task T060 in Phase 6.
3. An update while the game is open, or the uninstaller run by an update: the user expects the game to keep running and
   Steam untouched. Pinned by `canInstall` with the game running, task T070 in Phase 7; the `--updated` skip is in
   `build/installer.nsh` (T065) and checked in quickstart §6 step 5.
4. "Let the game close" then "Reconnect" clicked fast: the user expects one session at a time and exactly one new pause.
   Pinned by "release then reconnect at once", task T051 in Phase 5.
5. A Steam file in an unexpected shape (another casing, missing block, CRLF): the user expects the file unchanged when it
   cannot be edited safely, and a clear message. Pinned by the `VdfShapeError` and CRLF cases, task T030 in Phase 3.

### Security Criteria

- T030, T034 (`vdf.ts`): only the option's bytes change (CHK012); unexpected shape writes nothing (CHK016).
- T031, T035 (`launch-option.ts`): never erase the user's text (CHK018); removal takes only the inserted text (CHK014).
- T033, T037 (`setup-store.ts`): only the numeric account id, no name, nothing in logs (CHK017); backup never
  overwritten (CHK013).
- T040, T044 (`setup.ts`, `system.ts`): change Steam only after the user's click (CHK011); never kill Steam nor write
  with it open (CHK015); `execFile`, never a shell.
- T043, T045, T055 (IPC): fixed channels, sender check, payload check (CHK021).
- T051, T054 (release/reconnect): read-only constraints kept, the debugging pipe never closed (CHK019, CHK020).
- T060, T063–T065 (undo): every configured account, only the inserted text (CHK014).
- T070, T072, T074 (updates): only the app, only the releases repository over HTTPS, hash checked, no downgrade, never
  with the game open (CHK002–CHK006, CHK008, CHK009).
- T015 (`electron-builder.yml`): per-user, fixed path, no game file (CHK022, CHK023); unsigned by decision (CHK007).
