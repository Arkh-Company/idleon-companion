# The companion adds its part to Steam's launch option, by splicing the file with Steam closed

The app writes the launch option itself, in `userdata\<id>\config\localconfig.vdf`, only after the user's click, only
with Steam closed the normal way (`steam.exe -shutdown`, never killed), and by replacing just the text of that one value:
the rest of the file stays byte for byte. It adds `"<exe>" --keeper` and never removes what the user had; undoing removes
only the text it added (Vinicius, 07/11).

## Considered Options

- **Ask the user to paste the option.** Rejected: the friends would get it wrong, and it was the problem to solve.
- **Rewrite the file with a VDF library.** Rejected: it reformats the whole file Steam owns.
- **Replace the user's option.** Rejected by the user: their own options must survive.

## Consequences

Setup and removal close and reopen Steam, and refuse while the game is open. A copy of the file from before the first
write stays in the data folder. The uninstaller runs the same removal (`--remove-from-steam`), except during an update.
