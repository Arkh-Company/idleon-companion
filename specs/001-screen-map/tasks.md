# Tasks: IdleOn Companion v1 (Screen Map)

**Input**: [spec.md](spec.md), [plan.md](plan.md) (read its "Kit decisions": they change the paths of the original plan)

**Tests**: Tests are mandatory. Every phase writes its tests first, next to the code in `src/`, and sees them fail
before the implementation exists. `just check` passes at the end of every phase.

**Organization**: one phase per group of the original plan's tasks (the user chose six code phases on 07/11), after the
Done gate. Task numbers of the original plan are noted in each phase title.

## Format: `[ID] [P?] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[sessão]**: done-gate file, applied by the session with the user's confirmation, never by the Executor

## Rules for every phase

- Inside the game only property reads run; no game function call, no write, no network. A test never imports a module
  that imports `electron` (plan, Kit decision 7), and never touches the network.
- Identifiers and UI copy in English; files up to 400 lines; other folders import the shared code from
  `src/shared/index.ts` only (constitution: the entry file is the public API).
- `.ts` relative imports keep their extension (`./catalog.ts`), as `module: nodenext` and `rewriteRelativeImportExtensions` ask.
- A named-pipe path in a test: `process.platform === "win32" ? \`\\\\.\\pipe\\${name}\` : join(tmpdir(), \`${name}.sock\`)` (the CI is Linux).

---

## Phase 0: Done gate

**Purpose**: the configuration changes the scaffold needs, before any code (plan, Kit decision 11).

**Independent Test**: `just check` passes with the code of `main` as it is, and `just arch` reports no violation.

