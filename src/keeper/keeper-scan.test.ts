// The scan of the game's text in the keeper's flow, with a fake game and reader over a real local pipe (runs on the CI).
// All the "game code" here is made up (FR-015).
import { mkdtempSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { createLineDecoder, READ_NULLS } from "../shared/index.ts";
import type {
  GameTables,
  LinkMessage,
  Reading,
  Status,
} from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { readGameTables } from "./game-tables.ts";
import type * as GameTablesModule from "./game-tables.ts";
import { runKeeper } from "./keeper.ts";
import type { KeeperDeps } from "./keeper.ts";

vi.mock("./game-tables.ts", async (original) => ({
  ...(await original<typeof GameTablesModule>()),
  readGameTables: vi.fn(),
}));
const { readGameTables: realRead } =
  await vi.importActual<typeof GameTablesModule>("./game-tables.ts");

let n = 0;
function pipePath(): string {
  const name = `idleon-companion-test-${String(process.pid)}-scan-${String(n++)}`;
  return process.platform === "win32"
    ? `\\\\.\\pipe\\${name}`
    : join(tmpdir(), `${name}.sock`);
}

const cleanups: (() => unknown)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !ok(); i++) await sleep(20);
}

const MAPS =
  'x.MapName=function(){return"a b".split(" ")},x.MapDispName=function(){return"Vale Peak".split(" ")};';
const MONSTER = 'G.addNewMonster("a1",{Name:"Beast"});';
const TABLES: GameTables = {
  maps: ["Vale", "Peak"],
  monsters: { a1: "Beast" },
};
const NO_TABLES: GameTables = { maps: null, monsters: null };

/** A running keeper whose game and reader are fakes; `extract` stands for the scan, which `order` records. */
async function keeper(
  gameCode: () => string | undefined,
  extract: (code: string) => GameTables = realRead,
) {
  let exit: () => void = () => undefined;
  const exited = new Promise<void>((r) => (exit = r));
  const order: string[] = [];
  const logs: Record<string, unknown>[] = [];
  const reader: {
    onReading?: (r: Reading) => void;
    onStatus?: (s: Status) => void;
  } = {};
  vi.mocked(readGameTables).mockImplementation((code) => {
    order.push("scan");
    return extract(code);
  });
  const deps: KeeperDeps = {
    pipePath: pipePath(),
    hashPath: join(
      mkdtempSync(join(tmpdir(), "idleon-keeper-")),
      "game-hash.json",
    ),
    makeDataDir: () => undefined,
    gameCode,
    launch: (debugPipe) => {
      order.push(debugPipe ? "launch" : "launch-no-pipe");
      return { pid: 42, cdp: debugPipe ? ({} as Cdp) : undefined, exited };
    },
    read: (_cdp, onReading, onStatus) => {
      order.push("read");
      reader.onReading = onReading;
      reader.onStatus = onStatus;
      return { stop: () => Promise.resolve() };
    },
    startApp: () => order.push("app"),
    log: (label, data) => logs.push({ label, ...data }),
  };
  const run = runKeeper(deps);
  cleanups.push(() => (exit(), run));
  await until(() => order.includes("app"));
  return { deps, order, logs, reader, run, exit };
}

/** An app on the link: every message it got, in order. */
async function app(path: string, wanted: number) {
  const got: LinkMessage[] = [];
  const s = connect(path);
  s.on("error", () => undefined);
  s.on(
    "data",
    createLineDecoder((m) => got.push(m)),
  );
  cleanups.push(() => s.destroy());
  await until(() => got.length >= wanted);
  return got;
}

const reading: Reading = {
  t: 1,
  map: 264,
  menu: 3,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: "Tester",
  afk: null,
  codexTab: 2,
  ...READ_NULLS,
};

test("the tables are read only after startApp was called, and reach the app", async () => {
  const h = await keeper(() => MAPS + MONSTER);
  expect(h.order).toEqual(["launch", "read", "app", "scan"]);
  expect(await app(h.deps.pipePath, 1)).toEqual([
    { type: "tables", tables: TABLES },
  ]);
  expect(h.logs.map((l) => l.label)).not.toContain("game-tables-unreadable");
});

test("no game code publishes both tables as null and runs no scan", async () => {
  const h = await keeper(() => undefined);
  expect(await app(h.deps.pipePath, 1)).toEqual([
    { type: "tables", tables: NO_TABLES },
  ]);
  expect(h.order).not.toContain("scan");
  expect(h.logs).toContainEqual({
    label: "game-tables-unreadable",
    id: 42,
    maps: false,
    monsters: false,
  });
});

test.each([
  ["maps", MONSTER, { maps: false, monsters: true }],
  ["monsters", MAPS, { maps: true, monsters: false }],
])(
  "unreadable %s are logged with one boolean per table",
  async (_name, code, flags) => {
    const h = await keeper(() => code);
    expect(h.logs).toContainEqual({
      label: "game-tables-unreadable",
      id: 42,
      ...flags,
    });
  },
);

test("a scan that throws is logged, publishes no names, and the keeper still ends only after the game", async () => {
  const h = await keeper(
    () => MAPS,
    () => {
      throw new Error("boom");
    },
  );
  let ended = false;
  void h.run.then(() => (ended = true));
  expect(h.logs).toContainEqual({
    label: "game-scan-failed",
    id: 42,
    error: "Error: boom",
  });
  expect(await app(h.deps.pipePath, 1)).toEqual([
    { type: "tables", tables: NO_TABLES },
  ]);
  expect(ended).toBe(false);
  h.exit();
  await h.run;
  expect(ended).toBe(true);
});

test("a new client gets the tables first, then the status, then the reading", async () => {
  const h = await keeper(() => MAPS + MONSTER);
  const status: Status = { game: "running", reader: "attached" };
  h.reader.onStatus?.(status);
  h.reader.onReading?.(reading);
  expect(await app(h.deps.pipePath, 3)).toEqual([
    { type: "tables", tables: TABLES },
    { type: "status", status },
    { type: "reading", reading },
  ]);
});
