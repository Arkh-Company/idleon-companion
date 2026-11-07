#!/usr/bin/env node
// PreToolUse hook (matcher "WebFetch"): decide pelo papel de quem chama, o agent_type da entrada (o name do frontmatter
// do subagente, sem mudar a caixa).
//   executor e revisor  só buscam páginas em PERMITIDOS: URL https:, sem usuário nem senha, na porta padrão. O resto bloqueia.
//   sessão              é qualquer outro agent_type (Explore, general-purpose, plugin:executor, Executor com maiúscula) e a
//                       falta dele: nada muda, a URL nem é olhada.
// Exit 2 = bloqueia (o stderr volta ao Claude como motivo); exit 0 = sem objeção.
// Falha fechado: se não der para ler a entrada, ou se ela não for um objeto, bloqueia em qualquer papel.
// Falha fechado também numa exceção: sem isto, um erro não tratado (até um ReferenceError do módulo) sai com 1, e o
// Claude Code só bloqueia com 2. Os imports do ESM sobem antes de tudo, mas só os do node:, que não falham.
process.on("uncaughtException", () => {
  process.stderr.write("Bloqueado pelo hook: erro interno ao conferir a busca; peça ao humano.\n");
  process.exit(2);
});
import { readFileSync } from "node:fs";

// domínio novo entra no kit, por PR, com o caso no teste
const PERMITIDOS = ["raw.githubusercontent.com"];

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // entrada ilegível: cai no bloqueio logo abaixo
}
if (input === null || typeof input !== "object" || Array.isArray(input)) {
  process.stderr.write("Bloqueado por .claude/hooks/guard-web: não consegui ler a entrada. Tente de novo ou peça à sessão.");
  process.exit(2);
}
if (input.agent_type !== "executor" && input.agent_type !== "revisor") process.exit(0);

let url;
try {
  url = new URL(input.tool_input?.url);
} catch {
  // URL ausente, que não é texto ou que o new URL não lê: cai no bloqueio logo abaixo
}
if (url?.protocol === "https:" && !url.username && !url.password && !url.port && PERMITIDOS.includes(url.hostname)) {
  process.exit(0);
}
process.stderr.write("Bloqueado por .claude/hooks/guard-web: o Executor e o Revisor só buscam páginas em raw.githubusercontent.com. "
  + "Para documentação de biblioteca, use o Context7; para outro endereço, peça à sessão.");
process.exit(2);
