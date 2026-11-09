# IdleOn Companion

A desktop companion that shows, live and read-only, where the player is in Legends of Idleon and what is open, next to
the game.

## Processes

**Keeper**:
The process Steam starts in place of the game: the companion's own executable with `--keeper`, in Electron's main
process and without `ELECTRON_RUN_AS_NODE`; it opens the game, holds its debugging pipe and reads it for the whole
session.
_Avoid_: launcher, guardian, daemon

**App**:
The companion's window and tray, a process apart from the keeper that can close without touching the game.
_Avoid_: client, UI process

**Link**:
The local named pipe between the keeper and the app, carrying readings, statuses, the game tables, the confirmation of
an update and the requests to let go of the game or read it again.
_Avoid_: channel, socket, bridge

## Reading the game

**Engine reference**:
The handle on the game engine the keeper takes once per game load, through one short pause at a breakpoint, and reads
every second.
_Avoid_: hook, attach, injection

**Reading**:
The few game fields taken at one moment (map, menus, Codex tab, character, AFK target and the values that tell one
screen from another), by property reads only.
_Avoid_: snapshot, sample, poll

**Slice**:
A piece of the account's state of up to 25 KB, read by property reads only and carried over the **Link**; one every 250 ms,
never two at once, and nothing stays in the game between them.
_Avoid_: snapshot, chunk, batch

**Mosaic**:
The app's copy of the state, in memory only and never saved or logged, with the newest value of each piece that the
**Slices** brought.
_Avoid_: snapshot, retrato, cache

**Sentinel**:
The character and the map that every **Slice** carries: a new character starts the **Mosaic** over, and a new map waits a
whole rotation before the next calculation.
_Avoid_: marker, version

**Calculator**:
The isolated worker of the app that runs the game's code over the **Mosaic** to give the numbers of the Stats tab, with no
network and no access to the app; when it cannot, the tab says "unavailable".
_Avoid_: engine, simulator, sandbox

**Update watch**:
The check of the installed game code before each launch, which keeps the debugging pipe off when the code changed in a
suspicious way or cannot be checked.
_Avoid_: anti-cheat check, scanner

## Names

**Catalog**:
The list of **Screen rules** that ships in the companion, each with its proof; the player never adds to it.
_Avoid_: dictionary, mapping, names list

**Screen rule**:
One line of the **Catalog**: the equalities a **Reading** must meet, all of them, the screen's name and the proof of that
name (a photo or a sprite). The rule with the most conditions wins.
_Avoid_: entry, pattern, match

**Game tables**:
The names of the maps and monsters that the **Keeper** takes from the text of the installed game code, which it never
runs, once per game launch. They stay in the app's memory, and a table it cannot read gives no name.
_Avoid_: game data, dump

**Unknown screen**:
What the window shows when no **Screen rule** holds or two tie: a name without proof never appears.
_Avoid_: unnamed, deduced

## Steam and install

**Launch option**:
The text in the game's Steam properties that tells Steam what to run when the player presses Play.
_Avoid_: launch parameter, launch command, Steam argument

**Companion part**:
What the companion adds to the launch option, `"<exe>" --keeper ` right before `%command%`, and the only text it ever
takes out of it, which happens only when the companion is uninstalled.
_Avoid_: prefix, wrapper, launch script

**Setup screen**:
The window's only content while Steam is not set up for the most recent account, with the one button that closes Steam,
adds the companion part and reopens Steam.
_Avoid_: onboarding, wizard

**Let the game close**:
The action, in the status bar and the tray, that makes the keeper let go of the game's page so its X closes it again; the
debugging pipe stays open.
_Avoid_: detach, disconnect

**Reconnect**:
The action that takes the engine reference again after **Let the game close**, with one new pause.
_Avoid_: reattach, resume

**Releases repository**:
The public GitHub repository with only the installers and update files, `Arkh-Company/idleon-companion-releases`, and the
only place the app reaches over the network.
_Avoid_: update server, CDN
