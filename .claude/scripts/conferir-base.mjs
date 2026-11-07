#!/usr/bin/env node
// A conferência do workflow semanal (.github/workflows/skills-update.yml): o job `pr` a roda depois do `analisar` e
// decide o PR sem IA, de propósito. O Claude analisou conteúdo de fora, e o que ele deixou (o veredito, os achados e a
// cópia do documento com a base nova) só entra no PR pelas regras fixas abaixo, nunca por outra leitura de IA.
// Uso, na raiz do projeto:
//   node .claude/scripts/conferir-base.mjs <doc da main> <pasta da análise> <pasta do pacote> <saida> <resultado>
// <resultado> é o needs.analisar.result. Da pasta da análise (montada pelo skills-analise.mjs) vêm o motivo.txt
// (`ok`, `sem-token`, `token-mal-formado`, `falhou` ou `token-no-relatorio`, quando o analisar já descartou o
// relatório e a cópia), o relatorio.md e a cópia do documento, revisao-de-ferramentas.md; do pacote, o versoes.md. Um
// arquivo da análise ausente (ou a pasta inteira, quando o `analisar` falhou) é resultado, não erro: vira "não
// analisado". O ERRO do ambiente é a saída `erro` do analisar (o texto do Claude quando ele falhou, numa linha só):
// com o analisar reprovado, o motivo `falhou` ou um ERRO não vazio, o veredito é "não analisado", o motivo vira
// `a análise falhou: <erro>`, e no corpo o erro, que vem de fora, só aparece dentro de um bloco ```text.
// Grava em <saida>:
//   decisao.json  {"veredito": "limpo"|"base-atualizada"|"pequenas"|"suspeito"|"nao-analisado",
//                 "motivo": <texto ou null>, "aplicarBase": bool, "rascunho": bool}, que o skills-pr.mjs lê (o rótulo
//                 vai com o rascunho; o veredito, ele não lê)
//   corpo.md      a descrição do PR
//   revisao-de-ferramentas.md  só com aplicarBase: a cópia conferida, byte a byte, que o skills-pr.mjs põe no lugar
//                 de docs/agents/revisao-de-ferramentas.md
// e imprime `conferir-base: <veredito>`. Sai com 1 (`conferir-base: <motivo>` no stderr, nada gravado) só com uso
// errado ou sem o doc da main ou o versoes.md. Nada com cara de token da Anthropic (sk-ant-…) no relatório ou na cópia
// chega ao PR, nem ao log: o texto casado nunca é impresso.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TOKEN } from "./token.mjs";

function recusa(mensagem) {
  console.error(`conferir-base: ${mensagem}`);
  process.exit(1);
}

const ler = (caminho) => {
  try {
    return readFileSync(caminho);
  } catch {
    return null;
  }
};

const argumentos = process.argv.slice(2);
if (argumentos.length !== 5) {
  recusa("uso: node .claude/scripts/conferir-base.mjs <doc da main> <pasta da análise> <pasta do pacote> <saida> " +
    "<resultado do analisar>");
}
const [docMain, pastaAnalise, pastaPacote, saida, resultado] = argumentos;
const principal = ler(docMain);
if (principal === null) recusa(`não li o documento da main, ${docMain}`);
const versoes = ler(join(pastaPacote, "versoes.md"));
if (versoes === null) recusa(`não li o versoes.md do pacote, em ${pastaPacote}`);
// o skills-analise.mjs já tirou o token; a varredura de novo é só para nada passar
const erro = (process.env.ERRO ?? "").replace(new RegExp(TOKEN, "g"), "[removido]").trim();

const LOW = " - risk: low - ";
const HIGH = " - risk: high - ";

// Antes, a seção e depois; null sem a seção uma vez só. Em latin1, um caractere por byte: a comparação é byte a byte.
function partes(dados) {
  const texto = dados.toString("latin1");
  const titulo = "\n## Accepted baseline\n";
  const inicio = texto.indexOf(titulo);
  if (inicio < 0 || texto.indexOf(titulo, inicio + 1) >= 0) return null;
  const proxima = texto.indexOf("\n## ", inicio + titulo.length);
  const fim = proxima < 0 ? texto.length : proxima;
  return [texto.slice(0, inicio), texto.slice(inicio, fim), texto.slice(fim)];
}

const CABECALHOS = ["Accepted baseline (not findings):", "Binaries:", "Not fully reviewed:"];

