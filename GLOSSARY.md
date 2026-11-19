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
A piece of the account's state of up to 25 KB, read by property reads only and carried over the **Link**; 12 a second
nominal (about 10.7 measured on Windows), never two at once, and nothing stays in the game between them.
_Avoid_: snapshot, chunk, batch

**Catalog**:
The table in the repository with one line per piece of the game's state: what it is, which numbers it affects, when it
changes and in which reading it goes. It is the single source of the reading lists, and has no account value, player
name or text of the game's code.
_Avoid_: reading list, manifest

**Fast reading**:
Every piece of the **Catalog** with a proven impact on a number the companion shows, except the pieces of other
characters, so that a change reaches the number in less than 1 s.
_Avoid_: `formula`

**Slow reading**:
Every other piece, one the **Catalog** does not know included: still read, only later. The fixed tables the calculator builds itself and the `_vars` outside the closed list are never read.
_Avoid_: `other`

**Actions slice**:
The **Slice** of the **Fast reading** with what changes together when the player acts, such as the equipment and the game's
caches of it, with 3 of the 12 reads of each second. A change in it is calculated when the next read comes equal, or
after 3 reads in a row that keep changing it.
_Avoid_: equipment slice, priority slice

**Mosaic**:
The app's copy of the state, in memory only and never saved or logged, with the newest value of each piece that the
**Slices** brought, and the fields of the map's actors (the `actors` part), which only the tree worker applies.
_Avoid_: snapshot, retrato, cache

**Sentinel**:
The character and the map that every **Slice** carries: a new character starts the **Mosaic** over, and a new map waits a
whole pass of the **Fast reading** before the next calculation.
_Avoid_: marker, version

**Calculator**:
The isolated workers of the app that run the game's code over the **Mosaic**, with no network and no access to the app;
two of them: the Stats worker gives the numbers of the Stats tab, and the tree worker, with a heap of its own, records
and builds each **Formula tree** and the live values in view. When one cannot, what it serves says "unavailable", and
the tree worker never fails the Stats.
_Avoid_: engine, simulator, sandbox

**Update watch**:
The check of the installed game code before each launch, which keeps the debugging pipe off when the code changed in a
suspicious way or cannot be checked.
_Avoid_: anti-cheat check, scanner

## Names

**Screen catalog**:
The list of **Screen rules** that ships in the companion, each with its proof; the player never adds to it.
_Avoid_: dictionary, mapping, names list

**Screen rule**:
One line of the **Screen catalog**: the equalities a **Reading** must meet, all of them, the screen's name and the proof of that
name (a photo or a sprite). The rule with the most conditions wins.
_Avoid_: entry, pattern, match

**Game tables**:
The names of the maps, monsters, items and classes that the **Keeper** takes from the text of the installed game code,
which it never runs, once per game launch. They stay in the app's memory, and a table it cannot read gives no name.
_Avoid_: game data, dump

**Unknown screen**:
What the window shows when no **Screen rule** holds or two tie: a name without proof never appears.
_Avoid_: unnamed, deduced

## Formula trees

**Formula tree**:
How one number of the game is calculated, as rows opened in place like folders, built by the tree worker of the
**Calculator** from one recording of the game's own code; its root is the number the Stats shows, checked against it.
_Avoid_: formula graph, dependency tree, explanation

**Tree piece**:
One call of the game with its arguments, or one read of the state, with the character's number: the same piece is the same
part in any tree and any recording. Its key is what marks, **Where this goes** and the **Patch radar** compare.
_Avoid_: node, block, term

**Leaf**:
A row of a **Formula tree** with nothing below it but its own detail: a value the player raises or picks, or one the game
sets.
_Avoid_: input, terminal, end node

**Leaf type**:
What a **Leaf** is in the math, one of nine: Level, Quantity, Invested points, Tier and Record (the player raises them),
Condition and Choice (the player unlocks or picks them), Fixed value and Raw bonus (the game sets them); `?` while it is not
known. Each has its tag in text, its family's color and its phrase.
_Avoid_: category, kind, class

