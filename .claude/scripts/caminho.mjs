// Conferência de caminho do png.mjs e do svg.mjs. O settings.json libera os dois sem pedido de permissão, então os
// argumentos deles não são confiáveis: cada caminho passa por aqui antes de qualquer leitura ou escrita. Também mora
// aqui o cdPasta, o `cd` que as mensagens de vários scripts mostram ao usuário.
import { lstatSync } from "node:fs";
import { isAbsolute, posix } from "node:path";

// Relativo à raiz do projeto (nem /x, nem C:\x, nem C:x), com / e já normalizado (sem ./, // nem ..)
export function relativoNormal(caminho) {
  const normal = !caminho.includes("\\") && posix.normalize(caminho) === caminho && !caminho.split("/").includes("..");
  return normal && !isAbsolute(caminho) && !/^[A-Za-z]:/.test(caminho);
}

// O `cd '<pasta>' && ` que as mensagens dos scripts mostram ao usuário. Aspas simples, nunca duplas: no PowerShell as
// duplas expandem `$var`, `$(...)` e a crase, e um nome de pasta de fora viraria comando. Nas simples nada expande; o
// `'` do caminho é dobrado, e também as aspas curvas ‘ ’ ‚ ‛ (U+2018, U+2019, U+201A, U+201B), que o PowerShell
// trata como aspas simples. O `&&`, nunca o `;`: com o `;`, um `cd` que falha roda o comando seguinte na pasta errada
// (um `gh secret set` gravaria o token no repositório errado). Com `[`, `]`, `*` ou `?`, o `-LiteralPath`: o `cd` do
// PowerShell trata esses caracteres como curinga, e `proj[1]` cairia em `proj1`.
export function cdPasta(pasta = process.cwd()) {
  const literal = /[\][*?]/.test(pasta) ? "-LiteralPath " : "";
  return `cd ${literal}'${pasta.replace(/['\u2018\u2019\u201A\u201B]/g, (aspa) => aspa + aspa)}' && `;
}

// O lstat do caminho (um link é o próprio link, não o alvo), ou null quando ele não existe
export function estado(caminho) {
  try {
    return lstatSync(caminho);
  } catch {
    return null;
  }
}
