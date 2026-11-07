// The real SteamSystem's file side, in a temp folder, and where it finds the Windows tools. No process is started.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { steamSystem, systemTool } from "./system.ts";

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
