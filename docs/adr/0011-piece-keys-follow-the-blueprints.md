# Piece keys follow the blueprints, and old saved tree data is deleted

The keys of the tree pieces come from the blueprints, so Pins, marks and saved tree shapes from the deduced trees point to pieces that no longer exist. Their files move to version 2: the old ones are deleted, and the app shows a one-time notice instead of trying to map them by name, which could drop a Pin on the wrong piece (spec 010, FR-028).
