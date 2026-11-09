// Disposable prototype: not product code.
// Contas puras do protótipo, sem jogo e sem arquivo.
"use strict";

/** Empacota as peças em fatias de até `maxBytes`. Uma peça maior que o limite fica sozinha. */
function pack(pieces, maxBytes) {
  const slices = [];
  let cur = [], size = 0;
  for (const p of pieces) {
    if (cur.length && size + p.bytes > maxBytes) { slices.push(cur); cur = []; size = 0; }
    cur.push(p);
    size += p.bytes;
  }
  if (cur.length) slices.push(cur);
  return slices;
}

/** Remonta o retrato no formato do retrato inteiro, a partir dos valores das peças. */
function mergeMosaic(plan, values) {
  const attrs = {};
  for (const [i, path] of plan.paths.entries()) {
    const v = values[i];
    if (path.length === 1) { attrs[path[0]] = v; continue; }
    const [parent, child] = path;
    attrs[parent] ??= { $m: {}, $c: plan.split[parent].cls };
    attrs[parent].$m[child] = v;
  }
  return { ms: 0, nodes: 0, skipped: plan.skipped, attrs };
}

const pct = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null);

/** Intervalos entre quadros e tarefas longas de uma janela, a partir dos eventos do trace (ts e dur em microssegundos). */
function frameStats(events) {
  const ticks = events.filter((e) => e.name === "FireAnimationFrame" && e.ph !== "E").map((e) => e.ts).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < ticks.length; i++) gaps.push((ticks[i] - ticks[i - 1]) / 1000);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = pct(sorted, 0.5);
  const tasks = events.filter((e) => e.name === "ThreadControllerImpl::RunTask" || e.name === "RunTask").map((e) => (e.dur || 0) / 1000);
  return {
    frames: ticks.length,
    p50: median, p95: pct(sorted, 0.95), p99: pct(sorted, 0.99), max: sorted.at(-1) ?? null,
    perdidos: median === null ? null : gaps.filter((g) => g > median * 1.5).length,
    tarefas8ms: tasks.filter((d) => d >= 8).length,
    tarefas16ms: tasks.filter((d) => d >= 16.7).length,
    tarefas50ms: tasks.filter((d) => d >= 50).length,
  };
}

/** Condições de uma rodada, com um "sem leitura" antes de cada leitura. */
function roundOrder(round, conditions) {
  const r = round % conditions.length;
  return [...conditions.slice(r), ...conditions.slice(0, r)].flatMap((c) => ["sem", c]);
}

module.exports = { pack, mergeMosaic, frameStats, roundOrder, pct };
