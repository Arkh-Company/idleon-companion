# Architecture

IdleOn Companion reads a few fields of Legends of Idleon every second, read-only, and shows them in a window next to
the game. This file describes the code as it is; the design and its reasons are in
[specs/001-screen-map/](specs/001-screen-map/spec.md), [specs/002-install-and-setup/](specs/002-install-and-setup/spec.md),
[specs/003-screen-base/](specs/003-screen-base/spec.md) and, for the formula trees,
[specs/008-formula-trees/](specs/008-formula-trees/spec.md) (its contracts in
[contracts/](specs/008-formula-trees/contracts/ipc.md)) and [specs/009-system-mould/](specs/009-system-mould/spec.md).
The decisions that are hard to reverse are in [docs/adr/](docs/adr/) ([0001](docs/adr/0001-debugging-pipe-in-the-keeper.md):
the debugging pipe in a keeper process; [0002](docs/adr/0002-fail-closed-update-watch.md): the update watch fails closed;
[0003](docs/adr/0003-one-executable-launched-by-steam.md): one executable, launched by Steam directly;
[0004](docs/adr/0004-steam-launch-option-spliced-with-steam-closed.md): the launch option spliced with Steam closed;
[0005](docs/adr/0005-updates-from-a-public-releases-repository.md): updates from a public releases repository;
[0006](docs/adr/0006-game-code-runs-in-an-isolated-worker.md): the game's code runs in an isolated worker;
[0007](docs/adr/0007-one-long-lived-calculation-context.md): one long-lived calculation context;
[0008](docs/adr/0008-a-second-worker-records-formula-trees.md): a second worker records the formula trees), and the
terms in [GLOSSARY.md](GLOSSARY.md).

## One executable, two processes

