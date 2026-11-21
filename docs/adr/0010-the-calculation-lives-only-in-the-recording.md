# The calculation lives only in the recording

A blueprint never stores a formula: writing one would transcribe the game's code into Git. The lock rebuilds each level's calculation from the recorded steps when it checks a blueprint, and keeps nothing. So the check that every tree closes with the game runs only on the player's PC, over real recordings, and CI only checks the review files (the blueprint's hash and the lock's result): a green CI does not prove that a tree closes (spec 010, FR-010).
