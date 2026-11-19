// settings.json on Windows: another process holding the file makes the rename of `.tmp` over it fail (EPERM, EBUSY),
// and no caller of a save catches it (the zoom's callback, the IPC handlers). The rename fails here on purpose.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { loadView, saveView } from "./settings.ts";

const fails = vi.hoisted(() => ({ left: 0 }));
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return {
    ...fs,
    renameSync: (from: string, to: string) => {
      if (fails.left > 0) {
        fails.left--;
        throw Object.assign(new Error("EPERM: operation not permitted"), {
          code: "EPERM",
        });
      }
      fs.renameSync(from, to);
    },
  };
});
afterEach(() => {
  fails.left = 0;
});

function fileWith(content: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "settings-")), "settings.json");
  writeFileSync(file, content);
  return file;
}

test("a rename that fails once is tried again", () => {
  const file = fileWith('{"changes":false,"share":false}');
  fails.left = 1;
  saveView(file, { changes: true, share: true });
  expect(loadView(file)).toEqual({ changes: true, share: true });
  expect(existsSync(`${file}.tmp`)).toBe(false);
});

test("a rename that keeps failing writes the file directly, removes .tmp and throws nothing", () => {
  const file = fileWith('{"changes":false,"share":false}');
  fails.left = 100;
  expect(() => {
    saveView(file, { changes: true, share: false });
  }).not.toThrow();
  expect(JSON.parse(readFileSync(file, "utf8"))).toMatchObject({
    changes: true,
    share: false,
  });
  expect(existsSync(`${file}.tmp`)).toBe(false);
});
