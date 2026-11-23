// The guide of a draft (spec 010, research R7, contracts/real-trees-run.md): the recorded steps of each source of a
// number, for the agent who writes its blueprint. For each source, its block, what it reads and what it calls, down to
// the leaves the draft opens; the class of a talent source; the name with its proof, or that it is pending. Paths carry
// `{character}` and `*`, never a character's index. It carries the recorded count and values, so it goes only to
// TREES_OUT (`stepsPath`), never to the repository.
import type { Op } from "../instrument.ts";
import type { Recording } from "../recording.ts";
import { GAME_TABLE, makeSteps } from "../recorded/steps.ts";
import type { Expr } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import type { AnswerKey } from "./answer-key.ts";
import {
  marked,
  NO_CONTEXT,
  partName,
  sourceClass,
  walkTerm,
} from "./draft.ts";
import type { DraftContext, Walked } from "./draft.ts";
import type { LevelContext } from "./lock-levels.ts";
import { notLeafOf } from "./not-leaves.ts";

const fmt = (v: unknown): string =>
  typeof v === "number" ? String(+v.toPrecision(10)) : String(v);

export function stepsGuide(
  key: AnswerKey,
  rec: Recording,
  ops: readonly Op[],
  dc: DraftContext = NO_CONTEXT,
): string {
  const made = makeSteps(rec, ops);
  const ctx: LevelContext = {
    rec,
    stepsOf: (n) => made.of(n),
    character: dc.character,
    where: key.root,
  };
  const m = (s: string) => marked(s, dc.character);
  const text = (e: Expr): string => {
    switch (e.t) {
      case "num":
        return String(e.v);
      case "val":
        return `«${fmt(e.v)} sem fonte»`;
      case "call": {
        const n = rec.nodes[e.id];
        return n ? m(callRef(n)) : "?";
      }
      case "read":
        return m(e.p);
      case "def":
        return text(e.e);
      case "op":
        return `(${text(e.l)} ${e.o} ${text(e.r)})`;
      case "fn":
        return `${e.name ?? "fn"}(${e.args.map(text).join(", ")})`;
      case "not":
        return `!${text(e.a)}`;
    }
  };
  const lines = [
    `raiz ${m(key.root)} = ${fmt(key.final)} (forma ${key.form}; camadas de topo: ${String(key.top.length)}; divisores: ${String(key.divisors.length)})`,
  ];

  const part = (w: Walked, depth: number): void => {
    const pad = "  ".repeat(depth);
    const named = partName(w, dc.character);
    lines.push(
      [
        `${pad}${m(w.key)}${w.call ? ` = ${fmt(w.call.v)}` : ""}`,
        named
          ? `nome: ${named.name} (prova: names ${named.nameProof.names})`
          : "nome: pendente",
        ...(w.termPart ? ["segunda fonte do termo: sistema pendente"] : []),
      ].join("  |  "),
    );
    if (w.call) {
      w.call.a.forEach((a, i) => {
        if (a === dc.character)
          lines.push(
            `${pad}  argumento ${String(i + 1)} = ${fmt(a)}: o índice do personagem? se for, a receita escreve "{character}"`,
          );
      });
      for (const s of ctx.stepsOf(w.call.id).steps)
        lines.push(`${pad}  passo: ${text(s.e)} = ${fmt(s.v)}`);
      for (const [p, v] of w.call.r ?? []) {
        const table = GAME_TABLE.some((t) => t.test.test(p));
        const role = notLeafOf(p, dc.character)?.role;
        lines.push(
          `${pad}  lê ${m(p)} = ${fmt(v)}${table ? " (tabela do jogo)" : ""}${role ? ` (não é linha: ${role})` : ""}`,
        );
      }
      for (const id of w.call.c) {
        const k = rec.nodes[id];
        const role = k ? notLeafOf(callRef(k), dc.character)?.role : undefined;
        if (k)
          lines.push(
            `${pad}  chama ${m(callRef(k))} = ${fmt(k.v)}${role ? ` (não é linha: ${role})` : ""}`,
          );
      }
    }
    if (Array.isArray(w.below)) for (const c of w.below) part(c, depth + 1);
    else
      lines.push(
        `${pad}  ${w.below === "leaf" ? "folha: tipo pendente" : "descer: pendente (a gravação lê o save embaixo)"}`,
      );
  };

  key.pools.forEach((p, i) => {
    lines.push(
      "",
      `pool ${String(i + 1)} ${p.kind === "additive" ? "Additive" : "Multi"} = ${fmt(p.value)}`,
    );
    p.terms.forEach((t, j) => {
      const head = `  ${String(j + 1)}. ${t.kind === "constant" ? `constante ${t.ref}` : "fonte"} (peso ${fmt(t.weight)}) = ${fmt(t.value)}`;
      const c = sourceClass(rec.nodes[t.nodes[0] ?? -1], dc.talentOrder);
      lines.push(c === null ? head : `${head}  |  classe (aba): ${String(c)}`);
      if (t.kind === "source") part(walkTerm(t, ctx), 2);
    });
  });
  return `${lines.join("\n")}\n`;
}