```text
Steam ─▶ "IdleOn Companion.exe" --keeper %command%
           └─ src/start/ picks the role ─▶ keeper (Electron's main process, no window, no electron import)
                                             ├─ spawns the game with --remote-debugging-pipe (fd 3/4, no TCP port)
                                             ├─ reads it every 1000 ms (read.js: property reads only)
                                             ├─ reads the state in slices, 12 a second nominal by the catalog (state-slice.js: property reads only)
                                             ├─ named pipe \\.\pipe\idleon-companion ◀──▶ app (link client)
                                             └─ spawns the same exe detached with --from-steam
app (Electron main) ◀── IPC ──▶ preload (window.companion) ◀──▶ window (React, side panel with the tree)
  ├─ worker_threads ──▶ calculator, Stats worker (src/calculator/, no network, no app APIs): the game's code over the mosaic
  ├─ worker_threads ──▶ calculator, tree worker (the same calculator.js, 2 GB heap): an instrumented copy in memory,
  │                       the recorder, the trees built from one recording, the live values of what is in view
  └─ the user data folder: settings.json; marks.json, pins.json, tree-shapes.json (written through .tmp, .bad when unreadable)
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
  starting the app, it takes the map, monster, item and class names out of the text of the installed game code
  (`game-tables.ts`, which never runs that text) and sends them to the app as `tables`: the maps and monsters name the
  screen, the items name the farm's list and the classes the character picker.
- **App** (`src/main/`, `src/preload/`, `src/renderer/`, built to `out/main/index.js`, `out/preload/index.cjs` and
  `out/renderer/`). A link client: it turns readings into a `GameContext` with the screen catalog
  (`src/shared/screens/`) and the last game tables, kept only in memory, and sends it to the window. It never launches the game and never touches its pipe, so it can close, crash or be killed with the
  game open; reopening it reconnects and gets the last status and reading. While Steam is not set up for the most recent
  account, the window is only the setup screen (`SetupView`). One instance: a second manual launch brings the first
  window forward, and a second launch from Steam (`--from-steam`) follows "Show window when the game starts"
  (`launchEvent`). When the keeper ends after the game, the window keeps "Game closed · last reading N s ago"
  (`statusOnLinkDrop`). The window's X hides it in the tray, and only the tray's "Quit", the game exiting with "Close
  companion when the game closes", or the system ending the session end the app.
- **Calculator** (`src/calculator/`, built to `out/main/calculator.js`, unpacked next to the asar). The fourth part: two
  workers owned by the app (see **Two workers** below), never by the keeper, so a crash or hang cannot reach the game
  ([ADR 0006](docs/adr/0006-game-code-runs-in-an-isolated-worker.md)). The keeper reads the state in **slices** of up to
  25 KB, 12 a second nominal, about 10.7 measured on Windows with the 83 ms interval (`state-reader.ts`), and never two in flight, by property reads only, and publishes them. What each
  read brings comes from the **catalog** (`src/shared/reading-catalog.md`), the single source of the reading lists: a
  test fails on a row that breaks its rules. The **fast reading** is every piece with a proven impact on a number shown,
  except the pieces of other characters; the **slow reading** is all the rest, a piece the catalog does not know
  included, so a new piece is still read; only the six fixed tables of `STATE_EXCLUDED`, which the calculator builds from the game's own classes, and the `_vars` outside the closed list `VARS_KEYS` are never read. Of the 12 slots of each nominal second, 3 go to the **actions slice** (the catalog's group
  `ações`), 7 to the other fast slices and 2 to the slow reading, and a slot whose lane has nothing to read goes to
  another lane. On entering a character the first lap takes every slot, a pass of the fast reading and then the slow
  one, and no number is shown before it ends. After a game patch, `node scripts/reading-inventory.ts <state.json>` lists
  the pieces new to the catalog and the rows that state no longer has, only names, to decide what to measure.
  One piece is no key of the state: **`@actors`** (`ACTORS_PIECE`, `src/shared/state.ts`), a row of the slow reading
  that `state-slice.js` fills by property reads with the fields of the map's actors that the live-game trees need (the
  map it was read on, the helpers' fields, the map's first monster and the type of the player's target); the player's
  actor is found by the character's name, which never leaves that function.
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
  tab "unavailable", until the next slice. The mosaic has three parts, `attrs`, `vars` and `actors` (the `@actors`
  piece); a new read of `actors` also makes a calculation due, the only way a live-game number moves on.
- **Two workers** ([ADR 0008](docs/adr/0008-a-second-worker-records-formula-trees.md)). The **Stats worker** above keeps
  its one context and its budget; it applies no `actors` (`engine.ts` runs `__calc.ignoreActors()` at start), so the
  Stats never read the live game's actors. The **tree worker** (`tree-host.ts`, contract in
  [tree-worker.md](specs/008-formula-trees/contracts/tree-worker.md)) is a second instance of the same `calculator.js`,
  started with `mode: "tree"`, with a 2 GB heap (`maxOldGenerationSizeMb`), 120 s to start and 30 s for a request. The
  host reads the game's files again, because the Stats worker took its bytes. Inside, `instrument.ts` rewrites the
  installed `N.js` in memory with a parser (acorn), only adding calls to `__X`; the **recorder** (`recorder.js`,
  `recorder-pass.js`, loaded as text before the game's code) records nothing until a request turns it on, and then
  writes one **recording** per `number` request (calls, reads, writes, steps, helpers), only as JSON text, with a
  character's name turned into its index. Beside the root, the recording also calls the Meritocracy bonus multiplier
  (`tree-recipe.ts` `EXTRA_ROOTS`) and, after the roots, the max level of each Legend Talent the roots called
  (`FOLLOW_CALLS`), so that a system the game skips while its value is 0 still opens (spec 009, FR-018); they only read,
  and the tree's root stays the first call. A declared root (spec 010) may also run a routine of the game after the
  roots (`__rec.routine`, in `recorder-pass.js`: a block, or an event of a helper actor), once, on the recorder's copy
  only; what it writes there never reaches the save nor the running game. The answer key's recording (spec 010,
  `bootRecorder`'s `infinite` option, the real-trees probe only) keeps two things the live tree never gets: an infinite
  number crosses as `null` and comes back at its place (`__rec.infAt()`, in `recorder-pass.js`), and a call that
  returns a list or a map of the state keeps its path (the node's `vp`); the live tree keeps `null` and no `vp`. Each
  recording carries the time of its stages (`ms`), also on the error when a stage runs out of time.
  `tree-build.ts` and `tree/` build the root
  and its first level from it, over the same recording. A row's level is built when its parent's level is placed, to decide the row's name and its one
  child, and is kept by the row's id; `expand` places that stored level. So building the root also builds the level of
  each first-level row. A row's name comes from the names table; a name read from one of the installed game's tables
  comes through `names-reader.js` (a prelude run inside the context, which gives the cells and tables only as JSON
  text), and `game-names.ts` hashes each table and keeps a recipe's name only when the table's sha256 is the bench's.
  `values` recalculates only the numbers in view, with the recorder off, and the parts of the open tree by their call
  (a part's piece key), for the live tree; `shape` lists every part of a tree for Where this goes. The worker lives until the game closes or new
  game files arrive; a failure or a time limit makes that one request "unavailable", the next one starts another worker,
  and the Stats worker is never touched. A request always uses the Stats' own pair of mosaic and result, so the root is
  checked against the number on screen; when they differ, the tree is `diverged`. Every tree is checked by the main
  (`tree-check.ts`: the fields and their types, a ceiling of nodes, only atoms in the texts) before it reaches the
  window.
- **Inactive rebuild** (`inactive.ts`). The tree of another character: over the mosaic, before the context loads it, as
  the game does when it switches characters (the active one written back, then the game's own swap loads the other),
  and, inside the context, the caches the game rebuilds when that character's scene loads. The active character keeps
  the running game's caches. A list of an unexpected shape stops the calculation, and its error names the list, never a
  character. The window asks it through the **character picker** of the side panel (`formula:characters` gives the
  names, the classes and the active one's place; the names only reach the screen).
- **Catalog of trees** (`src/shared/number-catalog.json`, read by `tree-catalog.ts`): the 716 numbers that have a tree,
  in the game's order, identifiers only; the main accepts a request only for one of them. The game's call under each
  root lives in the calculator alone (`tree-roots.ts`, `root-calls.json`), pinned to the catalog by a test.
- **Around the trees** (`src/main/`): `live-values.ts` keeps the values in view (open tree, panels, pins) live over each
  new mosaic; `feeds-index.ts` fills, in the background and one tree at a time, which numbers use each piece (Where this
  goes), from the shapes in `tree-shapes.json`; `radar.ts` compares each tree's shape with the last game version's after
  a patch (the patch radar); `version-band.ts` says when the names were checked on another game version; `farm.ts`
  measures XP, gold and items per hour from the differences between slices, in memory only; `characters.ts` gives the
  picker its list; `side-panel.ts` widens the window for the side panel; `zoom.ts` handles the text zoom keys.
- **The mould by system** ([specs/009-system-mould/](specs/009-system-mould/spec.md), contracts in
  [contracts/](specs/009-system-mould/contracts/tree-node.md)). One more pass of the tree worker, after the assembly of
  008, that calls the game only through the recording's extra and follow-up calls above. The first level of a tree is the game's own **pools**, read from the root's chain of
  steps in the order of the sum (`tree/pools.ts`, with `tree/chain-context.ts` for the working values a call writes and
  reads back): sums in a row are an **Additive pool**, loose multipliers in a row are one **Multi pool**, a multiplier
  that sums bonuses inside, `1 + (a + b) ÷ 100`, is a Multi pool of its own, and a factor that is a plain sum of two
  sources or more is an Additive pool ("Multi pool 1", "Multi pool 2" when there is more than one of a kind). Inside a pool, and inside any row whose
  parts it splits, the sources are grouped **by system** (`tree/groups.ts`): `tree/systems.ts` turns the block a
  source calls, or the writer of the cache it reads, into a system with its proof, in the V1 order of the bench with its
  emoji, taken from the table of systems in `blueprints/systems.json` (read by `declared/systems.ts`, spec 010), and a
  source with no rule goes to "🔹 Other", never by a guess. A pool and a group are rows of
  `role` `pool` and `system`, with no piece key and a `combine` (`sum`, `product`, `onePlusPercent`, `max`, `min`, or
  `percent` for the bonuses in % the game sums and divides by 100, `tree/percent.ts`); `tree-check.ts` accepts only
  these values. A golden food computed as a chain opens like a root, with its pools (`tree/gold-food-chain.ts`). At any
  level, a step of the sum with no code of the game and no proven name is never a row (`tree/flatten.ts`): its parts
  move up, and the row above's ⓘ keeps the whole sum. Each source shows its **full build-up** (`tree/build-up*.ts`,
  FR-018): the level that enters the math is a row with the ⓘ of its sum, a curve is in the ⓘ with its constants named
  by their role, a branch check is no row, each multiplier is its own row, and every system that feeds a value is a row
  under it (a talent, a Legend Talent and its max, a bubble, a sigil, a capped card, the Prisma multi, a Meritocracy
  vote). The window lost the short answer of two lines, the "was" and
  the "Game changed · Refresh" band (`ChangeBadge.tsx` is gone): the **Changes** button (`ViewToggles.tsx`) shows a
  live arrow on each row against the tree as it was at the click ("live") or against a mark, with a group's value
  rebuilt from its rows by `combine` (`renderer/tree-changes.ts`), and the share is a button too. The open tree is
  live: each reading writes its values into it (`formula-answer.ts`), and when one moved the main asks the tree again
  in silence, one request at a time, never over a branch asked, and at most every 10 s since the last tree came
  (`REBUILD_EVERY_MS`), keeping what is open. Both buttons are saved through `view:get` and `view:set`, as `changes`
  and `share` in `settings.json`.

## Code folders

| Folder            | Runs in                                    | What it holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/start/`      | Electron's main process, first of all      | `index.ts` (the entry: loads only the role's bundle), `dispatch.ts` (`roleFor`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/keeper/`     | the keeper (Electron's main process)       | `index.ts` (entry), `keeper.ts` (the flow), `command-line.ts`, `launch.ts`, `cdp.ts`, `engine-ref.ts`, `reader.ts`, `readers.ts` (joins the two readers and their turn), `read-source.ts`, `read.js`, `game-tables.ts`, `update-watch.ts`, `link-server.ts`, `state-reader.ts`, `state-list.js`, `state-slice.js`, `vars-reader.ts`; `mock-game/` is a test fixture                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/main/`       | the app's main process                     | `index.ts` (entry: window, tray, link, IPC), `steam/`, `setup-store.ts`, `remove-from-steam.ts`, `updates.ts`, `forget-names.ts`, `context.ts`, `settings.ts`, `replace-file.ts` (a file written whole), `lifecycle.ts`, `link-client.ts`, `link-routes.ts`, `payloads.ts`, `window-options.ts`, `state-store.ts`, `game-files.ts`, `calculator-host.ts`, `stats.ts`, `stats-pipeline.ts`; the trees of spec 008: `pipelines.ts` (the Stats and the trees joined, and the window's formula channels), `formula-pipeline.ts` (with its contract in `formula-pipeline-api.ts`), `formula-answer.ts` (what an answer becomes, the live values written into it, the silent rebuild's clock), `tree-walk.ts`, `tree-host.ts` (the tree worker), `tree-check.ts`, `live-values.ts`, `feeds-index.ts`, `radar.ts`, `version-band.ts`, `characters.ts`, `saved-files.ts` (marks, pins and shapes), `saved-handlers.ts` (their channels), `character-names.ts`, `farm.ts`, `side-panel.ts`, `zoom.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/preload/`    | the window's preload (sandboxed, CommonJS) | `index.ts`: exposes `window.companion`; `api.ts`: the `CompanionApi` over the fixed channels; `channel.ts`: one main → window channel, with or without replay                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/renderer/`   | the window (sandboxed, no Node)            | `App.tsx`, `SetupView.tsx`, `StatusBar.tsx`, `SettingsView.tsx`, `ScreenMapPanel.tsx`, `StatsPanel.tsx`, `modules/screen-map.ts`, `styles.css`; the trees: `FormulasTab.tsx`, `SystemPanel.tsx` and `modules/system-panels.ts` (the system panels), `SidePanel.tsx`, `FormulaTree.tsx` (the treeview), `tree-items.tsx` (its rows), `tree-keys.ts` (its keys), `AnswerHeader.tsx`, `LeafTag.tsx`, `TruthTag.tsx`, `ViewToggles.tsx` and `tree-changes.ts` (Changes and Share, the arrows), `VersionBand.tsx`, `GameDetails.tsx`, `FeedsBadge.tsx`, `CharacterPicker.tsx`, `MarkBar.tsx`, `PinStrip.tsx`, `FarmStrip.tsx`, `PatchBand.tsx`, `tree-parts.ts`, `tree-text.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/calculator/` | two workers of the app's main process      | `index.ts` (the worker's entry, Stats or tree mode), `boot.ts`, `engine.ts` (the Stats), `context.js` (what runs inside the `node:vm` context), `targets.ts` (the 11 number ids, 10 lines on the tab); the trees: `tree-engine.ts`, `tree-record.ts`, `game-names.ts` and `names-reader.js` (the names read from the game's tables), `instrument.ts`, `recorder.js`, `recorder-pass.js`, `recording.ts`, `tree-recipe.ts`, `tree-roots.ts` and `root-calls.json`, `tree-build.ts`, `tree/` (the assembly; the mould of spec 009: `mould.ts`, `groups.ts` (the groups by system), `pools.ts`, `chain-context.ts`, `tops.ts` (a round or a clamp at the top of a step), `systems.ts`, `percent.ts`, `flatten.ts`, `scaled-names.ts` (a scaled source keeps its name), `search-names.ts` ("Found <item>"), `gold-food-chain.ts`; the full build-up: `build-up.ts`, `build-up-rows.ts`, `build-up-talents.ts`, `build-up-curves.ts`, `build-up-vote.ts`, `build-up-cards.ts`; the scratch boxes, each read named by its write: `scratch-names.ts`), `tree-contract.ts` (its copy of the tree contract), `inactive.ts`, `parity-compare.ts`, `parity-sources.ts` and `parity-values.ts` (for `parity.integration.test.ts`, run by `just test-one`); the parts that outlive the guessed shape (spec 010): `recorded/` (`ast.ts`, `math.ts`, `steps.ts`: the steps of a recording and a formula line's arithmetic), `names/` (a row's name: `names.ts`, `names-table.ts`, `table-names.ts`, `renames.ts`, `rename-list.ts`, `state-names.ts`, `state-words.ts`, `merit-names.ts`, `killroy-names.ts`, `name-text.ts` and their JSON), `declared/systems.ts` and `blueprints/systems.json` (the table of systems, by id, with name, emoji and proof); the declared engine (spec 010), not yet wired to the tree worker: `declared/` (`refs.ts`: a reference's key, `{character}` and `*`, the piece key and the node id; `blueprint.ts` and `blueprint-root.ts`: the blueprint's check on load (the root's shapes and the checks of a reference in `blueprint-root.ts`); `blueprint-types.ts`: the blueprint's types; `blueprints.ts`: every blueprint through `import.meta.glob`, only a complete one served; `expr-eval.ts`: a recorded expression evaluated without `eval`; `answer-key.ts`, `answer-key-terms.ts` and `answer-key-pool.ts`: the pools and terms a recording gives (a passage the root wrote and read back opened by the place of its write), an out-of-rule root refused; `answer-key-expression.ts`: a root with no running total, split into stretches, or a leaf; `answer-key-chain.ts`: a running total, each write matched to its step, a Cap or a Floor written under a test; `answer-key-top.ts`: the top layer above the pools (a round, a gate, the condition with two paths outside the return, the general division, the Cap and the Floor with a limit from sources, and the curve); `answer-key-shapes.ts`: the sum of calls, the part as terms of a recorded pool, and the routine; `not-leaves.ts`: the parts that are no row; `review.ts`: the review file's hash, lock and verdict; `index.ts`: the declared engine's API (the review stays out); `real-trees-run.ts`: the real-trees run's helpers, for `real-trees.integration.test.ts`, which skips without the `TREES_*` variables; a root's `scratch` marker and its routine write only into the recorder's copy of the state) and `blueprints/<lot>/<id>.blueprint.json` (one per tree number: a sketch, a draft or a complete blueprint; the `<id>.review.json` beside it is never imported); `fixtures/` is an invented game for the tests |
| `src/shared/`     | everywhere                                 | the contracts: `types.ts`, `state.ts` (the pieces of the state, the classes and the numbers), `reading-catalog.md` (the table of the state's pieces), `reading-catalog.ts`, `reading-catalog-rules.ts`, `link.ts` (line codec), `reading.ts` (`toReading`), `modules.ts` (`modulesFor`), `formula-tree.ts` (the tree contract), `formula-tree-compare.ts`, `row-text.ts` (a row's value as written), `tree-catalog.ts` and `number-catalog.json` (the catalog of trees), `stats-text.ts`, `screens/` (the screen catalog: `identify.ts`, `catalog.ts`, `rules/*.json`); other folders import `src/shared/index.ts` only, except that the keeper and the app load the screen catalog from its own entry, `src/shared/screens/index.ts`, so the preload and the window do not carry its rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Pure logic (`roleFor`, `decide`, `modulesFor`, `channel`, the screen catalog, context, settings, payload checks, `windowOptions`,
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
| `{ "type": "tables", "tables" }`       | keeper → app | `GameTables`: map, monster, item and class names, `null` for a table not read     |
| `{ "type": "state", "slice" }`         | keeper → app | `StateSlice`: one slice of the state, never logged and never stored by the keeper |
| `{ "type": "gameFiles", "resources" }` | keeper → app | the `resources` folder of the game launched, once per launch                      |
| `{ "type": "confirm-attach" }`         | app → keeper | the user clicked "Connect next time"                                              |
| `{ "type": "release" }`                | app → keeper | "Let the game close"; ignored with no reader running                              |
| `{ "type": "reconnect" }`              | app → keeper | "Reconnect"; ignored unless `reader` is `"released"`                              |

A new client first gets the last tables, the last status, the last reading and the last `gameFiles`; slices are not resent, because the mosaic builds up again in one rotation. The keeper sends `tables` once per game
launch, and on each one the app builds the context again from the last reading. A second keeper finds the pipe taken and exits without
launching anything. The app tries the pipe again every 5 s while it is missing.

**IPC, main ↔ window** (spec §5.4), through the preload only:

| Channel                                     | Direction     | Content                                                                                                |
| ------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `context:update`                            | main → window | `GameContext`                                                                                          |
| `status:update`                             | main → window | `Status`                                                                                               |
| `settings:get` / `settings:set`             | window ↔ main | `Settings`                                                                                             |
| `view:get` / `view:set`                     | window ↔ main | `{ changes, share }`, the tree's two buttons; set answers `null`                                       |
| `reader:confirm-attach`                     | window → main | sent on to the keeper as `confirm-attach`                                                              |
| `reader:release`                            | window → main | sent on to the keeper as `release`                                                                     |
| `reader:reconnect`                          | window → main | sent on to the keeper as `reconnect`                                                                   |
| `steam:state`                               | window ↔ main | `SteamState`, read now; nothing changes                                                                |
| `steam:setup`                               | window ↔ main | sets up the most recent account; final `SetupProgress`                                                 |
| `steam:progress`                            | main → window | `SetupProgress`, each step of a setup                                                                  |
| `update:state`                              | main → window | `UpdateState`                                                                                          |
| `update:install`                            | window → main | installs a ready update; refused with the game open                                                    |
| `stats:update`                              | main → window | `Stats`: the Stats tab's state                                                                         |
| `formula:request`                           | window → main | `{ id, character? }` (a tree) or `{ treeId, nodeId }` (a branch); the id must be in the catalog        |
| `formula:update`                            | main → window | `FormulaTree`; `{ state: "none" }` on a character change or new game files                             |
| `formula:close`                             | window → main | lets go of the tree kept and its replay                                                                |
| `formula:values`                            | window → main | `{ ids }`: the numbers in view now                                                                     |
| `formula:liveValues`                        | main → window | `{ values, calculatedAt, stale }`                                                                      |
| `formula:characters`                        | main → window | `{ names, classes, active }` for the character picker; the names only on screen                        |
| `panel:update`                              | main → window | `{ system }`: the system whose screen is open, for the switch of panel                                 |
| `marks:list` / `marks:save` / `marks:clear` | window ↔ main | by character number: `{ marks, warning }`; save and clear answer `null` or the sentence for the player |
| `pins:get` / `pins:set`                     | window ↔ main | `{ pins, warning }`; set answers `null` or the sentence                                                |
| `feeds:list`                                | window ↔ main | `{ pieceKey }` → the catalog ids that piece feeds (Where this goes)                                    |
| `farm:update`                               | main → window | `{ state, minutes, xpPerHour, goldPerHour, items }`, the active character only                         |
| `radar:update`                              | main → window | `{ changed, checking, warning }` or `null`: the patch radar's band                                     |
| `radar:dismiss`                             | window → main | closes the band until the next patch                                                                   |
| `window:sidePanel`                          | window → main | `{ open }`: widens the window, toward the side with room, or gives it back                             |
| `module:<id>:*`                             | both          | reserved for modules by spec 001, still unused                                                         |

The contract of the channels of spec 008 is [contracts/ipc.md](specs/008-formula-trees/contracts/ipc.md); each request
of the window is checked in `src/main/payloads.ts` before it reaches a worker. The preload (`src/preload/channel.ts`)
keeps the last value of every main → window channel but one (`context:update`, `status:update`, `update:state`,
`stats:update`, `formula:update`, `formula:liveValues`, `formula:characters`, `panel:update`, `farm:update`,
`radar:update`) and replays it to a late subscriber. `steam:progress` does not repeat its last value: a step goes only to
whoever listens at that moment, so a late screen never sees an old "done".

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

| Rule                                 | Forbids                                                                                                                                                  | Why                                                                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keeper-and-shared-without-electron` | `src/keeper/` and `src/shared/` importing `electron`                                                                                                     | the keeper stays plain Node code inside Electron's main process (ADR 0003), and shared code runs everywhere                                                       |
| `start-only-dispatches`              | `src/start/` importing any `src/` file but the entries                                                                                                   | the entry only picks the role: the keeper's, the app's or the uninstaller mode's entry                                                                            |
| `keeper-alone`                       | `src/keeper/` importing `src/main`, `preload` or `renderer`                                                                                              | the keeper holds the game's pipe and must not depend on the app                                                                                                   |
| `main-not-keeper-or-renderer`        | `src/main/` importing `src/keeper` or `renderer`                                                                                                         | the main process reaches the keeper over the link and the window over IPC, never by import                                                                        |
| `preload-alone`                      | `src/preload/` importing `src/main`, `keeper` or `renderer`                                                                                              | the preload is the window's thin bridge                                                                                                                           |
| `renderer-without-node`              | `src/renderer/` importing `src/main`, `keeper` or `preload`                                                                                              | the window reaches the main process only through `window.companion`                                                                                               |
| `renderer-without-node-core`         | `src/renderer/` importing Node core modules                                                                                                              | the window is sandboxed, without Node. Exception, accepted on 07/11: `*.test.ts(x)` files, which run in Node and may read files (the CSP test reads `index.html`) |
| `shared-alone`                       | `src/shared/` importing any of the four process folders                                                                                                  | shared code is the common contract and depends on none of them                                                                                                    |
| `calculator-alone`                   | `src/calculator/` importing any other `src/` folder, tests excepted                                                                                      | its bundle stays one file, and it reaches nothing of the app                                                                                                      |
| `nothing-imports-the-calculator`     | `src/main`, `keeper`, `preload` or `renderer` importing `src/calculator/`                                                                                | the game's code only runs inside the worker (ADR 0006)                                                                                                            |
| `vm-only-in-the-calculator`          | any `src/` file but `src/calculator/` and tests using `node:vm`                                                                                          | elsewhere the game's files stay text                                                                                                                              |
| `declared-not-guessed`               | `src/calculator/declared/`, `recorded/` and `names/` importing `tree/`, `tree-build.ts`, `tree-roots.ts`, `root-calls.json` or `parity*`, tests included | the declared engine never grows on the guessed shape, and what outlives feature 010 never depends on what leaves (spec 010, research R17)                         |

The tree worker added no rule: it is the same `calculator.js`, so `calculator-alone` and
`nothing-imports-the-calculator` hold it too. The calculator keeps its own copy of the tree contract
(`tree-contract.ts`), pinned both ways to `src/shared/formula-tree.ts` by a test, and the game's call under each root
stays in the calculator; acorn, the parser of the in-memory copy, is imported only by `instrument.ts`.

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
- **Only atoms leave the tree worker** (`src/main/tree-check.ts`). The recording and the instrumented copy never leave
  the worker, and the copy never touches the disk. A tree out of shape, over the ceiling of nodes or with a text that
  looks like code is `unavailable`, and the case goes to the log with a label and a catalog id only, never a value or a
  name. A character's name reaches only the screen (the picker); everywhere else, in a path, a piece key, a saved file
  or a Copy, a character is its number. `src/main/no-game-text.test.ts` fails when a file of `src/` or of the spec's
  folder holds a game table, a long line of the game's minified code or a proof that quotes the game.
- **Navigation lockdown** (`src/main/window-options.ts`, `src/main/index.ts`): `sandbox`, `contextIsolation`, no
  `nodeIntegration`; `setWindowOpenHandler` denies every new window, and `will-navigate` is prevented for any URL but the
  window's own page (`isAllowedNavigation`). The page has the CSP `default-src 'self'`, so the UI has no inline styles.
- **IPC sender check** (`guardIpc` in `src/main/window-options.ts`): every `ipcMain.handle` refuses a call whose sender
  frame is not the window's own page, or that has none.
- **Shape checks on every message** (`src/main/payloads.ts`, `src/shared/link.ts`, `src/shared/reading.ts`): the line
  decoder skips junk lines and checks the message type; the main process checks a link `reading` (`toReading`),
  `status` and `tables` (`linkTables`: a table out of shape counts as not read), a `state` slice (`linkState`) and a
  `gameFiles` folder (`linkGameFiles`) before use, and each IPC payload
  (`settings:set`: the three booleans; `view:set`: `changes` and `share`, two booleans and no other key; the 008 requests that carry a body (catalog id, character number, ids, piece key, mark
  name, pins, `{ open }`), see [contracts/ipc.md](specs/008-formula-trees/contracts/ipc.md); the other window → main
  channels take no body); a payload of the wrong shape is
  refused.
- **The updater is the only network access** (see [Updates](#updates)): the link is a local named pipe, the debugging
  channel is a pipe, and the window's CSP allows only its own files. `src/main/no-network.test.ts` scans the source for
  anything else.
- **Steam is changed only on a click and with Steam closed**, never killed, and never with the game open (see
  [Steam](#steam)). The account's name is read on request and never saved.

## User data

`%APPDATA%\IdleOn Companion\`, never in the repository:

| File                                | Written by | Content                                                                                                                                                                           |
| ----------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.json`                     | app        | `Settings`, the window's zoom (main process only, outside `Settings`) and the tree's `changes` and `share`; invalid or missing → defaults                                         |
| `marks.json`                        | app        | by character number: up to 3 marks, each a name of up to 40 characters, its time and only the values by piece key                                                                 |
| `pins.json`                         | app        | up to 5 pinned numbers (`treeId`, `nodeId`), no values                                                                                                                            |
| `tree-shapes.json`                  | app        | the game's sha256 and each tree's parts (piece key without the character, name); while a patch is open, also the old trees not compared yet, the changes and how many were closed |
| `steam-setup.json`                  | app        | per account (numeric id only, never a name): the text added, the option before, the copy's path and the time; written through `.tmp`, `.bad` for an invalid file                  |
| `steam-backup\<id>-localconfig.vdf` | app        | the account's `localconfig.vdf` from before the companion's first write; never overwritten                                                                                        |
| `game-hash.json`                    | keeper     | the hash of the last game code checked clean (recorded after the check), or confirmed                                                                                             |
| `keeper.log`                        | keeper     | one JSON line per entry (`t`, `label`, `id` = the game pid, null before the launch), the pause time included                                                                      |
| `game.log`                          | keeper     | the game's own output                                                                                                                                                             |

Three labels of `keeper.log` come from the scan of the game code: `unknown-screen-numbers` (`numbers`: the `MenuType2`
numbers outside `KNOWN_WINDOWS`), `game-tables-unreadable` (`unreadable`: the names of the tables not read) and
`game-scan-failed` (`error`). The player sees none of them, and they carry only numbers, the names of the tables and text
of the error: no text of the game's file and no player name.

The three files of spec 008 ([contracts/saved-files.md](specs/008-formula-trees/contracts/saved-files.md),
`src/main/saved-files.ts`) are read and checked once and written whole through `.tmp` and a rename, as `settings.json`
(`src/main/replace-file.ts`: a rename Windows refuses is tried again, then the file is written directly). A file that cannot
be read (invalid JSON, an unknown `version` or a wrong shape) is renamed `<name>.bad`, the item starts empty and the
window says so once; values over the limits are dropped without a word; a failed write is a warning, and the app goes
on. None of them holds a character's name: a mark's name with one is refused.

The screen catalog ships in the code (`src/shared/screens/`), and the only text the player types that is saved is a
mark's name. On every start the
app deletes the files where earlier versions kept the names the player typed (`src/main/forget-names.ts`); a file it
cannot delete stops nothing, and the next start tries again.
