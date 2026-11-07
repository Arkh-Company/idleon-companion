import { expect, test } from "vitest";
import {
  addPart,
  companionPart,
  hasConsoleScript,
  optionState,
  removePart,
} from "./launch-option.ts";

const EXE =
  "C:\\Users\\A B\\AppData\\Local\\Programs\\IdleOn Companion\\IdleOn Companion.exe";
const PART = `"${EXE}" --keeper `;

test("the companion's part: the exe packaged, electron and the repo in development", () => {
  expect(
    companionPart({ execPath: EXE, defaultApp: false, appPath: "x" }),
  ).toBe(PART);
  expect(
    companionPart({
      execPath: "C:\\repo\\node_modules\\electron\\dist\\electron.exe",
      defaultApp: true,
      appPath: "C:\\repo",
    }),
  ).toBe(
    '"C:\\repo\\node_modules\\electron\\dist\\electron.exe" "C:\\repo" --keeper ',
  );
});

test.each([
  ["empty", "", `${PART}%command%`],
  ["without %command%", "-windowed", `${PART}%command% -windowed`],
  ["with %command%", "FOO %command% -bar", `FOO ${PART}%command% -bar`],
  ["with two %command%", "%command% %command%", `${PART}%command% %command%`],
])("adding to an option %s keeps the user's text", (_name, current, next) => {
  const r = addPart(current, PART);
  expect(r.next).toBe(next);
  expect(removePart(r.next, r.inserted)).toBe(current);
});

test("adding to an option that already has the part changes nothing", () => {
  const current = `FOO ${PART}%command%`;
  expect(addPart(current, PART)).toEqual({ next: current, inserted: "" });
});

test("removing keeps what the user changed after the setup", () => {
  const { next, inserted } = addPart("FOO %command% -bar", PART);
  const edited = `${next.replace("FOO", "BAZ")} -extra`;
  expect(removePart(edited, inserted)).toBe("BAZ %command% -bar -extra");
});

test("removing when the inserted text is gone changes nothing", () => {
  const { inserted } = addPart("-windowed", PART);
  expect(removePart("-windowed -fullscreen", inserted)).toBe(
    "-windowed -fullscreen",
  );
  expect(removePart("-windowed", "")).toBe("-windowed");
});

test.each([
  ["", "not-set"],
  ["  ", "not-set"],
  [`${PART}%command%`, "companion"],
  ["-windowed", "other"],
])("the state of %j is %s", (current, state) => {
  expect(optionState(current, PART)).toBe(state);
});

test.each([
  ['"C:\\x\\run.cmd" %command%', true],
  ['"C:\\x\\RUN.BAT" %command%', true],
  ["-windowed", false],
  ["%command% C:\\x\\after.cmd", false],
  ['"C:\\x\\run.cmd"', false], // without %command% the text goes after the game's command
])("a console script in %j: %s", (current, expected) => {
  expect(hasConsoleScript(current)).toBe(expected);
});
