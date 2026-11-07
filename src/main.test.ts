import { expect, test } from "vitest";

test("a aplicação carrega", async () => {
  await expect(import("./main.ts")).resolves.toBeDefined();
});
