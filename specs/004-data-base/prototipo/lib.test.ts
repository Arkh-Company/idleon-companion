// Disposable prototype: not product code.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";

const require = createRequire(import.meta.url);
const { pack, mergeMosaic, frameStats, roundOrder } = require("./lib.cjs");

const load = (file: string) =>
  readFileSync(join(import.meta.dirname, file), "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();

test("uma peça maior que o limite fica sozinha, e nenhuma fatia passa do limite com mais de uma peça", () => {
  const slices = pack(
    [{ bytes: 3 }, { bytes: 3 }, { bytes: 50 }, { bytes: 4 }],
    5,
  );
  expect(slices.map((s: unknown[]) => s.length)).toEqual([1, 1, 1, 1]);
  expect(pack([{ bytes: 2 }, { bytes: 3 }, { bytes: 1 }], 5).length).toBe(2);
});

test("o mosaico remonta chaves simples e filhos de um mapa", () => {
  const plan = {
    paths: [["a"], ["DNSM", "x"], ["DNSM", "y"]],
    split: { DNSM: { cls: "haxe.ds.StringMap" } },
    skipped: ["CustomLists"],
  };
  expect(mergeMosaic(plan, [1, 2, 3])).toEqual({
    ms: 0,
    nodes: 0,
    skipped: ["CustomLists"],
    attrs: { a: 1, DNSM: { $m: { x: 2, y: 3 }, $c: "haxe.ds.StringMap" } },
  });
});

test("a estatística de quadros conta o que passou de 1,5 vez a mediana", () => {
  const ev = [0, 33000, 66000, 99000, 199000].map((ts) => ({
    name: "FireAnimationFrame",
    ts,
  }));
  const tasks = [{ name: "RunTask", dur: 20000 }];
  const s = frameStats([...ev, ...tasks]);
  expect(s.frames).toBe(5);
  expect(s.p50).toBe(33);
  expect(s.perdidos).toBe(1);
  expect(s.tarefas16ms).toBe(1);
  expect(s.tarefas50ms).toBe(0);
});

test("cada leitura vem depois de uma janela sem leitura", () => {
  expect(roundOrder(0, [5, 25])).toEqual(["sem", 5, "sem", 25]);
  expect(roundOrder(1, [5, 25])).toEqual(["sem", 25, "sem", 5]);
});

function engine() {
  let calls = 0;
  const trap = new Proxy(() => undefined, {
    apply() {
      calls++;
      throw new Error("game function called");
    },
  });
  class Map1 {
    h: Record<string, unknown>;
    constructor(h: Record<string, unknown>) {
      this.h = h;
    }
  }
  (Map1.prototype as unknown as { __class__: unknown }).__class__ = {
    __name__: "haxe.ds.StringMap",
  };
  const withGetter = {};
  let getterRuns = 0;
  Object.defineProperty(withGetter, "x", {
    enumerable: true,
    get() {
      getterRuns++;
      return 1;
    },
  });
  const h = {
    Lista: [1, "a", trap],
    Mapa: new Map1({ filho: 7 }),
    Com: withGetter,
    fn: trap,
    PlayerDATABASE: new Map1({ Tester: { a: 1 } }),
    CustomLists: { x: 1 },
  };
  return {
    engine: { gameAttributes: { h }, getGameAttribute: trap },
    calls: () => calls,
    getterRuns: () => getterRuns,
  };
}

test("a fatia não chama função do jogo nem aciona getter", () => {
  const e = engine();
  const fn = runInNewContext(`(${load("fatia.js")})`, {
    performance: { now: () => 0 },
  }) as (this: unknown, p: string[][]) => { out: unknown[] };
  const r = fn.call(e.engine, [
    ["Lista"],
    ["Mapa", "filho"],
    ["Com"],
    ["Nada"],
  ]);
  expect(e.calls()).toBe(0);
  expect(e.getterRuns()).toBe(0);
  expect(r.out[1]).toBe(7);
  expect(r.out[3]).toBeNull();
});

test("a listagem separa os mapas divididos e pula as tabelas grandes", () => {
  const e = engine();
  const fn = runInNewContext(`(${load("listar.js")})`) as (this: unknown) => {
    top: string[];
    split: Record<string, { children: string[] }>;
    skipped: string[];
  };
  const r = fn.call(e.engine);
  expect(e.calls()).toBe(0);
  expect(r.skipped).toEqual(["CustomLists"]);
  expect(r.split.PlayerDATABASE?.children).toEqual(["Tester"]);
  expect(r.top).toContain("Mapa");
});
