#!/usr/bin/env node
// Monta a pasta da análise do workflow semanal (.github/workflows/skills-update.yml): o job `analisar` o roda sempre,
// depois da action do Claude e antes do upload do artifact analise, que o conferir-base.mjs lê no job `pr`.
// Uso, na raiz do projeto:
//   node .claude/scripts/skills-analise.mjs <resultado do passo> <arquivo de execução ou ""> <cópia do documento> <saida>
// <resultado do passo> é o steps.claude.outcome; o arquivo de execução, o execution_file da action (a lista JSON das
// mensagens do SDK). O FORMATO do ambiente é a saída do passo `formato` (`certo`, `errado` ou vazia, quando ele não
// rodou); com `errado`, a action não rodou por causa do formato do token. Grava em <saida>:
//   motivo.txt                 `ok` (a action passou), `sem-token` (não rodou), `token-mal-formado` (não rodou pelo
//                              formato do token), `falhou` ou `token-no-relatorio`
//   relatorio.md               o `result` da última mensagem `result`; o resto do arquivo de execução, que tem o que
//                              as ferramentas leram, fica na máquina
//   revisao-de-ferramentas.md  a cópia do documento que o Claude editou, byte a byte
// Com algo com cara de token da Anthropic no relatório ou na cópia, o relatório vira uma linha fixa, a cópia não vai e
// o motivo é `token-no-relatorio`: o artifact nunca guarda o token, e o texto casado nunca é impresso. Um arquivo
// ausente ou ilegível é resultado, não erro: sai o que houver, e o conferir-base.mjs dá "não analisado".
// Com `is_error: true` na última mensagem `result` (o Claude falhou, como no "Not logged in"), o texto dela também vai,
// numa linha só, sem nada com cara de token (vira `[removido]`) e cortado em 300 caracteres, como `erro=…` no
// $GITHUB_OUTPUT: é a saída `erro` do job, que chega ao PR mesmo sem o artifact; o motivo é `falhou`.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TOKEN } from "./token.mjs";

const ler = (caminho) => {
  try {
    return caminho ? readFileSync(caminho) : null;
  } catch {
    return null;
  }
};

const argumentos = process.argv.slice(2);
if (argumentos.length !== 4) {
  console.error("skills-analise: uso: node .claude/scripts/skills-analise.mjs <resultado do passo> " +
    '<arquivo de execução ou ""> <cópia do documento> <saida>');
  process.exit(1);
}
const [resultado, execucao, documento, saida] = argumentos;

let relatorio = null;
let erro = "";
try {
  const ultima = JSON.parse(ler(execucao)?.toString("utf8") ?? "[]").filter((m) => m?.type === "result").pop();
  if (typeof ultima?.result === "string") relatorio = ultima.result;
  // o token sai antes do corte: cortado, o que sobrasse dele já não casaria com a expressão
  if (ultima?.is_error === true && relatorio !== null) {
    erro = relatorio.replace(new RegExp(TOKEN, "g"), "[removido]").replace(/\s+/g, " ").trim().slice(0, 300);
  }
} catch {
  // arquivo de execução quebrado: sem relatório
}
const copia = ler(documento);

let motivo = { success: "ok", skipped: "sem-token" }[resultado] ?? "falhou";
if (erro) motivo = "falhou";
if (process.env.FORMATO === "errado") motivo = "token-mal-formado";
if (erro && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `erro=${erro}\n`);
mkdirSync(saida, { recursive: true });
// em latin1, um caractere por byte: a expressão acha o token em qualquer codificação compatível com ASCII
if ((relatorio !== null && TOKEN.test(relatorio)) || (copia && TOKEN.test(copia.toString("latin1")))) {
  motivo = "token-no-relatorio";
  writeFileSync(join(saida, "relatorio.md"),
    "Relatório descartado pelo workflow: tinha algo com cara de token da Anthropic.\n");
} else {
  if (relatorio !== null) writeFileSync(join(saida, "relatorio.md"), relatorio);
  if (copia) writeFileSync(join(saida, "revisao-de-ferramentas.md"), copia);
}
writeFileSync(join(saida, "motivo.txt"), `${motivo}\n`);
console.log(`skills-analise: ${motivo}`);
