// The real SteamSystem's file side, in a temp folder, and where it finds the Windows tools. No process is started.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { steamSystem, systemTool } from "./system.ts";

// No Windows tool runs in these tests: the promisified execFile answers with an empty output.
const { execFile } = vi.hoisted(() => ({
  execFile: vi.fn(
    (
      _file: string,
      _args: string[],
      _options: unknown,
      done: (e: null, out: { stdout: string }) => void,
    ) => {
      done(null, { stdout: "" });
    },
  ),
}));
vi.mock("node:child_process", () => ({ execFile, spawn: vi.fn() }));

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "steam-system-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("reg.exe and tasklist.exe come from System32 by full path, never by name alone", () => {
  expect(systemTool("reg", "D:\\WinNT")).toBe("D:\\WinNT\\System32\\reg.exe");
  expect(systemTool("tasklist", undefined)).toBe(
    "C:\\Windows\\System32\\tasklist.exe",
  );
});

test("a Windows tool shows no window and is stopped after 10 s", async () => {
  await steamSystem.isRunning("steam.exe");
  expect(execFile.mock.calls[0]?.[2]).toEqual({
    windowsHide: true,
    timeout: 10_000,
  });
});

test("readFile gives the bytes, or undefined for a missing file", async () => {
  const d = tempDir();
  const f = join(d, "a.vdf");
  writeFileSync(f, Buffer.from([0x22, 0xff]));
  expect(await steamSystem.readFile(f)).toEqual(Buffer.from([0x22, 0xff]));
  expect(await steamSystem.readFile(join(d, "none.vdf"))).toBeUndefined();
});

test("writeFileAtomic replaces the file through .tmp and leaves no .tmp", async () => {
  const d = tempDir();
  const f = join(d, "localconfig.vdf");
  writeFileSync(f, "old");
  await steamSystem.writeFileAtomic(f, "new é");
  expect(readFileSync(f, "utf8")).toBe("new é");
  expect(() => readFileSync(`${f}.tmp`)).toThrow();
});

test("copyFile makes the folder and never overwrites a copy", async () => {
  const d = tempDir();
  const from = join(d, "localconfig.vdf");
  const to = join(d, "steam-backup", "102-localconfig.vdf");
  writeFileSync(from, "first");
  await steamSystem.copyFile(from, to);
  writeFileSync(from, "second");
  await expect(steamSystem.copyFile(from, to)).rejects.toThrow();
  expect(readFileSync(to, "utf8")).toBe("first");
});
