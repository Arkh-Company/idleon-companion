// Disposable prototype: not product code.
// Grava o Drop Rate com o gravador real, tira o gabarito e mede os dois tempos separados. Tudo o que tem valor do
// personagem (gabarito, passos, medidas) vai só para a pasta de rascunho, fora do repositório.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { Expr } from "../../../src/calculator/tree/steps.ts";
import { extrair, fontesDo, relDiff } from "./gabarito.ts";
import type { Rastro } from "./gabarito.ts";
import { gravar, SCRATCH } from "./gravar.ts";

const OUT = join(SCRATCH, "proto010");

test("o gabarito do Drop Rate sai da gravação e fecha em cada pool", () => {
  const g = gravar();
  const { rec, topId } = g;
  const rastro: Rastro = {
    nodes: rec.nodes,
    topId,
    steps: g.steps,
    checks: g.checks,
    writes: rec.writes.filter((w) => w.node === topId),
  };
  const t0 = performance.now();
  const gab = extrair(rastro);
  const extracao = performance.now() - t0;

  // A corrente de pools na ordem do jogo, cada pool fechando com o valor gravado, e a corrente dando o total.
  expect(gab.pools.map((p) => p.kind)).toEqual([
    "Additive",
    "Multi",
    "Additive",
    "Multi",
  ]);
  for (const p of gab.pools) expect(p.erro).toBeLessThanOrEqual(1e-6);
  const total = gab.pools.reduce(
    (acc: number | null, p) =>
      acc === null ? p.value : p.kind === "Additive" ? acc + p.value : acc * p.value,
    null,
  );
  expect(relDiff(total ?? 0, gab.final)).toBeLessThanOrEqual(1e-6);
  expect(gab.final).toBe(rec.nodes[topId]?.v);

  // Fora do repositório: o gabarito, as medidas e os passos de cada fonte (o insumo da receita escrita à mão).
  mkdirSync(OUT, { recursive: true });
  const fontes = fontesDo(gab);
  writeFileSync(join(OUT, "gabarito-dropRate.json"), JSON.stringify(gab, null, 1));
  writeFileSync(
    join(OUT, "medidas.json"),
    JSON.stringify(
      {
        ms: { ...g.ms, extracao },
        nos: rec.nodes.length,
        passosRaiz: g.steps.length,
        checagensRaiz: g.checks.length,
        fontes: fontes.length,
        constantes: gab.pools.flatMap((p) => p.termos).filter((t) => t.kind === "constante").length,
        poluicao: gab.poluicao,
      },
      null,
      1,
    ),
  );
  const fmt = (v: unknown) => (typeof v === "number" ? String(+v.toPrecision(7)) : String(v));
  const show = (e: Expr): string => {
    switch (e.t) {
      case "num":
        return String(e.v);
      case "val":
        return `?${fmt(e.v)}`;
      case "call": {
        const n = rec.nodes[e.id];
        return n ? `${n.b}(${n.a.map((a) => JSON.stringify(a)).join(",")})#${e.id}=${fmt(e.v)}` : "?call";
      }
      case "read":
        return `R[${e.p}]=${fmt(e.v)}`;
      case "def":
        return show(e.e);
      case "op":
        return `(${show(e.l)} ${e.o} ${show(e.r)})`;
      case "fn":
        return `${e.name ?? "fn"}(${e.args.map(show).join(", ")})`;
      case "not":
        return `!${show(e.a)}`;
    }
  };
  const lines: string[] = [];
  const seen = new Set<number>();
  const dump = (id: number, depth: number) => {
    const n = rec.nodes[id];
    if (!n || seen.has(id) || depth > 2) return;
    seen.add(id);
    const pad = "  ".repeat(depth);
    const s = g.stepsOf(id);
    lines.push(`${pad}#${id} ${n.b}(${n.a.map((a) => JSON.stringify(a)).join(",")}) = ${fmt(n.v)}`);
    for (const st of s.steps.slice(-3)) lines.push(`${pad}  passo ${fmt(st.v)} = ${show(st.e)}`);
    for (const c of s.checks) lines.push(`${pad}  checa ${String(c.v)} = ${show(c.e)}`);
    for (const k of n.c.slice(0, 12)) dump(k, depth + 1);
  };
  gab.pools.forEach((p, i) => {
    lines.push(`=== pool ${String(i + 1)} ${p.kind}`);
    for (const t of p.termos) for (const id of t.nos) if (id !== null) dump(id, 0);
  });
  writeFileSync(join(OUT, "passos-das-fontes.txt"), lines.join("\n"));
}, 600_000);