- [X] T001 [sessão] JSX and the extra roots in `tsconfig.json`
  - Files: `tsconfig.json`
  - Change: add `"jsx": "react-jsx"` to `compilerOptions`; `"include": ["src", "scripts", "electron.vite.config.ts"]`
    (ESLint's project service only parses files the tsconfig includes).
- [X] T002 [sessão] Ignore the build output and the mock game in `eslint.config.mjs`
  - Files: `eslint.config.mjs`
  - Change: `ignores` gains `"out/**"` (electron-vite output; ESLint 10 does not read `.gitignore`) and
    `"src/keeper/mock-game/**"` (browser fixture code that imitates the game).
- [X] T003 [sessão] Keep Prettier off the mock game in `.prettierignore`
  - Files: `.prettierignore`
  - Change: add `src/keeper/mock-game/`, with a comment: Prettier would rewrite `getGameAttribute:function(`, the anchor
    the reader looks for.
- [X] T004 [sessão] The dependency-cruiser tool and its `arch` recipe (the config goes to T016, the `check` entry to T017)
  - Files: `package.json` and `pnpm-lock.yaml` (through `pnpm add -D dependency-cruiser@18.7.2`), `justfile`
  - Change: recipe `arch: pnpm exec depcruise src --config .dependency-cruiser.cjs`, still outside `check`.
  - During the implementation (07/11): the `protect-files` hook does not count `.dependency-cruiser.cjs` as a done-gate
    file, so the session cannot create it. With the user's choice, the Executor creates it in Phase 1 (T016), and the
    session puts `arch` into `check` at the end of Phase 1 (T017).
- [X] T005 [sessão] `dev`, `build` and `clean` through electron-vite
  - Files: `justfile`, `tsconfig.build.json` (removed)
  - Change: `dev: pnpm exec electron-vite dev`; `build: pnpm exec electron-vite build`; `clean` also removes `out`;
    remove `tsconfig.build.json`, which only the old `build` used.

**Verify**: `just check` — every step passes.

---

## Phase 1: Setup — scaffold and shared types (plan Tasks 1–2)

**Goal**: an empty, secure window titled "IdleOn Companion" built by electron-vite, and the shared types of the spec.

**Independent Test**: `just build` writes `out/main/index.js`, `out/preload/index.cjs` and `out/renderer/index.html`;
the window-options, CSP, App and shared-types tests pass.

### Tests for Phase 1

- [X] T010 [P] Window options test in `src/main/window-options.test.ts`
  - Files: `src/main/window-options.test.ts`
  - Cases: `windowOptions("x/preload.cjs")` has `title: "IdleOn Companion"`, `webPreferences.contextIsolation === true`,
    `nodeIntegration === false`, `sandbox` not `false`, `preload === "x/preload.cjs"`.
- [X] T011 [P] CSP and App tests in `src/renderer/App.test.tsx` (`// @vitest-environment jsdom`)
  - Files: `src/renderer/App.test.tsx`
  - Cases: `src/renderer/index.html` has `<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`
    and `<title>IdleOn Companion</title>`; `<App />` renders the heading "IdleOn Companion". Call `cleanup()` in
    `afterEach` (vitest runs without globals, so Testing Library does not clean up by itself).
- [X] T012 [P] Shared constants test in `src/shared/types.test.ts`
  - Files: `src/shared/types.test.ts`
  - Cases: `IPC` equals `{ contextUpdate: "context:update", statusUpdate: "status:update", catalogName: "catalog:name",
    settingsGet: "settings:get", settingsSet: "settings:set", confirmAttach: "reader:confirm-attach" }`;
    `moduleChannel("screen-map", "x") === "module:screen-map:x"`; `DEFAULT_SETTINGS` equals
    `{ showWindowOnGameStart: true, closeWithGame: true, alwaysOnTop: false }`.

### Implementation for Phase 1

- [X] T013 Dependencies and package entry
  - Files: `package.json`, `pnpm-lock.yaml` (through pnpm), `.gitignore`
  - Commands: `pnpm add react@19.3.1 react-dom@19.3.1`; `pnpm add -D electron@45.2.3 electron-vite@6.0.0 vite@8.3.6
    jsdom@31.0.0 @testing-library/react@16.3.3 @types/react@19.3.0 @types/react-dom@19.3.0` (no `@vitejs/plugin-react`:
    plan Kit decision 5).
  - `package.json`: `"main": "out/main/index.js"` (Electron and the keeper start the app from the repo root).
  - `.gitignore`: `/names.json`, `*.pak`, `N.js` with `!src/keeper/mock-game/static/game/N.js`, `N.game.js` (game files
    and user data never enter the repo; `out/` and `*.log` are already there).
- [X] T014 electron-vite config and the main/preload/renderer skeleton
  - Files: `electron.vite.config.ts`, `src/main/window-options.ts`, `src/main/index.ts`, `src/preload/index.ts`,
    `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/styles.css`
  - Signatures: `windowOptions(preloadPath: string): BrowserWindowConstructorOptions` (`import type` from `electron`
    only, so the test does not load Electron).
  - `electron.vite.config.ts`: preload `build.rolldownOptions.output = { format: "cjs", entryFileNames: "[name].cjs" }`;
    `renderer: { server: { hmr: false } }` (plan Kit decisions 5 and 6).
  - `src/main/index.ts`: one `BrowserWindow(windowOptions(join(import.meta.dirname, "../preload/index.cjs")))`;
    `ELECTRON_RENDERER_URL` in dev, else `../renderer/index.html`. Preload exposes nothing yet.
- [X] T015 Shared types in `src/shared/types.ts` and `src/shared/index.ts`
  - Files: `src/shared/types.ts`, `src/shared/index.ts` (re-exports the public API)
  - Signatures (spec §5.1, §5.3, §5.4, §6.2, §6.3): `Reading`, `Entry`, `Catalog`,
    `CatalogTable = "menu" | "menu2" | "codex"`, `GameContext`, `Status = { game: "running" | "closed" | "not-launched";
    reader: "attached" | "connecting" | "error"; message?: string; lastReadingAt?: number }`, `Settings`,
    `DEFAULT_SETTINGS`, `CompanionModule` (`Panel` typed with `import type { ComponentType } from "react"`), `IPC`
    (`as const`), `moduleChannel(id: string, name: string): string`, and `CompanionApi` (the preload API of T054).
- [X] T016 Boundary rules in `.dependency-cruiser.cjs`
  - Files: `.dependency-cruiser.cjs` (new, CommonJS: the package is `"type": "module"`)
  - Rules, all `severity: "error"`: `keeper-and-shared-without-electron` (from `^src/(keeper|shared)/` to path
    `node_modules/electron/`; a fancier regex is refused as unsafe), `keeper-alone` (from `^src/keeper/` to
    `^src/(main|preload|renderer)/`), `main-not-keeper-or-renderer` (from `^src/main/` to `^src/(keeper|renderer)/`),
    `preload-alone` (from `^src/preload/` to `^src/(main|keeper|renderer)/`), `renderer-without-node` (from
    `^src/renderer/` to `^src/(main|keeper|preload)/`), `renderer-without-node-core` (from `^src/renderer/` to
    `dependencyTypes: ["core"]`), `shared-alone` (from `^src/shared/` to `^src/(main|keeper|preload|renderer)/`); each
    with a one-line `comment` saying why. Options: `doNotFollow: { path: "node_modules" }`, `tsPreCompilationDeps: true`,
    `tsConfig: { fileName: "tsconfig.json" }`.
  - Check: `just arch` prints `no dependency violations found`; a throwaway `import { app } from "electron"` in
    `src/keeper/` and `import "node:fs"` in `src/renderer/` are reported (remove them before committing).
- [X] T017 [sessão] `arch` joins `just check`, after T016 (the session, at the end of this phase)
  - Files: `justfile`
  - Change: `check: fmt-check lint typecheck arch secrets test`.

**Verify**: `just test-one src/main/window-options.test.ts`, `just test-one src/renderer/App.test.tsx` and
`just test-one src/shared/types.test.ts` pass; `just arch` prints `no dependency violations found`; `just build` lists
the three outputs above; `just check` passes.

---

## Phase 2: Catalog and context (plan Tasks 3–4)

**Goal**: readings become a `GameContext` with English names, unnamed numbers are found, and names are saved safely.

**Independent Test**: the catalog and context tests pass on their own, with the converted default catalog.

### Tests for Phase 2

- [X] T020 Catalog tests in `src/main/catalog/catalog.test.ts`
  - Files: `src/main/catalog/catalog.test.ts`
  - Cases: `catalogKey(0.1) === "0.1"`, `catalogKey(0.78) === "0.78"`, `catalogKey(44) === "44"` (Review Focus 3);
    invalid user file (`"{"`) → `loadCatalog` returns the default and the file is renamed to `names.json.bad`;
    missing user file → default, no `.bad`; valid JSON with the wrong shape (no `version: 1`) → default and `.bad`;
    `nameEntry(def, "menu2", "999", "Test").menu2["999"]` equals `{ name: "Test", status: "confirmed" }` and `def` is
    not mutated; saving twice leaves `names.json.bak` with the first content (`"version":1`); `unnamedIn(def,
    { ...base, menu: 3, menu2: 999, codexTab: 9 })` equals `[{ table: "menu2", key: "999" }, { table: "codex", key: "9" }]`;
    `menu2: 0` and a closed Codex (`menu !== 3`) add nothing. Temp dirs from `mkdtempSync(join(tmpdir(), ...))`.
- [X] T021 [P] Context tests in `src/main/context.test.ts`
  - Files: `src/main/context.test.ts`
  - Cases: world from map (264 → 6, 41 → 1, 326 → 7); names (`map: 264, menu2: 44, afk: "w6d3"` →
    `names.map === "Emperor's Castle Doorstep"`, `names.window?.name === "Sailing"`, `names.afk === "Samurai Guardian"`);
    `char: null` → `character === null`; `unnamed` comes from `unnamedIn`; `updatedAt === reading.t`.

### Implementation for Phase 2

- [X] T022 Convert the prototype catalog
  - Files: `scripts/convert-prototype-names.ts`, `src/main/catalog/default-names.json`
  - Run: `node scripts/convert-prototype-names.ts <prototype names.json> src/main/catalog/default-names.json`, where the
    prototype file is `C:\Users\Vinicius\idleon-companion\names.json`.
  - Rules (spec §5.3): a name ending in ` (?)` → that name without the suffix, `"deduced"`; keys in the confirmed list
    (menu 3, 4, 5; menu2 2, 5, 6, 8, 9, 10, 12, 13, 14, 17, 21, 23, 28, 30, 35, 38, 45, 56, 72, 82, 94, 100 and 64–69)
    → `"confirmed"`; everything else `"deduced"`; `codex` and `quickref` the same way, all `"deduced"`; `maps` and `afk`
    copied as they are; `version: 1`.
  - Translation (plan Kit decision 9): a fixed Portuguese → English table for every Portuguese name in the prototype's
    `menu`, `menu2`, `codex` and `quickref` (e.g. nenhum/nenhuma → None, Itens → Items, Talentos → Talents, Mapa do
    mundo → World map, Ataques → Attacks, Bigorna → Anvil, Baú → Storage, Estátuas → Statues, Torneio → Tournament,
    Correio → Mail, Alquimia → Alchemy, Amigos → Friends, Guilda → Guild, Servidor → Server, Personagens → Characters,
    Ofertas (loja) → Offers (shop)). The script fails, naming the string, when a name with Portuguese characters is left
    untranslated.
- [X] T023 Catalog in `src/main/catalog/catalog.ts`
  - Files: `src/main/catalog/catalog.ts`
  - Signatures: `catalogKey(n: number): string`; `loadCatalog(userPath: string, defaultCatalog: Catalog): Catalog`;
    `nameEntry(cat: Catalog, table: CatalogTable, key: string, name: string): Catalog`;
    `saveCatalog(userPath: string, cat: Catalog): void` (creates the folder; copies the previous file to
    `names.json.bak` before writing); `unnamedIn(cat: Catalog, r: Reading): Array<{ table: CatalogTable; key: string }>`.
- [X] T024 Context in `src/main/context.ts`
  - Files: `src/main/context.ts`
  - Signature: `toContext(r: Reading, cat: Catalog): GameContext` (`world = Math.floor(map / 50) + 1`; `screen.window`
    is `menu2`, `screen.tab` is `menu2tab`; `names.codexTab` only when `menu === 3`).
- [X] T025 [P] Declare `@testing-library/dom` (added on 07/11 during the implementation, with the user's yes)
  - Files: `package.json`, `pnpm-lock.yaml` (through pnpm)
  - Command: `pnpm add -D @testing-library/dom@<the version the lockfile already resolves>`: today it only comes in
    through pnpm's auto-install of peers, and Testing Library asks for it explicitly.

**Verify**: `just test-one src/main/catalog/catalog.test.ts` and `just test-one src/main/context.test.ts` pass;
`just check` passes.

---

## Phase 3: Read-only reader — read.js, CDP, launch and reader loop (plan Tasks 5–6)

**Goal**: the keeper-side code that opens the game with the pipe, takes the engine once and reads it every second,
proved read-only.

**Independent Test**: the read-only proof and the CDP unit tests pass anywhere; on Windows with Edge, the integration
test reads the mock game through a reload.

### Tests for Phase 3

- [X] T030 Read-only proof in `src/keeper/read-only.test.ts`
  - Files: `src/keeper/read-only.test.ts`
  - Cases (spec §7.2): a fake engine where every function is `new Proxy(function () {}, { apply() { throw new
    Error("game function called"); } })`, including `getGameAttribute` and a function inside `gameAttributes.h`;
    `fn.call(engine)` returns `{ map: 264, menu: 3, codexTab: 0, codexSel: "Scripticus", char: "Darkhe" }` (subset);
    Friends tab (`OptionsList[12] = 5`, `NonCloudsave[0][2] = "Bob"`) → `codexSel === "Bob"`; outside a character
    (`UserInfo` missing) → `char === null`; the result has no `probe` key.
- [X] T031 [P] CDP tests in `src/keeper/cdp.test.ts`
  - Files: `src/keeper/cdp.test.ts`
  - Cases, with two `PassThrough` streams: `send` writes `{"id":1,"method":...,"params":{}}\0` and resolves with the
    `result` of the matching answer, also when the answer arrives split across chunks; an answer with `error` rejects
    with its message; an event without `id` reaches `waitFor`; no answer within the timeout rejects with
    `/no answer/`; `close()` rejects every pending request.
- [X] T032 Launch and reader tests in `src/keeper/reader.integration.test.ts`
  - Files: `src/keeper/reader.integration.test.ts`
  - Cases (the original plan's Task 6 code, with `describe.skipIf(!existsSync(EDGE))` and
    `EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"`): reads changes, pauses once, survives a
    reload (`app.html?reload=1`, 12 s: more than 3 distinct maps, at least 2 `attached` statuses; Review Focus 1); the
    exe path with spaces and parentheses keeps every arg (`spawnImpl` fake, outside the `skipIf`, runs on the CI too;
    Review Focus 2); the game closing rejects in-flight requests with no unhandled rejection (Review Focus 4); a missing
    anchor reports `{ reader: "error", message: "Game updated: the reader needs an update" }` and no reading.

### Implementation for Phase 3

- [X] T033 read.js and its loader
  - Files: `src/keeper/read.js`, `src/keeper/read-source.ts`
  - `read.js`: ported from the prototype `C:\Users\Vinicius\idleon-companion\read.js` with `codexTab`/`codexSel`
    and without the probe section; written as a parenthesized function expression, `(function () { ... })`, so ESLint
    and Prettier can parse it; property reads only.
  - Signature: `loadReadSource(file: string): string` (drops whole-line `//` comments and trims; the result works
    as `functionDeclaration` of `Runtime.callFunctionOn` and in `new Function(\`return ${src}\`)()`).
- [X] T034 CDP client in `src/keeper/cdp.ts`
  - Files: `src/keeper/cdp.ts`
  - Signatures: `createCdp(toBrowser: Writable, fromBrowser: Readable, timeoutMs = 20000): { send(method: string,
    params?: object, sessionId?: string): Promise<unknown>; waitFor(pred: (m: CdpMessage) => boolean, ms: number):
    Promise<CdpMessage>; close(): void }`; `type Cdp = ReturnType<typeof createCdp>`. Timeout message:
    `no answer from the game for <method>`. Stream errors never throw out of the module.
- [X] T035 Mock game fixture with a reload mode
  - Files: `src/keeper/mock-game/app.html`, `src/keeper/mock-game/static/game/index.html`,
    `src/keeper/mock-game/static/game/N.js` (copied from `C:\Users\Vinicius\idleon-companion\mock-game\`)
  - Change: `CurrentMap` changes every second (so readings keep changing); with `?reload=1` on `app.html`, the game
    frame reloads itself exactly once, 3 s after its first load. Keep the text `getGameAttribute:function(` intact.
- [X] T036 Launch, engine reference and reader loop
  - Files: `src/keeper/launch.ts`, `src/keeper/engine-ref.ts`, `src/keeper/reader.ts` (ported from the prototype
    `launcher.cjs`)
  - Signatures: `launchGame(exe: string, args: string[], logFile: string, spawnImpl = spawn): { child: ChildProcess;
    cdp: Cdp; exited: Promise<number | null> }` (args + `--remote-debugging-pipe`, `stdio: ["ignore", log, log, "pipe",
    "pipe"]`, env `ELECTRON_ENABLE_LOGGING=1`); `acquireEngine(cdp: Cdp, opts: { scriptSuffix: string; anchor: string }):
    Promise<{ sessionId: string; objectId: string; pausedMs: number }>` (throws `AnchorNotFound`);
    `startReader(cdp: Cdp, readSource: () => string, onReading: (r: Reading) => void, onStatus: (s: Status) => void,
    opts?: { pollMs?: number; retryMs?: number; anchor?: string; scriptSuffix?: string }): { stop(): void }` (defaults
    1000 / 5000 / `getGameAttribute:function(` / `/static/game/N.js`; emits only on change). Errors, as spec §7.1 says
    (corrected on 07/11 during the implementation; the earlier "any error → re-acquire" contradicted spec §3, one pause
    per session): a failed reading (an exception inside `read.js`, a reading of the wrong shape, an exception in
    `onReading`) is ignored and the next cycle reads again with the same engine reference; only a lost reference (the
    `Runtime.callFunctionOn` request rejects: dead object or session) or a failed `acquireEngine` re-acquires after
    `retryMs`.

**Verify**: `just test-one src/keeper/read-only.test.ts` and `just test-one src/keeper/cdp.test.ts` pass;
`just test-one src/keeper/reader.integration.test.ts` passes on Windows with Edge (4 tests); `just check` passes.

---

## Phase 4: Update watch, keeper process and link (plan Tasks 7–8)

**Goal**: the keeper holds the pipe for the whole game session, warns on suspicious game updates and publishes
readings to any app over the local named pipe.

**Independent Test**: the update-watch and link tests pass; the keeper smoke against Edge writes readings to
`keeper.log`, and a second keeper exits at once.

### Tests for Phase 4

- [X] T040 [P] Update watch tests in `src/keeper/update-watch.test.ts`
  - Files: `src/keeper/update-watch.test.ts`
  - Cases: `scanGameCode("var a=1;")` → `[]`; `scanGameCode("x;debugger;y")` → `["debugger"]`;
    `scanGameCode('"debuggerName"')` → `[]`; first `checkGameUpdate` of clean code → `changed: true`; second with the
    same clean code → `changed: false`; different code → `changed: true` (state in a temp file). Corrected on 07/11
    during the implementation (spec §7.2: with markers, nothing connects until the user confirms): code with markers
    keeps `changed: true` and its markers on every check until `recordGameHash(hash, statePath)` records it, which the
    keeper calls only after `confirm-attach`.
- [X] T041 [P] Line codec tests in `src/shared/link.test.ts`
  - Files: `src/shared/link.test.ts`
  - Cases: `encodeLine` ends in `"\n"`; the decoder joins split chunks and skips junk
    (`'{"type":"confirm-at'` + `'tach"}\nnot json\n{"type":"confirm-attach"}\n'` → two `confirm-attach`).
- [X] T042 Link tests in `src/link.test.ts`
  - Files: `src/link.test.ts` (outside the boundary folders: it uses the keeper's server and the app's client)
  - Cases, each with its own pipe name (`idleon-companion-test-${process.pid}-${n}`, path per the phase rules): a late
    client gets the last status, then the last reading; a second server on the same pipe rejects with `AlreadyRunning`
    (Review Focus 5); the client reconnects after the server comes back (`retryMs: 200`, `onConnected(true)` twice;
    Review Focus 5); `confirm-attach` from the client reaches `onConfirm`.

### Implementation for Phase 4

- [X] T043 Update watch in `src/keeper/update-watch.ts`
  - Files: `src/keeper/update-watch.ts`
  - Signatures: `DETECTION_MARKERS = ["debugger", "devtools", "remote-debugging", "isDevToolsOpened", "outerWidth",
    "Function.prototype.toString"]`; `scanGameCode(code: string): string[]` (case-sensitive, whole word for `debugger`);
    `checkGameUpdate(code: string, statePath: string): { changed: boolean; hash: string; markers: string[] }` (sha256);
    `readInstalledGameCode(asarPath: string): string` (`readFileSync(join(asarPath, "distBuild/static/game/N.js"),
    "utf8")`; Electron's `fs` reads inside `.asar` also under `ELECTRON_RUN_AS_NODE`).
- [X] T044 Link codec, server and client
  - Files: `src/shared/link.ts`, `src/keeper/link-server.ts`, `src/main/link-client.ts`
  - Signatures: `LINK_PIPE = "\\\\.\\pipe\\idleon-companion"`; `type LinkMessage = { type: "reading"; reading: Reading }
    | { type: "status"; status: Status } | { type: "confirm-attach" }`; `encodeLine(m: LinkMessage): string`;
    `createLineDecoder(onMessage: (m: LinkMessage) => void): (chunk: Buffer | string) => void`;
    `startLinkServer(pipePath: string, onConfirm: () => void): Promise<{ publish(m: LinkMessage): void; close():
    Promise<void> }>` (`EADDRINUSE` → `AlreadyRunning`); `connectLink(pipePath: string, onMessage: (m: LinkMessage) =>
    void, onConnected: (up: boolean) => void, retryMs = 5000): { send(m: LinkMessage): void; close(): void }`. Node `net`
    only, never TCP.
- [X] T045 Keeper entry and its build entry
  - Files: `src/keeper/index.ts`, `electron.vite.config.ts` (main `build.rolldownOptions.input = { index:
    "src/main/index.ts", keeper: "src/keeper/index.ts" }` → `out/main/keeper.js`)
  - Flow (argv = game exe + game args): `startLinkServer` first (`AlreadyRunning` → exit 0 without launching anything);
    `checkGameUpdate` on the installed N.js (`<exe dir>\resources\app.asar`; state `%APPDATA%\IdleOn
    Companion\game-hash.json`; an unreadable N.js, as with Edge, is logged and skipped); markers found → publish
    `{ game: "running", reader: "error", message: "The game code changed and contains: <markers>. Connect anyway?" }` and
    start the reader only after `confirm-attach`; `launchGame` → `startReader` (read.js from
    `resolve(import.meta.dirname, "../../src/keeper/read.js")`) → `publish`; spawn the app detached:
    `spawn(process.execPath, [<repo root>, "--from-steam"], { detached: true, stdio: "ignore", env: <process.env without
    ELECTRON_RUN_AS_NODE> }).unref()`; on game exit publish `{ game: "closed", reader: "error" }`, close the server,
    exit 0. Log to `%APPDATA%\IdleOn Companion\keeper.log`, one JSON line per entry with `t`, `label` and `id` (the game
    pid), `pausedMs` included. `uncaughtException`/`unhandledRejection` are logged and never end the keeper while the
    game runs.
  - Manual smoke (Windows): `just build`, then with `ELECTRON_RUN_AS_NODE=1`:
    `node_modules\electron\dist\electron.exe out\main\keeper.js "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    --headless=new --no-first-run --user-data-dir=<tmp> file:///<repo>/src/keeper/mock-game/app.html` → `keeper.log`
    shows `attached` and readings; a second run exits at once.
  - From the read-only reader review (07/11, during the implementation): `pausedMs` reaches the keeper log (change
    `startReader` so the keeper gets it, e.g. through the `attached` status or a callback); the keeper calls the reader's
    `stop()` before it publishes `{ game: "closed" }`; and a `stop()` that arrives while `acquireEngine` finishes still
    releases the session (detach), with a fake-`Cdp` test in `src/keeper/reader.test.ts`.
- [X] T046 Warn about readings that keep failing (added on 07/11 during the implementation, with the user's yes)
  - Files: `src/keeper/reader.ts`, `src/keeper/reader.test.ts`, `src/keeper/index.ts` (log)
  - Behavior: after 10 consecutive failed readings (an exception in `read.js`, a reading of the wrong shape), the reader
    sends `{ game: "running", reader: "attached", message: "Reading failed: <reason>" }`, without pausing the game and
    without taking the engine again; the next good reading sends `{ reader: "attached" }` without the message. The keeper
    logs it. Tests (fake `Cdp`, on the CI): 10 failures → one status with the message and still one `attach`; a good
    reading after it clears the message.
- [X] T047 The Edge integration test becomes opt-in (added on 07/11, with the user's yes: "Tests use no real network",
  and headless Edge cannot guarantee zero traffic of its own)
  - Files: `src/keeper/reader.integration.test.ts`
  - Change: the Edge `describe` is skipped unless `IDLEON_EDGE_TESTS=1` (and Edge exists), so `just check` and the CI
    never start Edge. The tests outside that `describe` (exe path args, `toReading`) keep running everywhere.
- [X] T048 [sessão] Recipe `test-edge` in `justfile` (the session, at the end of this phase)
  - Files: `justfile`
  - Change: `test-edge` sets `IDLEON_EDGE_TESTS=1` inside the recipe and runs `pnpm exec vitest run --dir src
    src/keeper/reader.integration.test.ts`; it stays outside `check`.

**Verify**: `just test-one src/keeper/update-watch.test.ts`, `just test-one src/shared/link.test.ts`,
`just test-one src/link.test.ts` and `just test-one src/keeper/reader.test.ts` pass; `just check` passes and starts no
Edge; `just test-edge` passes on Windows; `just build` writes `out/main/keeper.js`.

---

## Phase 4b: Keeper safety follow-ups (added on 07/11 during the implementation, with the user's yes)

**Goal**: after a suspicious or uncheckable game update the game opens without the debugging pipe, and a keeper that
fails before launching still opens the game (spec §3: zero ban risk; the game never depends on the app).

**Independent Test**: the keeper tests with fakes show which launch happens in each case, on the CI.

### Tests for Phase 4b

- [X] T049 Keeper launch decisions in `src/keeper/keeper.test.ts` and `src/keeper/launch.test.ts` (or the file that
  already tests `launchGame`)
  - Cases: (a) markers found and not confirmed → the game is launched **without** `--remote-debugging-pipe` and without
    the debug stdio pipes, no reader starts, status `{ game: "running", reader: "error", message: "The game code changed
    and contains: <markers>. Reading is off for this session." }`; a `confirm-attach` in that session records the hash
    (`recordGameHash`) and starts nothing, so the next session launches with the pipe and reads without a warning;
    (b) `app.asar` exists but its N.js cannot be read → launched without the pipe, status message "Could not check the
    game code: the reader needs an update.", `confirm-attach` records nothing (there is no hash); without `app.asar`
    (Edge in the tests) the watch is skipped and reading starts as today; (c) the link server fails with an error other
    than `AlreadyRunning`, or the data folder cannot be created → the game is still launched without the pipe, and the
    error is logged when the log is writable; `AlreadyRunning` still exits without launching anything; (d)
    `launchGame(..., { debugPipe: false })` passes the Steam args unchanged, with no extra flag, `stdio` without the
    two pipes, and still drops `ELECTRON_RUN_AS_NODE`.

### Implementation for Phase 4b

- [X] T049a Launch without the pipe and the three keeper paths
  - Files: `src/keeper/launch.ts`, `src/keeper/keeper.ts`, `src/keeper/index.ts`, `src/keeper/update-watch.ts`
  - Signatures: `launchGame(exe, args, logFile, opts?: { debugPipe?: boolean }, spawnImpl?)` (default `true`; with
    `false` it returns no `cdp`); `readInstalledGameCode` tells "no app.asar" apart from "app.asar present, N.js
    unreadable". The keeper always keeps the link server (when it started), opens the app and exits only after the game.

**Verify**: `just test-one src/keeper/keeper.test.ts` passes; `just check` passes and starts no Edge;
`just test-edge` passes on Windows.

---

## Phase 5: Settings and app main process (plan Tasks 9–10)

> Before this phase's Executor, the session runs `just build` and opens the app once (`pnpm exec electron .`), to see
> the empty window come up with the ESM main, the sandboxed CommonJS preload and the CSP (added on 07/11, with the
> user's yes; the first run downloads the Electron binary).

**Goal**: the app is a link client with a tray, single instance, settings and the fixed IPC channels.

**Independent Test**: the settings, lifecycle and module tests pass; `just build` and a manual start show the window
with the not-launched status when no keeper runs.

### Tests for Phase 5

- [ ] T050 [P] Settings tests in `src/main/settings.test.ts`
  - Files: `src/main/settings.test.ts`
  - Cases: missing file → `DEFAULT_SETTINGS`; `{"alwaysOnTop":true,"x":1}` → defaults with `alwaysOnTop: true` and no
    `x`; a wrong type (`{"closeWithGame":"no"}`) → that key's default; invalid JSON → defaults; save then load round-trips.
- [ ] T051 [P] Lifecycle and modules tests in `src/main/lifecycle.test.ts` and `src/shared/modules.test.ts`
  - Files: `src/main/lifecycle.test.ts`, `src/shared/modules.test.ts`
  - Cases: the eight `decide` expectations of the original plan's Task 10 (start-from-steam with and without
    `showWindowOnGameStart`, start-manual, second-instance → `focus-window` (Review Focus 5), game-exited with and
    without `closeWithGame`, tray-click visible/hidden); `modulesFor(ctx, [always, never])` returns only the module
    whose `matches` is true.

### Implementation for Phase 5

- [ ] T052 Settings in `src/main/settings.ts`
  - Files: `src/main/settings.ts`
  - Signatures: `loadSettings(file: string): Settings` (missing/invalid → defaults, unknown keys dropped, wrong types
    → default); `saveSettings(file: string, s: Settings): void` (creates the folder).
- [ ] T053 Pure lifecycle and module registry
  - Files: `src/main/lifecycle.ts`, `src/shared/modules.ts`
  - Signatures: `decide(event: "start-from-steam" | "start-manual" | "second-instance" | "game-exited" | "tray-click",
    s: Settings, windowVisible: boolean): Array<"show-window" | "hide-window" | "focus-window" | "quit">`;
    `modulesFor(ctx: GameContext, all: CompanionModule[]): CompanionModule[]`. No `electron` import in either.
- [ ] T054 Wire the main process and the preload
  - Files: `src/main/index.ts`, `src/preload/index.ts`
  - `index.ts`: `app.requestSingleInstanceLock()` (lost → quit; the first copy handles `second-instance`);
    `start-from-steam` when `process.argv` has `--from-steam`, else `start-manual`; user data in
    `join(app.getPath("appData"), "IdleOn Companion")`; `connectLink(LINK_PIPE, ...)`: while not connected send
    status `{ game: "not-launched", reader: "error" }`; `reading` → `toContext` → `context:update`; `status` →
    `status:update`, and `game: "closed"` → `decide("game-exited", ...)`; tray icon with show/hide; on the window's
    `render-process-gone` reload only the window; `catalog:name` (`nameEntry` + `saveCatalog`, then resend the
    context of the last reading); `settings:get`/`settings:set` (apply `alwaysOnTop` at once);
    `reader:confirm-attach` → link `{ type: "confirm-attach" }`. Validate each IPC payload's shape before use
    (`catalog:name`: a known table, string key, non-empty string name).
  - From the keeper review (07/11): the link decoder checks only the message type, so validate a `reading` message's
    shape before `toContext` (move `toReading` from `src/keeper/reader.ts` to `src/shared/`, re-exported by
    `src/shared/index.ts`, and use it on both sides); start as "not connected", because `connectLink` calls
    `onConnected(false)` only when a live connection drops.
  - Navigation lockdown (added on 07/11 during the implementation, with the user's yes; Electron security checklist):
    `webContents.setWindowOpenHandler(() => ({ action: "deny" }))` and `will-navigate` prevented for any URL other
    than the window's own page. Put the decision in a pure function next to `windowOptions` (e.g.
    `isAllowedNavigation(url, ownUrl): boolean`) and test it in `src/main/window-options.test.ts`.
  - Preload: `contextBridge.exposeInMainWorld("companion", api)` with `CompanionApi = { onContext(cb), onStatus(cb),
    name(table, key, name): Promise<void>, getSettings(): Promise<Settings>, setSettings(s): Promise<void>,
    confirmAttach(): Promise<void> }`, through `ipcRenderer` and the `IPC` channel names only.

**Verify**: `just test-one src/main/settings.test.ts`, `just test-one src/main/lifecycle.test.ts` and
`just test-one src/shared/modules.test.ts` pass; `just check` passes.

---

## Phase 6: Window UI, Steam launch script and architecture (plan Task 11, Task 12 Steps 1–2)

**Goal**: the Screen map panel with "Name it", the status bar, the settings view, the launch script Steam calls,
and the architecture document.

**Independent Test**: the UI tests pass in jsdom; `docs/steam-setup.md` and `ARCHITECTURE.md` describe what the code does.

### Tests for Phase 6

- [ ] T060 UI tests in `src/renderer/ui.test.tsx` (`// @vitest-environment jsdom`)
  - Files: `src/renderer/ui.test.tsx`
  - Cases (the original plan's Task 11, with `fireEvent` in place of user-event and `getByText`/`getByTitle` in place of
    jest-dom; `cleanup()` in `afterEach`; `window.companion` stubbed with `vi.fn()`): map row
    "264 Emperor's Castle Doorstep" and window "Sailing"; unnamed `menu2` 999 → typing "Test" in the field labelled
    "Name it" and pressing Enter calls `companion.name("menu2", "999", "Test")`; a deduced entry shows
    `title="from game code"`; not-launched status shows "Live reading needs the game to be launched through Steam with
    the companion launch option."; the update warning ("The game code changed and contains: debugger. Reading is off
    for this session.") shows a "Connect next time" button that calls `companion.confirmAttach()` and then says
    "Reading starts next time the game opens.", and no such button for other messages (including "Could not check the
    game code: the reader needs an update."); the three settings checkboxes call
    `companion.setSettings` with the toggled value.

### Implementation for Phase 6

- [ ] T061 Panel, status bar, naming, settings and the screen-map module
  - Files: `src/renderer/ScreenMapPanel.tsx`, `src/renderer/StatusBar.tsx`, `src/renderer/NameIt.tsx`,
    `src/renderer/SettingsView.tsx`, `src/renderer/modules/screen-map.ts`, `src/renderer/App.tsx`,
    `src/renderer/styles.css`, `src/renderer/companion.d.ts` (`window.companion: CompanionApi`)
  - Rows: World, Map, Menu, Window, Codex tab (+ selected item), Character, AFK target; status "Game running / Reader
    attached / last reading N s ago"; "Connect next time" only when the status message starts with "The game code
    changed" (decided on 07/11: with markers the game opens without the pipe, see Phase 4b); settings "Show window when the game starts", "Close companion when the game closes", "Always on top".
    `screenMap: CompanionModule = { id: "screen-map", title: "Screen map", needs: ["live-screen"], matches: () => true,
    Panel: ScreenMapPanel }`; `App` shows `modulesFor(ctx, [screenMap])`. No inline `style` attributes (CSP).
- [ ] T062 [P] Steam launch script in `scripts/steam-launch.cmd`
  - Files: `scripts/steam-launch.cmd`
  - Content (runs the keeper in the foreground so Steam tracks it; passes the Steam command line through):
    `@echo off`, `set ELECTRON_RUN_AS_NODE=1`,
    `"%~dp0..\node_modules\electron\dist\electron.exe" "%~dp0..\out\main\keeper.js" %*`.
- [ ] T063 [P] Steam setup doc in `docs/steam-setup.md`
  - Files: `docs/steam-setup.md`
  - Content: run `just setup` and `just build` once (Electron downloads its binary on first use); the launch option
    `"<repo>\scripts\steam-launch.cmd" %command%`; how to undo it; the known limit: killing the keeper (`electron.exe`
    running `keeper.js`) kills the game, so close the app window instead.
- [ ] T064 [P] Architecture document in `ARCHITECTURE.md`
  - Files: `ARCHITECTURE.md`
  - Content: the two processes and the four code folders (keeper, main, preload, renderer, plus shared), the link and
    IPC contracts (spec §5.4), the seven dependency-cruiser rules and why each exists (including the test-file exception of
    `renderer-without-node-core`, accepted by the user on 07/11), and where user data lives.

**Verify**: `just test-one src/renderer/ui.test.tsx` passes; `just build` passes; `just check` passes.

---

## After the code PR merge (with the user, not an Executor task)

Original plan Task 12 Step 3, with the user present and explicit OK before touching Steam: replace the prototype
launch option with `"<repo>\scripts\steam-launch.cmd" %command%` and run the spec §7.3 manual checklist (Steam start
with the window on and off; map/menu/Codex tab followed within ~1 s; naming an unnamed number; killing the app with the
game open keeps the game running; reopening the app goes live again; closing the game ends the keeper and, with the
default settings, the app).

---

## Dependencies & Execution Order

- Phase 0 → Phase 1 → … → Phase 6, in order: each phase uses the types and modules of the earlier ones.
- Inside a phase, the test tasks come first and fail before their implementation tasks; `[P]` tasks touch different files.

## Review Focus

1. The game reloads or changes scene and the engine `objectId` dies: a reasonable user expects the panel to go on
   following the game within ~5 s, not to freeze on the last reading. Pinned by "reads changes, pauses once, survives a
   reload", task T032 in Phase 3.
2. Steam passes an exe path with spaces and parentheses plus its own args: the user expects the game to start exactly
   as Steam asked, plus `--remote-debugging-pipe`. Pinned by "exe path with spaces and parentheses keeps every arg",
   task T032 in Phase 3.
3. Fractional `MenuType` values (`0.1`, `0.2`, `0.78`, the Quik Ref shortcuts): the user expects the shortcut's own
   name, not the name of menu 0. Pinned by the `catalogKey` test, task T020 in Phase 2.
4. The game closes while a CDP request is in flight: the user expects the keeper to report the game closed and end
   cleanly, with no crash dialog. Pinned by "game closing rejects in-flight requests", task T032 in Phase 3.
5. A second app or keeper starts while the first runs, or the app dies and is reopened: the user expects one game, one
   window brought to the front, and the reopened app live again with the last status and reading. Pinned by
   `AlreadyRunning`, reconnection and late-client tests (T042, Phase 4) and the `second-instance` decision (T051, Phase 5).
