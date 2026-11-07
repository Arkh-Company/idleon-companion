// The keeper's command line and paths, packaged and in development (research R1).
import { join } from "node:path";
import { expect, test } from "vitest";
import { appCommand, gameCommand, readJsPath } from "./command-line.ts";

test("the game command is everything after --keeper, byte for byte", () => {
  const exe =
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Legends of Idleon\\LegendsOfIdleon.exe";
  expect(
    gameCommand([
      "C:\\Apps\\IdleOn Companion.exe",
      "--keeper",
      exe,
      "-steam",
      "--some flag=a b",
    ]),
  ).toEqual({ exe, args: ["-steam", "--some flag=a b"] });
});

test("the game command in development skips electron and the repo", () => {
  expect(
    gameCommand(["electron.exe", "C:\\repo", "--keeper", "x.exe"]),
  ).toEqual({ exe: "x.exe", args: [] });
});

test.each([[["exe", "--keeper"]], [["exe"]]])(
  "no game after --keeper in %j → null",
  (argv) => {
    expect(gameCommand(argv)).toBeNull();
  },
);

test("packaged, the app is the same exe with --from-steam", () => {
  expect(
    appCommand({
      execPath: "C:\\a\\x.exe",
      defaultApp: false,
      appPath: "C:\\r",
    }),
  ).toEqual({ file: "C:\\a\\x.exe", args: ["--from-steam"] });
});

test("in development, electron gets the repo before --from-steam", () => {
  expect(
    appCommand({
      execPath: "C:\\r\\electron.exe",
      defaultApp: true,
      appPath: "C:\\r",
    }),
  ).toEqual({ file: "C:\\r\\electron.exe", args: ["C:\\r", "--from-steam"] });
});

test("read.js comes from resources when packaged and from src/keeper in development", () => {
  expect(
    readJsPath({ defaultApp: false, resourcesPath: "R", repoRoot: "C" }),
  ).toBe(join("R", "read.js"));
  expect(
    readJsPath({ defaultApp: true, resourcesPath: "R", repoRoot: "C" }),
  ).toBe(join("C", "src/keeper/read.js"));
});
