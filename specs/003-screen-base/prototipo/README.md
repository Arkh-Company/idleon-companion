# Protótipo: tabelas do jogo lidas só como texto

Código descartável. A versão real é escrita pelo Executor em `src/`, com TDD.

## O que foi testado

Dá para tirar do `N.js` instalado os nomes de mapas, os nomes de monstros e os números de tela, lendo o arquivo só como
texto, sem executar nada dele (FR-014, FR-016, FR-017)?

`extrair.ts` lê o arquivo de dentro do `app.asar` e procura os dados com expressões regulares sobre a string.
`extrair.test.ts` cobre o formato inesperado com um código de jogo inventado. Nenhum trecho do arquivo do jogo está nesta
pasta: só nomes de campos, contagens e a forma da extração.

Medido em 08/11/2026 no jogo instalado (`N.js` com 24,8 milhões de caracteres), com `node extrair.ts <app.asar> <mapa-de-telas.md>`
e `pnpm exec vitest run --dir specs/003-screen-base/prototipo` (6 testes passam).

## Resultado

| Critério | Medida | Passou |
| --- | --- | --- |
| Números de `MenuType2` batem com o mapa de telas | 108 no código e 108 em uso no mapa. O mapa tem mais 3 linhas (22, 50 e 51), marcadas como "sem uso"; nenhum número do código falta no mapa | sim |
| Mapas com contagem coerente | 327 nomes em `MapDispName`, mesmo tamanho de `MapName`; o jogo indexa essa lista por `CurrentMap` | sim |
| Monstros com contagem coerente | 418 ids distintos; os 11 ids escritos em `AFKtarget` no código estão todos na tabela | sim |
| Nomes iguais aos do catálogo da 001 | 327 de 327 mapas e 417 de 417 monstros, comparados por programa e sem imprimir nomes. O id `Nothing` tem nome vazio: não é monstro, é "sem alvo" | sim |
| Formato novo nunca vira nome errado | Sem o trecho, com duas candidatas, com listas de tamanhos diferentes ou com um monstro fora do formato, o resultado é "não consegui ler" | sim |
| Tempo abaixo de 1 s | 23 ms para as tabelas e 45 ms para os números, com o arquivo já na memória; ler do `app.asar` levou mais 27 ms | sim |

## Decisões para o plano

- **Como ler as tabelas (FR-014):** expressões regulares sobre o texto do arquivo, sem executar nada. Os mapas vêm das duas
  listas de texto separadas por espaço (`MapDispName` e `MapName`), procuradas pelo nome do campo, porque o nome do objeto
  minificado pode mudar a cada build. Os monstros vêm das chamadas `addNewMonster`, cujo objeto começa em `Name`.
- **Tudo ou nada:** qualquer sinal de formato novo descarta a tabela inteira, e o painel mostra "Unknown map" ou "Unknown
  monster" (FR-016). Nas duas listas de mapas, tamanhos diferentes contam como formato novo.
- **Id de monstro repetido:** o último vale, como no jogo. O arquivo atual tem um repetido.
- **Sublinhado vira espaço** nos nomes de mapas e monstros, como o jogo mostra.
- **Números de tela (FR-017):** escritas e comparações literais de `MenuType2`.
- **Reaproveitar o texto já lido:** o guardião já carrega o `N.js` inteiro para o vigia de update, inclusive de dentro do
  `app.asar`, então não precisa de um leitor de asar novo.

## O que não ficou provado

- Só uma versão do jogo foi medida. Um patch que mude o formato cai no "não consegui ler".
- Um número de tela novo que só apareça numa conta, sem escrita nem comparação literal, não seria apontado pelo guardião.
