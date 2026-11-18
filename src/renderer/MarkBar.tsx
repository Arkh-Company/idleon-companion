// Antes/depois (spec 008 FR-025, FR-037, FR-041): "Mark before" saves the open tree's values under a name, a picker
// chooses what "Changes" compares with ("Live" or a mark, spec 009 FR-013), and the chosen mark has Clear. The marks are the main's, by the character's
// number; the focus never drops on the page, and each message goes once to the page's live region.
import { useCallback, useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { MARKS_FULL, MAX_MARK_NAME, MAX_MARKS } from "../shared/index.ts";
import type { Mark } from "../shared/index.ts";

/** "Mark 1", "Mark 2"…: the first one not taken. */
function suggestion(marks: readonly Mark[]): string {
  for (let i = 1; ; i++)
    if (!marks.some((m) => m.name === `Mark ${String(i)}`))
      return `Mark ${String(i)}`;
}

export function MarkBar({
  character,
  chosen,
  onChoose,
  announce,
}: {
  character: number;
  chosen: Mark | null;
  onChoose: (mark: Mark | null) => void;
  announce: (text: string) => void;
}) {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [name, setName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const markButton = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLSelectElement>(null);

  const say = useCallback(
    (text: string) => {
      setMessage(text);
      announce(text);
    },
    [announce],
  );
  const load = useCallback(async (): Promise<Mark[]> => {
    const { marks: list, warning } = await window.companion.listMarks({
      character,
    });
    setMarks(list);
    if (warning) say(warning);
    return list;
  }, [character, say]);
  useEffect(() => {
    void load();
  }, [load]);
  const naming = name !== null;
  useEffect(() => {
    if (naming) field.current?.focus();
  }, [naming]);

  function start(): void {
    if (marks.length >= MAX_MARKS) {
      say(MARKS_FULL);
      return;
    }
    setMessage(null);
    setName(suggestion(marks));
  }
  function stop(): void {
    setName(null);
    markButton.current?.focus();
  }
  async function save(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (name === null) return;
    const refused = await window.companion.saveMark({ character, name });
    if (refused) {
      say(refused);
      return;
    }
    const list = await load();
    onChoose(list.find((m) => m.name === name.trim()) ?? null);
    stop();
    announce(`${name.trim()} saved.`);
  }
  async function clear(mark: Mark): Promise<void> {
    const refused = await window.companion.clearMark({
      character,
      name: mark.name,
    });
    if (refused) say(refused);
    onChoose(null);
    const list = await load();
    // The Clear button is gone: the focus stays in the bar.
    (list.length > 0 ? picker.current : markButton.current)?.focus();
  }

  return (
    <div className="marks" role="group" aria-label="Marks">
      <button type="button" ref={markButton} onClick={start}>
        Mark before
      </button>
      {name !== null && (
        <form onSubmit={(e) => void save(e)}>
          <label>
            Mark name{" "}
            <input
              ref={field}
              value={name}
              maxLength={MAX_MARK_NAME}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          </label>
          <button type="submit">Save mark</button>
          <button type="button" onClick={stop}>
            Cancel
          </button>
        </form>
      )}
      {marks.length > 0 && (
        <label>
          Compare with{" "}
          <select
            ref={picker}
            value={chosen?.name ?? ""}
            onChange={(e) => {
              onChoose(marks.find((m) => m.name === e.target.value) ?? null);
            }}
          >
            <option value="">Live</option>
            {marks.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {chosen && (
        <button type="button" onClick={() => void clear(chosen)}>
          {`Clear ${chosen.name}`}
        </button>
      )}
      {message && <p className="note">{message}</p>}
    </div>
  );
}
