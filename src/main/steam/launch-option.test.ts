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

test("removing after the user deleted their own text still takes out the companion's part", () => {
  const { next, inserted } = addPart("-windowed", PART);
  expect(inserted).toBe(`${PART}%command% `);
  expect(removePart(next.replace(" -windowed", ""), inserted)).toBe("");
  expect(removePart(`${PART}%command%`, `${PART}%command% `)).toBe("");
});

test("removing when the inserted text is gone changes nothing", () => {
  const { inserted } = addPart("-windowed", PART);
  expect(removePart("-windowed -fullscreen", inserted)).toBe(
    "-windowed -fullscreen",
  );
  expect(removePart("-windowed", "")).toBe("-windowed");
});

test("adding to an option of only spaces is adding to an empty one", () => {
  const whole = `${PART}%command%`;
  expect(addPart("  ", PART)).toEqual({ next: whole, inserted: whole });
});

test.each([
  ["FOO %command%", `${PART}%command%`, `FOO ${PART}%command%`],
  ["FOO %command% -bar", `${PART}%command% `, `FOO ${PART}%command% -bar`],
  ["FOO %command%", `${PART}%command% `, `FOO ${PART}%command%`],
])(
  "the user's text before the part keeps a command to run: %j",
  (expected, inserted, current) => {
    expect(removePart(current, inserted)).toBe(expected);
  },
);

test.each([
  ["", "not-set"],
  ["  ", "not-set"],
  [`${PART}%command%`, "companion"],
  ["-windowed", "other"],
  ["%command% --keeper -x", "other"],
  ["--keeper -x", "other"],
  ['"C:\\Old\\IdleOn Companion.exe" --keeper %command%', "other-companion"],
  ['FOO "C:\\Old.exe" "C:\\repo" --keeper %command% -x', "other-companion"],
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
