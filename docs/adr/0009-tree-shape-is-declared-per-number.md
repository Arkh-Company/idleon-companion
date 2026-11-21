# The shape of a formula tree is declared per number

Each of the 289 numbers of the validated catalog has a blueprint: a data file that declares its pools, system groups, sources, children and leaf types, with references to the game's code by block and mode. The app only reads blueprints and fills them with the recorded values; it never deduces a shape from the recording. The deduced shape (hundreds of local rules over a noisy trace) broke one family of trees with every fix, and two rules that conflicted were settled silently (spec 010, prototype on the Drop Rate).

Supersedes the shape-building part of [ADR 0008](0008-a-second-worker-records-formula-trees.md): the second worker still records, but the `tree/` folder that deduced shapes goes away.
