// The one executable's role, picked from its command line (contracts/command-line.md).
import { expect, test } from "vitest";
import { roleFor } from "./dispatch.ts";

test.each([
  ["packaged keeper", ["exe", "--keeper", "C:\\Game\\LegendsOfIdleon.exe"]],
  ["dev keeper", ["electron.exe", "C:\\repo", "--keeper", "x.exe"]],
  [
    "a game arg that is --remove-from-steam",
    ["exe", "--keeper", "x.exe", "--remove-from-steam"],
  ],
])("%s → keeper", (_name, argv) => {
  expect(roleFor(argv)).toBe("keeper");
});

test("--remove-from-steam → the uninstaller mode", () => {
  expect(roleFor(["exe", "--remove-from-steam"])).toBe("remove-from-steam");
});

test.each([[["exe"]], [["exe", "--from-steam"]]])("%j → app", (argv) => {
  expect(roleFor(argv)).toBe("app");
});