**How it adds up**:
A row's calculation in two lines, its names and its numbers, or a rule as its two lines of text: names and numbers only,
never the game's code. The bench calls it ⓘ; the counts of Game details say "Rows with How it adds up".
_Avoid_: formula, equation, ⓘ on screen

**Pool**:
One stage of the game's own math on the first level of a **Formula tree**, in the order of the sum: an **Additive pool** or
a **Multi pool**, with its value, its **Share** and the **System groups** inside; numbered ("Multi pool 1") when there is
more than one of a kind.
_Avoid_: stage, bucket, layer

**Additive pool**:
A **Pool** that adds: the sums in a row of the game's steps, or a factor that is a plain sum of two sources or more.
_Avoid_: sum pool, flat pool, additive group

**Multi pool**:
A **Pool** that multiplies: the loose multipliers in a row are one, and a multiplier that sums bonuses inside,
`1 + (a + b) ÷ 100`, is one of its own.
_Avoid_: multiplier pool, product pool, multi group

**System group**:
The sources of one game system inside a **Pool** or under the root, with its emoji and name, in the V1 order of the bench
and "🔹 Other" last; its value is the sum or the product of its sources, and a source with no system rule is never
guessed into one.
_Avoid_: category, system row, grupo de sistema

**Changes**:
The tree's button, off by default, that shows on each row a live arrow with how much it moved, against the tree as it was
at the click ("live") or against a **Mark**; only its on or off is saved.
_Avoid_: diff, Refresh, was

**Share**:
How much of its parent a row is ("26%"), and the tree's button, off by default, that shows or hides it; only its on or off
is saved.
_Avoid_: fatia, of total, weight

**System panel**:
The panel of one game system in the Panel tab, shown when that system's screen opens in the game and said once to a screen
reader; a screen without one keeps the last.
_Avoid_: system tab, module

**Side panel**:
The panel beside the window where a tapped number's **Formula tree** opens, the window widened toward the side with room;
it changes only when the player taps another number or ✕, never with the game's screen.
_Avoid_: drawer, popup, sidebar

**Mark**:
The values of the open tree saved under a name ("Mark before"), up to 3 per character, to compare the tree with later; kept
on the player's machine by the character's number until Clear, never with a character's name.
_Avoid_: snapshot, bookmark, save

**Pin**:
A number of the catalog kept live in the strip under the status bar, up to 5, on every tab; only which numbers are saved,
never their values.
_Avoid_: favorite, watch

**Where this goes**:
The count on a part that 2 or more numbers of the catalog use ("Feeds N numbers"), whose list opens each of those trees;
filled in the background from the saved tree shapes.
_Avoid_: usages, references, feeds index

**Patch radar**:
The band under the status bar after a game update, which says how many trees changed their shape and lists what changed,
until the player closes it; it keeps only shapes, never values.
_Avoid_: changelog, diff, update notes

**Farm tracker**:
The XP, gold and items per hour of the active character, measured only from what changes between **Slices** and only in
memory, never by a formula: it counts on a map that is not a town, pauses in a town and starts over on another map.
_Avoid_: farm calculator, income estimate

**Version band**:
The one band over a **Formula tree** when its names and tags were checked on another version of the game's code: the values
stay live, and no row is marked.
_Avoid_: outdated warning, version tag

**Inactive character**:
A character of the account other than the one in play: its tree is built from the **Mosaic** as the game builds that
character when it switches to it, and it stays outside the check against the Stats.
_Avoid_: offline character, other player, alt

**Character picker**:
The choice, at the top of the **Side panel**, of whose tree is shown, by name and class; it opens on the active character,
and the names appear only on screen.
_Avoid_: account switcher, character select

**Last reading**:
What the Stats, the trees and the panels keep when the game closes, with "last reading N s ago".
_Avoid_: cache, offline values, saved values

**Stale**:
A value or a tree that is the **Last reading** and no longer follows the game, because the game is closed.
_Avoid_: old, expired, outdated

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