// A decisão, pelas regras em ordem (decisão 3 do Plano 5b); `relatorio` só sai quando pode ir para o corpo
function decidir() {
  const nao = (motivo, extra = {}) => ({ veredito: "nao-analisado", motivo, ...extra });
  const motivo = ler(join(pastaAnalise, "motivo.txt"))?.toString("utf8").trim();
  // o Claude pode dar is_error com o passo aprovado: aí o relatorio.md é o texto do erro, nunca um relatório
  if (resultado !== "success" || motivo === "falhou" || erro) {
    if (!erro) return nao("a análise falhou ou o token venceu", { token: true });
    return nao(`a análise falhou: ${erro}`, { token: true, erro });
  }
  if (motivo === "sem-token") return nao("sem o token do Claude", { token: true });
  if (motivo === "token-mal-formado") {
    return nao("o token gravado não tem o formato de um token da assinatura (sk-ant-oat01-…, numa linha só, sem " +
      "espaço)", { token: true });
  }
  const comToken = nao("o relatório tinha algo com cara de token; não foi publicado",
    { token: true, semRelatorio: true });
  if (motivo === "token-no-relatorio") return comToken;
  const bruto = ler(join(pastaAnalise, "relatorio.md"))?.toString("utf8") ?? "";
  if (!bruto.trim()) return nao("a análise não deixou relatório");
  const copia = ler(join(pastaAnalise, "revisao-de-ferramentas.md"));
  // antes de qualquer outra leitura do relatório; o texto casado não sai daqui
  if (TOKEN.test(bruto) || (copia && TOKEN.test(copia.toString("latin1")))) return comToken;
  const relatorio = bruto.replace(/\r\n?/g, "\n");
  const linhas = relatorio.split("\n");
  const veredito = linhas[0];
  const com = (decisao) => ({ ...decisao, relatorio });
  if (veredito !== "VERDICT: CLEAN" && veredito !== "VERDICT: SUSPICIOUS") {
    return com(nao("o relatório não começa por um veredito válido"));
  }
  const [antesMain, secaoMain, depoisMain] = partes(principal) ?? [];
  const [antes, secao, depois] = (copia && partes(copia)) ?? [];
  if (antesMain === undefined || antes !== antesMain || depois !== depoisMain) {
    return com(nao("a cópia do documento mudou fora da seção Accepted baseline"));
  }
  // os achados vão até o primeiro cabeçalho das outras listas do Output: o Claude pode omitir um vazio
  const fimAchados = linhas.findIndex((l) => CABECALHOS.includes(l));
  const achados = linhas.slice(1, fimAchados < 0 ? undefined : fimAchados).filter((l) => l.startsWith("- "));
  const baseMudou = secao !== secaoMain;
  if (veredito === "VERDICT: CLEAN") {
    if (achados.length || baseMudou) return com(nao("veredito CLEAN com achados ou com a base mudada"));
    return com({ veredito: "limpo", motivo: null });
  }
  if (!achados.length) return com(nao("veredito SUSPICIOUS sem achado não é um veredito válido"));
  // sem o low, o achado conta como high; um achado que cita os dois riscos também conta como high
  const semRisco = achados.some((a) => !a.includes(LOW) && !a.includes(HIGH));
  const alto = achados.some((a) => a.includes(HIGH));
  if (alto || semRisco) {
    const motivo = [alto && "achado high", semRisco && "achado sem risco, que conta como high"].filter(Boolean);
    return com({ veredito: "suspeito", motivo: motivo.join("; ") });
  }
  // só low e nada que a base descreve tocado: a base não precisa mudar (depois do merge, a main já tem a versão nova,
  // e a semana seguinte não repete os achados)
  if (!baseMudou) return com({ veredito: "pequenas", motivo: null });
  return com({ veredito: "base-atualizada", motivo: null, aplicarBase: true, copia });
}

const decisao = decidir();
const aplicarBase = decisao.aplicarBase === true;
const rascunho = decisao.veredito === "suspeito" || decisao.veredito === "nao-analisado";

