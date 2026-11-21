// Disposable prototype: not product code.
// A trava contra o gabarito real do Drop Rate: a receita escrita à mão passa; sem uma fonte ela reprova dizendo qual
// falta; com dois pools trocados ela reprova dizendo a ordem esperada. O resultado vai só para a pasta de rascunho.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { extrair } from "./gabarito.ts";
import type { Gabarito } from "./gabarito.ts";
import { gravar, SCRATCH } from "./gravar.ts";
import type { Gravado } from "./gravar.ts";
import { travar } from "./trava.ts";
import type { Receita, Resultado } from "./trava.ts";

const OUT = join(SCRATCH, "proto010");
const receita = (): Receita =>
  JSON.parse(
    readFileSync(new URL("./receita-dropRate.json", import.meta.url), "utf8"),
  ) as Receita;

let g: Gravado;
let gab: Gabarito;
const resultados: Record<string, Resultado & { ms: number }> = {};
const rodar = (nome: string, r: Receita) => {
  const t0 = performance.now();
  const res = travar(r, gab, g.rec.nodes, g.topId, (id) => g.stepsOf(id).steps);
  resultados[nome] = { ...res, ms: performance.now() - t0 };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "trava.json"), JSON.stringify(resultados, null, 1));
  return res;
};

beforeAll(() => {
  g = gravar();
  gab = extrair({
    nodes: g.rec.nodes,
    topId: g.topId,
    steps: g.steps,
    checks: g.checks,
    writes: g.rec.writes.filter((w) => w.node === g.topId),
  });
}, 600_000);

test("a receita escrita à mão passa na trava", () => {
  const res = rodar("correta", receita());
  expect(res.erros).toEqual([]);
  expect(res.ok).toBe(true);
});

test("sem uma fonte, a trava reprova e diz qual fonte falta", () => {
  const r = receita();
  const pool = r.pools[0];
  const grupo = pool?.grupos.find((x) => x.sistema === "Summoning");
  if (!grupo) throw new Error("a receita não tem o grupo Summoning");
  grupo.fontes = grupo.fontes.filter((f) => f.ref !== 'Summoning("WinBonus",9,0)');
  const res = rodar("sem-uma-fonte", r);
  expect(res.ok).toBe(false);
  expect(res.erros).toContainEqual(
    expect.stringContaining('fonte que falta: Summoning("WinBonus",9,0) (pool 1 Additive'),
  );
});

test("com dois pools trocados, a trava reprova e diz a ordem esperada", () => {
  const r = receita();
  const [a, b, ...resto] = r.pools;
  if (!a || !b) throw new Error("a receita tem menos de dois pools");
  r.pools = [b, a, ...resto];
  const res = rodar("pools-trocados", r);
  expect(res.ok).toBe(false);
  expect(res.erros).toContainEqual(
    expect.stringContaining(
      "a ordem esperada é Additive → Multi → Additive → Multi; a receita tem Multi → Additive → Additive → Multi",
    ),
  );
});
