#!/usr/bin/env node
// Publica a captura PNG de um diagrama do archify (desenho, seção 5.6): copia a captura que o visual-check grava em
// specs/<feature>/diagramas/local/ para specs/<feature>/diagramas/<nome>.png, que vai para o git. Existe para o fim do
// /speckit-plan copiar sem pedido de permissão (o settings.json libera este script; uma cópia pelo shell pediria) e sem
// poder gravar em outro lugar: os dois caminhos são relativos à raiz do projeto e conferidos antes da cópia.
// Uso, na raiz do projeto: node .claude/scripts/png.mjs <captura.png> <destino.png>
// ponytail: a conferência olha o texto dos caminhos e, pelo lstat, só o último nome. Um link que já exista no caminho
// (hard link ou junção) é seguido; nenhum comando liberado cria link.
import { copyFileSync } from "node:fs";
import { estado, relativoNormal } from "./caminho.mjs";

function recusa(mensagem) {
  console.error(`png: ${mensagem}`);
  process.exit(1);
}

const [captura, destino] = process.argv.slice(2);
if (!captura || !destino) recusa("uso: node .claude/scripts/png.mjs <captura.png> <destino.png>");
for (const caminho of [captura, destino]) {
  if (!relativoNormal(caminho)) {
    recusa(`${caminho}: use um caminho relativo à raiz do projeto, com / e sem .. (como specs/001-nome/diagramas/...)`);
  }
}
if (!/^specs\/[^/]+\/diagramas\/local\/(?:[^/]+\/)*[^/]+\.png$/.test(captura)) {
  recusa(`${captura}: a captura tem de ser um .png dentro de specs/<feature>/diagramas/local/`);
}
if (!/^specs\/[^/]+\/diagramas\/[^/]+\.png$/.test(destino)) {
  recusa(`${destino}: o destino tem de ser um .png direto em specs/<feature>/diagramas/`);
}
if (!estado(captura)?.isFile()) recusa(`${captura}: não existe ou não é um arquivo comum`);
const anterior = estado(destino);
if (anterior && !anterior.isFile()) recusa(`${destino}: já existe e não é um arquivo comum`);
try {
  copyFileSync(captura, destino);
} catch (erro) {
  recusa(`não copiei ${captura} para ${destino}: ${erro.message}`);
}
console.log(`PNG: ${destino}`);