const LINHA = {
  limpo: () => "Veredito: limpo",
  "base-atualizada": () => "Veredito: só diferenças pequenas, base atualizada",
  pequenas: () => "Veredito: só diferenças pequenas (a base não precisou mudar)",
  suspeito: (m) => `Veredito: suspeito (${m})`,
  "nao-analisado": (m) => `Veredito: não analisado (${m})`,
};
const FAZER = {
  limpo: "A análise não achou diferença da base aceita: confira as versões e faça o merge.",
  "base-atualizada": "A análise achou só diferenças pequenas (`low`) e atualizou neste PR a seção \"Accepted " +
    "baseline\" de `docs/agents/revisao-de-ferramentas.md`: confira o relatório e a seção, e faça o merge.",
  pequenas: "A análise achou só diferenças pequenas (`low`), que não tocam nada que a base aceita descreve (a seção " +
    "\"Accepted baseline\" de `docs/agents/revisao-de-ferramentas.md` não precisou mudar): confira o relatório e faça " +
    "o merge.",
  suspeito: "Há achado para você conferir: não faça o merge antes de ler o relatório. Num achado `high` que você " +
    "conferiu, atualize a base no próprio PR (a seção \"Accepted baseline\" de " +
    "`docs/agents/revisao-de-ferramentas.md`), tire o rascunho e faça o merge.",
  "nao-analisado": "A mudança não foi analisada: não faça o merge antes de rodar o workflow de novo com o token " +
    "(Actions, skills-update, Run workflow).",
};
const COMUM = "Este PR foi aberto pelo GitHub Actions, que tenta aprovar a CI dele; se o PR mostrar \"Approve " +
  "workflows to run\", aprove: sem isso a CI do PR não roda e a proteção da `main` segura o merge. O merge é sempre " +
  "seu. Enquanto houver um commit seu no branch `chore/skills-update`, o workflow não mexe nele nem no PR: faça o " +
  "merge ou apague o branch para a semana seguinte voltar a atualizá-lo.";
const TOKEN_CLAUDE = [
  "## Token do Claude",
  "",
  "Grave um token novo no seu terminal, um comando de cada vez (o segundo pede o token que o primeiro mostrou, sem " +
    "mostrá-lo):",
  "",
  "```text",
  "cd '<pasta do projeto>' && claude setup-token",
  "cd '<pasta do projeto>' && gh secret set CLAUDE_CODE_OAUTH_TOKEN",
  "```",
  "",
  "O token vale um ano. Depois, rode o workflow de novo.",
  "",
].join("\n");
const LIMITE = 60000;
const CORTE = "(relatório cortado: o inteiro está no artifact analise da execução)";

// O relatório e o versoes.md (nomes e refs que o upstream escolhe) num bloco ```text com uma crase a mais que a maior
// sequência deles: nada vira link, autolink, imagem ou HTML
function bloco(texto) {
  const crases = "`".repeat(Math.max(3, ...(texto.match(/`+/g) ?? []).map((c) => c.length + 1)));
  const fechado = (t) => `${crases}text\n${t}${t.endsWith("\n") ? "" : "\n"}${crases}\n`;
  return { fechado, inteiro: fechado(texto) };
}

function corpo() {
  const montar = (relatorio) => [
    // o erro do Claude vem de fora: só no bloco abaixo, nunca na linha do veredito
    LINHA[decisao.veredito](decisao.erro ? "a análise falhou" : decisao.motivo),
    "",
    "## Versões",
    "",
    bloco(versoes.toString("utf8")).inteiro,
    "## Relatório da análise",
    "",
    relatorio,
    "## O que fazer",
    "",
    `${FAZER[decisao.veredito]} ${COMUM}`,
    "",
    ...(decisao.token ? [TOKEN_CLAUDE] : []),
  ].join("\n");
  if (decisao.semRelatorio) {
    return montar("O relatório não foi publicado: tinha algo com cara de token da Anthropic. Troque o token (os " +
      "comandos abaixo) e rode o workflow de novo.\n");
  }
  if (decisao.erro) {
    return montar(`Sem relatório: a análise falhou. O erro do Claude:\n\n${bloco(decisao.erro).inteiro}`);
  }
  if (decisao.relatorio === undefined) return montar(`Sem relatório: ${decisao.motivo}.\n`);
  const { fechado, inteiro } = bloco(decisao.relatorio);
  const texto = montar(inteiro);
  if (texto.length <= LIMITE) return texto;
  // corta só o relatório, e o bloco continua fechado; a linha do corte vem logo depois dele
  const sobra = LIMITE - montar(`${fechado("")}\n${CORTE}\n`).length;
  return montar(`${fechado(decisao.relatorio.slice(0, Math.max(0, sobra)))}\n${CORTE}\n`);
}

const saidaDecisao = { veredito: decisao.veredito, motivo: decisao.motivo, aplicarBase, rascunho };
try {
  mkdirSync(saida, { recursive: true });
  writeFileSync(join(saida, "decisao.json"), `${JSON.stringify(saidaDecisao, null, 2)}\n`);
  writeFileSync(join(saida, "corpo.md"), corpo());
  // o mesmo Buffer que passou pelas regras
  if (aplicarBase) writeFileSync(join(saida, "revisao-de-ferramentas.md"), decisao.copia);
} catch (erro) {
  recusa(`não gravei ${saida}: ${erro.message}`);
}
console.log(`conferir-base: ${decisao.veredito}`);
