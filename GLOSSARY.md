# IdleOn Companion

A desktop companion that shows, live and read-only, where the player is in Legends of Idleon and what is open, next to
the game.

## Processes

**Keeper**:
The process Steam starts in place of the game; it opens the game, holds its debugging pipe and reads it for the whole
session.
_Avoid_: launcher, guardian, daemon

**App**:
The companion's window, tray and catalog, a process apart from the keeper that can close without touching the game.
_Avoid_: client, UI process

**Link**:
The local named pipe between the keeper and the app, carrying readings, statuses and the confirmation of an update.
_Avoid_: channel, socket, bridge

## Reading the game

**Engine reference**:
The handle on the game engine the keeper takes once per game load, through one short pause at a breakpoint, and reads
every second.
_Avoid_: hook, attach, injection

**Reading**:
The few game fields taken at one moment (map, menus, Codex tab, character, AFK target), by property reads only.
_Avoid_: snapshot, sample, poll

**Update watch**:
The check of the installed game code before each launch, which keeps the debugging pipe off when the code changed in a
suspicious way or cannot be checked.
_Avoid_: anti-cheat check, scanner

## Names

**Catalog**:
The names of the game's screen numbers, each one deduced from the game code or confirmed by the player.
_Avoid_: dictionary, mapping, names list
