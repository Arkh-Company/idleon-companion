// Disposable prototype: not product code.
// A trava (FR-010): confere uma receita escrita à mão contra o gabarito da gravação. Reprova com o motivo: a ordem
// esperada dos pools, a fonte que falta ou o nível que não fecha, com os dois valores. Os valores nunca vêm da
// receita: as fontes pegam o valor do gabarito e os filhos o valor da gravação (o nó da chamada ou a leitura).
import type { RecNode } from "../../../src/calculator/recording.ts";
import type { Expr, Step } from "../../../src/calculator/tree/steps.ts";
import { callRef, relDiff } from "./gabarito.ts";
import type { Gabarito, PoolKind } from "./gabarito.ts";

export const TOLERANCIA = 1e-6;

export const TIPOS_DE_FOLHA = [
  "Level",
  "Quantidade",
  "Valor fixo",
  "Bônus cru",
  "Condição",
  "Escolha",
  "Tier",
  "Recorde",
  "Pontos investidos",
] as const;

export interface NoReceita {
  /** O nome tirado do texto do jogo. */
  nome: string;
  /** `Bloco(args)` ou o caminho lido; o que liga o nó à gravação. */
  ref?: string;
  /** Onde está no código: bloco e modo, ou tabela e linha. */
  codigo?: string;
  /** Nome curto do nó dentro da fórmula do pai. */
  id?: string;
  /**
   * Opcional, só para medir: como os filhos dão o valor (+ - * / < > e min max pow floor ceil round log10 se). Fica FORA
   * da receita do repositório, porque transcreve a conta do N.js; sem ela, o nível confere a cobertura (abaixo).
   */
  formula?: string;
  filhos?: NoReceita[];
  folha?: string;
  a_descer?: boolean;
  /** O que liga ou desliga o nó sem entrar na conta (a condição de um `cond && (...)`, o degrau que escolhe a linha). */
  condicao?: NoReceita;
}

export interface FonteReceita extends NoReceita {
  /** O peso com que entra no pool Additive (padrão: o do pool). */
  peso?: number;
  /** Uma constante do código no pool, com o valor dela (Valor fixo); não tem ref. */
  constante?: number;
  /** A classe que tem essa fonte (FR-002a); fonte de outra classe pode faltar no gabarito. */
  classe?: string;
}

export interface GrupoReceita {
  sistema: string;
  emoji: string;
  fontes: FonteReceita[];
}

export interface PoolReceita {
  kind: PoolKind;
  /** O peso padrão das fontes de um pool Additive: 0.01 quando o jogo soma em % e divide a soma por 100. */
  peso?: number;
  codigo?: string;
  grupos: GrupoReceita[];
}

export interface Receita {
  numero: string;
  raiz: { nome: string; ref: string; codigo: string };
  pools: PoolReceita[];
}

export interface Resultado {
  ok: boolean;
  erros: string[];
  /** Quantos níveis fecharam com o valor gravado (raiz, pools e, quando há fórmula, fontes e filhos). */
  niveisConferidos: number;
  /** Quantos nós com filhos tiveram os filhos achados nas partes gravadas do pai (cobertura). */
  niveisCobertos: number;
  folhas: number;
  aDescer: number;
  /** Partes que o jogo usou num nó aberto e a receita não declara (chamadas de curva, contexto, leituras auxiliares). */
  naoDeclaradas: string[];
}

type Nos = readonly Pick<RecNode, "id" | "b" | "a" | "v" | "c" | "r">[];

const num = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

/** O valor de uma referência na gravação: o próprio nó, um filho dele, uma leitura dele; depois os descendentes. */
export function resolver(nodes: Nos, ref: string, ctx: readonly number[]): { v: number; no: number | null } | null {
  for (const id of ctx) {
    const n = nodes[id];
    if (!n) continue;
    if (callRef(n) === ref) {
      const v = num(n.v);
      if (v !== null) return { v, no: n.id };
    }
    for (const c of n.c) {
      const k = nodes[c];
      if (k && callRef(k) === ref) {
        const v = num(k.v);
        if (v !== null) return { v, no: k.id };
      }
    }
    const rd = (n.r ?? []).find((x) => x[0] === ref);
    if (rd) {
      const v = num(rd[1]);
      if (v !== null) return { v, no: null };
    }
  }
  // Mais fundo, até 4 níveis abaixo do primeiro contexto.
  let frontier = ctx.slice(0, 1);
  for (let d = 0; d < 4; d++) {
    const next: number[] = [];
    for (const id of frontier)
      for (const c of nodes[id]?.c ?? []) {
        const k = nodes[c];
        if (!k) continue;
        if (callRef(k) === ref && num(k.v) !== null) return { v: num(k.v) ?? 0, no: k.id };
        const rd = (k.r ?? []).find((x) => x[0] === ref);
        if (rd && num(rd[1]) !== null) return { v: num(rd[1]) ?? 0, no: null };
        next.push(k.id);
      }
    frontier = next;
  }
  return null;
}

