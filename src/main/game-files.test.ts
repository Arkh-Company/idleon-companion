// The game's two files, read from the installation the keeper launched (research R6). Every byte here is invented.
import { join } from "node:path";
import { expect, test } from "vitest";
import { readGameFiles } from "./game-files.ts";

const RESOURCES = join("game", "resources");
const GAME = ["distBuild", "static", "game"];
const asarCode = join(RESOURCES, "app.asar", ...GAME, "N.js");
const asarPak = join(RESOURCES, "app.asar", ...GAME, "lib", "default.pak");
const appCode = join(RESOURCES, "app", ...GAME, "N.js");
const appPak = join(RESOURCES, "app", ...GAME, "lib", "default.pak");

function disk(files: Record<string, number[]>) {
  return (path: string): Promise<Uint8Array> => {
    const bytes = files[path];
    return bytes
      ? Promise.resolve(Uint8Array.from(bytes))
      : Promise.reject(new Error("missing"));
  };
}

test("the files inside app.asar come first", async () => {
  const read = disk({
    [asarCode]: [1, 2],
    [asarPak]: [3],
    [appCode]: [8],
    [appPak]: [9],
  });
  const { code, pak } = await readGameFiles(RESOURCES, read);
  expect([...code]).toEqual([1, 2]);
  expect([...pak]).toEqual([3]);
});

test("without the asar, the unpacked app folder is read", async () => {
  const read = disk({ [appCode]: [4], [appPak]: [5, 6] });
  const { code, pak } = await readGameFiles(RESOURCES, read);
  expect([...code]).toEqual([4]);
  expect([...pak]).toEqual([5, 6]);
});

test("the two files never come from different places", async () => {
  const read = disk({ [asarCode]: [1], [appCode]: [4], [appPak]: [5] });
  const { code, pak } = await readGameFiles(RESOURCES, read);
  expect([...code]).toEqual([4]);
  expect([...pak]).toEqual([5]);
});

test("a missing file rejects", async () => {
  await expect(
    readGameFiles(RESOURCES, disk({ [asarCode]: [1], [appCode]: [4] })),
  ).rejects.toThrow();
});

test("a Buffer from the shared pool comes back as a Uint8Array that owns its memory, so it can be transferred", async () => {
  const pooled = () => Promise.resolve(Buffer.from([7, 8, 9]));
  const { code, pak } = await readGameFiles(RESOURCES, pooled);
  for (const bytes of [code, pak]) {
    expect(Object.getPrototypeOf(bytes)).toBe(Uint8Array.prototype);
    expect(bytes.buffer.byteLength).toBe(3);
    expect([...bytes]).toEqual([7, 8, 9]);
  }
});
