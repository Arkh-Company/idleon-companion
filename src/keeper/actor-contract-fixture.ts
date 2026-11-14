// For tests only: the actor fields the live-game trees read (spec 008 US12), what state-slice.js is checked against. They
// come from the bench's curation: the map and helper fields of the 40 live-game rows (L1) and the 26 fields the 19 trees
// whose recording reads an actor outside the read contract use (CATALOGO-008-app). Only field paths, never a value.

/** [PixelHelperActor index, ActorEvents number, field, the indexes read of it, or null when it is read whole]. */
export const HELPER_FIELDS: [number, number, string, number[] | null][] = [
  [0, 29, "_ScrollCircleINFO", [43]],
  [2, 167, "_BuffIDsOn", null],
  [4, 229, "_GenInfo", [84]],
  [5, 232, "_ItemsAndStorageOWNED", null],
  [6, 312, "_GenINFO", [45]],
  [8, 481, "_GenINFO", [108, 111, 112, 132]],
  [21, 510, "_GenINFO", [56]],
  [22, 548, "_GenINFO", [22, 38, 92, 110]],
  [24, 623, "_GenINFO", [71, 87, 110, 123, 124, 130, 132, 143, 170, 174, 185]],
  [25, 670, "_GenINFO", [36, 69, 76, 112, 210]],
  [26, 713, "_GenINFO", [70, 88, 89, 107]],
  [27, 741, "_GenINFO", [30, 32, 33, 39, 50]],
];

/** The map's first monster (MapMonstersList[0], ActorEvents_1). */
export const MONSTER_FIELDS = ["_MonsterType", "_MonsterHPtot", "_RespawnTime"];