/** Um avaliador pequeno de fórmula (sem eval): números, nomes, + - * / < >, parênteses e as funções da lista. */
export function avaliar(formula: string, vars: Readonly<Record<string, number>>): number {
  const toks = formula.match(/\d+(?:\.\d+)?(?:e[+-]?\d+)?|[A-Za-z_]\w*|[-+*/(),<>]/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const take = (t?: string) => {
    const x = toks[i++];
    if (t !== undefined && x !== t) throw new Error(`fórmula "${formula}": esperava ${t}, veio ${String(x)}`);
    return x ?? "";
  };
  const FNS: Record<string, (...a: number[]) => number> = {
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    log10: Math.log10,
    se: (c, a, b) => (c ? (a ?? 0) : (b ?? 0)),
  };
  function cmp(): number {
    let l = add();
    while (peek() === "<" || peek() === ">") {
      const o = take();
      const r = add();
      l = (o === "<" ? l < r : l > r) ? 1 : 0;
    }
    return l;
  }
  function add(): number {
    let l = mul();
    while (peek() === "+" || peek() === "-") l = take() === "+" ? l + mul() : l - mul();
    return l;
  }
  function mul(): number {
    let l = un();
    while (peek() === "*" || peek() === "/") l = take() === "*" ? l * un() : l / un();
    return l;
  }
  function un(): number {
    if (peek() === "-") {
      take();
      return -un();
    }
    return atom();
  }
  function atom(): number {
    const t = take();
    if (t === "(") {
      const v = cmp();
      take(")");
      return v;
    }
    if (/^\d/.test(t)) return Number(t);
    const fn = FNS[t];
    if (fn && peek() === "(") {
      take("(");
      const args = [cmp()];
      while (peek() === ",") {
        take(",");
        args.push(cmp());
      }
      take(")");
      return fn(...args);
    }
    const v = vars[t];
    if (v === undefined) throw new Error(`fórmula "${formula}": nome sem filho: ${t}`);
    return v;
  }
  const v = cmp();
  if (i !== toks.length) throw new Error(`fórmula "${formula}": sobrou ${toks.slice(i).join(" ")}`);
  return v;
}

const fmt = (v: number) => String(+v.toPrecision(10));

/** As referências de uma expressão gravada (chamadas e leituras), na ordem. */
function refsDe(e: Expr, nodes: Nos, out: Set<string>): void {
  switch (e.t) {
    case "call": {
      const n = nodes[e.id];
      if (n) out.add(callRef(n));
      return;
    }
    case "read":
      out.add(e.p);
      return;
    case "def":
      refsDe(e.e, nodes, out);
      return;
    case "op":
      refsDe(e.l, nodes, out);
      refsDe(e.r, nodes, out);
      return;
    case "fn":
      for (const a of e.args) refsDe(a, nodes, out);
      return;
    case "not":
      refsDe(e.a, nodes, out);
      return;
    default:
      return;
  }
}

export function travar(
  receita: Receita,
  gab: Gabarito,
  nodes: Nos,
  topId: number,
  /** Os passos gravados de um nó (makeSteps): de onde saem as partes de cada nó aberto. */
  passosDe: (id: number) => readonly Step[] = () => [],
): Resultado {
  const erros: string[] = [];
  const naoDeclaradas: string[] = [];
  let niveis = 0;
  let cobertos = 0;
  let folhas = 0;
  let aDescer = 0;
  /** As partes gravadas de um nó: o que os passos dele leem e chamam, as chamadas filhas e as leituras com número. */
  const partesDo = (id: number): Set<string> => {
    const out = new Set<string>();
    for (const st of passosDe(id)) refsDe(st.e, nodes, out);
    const n = nodes[id];
    for (const c of n?.c ?? []) {
      const k = nodes[c];
      if (k) out.add(callRef(k));
    }
    for (const x of n?.r ?? []) if (num(x[1]) !== null) out.add(x[0]);
    return out;
  };
  const fecha = (onde: string, partes: number, gravado: number) => {
    if (relDiff(partes, gravado) <= TOLERANCIA) niveis++;
    else erros.push(`nível não fecha: ${onde}: as partes dão ${fmt(partes)}, o valor gravado é ${fmt(gravado)}`);
  };

  // 1. A ordem dos pools.
  const esperada = gab.pools.map((p) => p.kind).join(" → ");
  const temos = receita.pools.map((p) => p.kind).join(" → ");
  if (esperada !== temos) {
    erros.push(`ordem dos pools errada: a ordem esperada é ${esperada}; a receita tem ${temos}`);
    return { ok: false, erros, niveisConferidos: niveis, niveisCobertos: cobertos, folhas, aDescer, naoDeclaradas };
  }

  /**
   * Um nó da receita: o valor vem da gravação; cada filho precisa estar entre as partes gravadas do nó (`partes`); a
   * folha precisa de um dos 9 tipos; e, só quando a receita traz fórmula, a fórmula dos filhos fecha com o valor.
   */
  function descer(
    no: NoReceita,
    valor: number,
    ctx: readonly number[],
    onde: string,
    partes: Set<string> | null,
  ): void {
    if (no.condicao) {
      const c = no.condicao;
      const r = c.ref ? resolver(nodes, c.ref, ctx) : null;
      if (!r) erros.push(`condição sem valor na gravação: ${onde} › ${c.nome} (${String(c.ref)})`);
      else descer(c, r.v, r.no !== null ? [r.no, ...ctx] : ctx, `${onde} › ${c.nome}`, null);
    }
    if (no.a_descer) {
      aDescer++;
      return;
    }
    const filhos = no.filhos ?? [];
    if (filhos.length === 0) {
      if (!no.folha || !(TIPOS_DE_FOLHA as readonly string[]).includes(no.folha))
        erros.push(`folha sem tipo válido: ${onde} (${String(no.folha)})`);
      else folhas++;
      return;
    }
    const vars: Record<string, number> = {};
    let fora = 0;
    // As partes de dentro de um filho que é a própria chamada do pai são dele, não do pai.
    const doFilhoProprio = new Set<string>();
    for (const f of filhos) {
      if (!f.ref) {
        erros.push(`filho sem referência: ${onde} › ${f.nome}`);
        continue;
      }
      if (partes && !partes.has(f.ref)) {
        fora++;
        erros.push(`filho fora da conta: ${onde} › ${f.nome} (${f.ref}) não está entre as partes que o jogo gravou para o pai`);
      }
      const r = resolver(nodes, f.ref, ctx);
      if (!r) {
        erros.push(`filho sem valor na gravação: ${onde} › ${f.nome} (${f.ref})`);
        continue;
      }
      if (f.id) vars[f.id] = r.v;
      // O filho que é o próprio nó do pai (a chamada vista de dentro) abre nas partes desse nó.
      const pf = r.no !== null ? partesDo(r.no) : null;
      if (pf && f.ref === no.ref) for (const p of pf) doFilhoProprio.add(p);
      descer(f, r.v, r.no !== null ? [r.no, ...ctx] : ctx, `${onde} › ${f.nome}`, pf);
    }
    if (partes) {
      if (fora === 0) cobertos++;
      const declaradas = new Set([no.ref, no.condicao?.ref, ...filhos.map((f) => f.ref), ...filhos.map((f) => f.condicao?.ref)]);
      for (const p of partes)
        if (!declaradas.has(p) && !doFilhoProprio.has(p)) naoDeclaradas.push(`${onde}: ${p}`);
    }
    if (!no.formula) return;
    try {
      fecha(onde, avaliar(no.formula, vars), valor);
    } catch (e) {
      erros.push(`${onde}: ${(e as Error).message}`);
    }
  }

  // 2. Por pool: toda fonte do gabarito na receita, a ordem dos grupos e das fontes, e o fechamento.
  receita.pools.forEach((rp, i) => {
    const gp = gab.pools[i];
    if (!gp) return;
    const nome = `pool ${String(i + 1)} ${gp.kind}`;
    // A posição de cada fonte do gabarito, com a ocorrência (a mesma ref pode vir duas vezes no pool).
    const pos = new Map<string, number>();
    const seenG = new Map<string, number>();
    gp.termos.forEach((t, j) => {
      const k = t.kind === "fonte" ? t.ref : `=${String(t.value)}`;
      const n = (seenG.get(k) ?? 0) + 1;
      seenG.set(k, n);
      pos.set(`${k}#${String(n)}`, j);
    });
    const usado = new Set<number>();
    const seenR = new Map<string, number>();
    let partes = gp.kind === "Additive" ? 0 : 1;
    const ordemGrupos: { sistema: string; primeira: number }[] = [];
    for (const g of rp.grupos) {
      let ultima = -1;
      let primeira = Infinity;
      for (const f of g.fontes) {
        const k = f.constante !== undefined ? `=${String(f.constante)}` : (f.ref ?? "");
        const n = (seenR.get(k) ?? 0) + 1;
        seenR.set(k, n);
        const j = pos.get(`${k}#${String(n)}`);
        const t = j === undefined ? undefined : gp.termos[j];
        if (j === undefined || !t) {
          if (!f.classe) erros.push(`fonte a mais na receita (não está no gabarito): ${nome} › ${g.sistema} › ${f.nome} (${k})`);
          continue;
        }
        usado.add(j);
        if (j < ultima)
          erros.push(`ordem das fontes: ${nome} › ${g.sistema} › ${f.nome} vem depois de uma fonte que o jogo soma depois dela`);
        ultima = j;
        primeira = Math.min(primeira, j);
        // Uma constante do código entra com peso 1; uma fonte, com o peso dela ou o do pool.
        const peso =
          gp.kind === "Additive"
            ? (f.peso ?? (f.constante !== undefined ? 1 : (rp.peso ?? 1)))
            : 1;
        partes = gp.kind === "Additive" ? partes + peso * t.value : partes * t.value;
        const onde = `${nome} › ${g.sistema} › ${f.nome}`;
        if (f.constante !== undefined) {
          if (f.condicao) descer({ nome: f.nome, folha: "Valor fixo", condicao: f.condicao }, t.value, [topId], onde, null);
          else folhas++;
          continue;
        }
        // A fonte abre dentro do próprio nó (quando o termo é a chamada) e, se não achar, no da raiz.
        const no0 = t.nos[0];
        const ctx = no0 !== null && no0 !== undefined ? [no0, topId] : [topId];
        // As partes de uma fonte: as referências do termo e, quando o termo é a própria chamada, as partes dela.
        const partesF = new Set(t.refs);
        if (no0 !== null && no0 !== undefined && relDiff(num(nodes[no0]?.v) ?? NaN, t.value) <= TOLERANCIA)
          for (const p of partesDo(no0)) partesF.add(p);
        descer(f, t.value, ctx, onde, partesF);
      }
      // Um grupo sem fonte nenhuma no gabarito some (FR-002a) e fica fora da ordem.
      if (primeira !== Infinity) ordemGrupos.push({ sistema: g.sistema, primeira });
    }
    // FR-013a: os grupos na ordem em que o jogo soma ou multiplica a primeira fonte de cada um.
    const certa = [...ordemGrupos].sort((a, b) => a.primeira - b.primeira).map((g) => g.sistema);
    const tem = ordemGrupos.map((g) => g.sistema);
    if (certa.join("|") !== tem.join("|"))
      erros.push(`ordem dos grupos do ${nome}: a ordem esperada é ${certa.join(", ")}; a receita tem ${tem.join(", ")}`);
    gp.termos.forEach((t, j) => {
      if (usado.has(j)) return;
      erros.push(
        t.kind === "fonte"
          ? `fonte que falta: ${t.ref} (${nome}, valor ${fmt(t.value)})`
          : `constante que falta: ${fmt(t.value)} (${nome})`,
      );
    });
    fecha(nome, partes, gp.value);
  });

  // 3. A raiz: a corrente de pools na ordem dá o valor final.
  const total = gab.pools.reduce<number | null>(
    (acc, p) => (acc === null ? p.value : p.kind === "Additive" ? acc + p.value : acc * p.value),
    null,
  );
  fecha(`raiz ${receita.raiz.nome}`, total ?? 0, gab.final);
  return { ok: erros.length === 0, erros, niveisConferidos: niveis, niveisCobertos: cobertos, folhas, aDescer, naoDeclaradas };
}
