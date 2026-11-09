# Tasks: Base de dados (data-base)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/), [quickstart.md](quickstart.md), [prototipo/](prototipo/README.md)

**Prerequisite**: the constitution amendment ("never call a game function" applies to the running game; the offline copy, in an isolated process, is allowed) is on `main`, from its own branch and PR, before Phase 1. It is not a task of this list.

**Tests**: Tests are mandatory. Every phase writes its tests first, next to the code in `src/`, and sees them fail before
the implementation exists. `just check` passes at the end of every phase.

**Organization**: the shared contract first, then the reading in the game (US1), the `_vars` (US2), the mosaic (US1), the
calculator (US1, US3), its host (US3) and only then the tab (US4), which is the first change the player sees.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[USn]**: the user story of spec.md the task serves

## Rules for every phase

- Inside the running game only property reads run: no game function call, no getter, no write, no click, nothing left in
  the page between reads (FR-002, FR-003).
- The game's code runs only in `src/calculator/`. Everywhere else it stays text: no `eval`, `new Function` or `node:vm` on
  it (FR-008, FR-009).
- No excerpt of the game's file in the repository, and no player name. Every "game code" in a test is made up, and every
  number and character name in a test is invented (FR-013, FR-021).
- No network anywhere but `src/main/updates.ts`. Tests never need the game, Steam or the files of `lab\` and `research\`.
- The state copy lives only in memory: never on disk, never in `keeper.log` (FR-007). `keeper.ts` publishes slices without
  passing them to `log`.
- Do not touch Steam or any game process.
- Identifiers and UI copy in English; code files up to 400 lines (`src/keeper/keeper.test.ts`, 463 lines, does not grow);
  other folders import shared code from `src/shared/index.ts`; `.ts` relative imports keep their extension.
- `src/calculator/` imports only Node built-ins and its own files, so its bundle stays one file (T029).
- The Executor edits only `tasks.md` inside the spec folder. A hook that blocks is never worked around.
- The only existing test that changes in behavior is `src/main/no-network.test.ts`, in T029, and the task says exactly how.

---

## Phase 1: Foundational — the shared contract

**Goal**: the pieces, the two link messages and their checks exist; nothing uses them yet.

**Independent Test**: `linkState` refuses every malformed slice and `classOf` puts each kind of piece in its class.

### Tests for Phase 1

- [X] T001 [P] Pieces and classes tests in src/shared/state.test.ts
  - Files: `src/shared/state.test.ts`
  - Cases: `classOf(["Cards"], "A")` is `formula`; `classOf(["ChestMap"], "A")` is `other`; `["PlayerDATABASE","A"]` is
    `formula` and `["PlayerDATABASE","B"]` is `other`, with character `"A"`; `["DNSM","CompanionBon"]` and
    `["DNSM","ShinyBonusS"]` are `formula`, another `DNSM` child is `other`; `["_vars"]` is `formula`; no key of
    `STATE_EXCLUDED` is in `FORMULA_KEYS`; `VARS_KEYS` has 27 distinct names.
- [X] T002 [P] Link message tests in src/shared/link.test.ts
  - Files: `src/shared/link.test.ts`
  - Cases: a `state` line with an object `slice` and a `gameFiles` line with a string `resources` reach `onMessage`; a
    `state` without `slice`, or a `gameFiles` with a number, are dropped without throwing.
- [X] T003 [P] Slice and files checks in src/main/payloads.test.ts
  - Files: `src/main/payloads.test.ts`
  - Cases of `linkState`: a good slice passes; `sentinel.char` accepts a string or `null`; `sentinel.map` not a number,
    `at` not a number, `pieces` not an array, a `path` of 0 or 3 items, a `path` item not a string or `cycles` with a
    non-number give `null`. Cases of `linkGameFiles`: an absolute path whose last folder is `resources` (any case) passes;
    empty, relative or ending in another folder gives `null`.

### Implementation for Phase 1

- [X] T004 Pieces, classes and types in src/shared/state.ts
  - Files: `src/shared/state.ts`, `src/shared/index.ts`
  - Signatures: `StatePath = [string] | [string, string]`; `StateClass = "formula" | "other"`;
    `StateSlice = { sentinel: { char: string | null; map: number }; pieces: { path: StatePath; value: unknown }[]; at: number; cycles: { formula: number; all: number } }`;
    `classOf(path: StatePath, char: string | null): StateClass`; `STATE_EXCLUDED`, `STATE_SPLIT = ["PlayerDATABASE", "DNSM"]`,
    `VARS_KEYS`, `FORMULA_KEYS: ReadonlySet<string>`; `NUMBER_IDS = ["damageMax","damageMin","hp","mp","accuracy","str","agi","wis","luk","dropRate","afkGains"]`;
    `CalcNumbers = Record<(typeof NUMBER_IDS)[number], number | null>`.
  - `STATE_EXCLUDED`: `CustomLists`, `ItemDefinitionsGET`, `MonsterDefinitionsGET`, `DialogueDefGET`, `PixelHelperActor`,
    `CustomMaps`.
  - `VARS_KEYS`: `voteCategories`, `voteCat2`, `votePercent`, `votePercent2`, `TomePct`, `TomeOn`, `ArcGballPCT`,
    `ArcadeRotation`, `ArcadeBonuses`, `AncientArtiPCT`, `AncientOddPerIsland`, `HappyHours`, `A_friendBons`, `A_ResXP`,
    `GuildRank`, `ChipRepo`, `Dungeon_CardMulti`, `Dungeon_CredMulti`, `Dungeon_FlurboMulti`, `GamingFertCostExpA`,
    `DivCostAfter3`, `DustCost`, `A_MineCost`, `A_MineHP`, `A_divArc`, `KillroySwap`, `EventActive`.
  - `FORMULA_KEYS` (research R2; only a priority, no key is left out):
    `AFKtarget AchieveReg AnvilCraftStatus AnvilPAstats ArcadeUpg Arcane Atoms BGunlocked Boats Breeding BribeStatus Bubba BuffsActive BundlesReceived Captains Cards CauldronBubbles CauldronInfo CauldronJobs CauldronP2W CharacterClass Chat ChestOrder ChestQuantity CogOrder Compass CookMaster Cooking CurrenciesOwned CurrentMap Divinity DoOnceREAL Dream DummyList DummyList2 DummyList3 DummyMap DummyNumber DummyNumber2 DummyNumber3 DummyNumber4 DummyNumber5 DummyNumbersStatManager DummyPixelType DummyText DummyText2 DummyText3 DungItems DungUpg EquipmentMap EquipmentOrder EquipmentQuantity Exp0 ExpReq0 FamilyValuesMap FarmCrop FarmPlot FarmRank FarmUpg FoodSlotsOwned Gaming GamingSprout GemItemsPurchased GetPlayersUsernames GreenStacks Grimoire GuildTasks HintStatus Holes InventoryOrder InventorySlotsOwned ItemMap KRbest KillsLeft2Advance Lab Lv0 MapBon MapMonstersList Meals Menagerie MenuType MenuType2 Money MonsterAlive MonsterHP MonsterWillDie MonstersOnScreen NONdummies Ninja NodeLength NodeNeighbors NodeX NodeY Number2Letter OptionsList OptionsListAccount OtherPlayers PersonalValuesMap Pets PetsStored PlayerHP PlayerMP PlayerMoveMaps PlayerStuff PopupType PostOfficeInfo PrayersActive PrayersUnlocked Printer QuestComplete Refinery Research Ribbon Rift RoyalG RoyalMaps SailChests Sailing SaltLick SceneEvents_n ServerGemsReceived ShrineInfo SkillLevels Spelunk StampLevel StampLevelMAX StatueG StatueLevels SteamAchieve Summon Sushi Tasks Territory Tess TimeAway TotemInfo TowerInfo UpgVault UserInfo WeeklyBoss dummyActor dummyCritDmgMulti dummyDamageDealt dummyDisplayEXPTYPE dummyDisplayPopup dummyMonsterID dummyMonsterNODE dummyMonsterTYPE`
- [X] T005 The two messages in src/shared/link.ts
  - Files: `src/shared/link.ts`
  - Change: `LinkMessage` gains `{ type: "state"; slice: StateSlice }` and `{ type: "gameFiles"; resources: string }`;
    `toMessage` passes them when `slice` is an object and `resources` a string.
- [X] T006 linkState and linkGameFiles in src/main/payloads.ts
  - Files: `src/main/payloads.ts`
  - Signatures: `linkState(v: unknown): StateSlice | null`; `linkGameFiles(v: unknown): string | null`. `value` is not
    inspected: it is only data for the calculator.

**Verify**: `just test-one src/shared/state.test.ts` and `just test-one src/main/payloads.test.ts` — all pass; `just check`
passes.

---

## Phase 2: User Story 1, part 1 — the slices in the game (Priority: P1) 🎯 MVP

**Goal**: the keeper can read the state in slices of up to 25 KB, one every 250 ms, never two in flight, property reads only.

**Independent Test**: against a fake engine where every function and getter is a trap, the slices cover every piece, and a
fake CDP sees one call at a time.

### Tests for Phase 2

- [X] T007 [P] [US1] Read-only proof of the slice in src/keeper/state-read-only.test.ts
  - Files: `src/keeper/state-read-only.test.ts` (own file, the model is `src/keeper/read-only.test.ts`)
  - Fake engine: a `gameAttributes.h` with arrays, plain objects and Haxe maps (`{ h: {...} }` whose prototype has `__class__`),
    where every function counts and throws, and where some properties are accessors that count and throw: a game object's
    property, a map's `h`, `__class__`, a `toJSON`, a `Symbol.toStringTag`.
  - Cases of `state-list.js` and `state-slice.js`, loaded with `loadReadSource`: no trap fires; no key was added to the global
    or to the engine; `state-list.js` returns `char` (`UserInfo[0]`, `null` when absent), `map` (`CurrentMap`), the top keys
    without `STATE_EXCLUDED` and without `STATE_SPLIT`, and the children of each split map; `state-slice.js` copies
    numbers, text, booleans, `null`, lists and plain objects; a map becomes `{ $m, $c }`; `Infinity` becomes `{ $n }`; a `String`
    object becomes text; a class instance, a cycle and a depth over 14 become `{ $x: 1 }`; `undefined` becomes `null`; a
    missing path gives `null` in its place and no error; a two-item path reads the child of the map.
- [X] T008 [P] [US1] Plan and rotation tests in src/keeper/state-reader.test.ts
  - Files: `src/keeper/state-reader.test.ts`, with a fake `send`, fake timers and invented keys
  - Cases of `pack`: pieces are grouped up to 25,000 bytes; a piece larger than the limit goes alone. Of `pieceBytes`: an
    unread `PlayerDATABASE` child counts 25,000 and any other unread piece 2,000, so the first cycle never groups the big ones;
    after a read the piece counts its measured `JSON.stringify` length.
  - Cases of the loop: one read every 250 ms; three `formula` slices then one `other`, repeating; with one class empty the
    other takes its turn; a second read never starts while one is in flight, counting the 1 s reader through the same
    `turn`; a round trip longer than 250 ms skips the next slot; `char: null` in the list produces no slice read and no
    slice; each slice carries the sentinel the game answered and `at`; a whole formula rotation raises `cycles.formula`,
    a whole rotation of both raises `cycles.all`; a change of map zeroes `cycles.formula` and keeps `cycles.all`; a change of
    character zeroes both and lists again; the keys are listed again at the start of each whole rotation; an engine of `null`
    reads nothing; a read that rejects or throws is skipped and the next slot goes on, and only the tenth in a row calls
    `onFailing`, once, with no argument; `stop()` during a read resolves after it and starts no other.
- [X] T009 [P] [US1] Engine hooks of the reader in src/keeper/reader-hooks.test.ts
  - Files: `src/keeper/reader-hooks.test.ts`, with a fake CDP as in `src/keeper/reader-stop.test.ts`
  - Cases: `onEngine` gets the reference when it is taken and `null` when it is lost and when the reader stops; each poll
    runs inside `turn` when one is given; without `turn` it behaves as before.

### Implementation for Phase 2

- [X] T010 [US1] The two read-only scripts in src/keeper/state-list.js and src/keeper/state-slice.js
  - Files: `src/keeper/state-list.js`, `src/keeper/state-slice.js`
  - Reference: `specs/004-data-base/prototipo/listar.js` and `fatia.js`, without the time and node counters. Answer of
    `state-slice.js`, which takes the paths as its one argument: `{ char, map, out }`.
  - Change from the prototype: a `String` object is recognized by `Object.getPrototypeOf(v) === String.prototype`, never with
    `Object.prototype.toString`, which reads `Symbol.toStringTag`; `__class__` and `__name__` come from
    `Object.getOwnPropertyDescriptor`. Array items are read by index, as measured: no game code defines accessors on them.
    Functions of the language allowed: those of [contracts/state-reading.md](contracts/state-reading.md), plus
    `String.prototype.valueOf`.
- [X] T011 [US1] The rotation in src/keeper/state-reader.ts
  - Files: `src/keeper/state-reader.ts`
  - Signatures: `pack(pieces: PlanPiece[], maxBytes: number): PlanPiece[][]`; `pieceBytes(p: PlanPiece): number`;
    `oneAtATime(): <T>(f: () => Promise<T>) => Promise<T>`;
    `startStateReader(deps: { send: Cdp["send"]; engine: () => EngineRef | null; listSource: string; sliceSource: string; turn: ReturnType<typeof oneAtATime>; onSlice: (s: StateSlice) => void; onFailing: () => void; vars?: VarsReader; everyMs?: number }): { stop(): Promise<void> }`.
  - `Runtime.callFunctionOn` with `returnByValue: true` and `arguments: [{ value: paths }]`. `everyMs` defaults to 250. Constraint from
    data-model.md: "até 25 KB, salvo uma peça maior, que vai sozinha".
- [X] T012 [US1] Hooks in src/keeper/reader.ts
  - Files: `src/keeper/reader.ts`
  - Change: `opts` gains `onEngine?: (ref: EngineRef | null) => void` and `turn?: <T>(f: () => Promise<T>) => Promise<T>`; the
    `Runtime.callFunctionOn` of each poll runs inside `turn`. No other behavior changes.

**Verify**: `just test-one src/keeper/state-read-only.test.ts`, `just test-one src/keeper/state-reader.test.ts` and
`just test-one src/keeper/reader-hooks.test.ts` — all pass; `just check` passes.

---

## Phase 3: User Story 2 — the `_vars` of the closed list (Priority: P2)

**Goal**: at each formula rotation the `_vars` of the closed list go in a slice, and nothing else leaves the function that filters.

**Independent Test**: a fake token next to the keys appears in no slice and no log.

### Tests for Phase 3

- [ ] T013 [P] [US2] Tests of the search in src/keeper/vars-reader.test.ts
  - Files: `src/keeper/vars-reader.test.ts`, with a fake `send` that answers `Runtime.getProperties` from an invented tree
  - Cases: the holder is found at depth up to 5 from `[[Scopes]]`, when at least 3 list keys are on one object; global scopes are
    skipped; the search stops at 3000 objects and gives `null`, and does not search again for the same engine; a new engine
    searches again; primitives and objects of the list come back with their values; a key outside the list, with a
    `FAKE-LOGIN-TOKEN` value and on the same object as the list keys, is never in the result, and the JSON of every call made
    and of the result has neither the value nor its property name; the next read uses only the holder, with no new search;
    a rejected read of the holder drops it, gives `null` and the next engine searches again; the holder is held in the
    `objectGroup` of the reader, released by `release()`; no `Runtime.callFunctionOn` declaration calls anything but a
    property read.
- [ ] T014 [P] [US2] Vars in the rotation, in src/keeper/state-reader-vars.test.ts
  - Files: `src/keeper/state-reader-vars.test.ts`
  - Cases: each new formula rotation emits one slice with the one piece `{ path: ["_vars"], value }`, counted among the
    formula slots; a `null` from the reader emits `value: {}`; `stop()` releases the holder.

### Implementation for Phase 3

- [ ] T015 [US2] The search and the read in src/keeper/vars-reader.ts
  - Files: `src/keeper/vars-reader.ts`
  - Signature: `createVarsReader(send: Cdp["send"]): VarsReader`, with `VarsReader = { read(ref: EngineRef): Promise<Record<string, unknown> | null>; release(ref: EngineRef | null): Promise<void> }`.
  - Reference, outside the repository: `varsMemoria` in `C:\Users\Vinicius\idleon-companion\lab\sessao.cjs`, and research R10. To find the
    function whose scopes are read, `Runtime.callFunctionOn` with `function () { return window.React.createElement; }`,
    `returnByValue: false` and its own `objectGroup`: it reads a property and calls nothing. Filter by `VARS_KEYS` in the one
    place the names are looked at; nothing else is kept, returned or logged.
- [ ] T016 [US2] Vars in src/keeper/state-reader.ts
  - Files: `src/keeper/state-reader.ts`
  - Change: at the start of each formula rotation, `vars.read(ref)` inside `turn`, and its slice; `stop()` calls `vars.release`.

**Verify**: `just test-one src/keeper/vars-reader.test.ts` and `just test-one src/keeper/state-reader-vars.test.ts` — all
pass; `just check` passes.

---

## Phase 4: User Story 1, part 2 — the link and the mosaic

**Goal**: the keeper publishes slices and the game's folder, and the app assembles the mosaic in memory.

**Independent Test**: invented slices become one mosaic, a new character wipes it, and no slice reaches `keeper.log`.

### Tests for Phase 4

- [ ] T017 [P] [US1] Keeper publication in src/keeper/keeper-state.test.ts
  - Files: `src/keeper/keeper-state.test.ts` (harness as in `src/keeper/keeper-scan.test.ts`)
  - Cases: each slice given to the `read` callback is published as `state`; the JSON of every `log` call has no value of the slice
    (use `FAKE-STATE-VALUE`) and the name `state` is no label; `gameFiles` goes once after a launch with `cdp`, with the
    `resources()` given; a launch without `cdp` publishes no `gameFiles`; a missing `resources` publishes nothing and breaks nothing.
- [ ] T018 [P] [US1] The last game folder for a late app in src/link.test.ts
  - Files: `src/link.test.ts`
  - Cases: a client that connects after a `gameFiles` gets it; after a `state` gets no `state`.
- [ ] T019 [P] [US1] Script paths in src/keeper/command-line.test.ts
  - Files: `src/keeper/command-line.test.ts`
  - Cases: `readJsPath(p, "state-slice.js")` is `src/keeper/state-slice.js` in development and `state-slice.js` in `resources` when
    packaged; with no second argument, `read.js` as today.
- [ ] T020 [P] [US1] Mosaic tests in src/main/state-store.test.ts
  - Files: `src/main/state-store.test.ts`
  - Cases: the newest value per piece wins; a two-item path lands in `attrs[parent].$m[child]`; `["_vars"]` lands in `vars`, and only
    keys of `VARS_KEYS` are kept from it; `attrs` has no key of `STATE_EXCLUDED`; nothing is due before `cycles.all` reaches 1;
    then due once, with the JSON of `{ attrs, vars, skipped: STATE_EXCLUDED }`; after it, due again only when `cycles.formula`
    rose and a `formula` value changed; a change only in an `other` value is not due; a new `char` wipes pieces and vars and calls
    `onCharacter`; a new `map` keeps the pieces, calls nothing, and the next calculation waits for `cycles.formula` to rise;
    a `char: null` wipes; `clear()` wipes; no two characters' pieces are ever in one due JSON.

### Implementation for Phase 4

- [ ] T021 [US1] Publication in src/keeper/keeper.ts and src/keeper/link-server.ts
  - Files: `src/keeper/keeper.ts`, `src/keeper/link-server.ts`
  - Change: `KeeperDeps.read` gains a last parameter `onSlice: (s: StateSlice) => void`, and `KeeperDeps` an optional `resources?: () => string`; the callback only
    calls `server?.publish`, without `log`. The server keeps the last `gameFiles` and writes it to a new client; it does not keep `state`.
- [ ] T022 [US1] Wiring in src/keeper/index.ts, src/keeper/command-line.ts and electron-builder.yml
  - Files: `src/keeper/index.ts`, `src/keeper/command-line.ts`, `electron-builder.yml`
  - Change: `readJsPath(p, file = "read.js")`. `read` creates one `oneAtATime()`, starts `startReader` with `onEngine` and `turn` and
    `startStateReader`, with the sources loaded once by `loadReadSource`, and its `stop()` stops the state reader first. `onFailing` logs the
    label `state-read-failing`, with no data. `resources: () => join(dirname(exe), "resources")`. Two `extraResources` entries for the scripts.
- [ ] T023 [US1] The mosaic in src/main/state-store.ts
  - Files: `src/main/state-store.ts`
  - Signature: `createStateStore(cb: { onDue: (mosaicJson: string) => void; onCharacter: (char: string | null) => void }): { add(s: StateSlice): void; clear(): void }`.
  - Split maps are `{ $m: { child: value } }` with no `$c`: both are `haxe.ds.StringMap`, the calculator's default. A piece compares with its old value by its JSON text.
    Never logs. Constraint from data-model.md: "`char === null` limpa tudo".

**Verify**: `just test-one src/keeper/keeper-state.test.ts` and `just test-one src/main/state-store.test.ts` — all pass;
`just check` passes.

---

## Phase 5: User Stories 1 and 3, part 3 — the calculator

**Goal**: an isolated module runs the game's code over a mosaic and gives the numbers, or says it could not.

**Independent Test**: an invented game gives the expected numbers, reaches no network and no host object, and an invented game
that does not start gives a failure.

### Tests for Phase 5

- [ ] T024 [US1] An invented game in src/calculator/fixtures/fake-game.js
  - Files: `src/calculator/fixtures/fake-game.js`. All invented, none of it copied from the game's file.
  - Contents: one anchor `A["com.stencyl.Engine"]=a,`; `lime.$scripts.N`; a registry with the classes T028 uses
    (`com.stencyl.Engine`, `haxe.ds.StringMap`, JSON-based `haxe.Serializer.run` and `haxe.Unserializer.run`, `haxe.io.Bytes.ofData`,
    `ManifestResources.init`, `lime.utils.Assets.getLibrary`, `lime.utils.Log`, `js.Boot`, `com.stencyl.behavior.Script`, `scripts.ItemDefinitions`,
    `scripts.MonsterDefinitions`, `scripts.DialogueDefinitions`, `scripts.CustomLists`, `scripts.CustomLists2`, `scripts.CustomLists3`, `scripts.CustomMaps`, `scripts.CustomMapsREAL`,
    `scripts.ActorEvents_29` whose `init` rewrites `AFKtarget`, `scripts.Design_23_23_EveryScene`); and blocks `_customBlock_DamageDealed`, `PlayerHPmax`, `PlayerMPmax`, `PlayerAccTot`, `TotalStats`,
    `AFKgainrates`, `CloudSAVE`, `SaveGamee`, reading the state. `PlayerMPmax` tries `new XMLHttpRequest()`, `fetch("x")`, `new WebSocket("x")`, `navigator.sendBeacon("x")`, `eval("1")`,
    `new Function("return 1")`, `constructor.constructor("return process")()`, `process`, `require`, and returns how many did not throw. A block that assigns to the state marks a
    field, so the test can see `CloudSAVE` was not run.
- [ ] T025 [US1] Engine tests in src/calculator/engine.test.ts
  - Files: `src/calculator/engine.test.ts`, calling `createEngine` directly, with the fake game and a mosaic built in the test
  - Cases: the numbers come from the mosaic, by id; `mp` is `0` (nothing reached network, code generation or the host; FR-008); each global of the context and the prototype of its `globalThis` have a `constructor.constructor` that refuses to generate code;
    a block that mutates the state does not change the next number (restored before each one, FR-011); `CloudSAVE` and `SaveGamee`, called by a block, do nothing; `AFKtarget` of the mosaic wins over the helper `init` that rewrites it, and so do `CompanionBon` and `ShinyBonusS` (FR-012); `CustomLists`, `CustomMaps`, `ItemDefinitionsGET`, `MonsterDefinitionsGET` and `DialogueDefGET` come from the game's classes, with no save (research R14);
    a `_vars` key answers through the bridge, and other names answer as nothing loaded;
    a block that throws gives `null` for that number alone; `NaN` and `Infinity` give `null`; an `AFKtarget` outside the monster table gives `null` for `damageMax` and `damageMin` (Edge Cases); a block in an endless loop gives `null` within its 2 s; a game with no anchor, with two anchors, or that throws in `lime.$scripts.N` fails at start;
    two calculations in a row share no state.
- [ ] T026 [P] [US3] Worker messages in src/calculator/index.test.ts
  - Files: `src/calculator/index.test.ts`, calling `handleMessage` with a fake port and a fake engine
  - Cases: `init` answers `ready`, or `failed` with no game text in the message; `calc` answers `result` with `numbers` and `ms`; a `calc` before `init` or with bad JSON answers `result` with every number `null`; an unknown message does nothing. The ids of `TARGETS` equal `NUMBER_IDS` (a test may import `src/shared`).

### Implementation for Phase 5

- [ ] T027 [US1] The list of numbers in src/calculator/targets.ts
  - Files: `src/calculator/targets.ts`
  - `TARGETS`, as `[id, block, argument]`: `damageMax` `DamageDealed` `"Max"`; `damageMin` `DamageDealed` `"Min"`; `hp` `PlayerHPmax` `0`; `mp` `PlayerMPmax` `0`; `accuracy` `PlayerAccTot` `0`; `str`, `agi`, `wis`, `luk` `TotalStats` `"STR"`, `"AGI"`, `"WIS"`, `"LUK"`; `dropRate` `TotalStats` `"Drop_Rarity"`; `afkGains` `AFKgainrates` `"Fighting"`.
- [ ] T028 [US1] The context and the engine in src/calculator/context.js and src/calculator/engine.ts
  - Files: `src/calculator/context.js`, `src/calculator/engine.ts`, `src/calculator/raw.d.ts` (`declare module "*?raw"`)
  - Signature: `createEngine(code: string, pak: Uint8Array): { calculate(mosaicJson: string): CalcNumbers }`, which throws when the game does not start. A fresh `vm` context per `calculate`: the one shape the lab proved. `// ponytail: reuse the context if the cost shows up in the game script.`
  - Reference, outside the repository: `boot.cjs`, `harness.cjs`, `helpers.cjs`, `snap.cjs` in `C:\Users\Vinicius\idleon-companion\research\run\` and `comparar.cjs` in `lab\`. Port them; do not copy game text.
  - Isolation (research R7, [contracts/calculator.md](contracts/calculator.md)): `vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } })`: the sandbox has no prototype, because with a plain `{}` the game's `this.constructor.constructor` would be the host's `Function`, which code generation off does not cover. Everything that lives in the context, stubs, the Firebase bridge, the restore of `$m`/`$n`/`$x` and the helper actors, is written in `context.js`, imported with `?raw` and run with `vm.runInContext`. Host objects never become context properties: text goes in as a string, the mosaic as a JSON string parsed by the context's `JSON`, `default.pak` is copied by the host into a `Uint8Array` the context created. The only host functions are the three decompressors behind `pako.ungzip`, `inflate` and `inflateRaw` (`node:zlib`), kept in a closure of `context.js`, never on a global, taking and giving context arrays.
  - Every call into the game is a script text run from the host, with a `timeout`: 2,000 ms per number, 5,000 ms and 8,000 ms for the helpers, as in the lab.
  - Tables, with no save (research R14): `CustomLists` is every zero-argument static function of `scripts.CustomLists`, `CustomLists2` and `CustomLists3`, called once, keyed by its name; `CustomMaps` likewise from `scripts.CustomMaps` and `CustomMapsREAL`; `PixelHelperActor` an empty array; the item, monster and dialogue maps as in `harness.cjs`.
  - Order: boot; tables; the mosaic; primitives and bonus remembered; helpers; primitives and bonus reapplied; per-key snapshot; for each target, restore and call. `_customBlock_CloudSAVE` and `_customBlock_SaveGamee` become empty functions before anything runs. `getServerVarLoad*` of a `_vars` key answers its value.
- [ ] T029 [US1] Worker entry and boundaries
  - Files: `src/calculator/index.ts`, `electron.vite.config.ts`, `.dependency-cruiser.cjs`, `src/main/no-network.test.ts`, `electron-builder.yml`
  - `index.ts`: `handleMessage(m, port, make = createEngine)`, and `parentPort.on("message", ...)` when `parentPort` exists. The bytes of `N.js` decoded to a string inside the worker. `init` builds the engine once, to answer `ready` or `failed`.
  - `rolldownOptions.input` gains `calculator: "src/calculator/index.ts"`. `electron-builder.yml` gains `asarUnpack: [out/main/calculator.js]`.
  - `.dependency-cruiser.cjs`: `calculator-alone` (no import from `src/calculator/` to any other `src/` folder, tests excepted); `src/main`, `src/keeper`, `src/preload` and `src/renderer` never import `src/calculator/`; `node:vm` only from `src/calculator/` and tests.
  - `src/main/no-network.test.ts`, the one exception, which FR-008 asks for: `src/calculator/fixtures/` is not scanned, as it never ships, and `src/calculator/context.js` may hold the words `XMLHttpRequest` and `WebSocket`, where it defines the stubs that throw. Every other pattern still applies to it.

**Verify**: `just test-one src/calculator` — all pass; `just check` passes; `just build` ends without error and `out/main/calculator.js` exists.

---

## Phase 6: User Story 3 — the host of the calculator (Priority: P3)

**Goal**: the app owns the worker, feeds it the game's files and the newest mosaic, and turns any failure into "unavailable".

**Independent Test**: with a fake worker, a worker that hangs, dies or does not start gives `unavailable`, and nothing is thrown.

### Tests for Phase 6

- [ ] T030 [P] [US3] Game files tests in src/main/game-files.test.ts
  - Files: `src/main/game-files.test.ts`, with an injected `read`
  - Cases: reads `app.asar/distBuild/static/game/N.js` and `app.asar/distBuild/static/game/lib/default.pak` under `resources`; if the asar is not there, `app/distBuild/...`, as the update watch does; a missing file rejects; the bytes come back as `Uint8Array`s.
- [ ] T031 [P] [US3] Worker path test in src/main/calculator-host.test.ts
  - Files: `src/main/calculator-host.test.ts`, with a fake worker, fake timers
  - Cases of `calculatorPath`: a folder inside `app.asar` maps to `app.asar.unpacked`; a development folder is unchanged.
  - Cases of the host: the first `calculate` reads the files once and posts `init` with the buffers in the transfer list, and no path in any message; `ready` lets the newest mosaic go; only one calculation at a time, and while one runs a newer one replaces the waiting one; the next calculation waits 5,000 ms after the last ended; a `result` reaches `onResult`, with any absent or non-number id as `null`; no `ready` in 60 s, `failed`, a read that rejects, no answer in 15 s, the worker's `error` or `exit`: `terminate()` and `onUnavailable`, once, and later `calculate`s do nothing; a mosaic with an empty `vars` gives `onUnavailable` (FR-015); `reset()` terminates and allows a new start; the worker was created with `env: {}`, `stdin: false` and `resourceLimits`; nothing throws to the caller.

### Implementation for Phase 6

- [ ] T032 [US3] The files in src/main/game-files.ts
  - Files: `src/main/game-files.ts`
  - Signature: `readGameFiles(resources: string, read = readFile): Promise<{ code: Uint8Array; pak: Uint8Array }>`, with Electron's `fs`, which understands asar.
- [ ] T033 [US3] The host in src/main/calculator-host.ts
  - Files: `src/main/calculator-host.ts`
  - Signatures: `calculatorPath(dir: string): string`;
    `createCalculatorHost(deps: { createWorker: () => WorkerLike; readFiles: () => Promise<GameBytes>; onResult: (n: CalcNumbers) => void; onUnavailable: () => void }): { calculate(mosaicJson: string): void; setFiles(resources: string): void; reset(): void }`.
  - Limits in constants: `INIT_MS = 60_000`, `SET_MS = 15_000`, `CALC_GAP_MS = 5_000`, `maxOldGenerationSizeMb: 1024`.

**Verify**: `just test-one src/main/calculator-host.test.ts` and `just test-one src/main/game-files.test.ts` — all pass;
`just check` passes.

---

## Phase 7: User Story 4 — the Stats tab (Priority: P4)

**Goal**: the window has a simple "Stats" tab with the 10 numbers, fed end to end.

**Independent Test**: invented slices and a fake worker make the 10 rows reach the window; the tab has no input.

### Tests for Phase 7

- [ ] T034 [P] [US4] Format and check tests in src/main/stats.test.ts
  - Files: `src/main/stats.test.ts`, invented numbers only
  - Cases of `formatNumber`: rounds up, `1234.1` is `1,235`; `999,999,999,999` with separators; a trillion and up is `T`, `351.2e12` is `352T`; `1e15` and up is `E` with 2 decimals truncated, `1.499e33` is `1.49E33`.
  - Cases of `statsRows`: 10 rows in the order Drop Rate, Damage, HP, MP, STR, AGI, WIS, LUK, Accuracy, AFK Gains; `Drop Rate` ends in `x`; `Damage` is `min – max`, and either one `null` makes `unavailable`; `Accuracy` always in `E` notation; `AFK Gains` is the value × 100 with `%`; a `null` makes only its row `unavailable`.
  - Cases of `statListCheck`, whose list is `[STR, AGI, WIS, LUK, ...]`, confirmed in the game (research R11): a value within 1%, or 1 point, passes; a different value passes for 35 s, as the game writes the list every 30 s; after 35 s still different, that row is `unavailable`; equal again clears it; no list, or a list with a non-number, checks nothing.
  - Cases of the tracker, as the table of data-model.md: `none` → `calculating` at the first slice of a character; `calculating` → `ready` at the first result; `ready` stays `ready` with new rows and never shows `calculating` again for the same character (FR-024); a new character → `calculating`, without the old rows; `clear()` → `none`; `unavailable` holds until a new start; `replay()` repeats the last value.
- [ ] T035 [P] [US4] Panel tests in src/renderer/StatsPanel.test.tsx
  - Files: `src/renderer/StatsPanel.test.tsx`
  - Cases: `calculating` shows `Calculating`; `unavailable` shows `Calculator unavailable`; `ready` shows the 10 labels with their text, and a row `unavailable`; `none` and `null` show no row; no `input`, `textarea` or `select` in any state (FR-020).
- [ ] T036 [P] [US4] Tabs test in src/renderer/stats-tab.test.tsx
  - Files: `src/renderer/stats-tab.test.tsx`, with the stub of `src/renderer/companion-stub.ts`
  - Cases: two tabs, `Screen map` selected by default; choosing `Stats` shows its panel and hides the map; going back shows the map again.
- [ ] T037 [P] [US4] End-to-end in src/main/stats-pipeline.test.ts
  - Files: `src/main/stats-pipeline.test.ts`, with invented slices and a fake worker
  - Cases: slices of a whole rotation and a `gameFiles` end with a `calc`; its `result` sends `ready` on `stats:update`; a `state` with a bad shape is dropped; a reading with `char: null`, a status with the reader not `attached` and a closed game send `none` and wipe the mosaic; after `unavailable`, the rest goes on without throwing, and a new `gameFiles` starts over.

### Implementation for Phase 7

- [ ] T038 [US4] Types and the channel
  - Files: `src/shared/types.ts`, `src/shared/index.ts`, `src/preload/index.ts`, `src/renderer/companion-stub.ts`
  - Change: `IPC.statsUpdate = "stats:update"`; `Stats` as in data-model.md: `{ state: "none" } | { state: "calculating" } | { state: "ready"; rows: { label: string; text: string }[] } | { state: "unavailable" }`; `CompanionApi.onStats`, with replay.
- [ ] T039 [US4] Format, check and tracker in src/main/stats.ts
  - Files: `src/main/stats.ts`
  - Signatures: `formatNumber(n: number): string`; `statsRows(n: CalcNumbers, unavailable: ReadonlySet<string>): Stats`; `statListCheck(now: () => number): (n: CalcNumbers, list: unknown) => Set<string>`; `statsTracker(send: (s: Stats) => void)`.
- [ ] T040 [US4] The pipeline in src/main/stats-pipeline.ts and src/main/index.ts
  - Files: `src/main/stats-pipeline.ts`, `src/main/index.ts`
  - Signature: `startStatsPipeline(deps: { send: (s: Stats) => void; createWorker: () => WorkerLike; readFiles: (resources: string) => Promise<GameBytes> }): { message(m: LinkMessage): void; reading(r: Reading): void; status(s: Status): void; replay(): void }`, joining the store, the host, the check and the tracker. `StatList` comes from the mosaic: `attrs.PlayerDATABASE.$m[char].$m.PersonalValuesMap.$m.StatList`.
  - `index.ts` passes the link's messages, readings and statuses to it, replays on `did-finish-load`, creates `new Worker(calculatorPath(import.meta.dirname) + "/calculator.js", { env: {}, stdin: false, resourceLimits })`.
- [ ] T041 [US4] The panel and the tabs
  - Files: `src/renderer/StatsPanel.tsx`, `src/renderer/App.tsx`, `src/renderer/styles.css`
  - Two `role="tab"` buttons around the panels of [contracts/ipc.md](contracts/ipc.md). A plain list, on purpose: the final tab is another feature.
- [ ] T042 [P] [US4] The boundary in ARCHITECTURE.md
  - Files: `ARCHITECTURE.md`
  - Change: the calculator as a fourth part: isolated worker owned by the app, what crosses into it, the reading in slices, and the link to [ADR 0006](../../docs/adr/0006-game-code-runs-in-an-isolated-worker.md).
- [ ] T043 [P] [US4] The words in GLOSSARY.md
  - Files: `GLOSSARY.md`
  - Change: `slice`, `mosaic`, `sentinel`, `calculator`, in the file's format.

**Verify**: `just test-one src/main/stats.test.ts`, `just test-one src/renderer/StatsPanel.test.tsx` and
`just test-one src/main/stats-pipeline.test.ts` — all pass; `just check` passes; `just build` ends without error. The session
runs the game script of the quickstart with Vinicius afterwards, on the installed build too, because the worker from
`app.asar.unpacked` is only exercised there.

---

## Dependencies & Execution Order

Phases run in order: 1 → 2 → 3 → 4 → 5 → 6 → 7. Phase 3 needs the rotation (2). Phase 5 depends only on Phase 1 for its ids and could come before 2 to 4. Phase 7 needs the store (4) and the host (6).

## Parallel Opportunities

Tests marked [P] of one phase touch different files, and T042 and T043 too. Inside a phase the implementation runs in order, since each task is what the next one builds on.

## Implementation Strategy

MVP: Phases 1 to 7 are what the player needs for US1, and the tab of Phase 7 is the first visible change. Phases 2 to 6 prove each piece with fakes. The numbers against the Player Info only come with the game script of the quickstart. Each phase ends with `just check` green.

## Review Focus

1. A change of map in combat: a reasonable user expects the numbers to stay on screen and update later, never "Calculating" again. Pinned by the map cases of the store, task T020 in Phase 4, and of the tracker, task T034 in Phase 7.
2. A change of equipment: the game's `StatList` runs up to 30 s behind, and a reasonable user expects no false "unavailable" in that time. Pinned by the 35 s case of `statListCheck`, task T034 in Phase 7.
3. The first rotation, when no size is known: a reasonable user expects no hitch when the game opens. Pinned by `pieceBytes`, task T008 in Phase 2, which reads each big character alone.
4. A game patch that moves the anchor or a class: a reasonable user expects "Calculator unavailable" and everything else working. Pinned by the failed starts of the engine, task T025 in Phase 5, and by the host, task T031 in Phase 6.
5. "Let the game close" during a read: a reasonable user expects the game to close without waiting and no stale number afterwards. Pinned by `stop()` in flight, task T008 in Phase 2, and by the status case of the pipeline, task T037 in Phase 7.

### Security Criteria

Criteria of [checklists/security.md](checklists/security.md).

- T007, T010: CHK001 (property reads only, no getter, no `JSON.stringify`), CHK002 (nothing added to the page), CHK003 (the proof with a fake engine), CHK004 (no game function, no write).
- T013, T015: CHK005 (closed list and a limit of 3000 objects), CHK006 (the fake token).
- T017, T020, T021, T023: CHK007 (memory only, nothing in `keeper.log`).
- T025, T028, T029: CHK008 (the exception only in `src/calculator/`, with the 003 rule intact and `node:vm` barred elsewhere), CHK009 (the four layers of research R7), CHK010 (`CloudSAVE` and `SaveGamee` emptied).
- T033, T040: CHK011 (the worker is the app's, and its failure does not reach the keeper).
- Prerequisite of this list: CHK012 (the amendment before the code).
- T030, T032: CHK013 (the files come from each machine's installation; `electron-builder.yml` gains no game file).
- T024: CHK014 (the game of the tests is invented, and so are its names and numbers).
- T029: CHK015 (`src/main/no-network.test.ts` keeps watching `src/calculator/`, with one named exception).
