// Disposable prototype: not product code.
// O gabarito de um número: lê só a gravação já feita (os passos do bloco raiz, makeSteps) e tira dela a corrente de
// pools (onde o jogo soma e onde multiplica, na ordem), as fontes de cada pool com o valor e o valor final. Não chama
// nada do jogo. Conta cada tipo de "poluição" do rastro que precisou ignorar ou atravessar.
import type { RecNode, RecWrite } from "../../../src/calculator/recording.ts";
import type { Check, Expr, Step } from "../../../src/calculator/tree/steps.ts";

export type PoolKind = "Additive" | "Multi";

export interface Termo {
  kind: "fonte" | "constante";
  /** A referência principal: `Bloco(args)` de uma chamada ou o caminho de uma leitura; numa constante, o número. */
  ref: string;
  /** Todas as referências do termo, na ordem do código (a primeira é `ref`). */
  refs: string[];
  /** O nó gravado de cada referência (null numa leitura), para descer aos filhos. */
  nos: (number | null)[];
  /** O valor do termo como entra no pool, antes do peso. */
  value: number;
  /** O peso com que o termo entra: 1, ou 1/100 quando o jogo divide a soma inteira por 100. */
  peso: number;
  /** As variáveis de passagem atravessadas até chegar ao termo. */
  via: string[];
}

export interface Pool {
  kind: PoolKind;
  /** No primeiro pool, o valor dele; nos outros, o que ele soma (Additive) ou o fator (Multi). */
  value: number;
  /** O acumulador depois deste pool. */
  depois: number;
  termos: Termo[];
  /** Os índices dos passos da raiz que formam o pool. */
  passos: number[];
  /** Diferença relativa entre as partes e o valor gravado do pool. */
  erro: number;
}

export interface Gabarito {
  raiz: string;
  final: number;
  acumulador: string;
  pools: Pool[];
  poluicao: Record<string, number>;
}

export interface Rastro {
  nodes: readonly Pick<RecNode, "id" | "b" | "a" | "v" | "c">[];
  topId: number;
  steps: readonly Step[];
  checks: readonly Check[];
  /** As escritas feitas pelo bloco raiz, na ordem. */
  writes: readonly Pick<RecWrite, "path" | "v" | "xi">[];
}

export const relDiff = (a: number, b: number): number =>
  a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);
const near = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" && relDiff(a, b) < 1e-9;

export const callRef = (n: Pick<RecNode, "b" | "a">): string =>
  `${n.b}(${n.a.map((x) => JSON.stringify(x)).join(",")})`;

/** Um termo ainda com a expressão e a poluição dele, antes de saber se é o acumulador. */
type Bruto = Termo & { e: Expr; pol: Record<string, number> };

