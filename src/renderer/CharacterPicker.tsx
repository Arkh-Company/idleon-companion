// The character picker (spec 008 FR-020; design.md C19): a native select over the game's characters, opened on the
// active one, each one by its name on screen (FR-010). Another character's tree carries the band: its numbers are not
// the Stats', which are the active character's. Plain text, no live region; the panel says the new breakdown.
import type { Characters } from "../shared/index.ts";

export function CharacterPicker({
  characters,
  character,
  onPick,
}: {
  characters: NonNullable<Characters>;
  /** The character whose tree is open or asked. */
  character: number;
  onPick: (character: number) => void;
}) {
  const { names, active } = characters;
  return (
    <div className="character-picker">
      <label>
        Character{" "}
        <select
          value={character}
          onChange={(e) => {
            onPick(Number(e.target.value));
          }}
        >
          {names.map((name, i) => (
            <option key={i} value={i}>
              {i === active ? `${name} · active` : name}
            </option>
          ))}
        </select>
      </label>
      {character !== active && (
        <p className="band">
          Not the active character. These numbers can&apos;t be compared with
          Stats.
        </p>
      )}
    </div>
  );
}