export function extrair(r: Rastro): Gabarito {
  const top = r.nodes[r.topId];
  if (!top) throw new Error("sem nó raiz");
  const final = top.v;
  if (typeof final !== "number") throw new Error("a raiz não deu número");
  const pol: Record<string, number> = {};
  // A contagem vai para `sink`: num termo, para um balde dele, somado só se o termo ficar (o acumulador sai).
  let sink: Record<string, number> = pol;
  const bump = (k: string, n = 1) => {
    sink[k] = (sink[k] ?? 0) + n;
  };
  const merge = (from: Record<string, number>) => {
    for (const [k, n] of Object.entries(from)) pol[k] = (pol[k] ?? 0) + n;
  };

  // 1. O acumulador: o caminho que a raiz escreveu mais vezes e cuja última escrita é o valor final.
  const byPath = new Map<string, number[]>();
  for (const w of r.writes)
    if (typeof w.v === "number")
      byPath.set(w.path, [...(byPath.get(w.path) ?? []), w.v]);
  const finals = [...byPath].filter(([, vs]) => near(vs.at(-1), final));
  finals.sort((a, b) => b[1].length - a[1].length);
  const [acc, accWrites] = finals[0] ?? [];
  if (!acc || !accWrites) throw new Error("sem acumulador");
  bump("cópia do total em outro caminho", finals.length - 1);
  bump("escrita de rascunho (DummyNumbersStatManager)", r.writes.filter((w) => w.path.startsWith("DummyNumbersStatManager.")).length);

  // 2. A corrente: cada escrita do acumulador casada, em ordem, com o passo que deu aquele valor.
  const chain: number[] = [];
  let from = 0;
  for (const w of accWrites) {
    const i = r.steps.findIndex((s, j) => j >= from && near(s.v, w));
    if (i < 0) throw new Error(`nenhum passo deu a escrita ${w} do acumulador`);
    chain.push(i);
    from = i + 1;
  }

  // 3. Variáveis de passagem: o que a raiz escreveu em outro caminho e leu de volta.
  // Os contadores de laço do rascunho (DummyNumbersStatManager) não são passagem: só sujeira do rastro.
  const passage = new Map<string, number[]>(
    [...byPath].filter(
      ([p]) =>
        p !== acc &&
        !finals.some(([q]) => q === p) &&
        !p.startsWith("DummyNumbersStatManager."),
    ),
  );
  const kids = top.c.map((c) => r.nodes[c]).filter((k) => !!k);
  const usedSteps = new Set<number>(chain);
  /** A expressão que deu o valor `v` de uma passagem: um passo da raiz, ou uma chamada filha com esse valor. */
  function passageExpr(v: number): Expr | null {
    const i = r.steps.findIndex((s) => near(s.v, v));
    if (i >= 0) {
      usedSteps.add(i);
      return r.steps[i]?.e ?? null;
    }
    const k = kids.find((n) => near(n.v, v));
    return k ? { t: "call", id: k.id, v } : null;
  }
  const passagePathOf = (v: unknown): string | null => {
    if (typeof v !== "number" || v === 0 || v === 1) return null;
    for (const [p, vs] of passage) if (vs.some((x) => near(x, v))) return p;
    return null;
  };

  /** Tira os embrulhos: o `def` (a expressão que deu a variável) e a passagem lida de volta. */
  function unwrap(e: Expr, via: string[]): Expr {
    for (;;) {
      if (e.t === "def") {
        bump("atalho de variável (def)");
        e = e.e;
        continue;
      }
      if (e.t === "fn" && e.name === null && e.args.length === 1 && e.args[0]) {
        bump("embrulho sem nome (fn de 1 argumento)");
        e = e.args[0];
        continue;
      }
      if (e.t === "read" || e.t === "val") {
        // Uma leitura só é passagem pelo caminho; um valor sem nome, pelo valor que a raiz escreveu.
        const p =
          e.t === "read" ? (passage.has(e.p) ? e.p : null) : passagePathOf(e.v);
        if (p && typeof e.v === "number") {
          const x = passageExpr(e.v);
          if (x) {
            bump(
              e.t === "val"
                ? "variável de passagem sem nome (val casado por valor)"
                : "variável de passagem lida (read)",
            );
            via.push(p);
            e = x;
            continue;
          }
        }
      }
      return e;
    }
  }

  function refsOf(e: Expr, via: string[], out: string[], nos: (number | null)[]): void {
    const u = unwrap(e, via);
    switch (u.t) {
      case "call": {
        const n = r.nodes[u.id];
        if (n) {
          out.push(callRef(n));
          nos.push(n.id);
        }
        return;
      }
      case "read":
        if (u.p.startsWith("DNSM.") && u.p !== acc) bump("cache DNSM lido como fonte");
        out.push(u.p);
        nos.push(null);
        return;
      case "val":
        bump("valor sem fonte (val)");
        return;
      case "op":
        refsOf(u.l, via, out, nos);
        refsOf(u.r, via, out, nos);
        return;
      case "fn":
        for (const a of u.args) refsOf(a, via, out, nos);
        return;
      case "not":
        refsOf(u.a, via, out, nos);
        return;
      default:
        return;
    }
  }

  /** Abre a expressão pela operação do pool (+ ou *), atravessando passagens e o "/ 100" de uma soma inteira. */
  function flat(e: Expr, op: "+" | "*", peso: number, out: Bruto[], via: string[]): void {
    const v0 = [...via];
    const u = unwrap(e, v0);
    if (u.t === "op" && u.o === op) {
      flat(u.l, op, peso, out, v0);
      flat(u.r, op, peso, out, v0);
      return;
    }
    if (op === "+" && u.t === "op" && u.o === "-") {
      flat(u.l, op, peso, out, v0);
      flat(u.r, op, -peso, out, v0);
      return;
    }
    if (op === "+" && u.t === "op" && u.o === "/" && u.r.t === "num" && typeof u.r.v === "number") {
      const inner = unwrap(u.l, [...v0]);
      if (inner.t === "op" && inner.o === "+") {
        bump("divisão da soma inteira (/ 100) atravessada");
        flat(u.l, op, peso / u.r.v, out, v0);
        return;
      }
    }
    if (typeof u.v !== "number") throw new Error("termo sem número");
    if (u.t === "num") {
      out.push({ kind: "constante", ref: String(u.v), refs: [], nos: [], value: u.v, peso, via: v0, e: u, pol: {} });
      return;
    }
    const refs: string[] = [];
    const nos: (number | null)[] = [];
    const tv = [...v0];
    const saved = sink;
    const local: Record<string, number> = {};
    sink = local;
    refsOf(u, tv, refs, nos);
    const [ref] = refs;
    if (!ref) bump("termo sem referência");
    sink = saved;
    if (!ref) {
      out.push({ kind: "constante", ref: String(u.v), refs: [], nos: [], value: u.v, peso, via: tv, e: u, pol: local });
      return;
    }
    out.push({ kind: "fonte", ref, refs, nos, value: u.v, peso, via: tv, e: u, pol: local });
  }

  // 4. Cada passo da corrente vira um pool: o primeiro pela operação de cima, os outros pela operação com o acumulador.
  const raw: { kind: PoolKind; termos: Termo[]; passo: number; antes: number; depois: number }[] = [];
  let prev: number | null = null;
  for (const i of chain) {
    const s = r.steps[i];
    if (!s) continue;
    const u = unwrap(s.e, []);
    if (u.t !== "op" || (u.o !== "+" && u.o !== "*")) throw new Error(`passo ${i} não soma nem multiplica`);
    const op = u.o;
    const termos: Bruto[] = [];
    flat(s.e, op, 1, termos, []);
    if (prev !== null) {
      const pv = prev;
      const k = termos.findIndex(
        (t) => near(t.value, pv) && (t.e.t === "val" || t.e.t === "read" || t.e.t === "def"),
      );
      if (k < 0) throw new Error(`passo ${i}: acumulador não achado`);
      const accTerm = termos[k];
      bump(accTerm?.e.t === "read" ? "acumulador lido (read)" : "acumulador sem nome (val)");
      termos.splice(k, 1);
    }
    for (const t of termos) {
      merge(t.pol);
      if (t.kind === "constante") bump("constante solta no pool");
    }
    // Um passo que só soma ou multiplica uma constante veio de um `cond && (...)` que o rastro não guarda como checagem.
    if (prev !== null && termos.every((t) => t.kind === "constante"))
      bump("passo condicionado sem a condição no rastro");
    raw.push({
      kind: op === "+" ? "Additive" : "Multi",
      termos: termos.map(({ e: _e, pol: _p, ...t }) => t),
      passo: i,
      antes: prev ?? (op === "+" ? 0 : 1),
      depois: s.v,
    });
    prev = s.v;
  }

  // 5. Passos seguidos do mesmo tipo são um pool só.
  const pools: Pool[] = [];
  for (const p of raw) {
    const last = pools.at(-1);
    if (last && last.kind === p.kind) {
      last.termos.push(...p.termos);
      last.passos.push(p.passo);
      last.depois = p.depois;
    } else
      pools.push({ kind: p.kind, value: 0, depois: p.depois, termos: [...p.termos], passos: [p.passo], erro: 0 });
  }
  let antes: number | null = null;
  for (const p of pools) {
    p.value =
      p.kind === "Additive"
        ? p.depois - (antes ?? 0)
        : p.depois / (antes ?? 1);
    const partes =
      p.kind === "Additive"
        ? p.termos.reduce((s, t) => s + t.value * t.peso, 0)
        : p.termos.reduce((s, t) => s * t.value, 1);
    p.erro = relDiff(partes, p.value);
    antes = p.depois;
  }

  bump("passo fora da corrente (preâmbulo do bloco)", r.steps.length - usedSteps.size);
  const touches = [acc, ...passage.keys()];
  const own = r.checks.filter((c) => {
    const j = JSON.stringify(c.e);
    return touches.some((p) => j.includes(JSON.stringify(p)));
  }).length;
  bump("checagem de ramo da conta (lida, sem efeito no valor)", own);
  bump("checagem do preâmbulo do bloco (outro ramo)", r.checks.length - own);
  bump("passos repetidos do acumulador juntados num pool", raw.length - pools.length);
  return { raiz: callRef(top), final, acumulador: acc, pools, poluicao: pol };
}

/** As fontes de um gabarito na ordem, com a chave que a trava usa: pool, referência e ocorrência. */
export function fontesDo(g: Gabarito): { pool: number; ref: string; n: number; value: number }[] {
  const out: { pool: number; ref: string; n: number; value: number }[] = [];
  g.pools.forEach((p, i) => {
    const seen = new Map<string, number>();
    for (const t of p.termos) {
      if (t.kind !== "fonte") continue;
      const n = (seen.get(t.ref) ?? 0) + 1;
      seen.set(t.ref, n);
      out.push({ pool: i, ref: t.ref, n, value: t.value });
    }
  });
  return out;
}
