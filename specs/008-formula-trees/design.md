> **Anexo da spec 008.** Cópia do `DESIGN-008-arvores-no-app.md` (v5.1, base BASELINE-3.1, 3abbb53), feita em 12/11/2026. O brainstorming de 12/11 mudou três coisas que este texto ainda não reflete, e nelas vale a [spec](spec.md): a árvore abre num painel lateral, com a janela alargando (FR-005); o escopo vai além dos 11 números da Stats (o catálogo, FR-007); e há um painel por sistema que segue a tela (FR-003, FR-004). O mockup citado aqui fica na bancada e não entra no repositório.

# DESIGN-008: árvores de fórmula no app

v5.1, base: BASELINE-3.1 (3abbb53)

**Anexo da spec:** este DESIGN vira `specs/008-*/design.md`; o mockup fica na bancada. As decisões do Vinicius estão em `docs\product\respostas-008.md`; a v4 as aplica.

12/11/2026. Rascunho para a spec 008, feito pelo agente (f) DESIGN. **É a fonte do design da 008** (tokens, componentes, regras); o mockup `mockup-008-arvores-no-app.html` ilustra e segue este documento, e o que ele contraria está em §3.10. Documento em português; todo texto de interface, de árvore e de exemplo de rótulo em inglês, porque o app é em inglês.

Pedido do Vinicius: "o sistema tem que ser fácil de usar e analisar, para que um jogador sem muita experiência consiga entender de maneira rápida o que ele está enxergando".

Nos exemplos, o personagem é `Character 1 (Royal Guardian)` (número e classe, nunca um nome, nem inventado: regra da pesquisa, a mesma da spec e do mockup); os números vêm do retrato de 08/11 da bancada, que fica fora do repo. Os números que dependem da base vêm do `BASELINE-3.1-READY.txt` (commit 3abbb53 da bancada).

Siglas: **bancada** = `C:\Users\Vinicius\idleon-companion\research\run\formula-006\`; **padrão** = `docs\product\padrao-de-formula.md`; **app** = `C:\Users\Vinicius\ClaudeCowork\idleon-companion\`; **IT** = Idleon Toolbox. Números do Drop Rate: retrato de 08/11 da bancada, `BASELINE-READY.txt` (2.262 linhas, 640 ⓘ, 12 "?": 4 folhas sem tipo e 8 de progresso de laço, que não é folha e é contado à parte). Rótulos e frases foram conferidos em 12/11 contra o Glossário M (`gloss-m/GLOSSARIO-jogador.md` na pasta de rascunho da pesquisa e `glossary.json`); as divergências e a escolha estão em §3.7, "Rótulos × Glossário M". O Glossário M ainda não foi validado pelo Vinicius, e nenhum rótulo aqui está. Marca **(fora do GM)** = rótulo nosso, sem entrada no Glossário M.

**Contagens do Drop Rate no BASELINE-3.1 (3abbb53):** 2.414 linhas, com 244 referências `shown earlier` (sem o compact seriam 5.024); 3 "?" reais + 14 de progresso de laço; 514 de 614 galhos com ⓘ; total e soma de conferência iguais (2.797.522,899738952 e 845,9508). Nenhum teste nem texto da tela usa estes números escritos à mão: eles vêm do arquivo de base. Os exemplos abaixo usam o retrato de 08/11; as regras de lista longa (C15) foram desenhadas para árvores de milhares de linhas.

**Nota sobre a skill pedida:** a skill "impeccable" não foi achada nesta máquina; usada a `anthropic-skills:web-design-guidelines` no lugar, como checklist (achados em §4.3). O processo da "impeccable" não foi reproduzido nem suposto.

---

## Parte 1. Análise

### 1.1 O que o app já tem

**Não há sistema de design.** Procurei `**/DESIGN*.md` no repositório (nada), `docs/` (`adr/`, `agents/`, `licoes/`, `lancamento.md`, `steam-setup.md`: nada de UI), `.superpowers/` (só brainstorm e registros do `/implementar`) e `specs/*/` (a 001 tem a §5.6 "Janela (v1)", que lista o conteúdo, não o visual). O único lugar de estilo é `src/renderer/styles.css` (1 KB). Este documento **estende** esse arquivo: os tokens entram no `:root` dele, e o que já existe continua funcionando.

| Peça            | Arquivo                      | O que é hoje                                                                                                                                                              | Estados e textos                                                                                                                                                          |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Janela          | `src/main/window-options.ts` | 420 × 640, `sandbox`, CSP `default-src 'self'` em `index.html`                                                                                                            | título "IdleOn Companion"                                                                                                                                                 |
| Raiz            | `App.tsx`                    | `<main>` com `<h1>IdleOn Companion</h1>`, a tela de setup ou: barra de status, abas, painel, settings **sempre embaixo do painel**                                        | —                                                                                                                                                                         |
| Abas            | `App.tsx` (`TABS`)           | `role="tablist"` com dois `role="tab"` ("Screen map", "Stats") e `aria-selected`                                                                                          | sem `tabpanel`, sem `aria-controls`, sem setas; selecionada só por `font-weight: 600`                                                                                     |
| Barra de status | `StatusBar.tsx`              | `role="status"`, uma linha "Game running · Reader attached · last reading N s ago", mais mensagem e botões                                                                | "Live reading needs the game to be launched through Steam with the companion launch option.", "Let the game close", "Reconnect", "Connect next time", "Restart to update" |
| Screen map      | `ScreenMapPanel.tsx`         | `<table class="screen-map">` de 5 linhas (Screen, World, Map, Character, AFK target)                                                                                      | "No character selected"                                                                                                                                                   |
| Stats           | `StatsPanel.tsx`             | a mesma tabela (reusa a classe `screen-map`), 10 linhas `label`/`text`                                                                                                    | "Calculating", "Calculator unavailable", "unavailable" por linha; nada quando `none`                                                                                      |
| Settings        | `SettingsView.tsx`           | `<fieldset>` com 3 checkboxes e "Set up Steam"                                                                                                                            | "Could not check for updates"                                                                                                                                             |
| Formatação      | `src/main/stats.ts`          | `formatNumber`: separador en-US, `Math.ceil`; `T` a partir de 1e12; `1.49E33` a partir de 1e15 (mantissa cortada, como o jogo); sufixo `x` no Drop Rate, `%` no AFK Gains | —                                                                                                                                                                         |
| Estilo          | `styles.css`                 | `color-scheme: light dark`, `system-ui`, tamanhos em `rem`, **nenhuma cor própria** (cores do sistema), `th` com `opacity: 0.7`                                           | —                                                                                                                                                                         |

Testes de UI que o design tem de manter: `ui.test.tsx` (as linhas do Screen map, a barra de status), `stats-tab.test.tsx` (duas abas, Screen map por padrão), `StatsPanel.test.tsx` (as 10 linhas, os textos fixos, **"has no field to fill in"**, FR-020), `status-bar.test.tsx`. A busca da 008 não pode morar dentro do `StatsPanel`, ou quebra o FR-020.

**Achados do app atual que pesam na 008** (não corrigir na 008 sem pedido; viram follow-up):

1. **O espaço útil é pequeno.** Em 640 px, antes do painel vêm o `h1` (~40 px), a barra de status (2 a 4 linhas e um botão, ~80 a 140 px no estado "attached") e as abas (~40 px); o `SettingsView` fica embaixo. Sobram ~380 a 440 px para a resposta e as primeiras linhas. Todo o desenho de §3 parte desse número.
2. **A barra de status é uma região viva que muda a cada segundo** ("last reading N s ago" dentro de `role="status"`): leitor de tela pode anunciar a cada segundo. A 008 não pode repetir isso no "calculated N s ago".
3. **Abas incompletas**: falta `tabpanel`/`aria-controls` e as setas do padrão APG. A 008 acrescenta a terceira aba ("Formulas") no fim; é a hora de completar (follow-up).
4. **O Drop Rate da Stats pode diferir do jogo em 1**: o jogo mostra "2.797.522x" (`resultados-testes-no-jogo.md`, A6), e o valor calculado é 2.797.522,90; `formatNumber` faz `Math.ceil` e daria "2,797,523x". O teste de `stats.test.ts` usa 2.797.521,5 e não pega o caso. O mockup mostra "2,797,523x". A raiz da árvore usa o texto da Stats (P1 da 006), então herda o que a Stats fizer: conferir no jogo se o Drop Rate é truncado (pergunta 1 de §3.11).

### 1.2 Como as árvores aparecem hoje na bancada

Páginas: `systems\pages\*.html` (71), `any\pages\*.html` (39 stats e `droprate.html`), moldes `page-template.html`, `artifact-template.html`, `screen-proposal\template.html`, e em `docs\product\` a `drop-rate-sheet.html` e a `validar-arvore-drop-rate.html`. Todas as páginas de árvore têm a mesma barra ("Search source name", "↓ Expand", "↑ Collapse", "Hide inactive") e uma árvore aninhada (`role="tree"`), com o valor à direita.

**O que funciona (manter):**

- **Nome à esquerda, valor à direita, uma linha por parte.** Lê como um extrato.
- **Cor pelo papel do valor**: verde para o que soma (`+`), âmbar para o que multiplica (`x`), cinza para o que vale 0 ou ×1 (`fmtV` em `systems\pages\death-note.html`). É o molde do V1 do site do Vinicius, que ele já lê.
- **ⓘ com duas linhas**, nomes e depois números: `Owned × Companion bonus` / `1 × 130 = 130` (Crystal Custard, `droprate.html`). É a melhor peça de explicação que existe hoje.
- **Selo do tipo de folha** em toda folha (2.262 linhas, só 12 "?"), com `yes`/`no` nas condições.
- **"At 0 (N)"** nas páginas de sistema (72 páginas com o grupo; `stamps.html` tem "At 0 (4)" três vezes).
- **A proposta de tela de 10/11** (`screen-proposal\template.html`, aprovada como direção em padrão §2): número grande, "✓ Same as the game's Stats screen", a corrente das três etapas ("Bonuses that add up → Fixed steps → multipliers"), sistemas na ordem do jogo, zeros recolhidos, **descer por navegação com o caminho no topo** em vez de recuar oito níveis.

**O que confunde um jogador (exemplos reais de `any\pages\droprate.html`):**

| #   | Problema                               | Exemplo                                                                                                                                                                                                                                                                           | O que o design faz (§)                                                                    |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Nomes que são caminho de código        | `Current: Loveloon (entry 44 of Research[45]) · Research[7][9]` (7 vezes); `Kills of Gloomie Mushroom · Holes[11][26]`; `Bonus per level · CustomLists.AtomInfo[12][4]`                                                                                                           | o caminho sai do nome e vai para "Game details", a última camada (C10)                    |
| 2   | "Working value of the game"            | `Working value of the game (StarSigns)` = 200; `Working value of the game (HoleozDN)` = 5.112; e a folha "?" `Working value of the game (EclipseSk)` em `death-note.html`                                                                                                         | mostrar como "Saved game value" com o selo "saved by the game" (C7) **(fora do GM)** |
| 3   | Fórmula com código dentro              | `(25 × (Points in the talent + All-talent levels) ÷ (...)) × OptionsListAccount[189]` (Boss Battle Spillover); `round(Slime × CustomLists.RANDOlist[92][0])`; `min(5, pow(1.1 + (min(8, 10) ÷ 100), ceil((309 + 1) ÷ 20)))` usado **como nome** de linha. 34 ⓘ assim no Drop Rate | regras de leitura do ⓘ (C6) e "Calculation" no lugar de nome-fórmula                      |
| 4   | Nomes enormes                          | 119 caracteres: `If no Prayers equipped, get 1/5th bonus of all prayers, and no curses ≠ 1 and Working value of the game (PrayNonEq) ≠ 1`; 110: `x Total Damage and x Drop Rate! @ (NOTE:All Bonuses earned...)`                                                                  | duas linhas no máximo na lista, nome inteiro na página (C2)                               |
| 5   | Rótulo que contradiz o valor           | a linha `× 1.4` mostra **1.116** (é o resultado de 1,4 × 0,797), dentro de `LUK Scaling`                                                                                                                                                                                          | linha de passo mostra a operação e o resultado em colunas separadas (C3)                  |
| 6   | Jargão nas etapas                      | `Additive Pool`, `Total Sum` (845.95, "raw"), `Post-Processing` (×3,306.96), `LUK Scaling`                                                                                                                                                                                        | as três etapas da proposta: "Bonuses that add up", "Game adjustments", "Multipliers" (C3)      |
| 7   | Número sem unidade e com casas inúteis | `K()` sempre com 3 casas: 400 vira "400.000"; 84.383,5 vira "84.384K" sem `%`; a raiz viraria "2.798M" + "x", diferente do jogo ("2,797,522x")                                                                                                                                    | uma regra de formato só, igual à do jogo (§3.6)                                           |
| 8   | Profundidade                           | 17 níveis: `Drop Rate > Additive Pool > 🎽 Equipment > Drop Rate > Gallery trophies: DROP RATE > Lucky Lad > ... > Violet black star > 2 more parts at ×1 > Minimum 1`; recuo de 14 px por nível passa de 230 px numa janela de 420                                               | árvore que abre no lugar, com recuo de 12px e teto visual em 6 níveis (C8) |
| 9   | "?" sem contexto                       | `LUK curve` "?" com a dica `nothing proves what this is: LUK curve`; as dicas de laço citam `Gallery(InitializeTrophyBonuses)` e `(N.js; nothing earlier wrote it)`                                                                                                               | frase de jogador; a explicação técnica só em "Game details" (C7)                          |
| 10  | Dica só no `title`                     | o selo e a linha inteira explicam por `title` (só mouse, sem teclado nem leitor de tela) e o ⓘ abre por hover                                                                                                                                                                     | explicação que abre na linha, por clique ou teclado (C4, C6)                              |
| 11  | Treeview pela metade                   | `role="tree"` e `treeitem`, mas sem setas, sem `aria-level`, `Enter`/espaço só; linha de folha `treeitem` sem foco                                                                                                                                                                | o padrão treeview do APG **inteiro** (§3.8) |
| 12  | Estilo inline                          | `style="padding-left:${8 + n.d * 14}px"` e `tip.style.left`: não passa na CSP do app                                                                                                                                                                                              | recuo por classe, sem posição calculada (§3.2)                                            |
| 13  | Contraste                              | `--zero: #a1a1aa` sobre branco = **2,56:1**; `--muted: #71717a` sobre `#0c0c0e` = 4,04:1 (ambos abaixo de 4,5:1)                                                                                                                                                                  | tokens conferidos (§3.2)                                                                  |
| 14  | Nomes de stat crus no índice           | `any\pages\index.html`: "DamageDealed Max", "PlayerHPmax 0", "AFKgainrates Fighting", "WorkbenchStuff MultiKillTOTAL 0 0"                                                                                                                                                         | busca e títulos por nome de jogador; a chamada só como segundo texto de busca (C12)       |

### 1.3 Referências de leitura rápida de números

Primeira leitura, sem rede (a Parte 4 traz as fontes da pesquisa na rede); a lista de ferramentas e jogos está em `docs\product\comunidade-e-outros-jogos.md` (§1 e §3).

| Referência                                                             | O que ensina                                                          | Como entra aqui                                                                               |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Pirâmide invertida** (jornalismo)                                    | a resposta na primeira frase, o detalhe depois                        | cabeçalho de resposta (C1) antes de qualquer lista                                            |
| **Divulgação progressiva** (Nielsen)                                   | mostrar o que a maioria precisa; o resto a um passo, nunca escondido  | as cinco camadas de §2                                                                        |
| **Números como o jogo mostra**                                         | o jogador compara com a tela do jogo; formato diferente parece erro   | separador en-US, `T`, `E` do jogo (`formatNumber`), sufixo `x` no stat                        |
| **Formato compacto (K/M/B)**                                           | bom para escanear, ruim para conferir                                 | **não** usado: o jogo não usa K/M/B; o valor exato fica na página (§3.6)                      |
| **Percentual vs multiplicador**                                        | "+X%" soma, "×Y" multiplica; misturar sem marca engana                | prefixo `+` e `%` nos que somam, prefixo `×` nos que multiplicam, sufixo `x` só no stat final |
| **Algarismos tabulares e alinhamento à direita** (tabelas financeiras) | as casas ficam umas sob as outras; dá para comparar de cima a baixo   | `font-variant-numeric: tabular-nums` em todo valor, coluna à direita                          |
| **Barras de contribuição** (gráfico de parte do todo)                  | a proporção é lida antes do número                                    | barra só onde as partes **somam exatamente** o pai (C2)                                       |
| **Path of Building, Calcs/breakdown**                                  | cada número abre na lista do que o compõe, com a origem de cada parte | o modelo da árvore inteira; a "Power Report" do PoB é o "+1% here gives" de depois            |
| **Idleon Toolbox** (só leitura, nunca fonte de dado)                   | páginas por sistema, busca `Ctrl+K` com páginas fixadas               | página de sistema (Stamps) e busca única; o IT não é fonte de verdade (HANDOFF §1)            |
| **Auto Review**                                                        | "mostra só as piores", seções com nota                                | o "At 0 (N)" é o "o que ainda não conta", sem nota nem recomendação                           |
| **Painéis de stat de RPG** (o próprio Idleon, WoW)                     | nome do stat, valor, e uma dica com a origem                          | a linha da Stats vira a porta para a árvore                                                   |

---

## Parte 2. Critério central: entender em segundos

**Regra:** um jogador com pouca experiência, olhando a tela por 5 segundos, sabe dizer **quanto é o número** e **de onde vem a maior parte**. Tudo o mais fica a um passo, em camadas, e cada camada só aparece quando ele pede.

| Camada              | O que mostra                                                                     | Quem precisa                     | Onde                                                          | Código cru?                                                                  |
| ------------------- | -------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **L0 Resposta**     | o stat, o valor (igual à Stats), uma frase, "Same as Stats · calculated N s ago" | todos                            | topo da página do stat (C1)                                   | nunca                                                                        |
| **L1 Forma**        | a corrente das etapas e as maiores partes                                        | todos                            | logo abaixo (C3, C2)                                          | nunca                                                                        |
| **L2 Partes**       | cada parte de um ramo, na ordem do jogo, com valor, barra, selo e "At 0 (N)"     | quem pergunta "por quê"          | lista da página (C2, C4, C5)                                  | nunca no nome; selo de honestidade, sim                                      |
| **L3 Conta (ⓘ)**    | "How it adds up": a conta com nomes e com os números                             | quem quer conferir               | primeiro filho do ramo aberto, na própria árvore (C6) | só quando a regra de nome não alcançou; dentro do ⓘ o termo vira o nome genérico com `no name yet`, e o código fica em "Game details" |
| **L4 Game details** | a chamada do jogo, as leituras, o valor exato, "Copy"                            | quem valida (IT, wiki, planilha) | fechado, no fim da página ou do detalhe da folha (C10)        | sim, só aqui                                                                 |

**"O que mais pesa" antes e depois do peso.** Saber o peso de cada parte no total exige recalcular trocando cada parte (decisão 1 de `spec-006-investigar-formula.md`; padrão §6, 35 sistemas em 2,6 s no retrato). Por isso:

|                                           | Sem o peso (MVP)                                                                                                                | Com o ganho por +1 (fatia "Where a gain counts most")                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Ordem das partes                          | **sempre a do jogo** (decisão do Vinicius de 10/11, padrão §2); nunca por tamanho                                               | igual: a árvore não reordena                                                                                          |
| Barra                                     | só num ramo cujas partes somam o pai (C2). No Drop Rate: as 31 partes de "Bonuses that add up" (soma confere: 84.383,509)       | igual na árvore; e uma lista própria, "Where a gain counts most" (C17), ordenada pelo ganho por +1 (`marginal`) |
| Multiplicadores                           | o fator (`×31.8`) e o total depois dele, sem barra                                                                              | igual                                                                                                                 |
| Frase da resposta                         | **só o que a conta diz sozinha**: a maior parte de uma soma (com a fatia dela) e o maior fator. Nunca "most of it" para o total | acrescenta "Biggest gain from +1: Golden Cake amount (+9.9% Drop Rate)." (C17)                                              |
| Passos que não são soma nem produto puros | linha de passo com a operação e o total depois (C3)                                                                             | igual                                                                                                                 |

Por que não "most of it comes from X" já no MVP: num número que é soma seguida de 13 a 18 multiplicadores, "a maior parte" não tem resposta sem o peso. Os dois fatos que a conta dá sozinha são verdadeiros e bastam para o jogador novo: "Largest added bonus: Golden Food, 66% of all added bonuses. Largest multiplier: Equipment ×31.8." (Golden Food = 56.036,19 de 84.383,51 = 66,4%; Equipment = ×31,84, `droprate.html`.)

---

## Parte 3. O DESIGN.md

### 3.1 Princípios

Cada princípio tem um teste que um revisor consegue rodar.

| #   | Princípio                                                                                                                                                                | Como verificar                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Resposta primeiro.** O valor e uma frase vêm antes de qualquer lista                                                                                                   | no DOM, o cabeçalho de resposta (C1) vem antes da primeira lista; a frase tem no máximo 2 linhas a 420 px (≤ 110 caracteres) |
| P2  | **O número é o do jogo.** A raiz é o texto da aba Stats, caractere por caractere; todo valor segue §3.6                                                                  | teste: `root.text === stats.rows["Drop Rate"].text`                                                                          |
| P3  | **Linguagem de jogador nas três primeiras camadas.** Nada de código em L0 a L2 | teste: o texto visível de L0–L2 não casa com as expressões do bloco abaixo |
| P4  | **Ordem do jogo, nunca por tamanho.** A barra e a frase destacam; não reordenam                                                                                          | teste: a ordem das linhas é a ordem dos filhos no dado                                                                       |
| P5  | **Honesto sem assustar.** Todo valor tem número ou selo; nada some; o que não se sabe diz "?" com uma frase calma                                                        | teste: nenhuma linha sem valor nem selo; a contagem de "?" do rodapé é igual à do dado                                       |
| P6  | **A árvore abre no lugar, como pastas.** Cada linha com ▸ abre os filhos ali mesmo, vários níveis na mesma tela (resposta 7c); o caminho no topo é o da linha em foco | teste: abrir um ramo não troca de tela; `aria-level` de cada linha = profundidade; o caminho muda com o foco |
| P7  | **Teclado, leitor de tela e contraste AA em tudo**, sem depender de cor                                                                                                  | §3.8; cada cor tem também um sinal (`+`, `×`, texto do selo)                                                                 |

Expressão do teste P3:

```text
/\[\d|\]\.|DNSM|CustomLists|OptionsList|_customBlock|\(\)/
/decay|Multi\b|\b[A-Z] [×÷] [A-Z]\b|sources \(|[≤≥]/
```

A segunda expressão pega o jargão de conta nos nomes (achado 9 da revisão g) e os símbolos de comparação (achado 1). A terceira (sensível a maiúsculas) pega o jargão de programador nos selos e nomes (os rótulos aprovados na resposta 8 passam; `?` e `Raw bonus` são rótulos mantidos e não entram): os ids crus da spec (`from the game's cache`, `changes at runtime`, `unnamed`) e o "Log Factor", que só podem aparecer em Game details:

```text
/cache|runtime|unnamed|\bloop\b|binding|Log Factor|\b(min|max|pow|ceil|floor)\(|[<>]=?\s*\d/
```

### 3.2 Sistema visual

Tudo em `src/renderer/styles.css` (a CSP `default-src 'self'` proíbe estilo inline; nada de `style=` nem de posição calculada em JS). O tema segue o sistema por `prefers-color-scheme`; o app não tem escolha de tema, então não há `[data-theme]` (o mockup tem o seletor só para demonstração).

#### Tokens

```css
/* All window styles live here: the CSP default-src 'self' blocks inline style attributes. */
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;

  /* surfaces */
  --bg: #ffffff; /* window */
  --surface: #f4f4f5; /* answer header, stage chain, open detail */
  --line: #e4e4e7; /* row separators (decorative) */
  --control: #6b6b73; /* borders of buttons and inputs, bar track edge (≥ 3:1) */
  /* text */
  --fg: #18181b;
  --muted: #52525b; /* secondary text, captions */
  --zero: #6b6b73; /* value 0 or ×1 */
  /* value roles */
  --add: #047857; /* adds (+) */
  --mult: #b45309; /* multiplies (×) */
  --focus: #1d4ed8; /* focus ring, links */
  --danger: #b91c1c; /* unavailable */
  --changed: #fef9c3; /* changed-row background */
  /* leaf-type families (chip text / chip fill) */
  --grow-fg: #1e40af;
  --grow-bg: #dbeafe; /* Level, Quantity, Invested points, Tier, Record */
  --pick-fg: #5b21b6;
  --pick-bg: #ede9fe; /* Condition, Choice */
  --set-fg: #3f3f46;
  --set-bg: #e4e4e7; /* Fixed value (was #f4f4f5 = --surface, 1,00:1) */
  /* type */
  --text-xs: 12px;
  --text-sm: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 28px;
  --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  /* space, radius */
  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 16px;
  --s5: 24px;
  --r-chip: 4px;
  --r-control: 6px;
  --r-card: 8px;
  --row-h: 32px;
  --fade: 2400ms;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #141416;
    --surface: #1f1f23;
    --line: #2e2e33;
    --control: #8b8b94;
    --fg: #e4e4e7;
    --muted: #a1a1aa;
    --zero: #8b8b94;
    --add: #6ee7b7;
    --mult: #fcd34d;
    --focus: #93c5fd;
    --danger: #fca5a5;
    --changed: #26230a;
    --grow-fg: #bfdbfe;
    --grow-bg: #1e3a8a;
    --pick-fg: #ddd6fe;
    --pick-bg: #4c1d95;
    --set-fg: #d4d4d8;
    --set-bg: #2a2a2f;
  }
}

body {
  background: var(--bg);
  color: var(--fg);
}
.num {
  /* nowrap only above 300px: see .num--range and the reflow of C2 */
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.code {
  font-family: var(--mono);
  font-size: var(--text-xs);
  color: var(--muted);
}
:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
.row:focus-visible {
  outline-offset: -2px;
}
@media (prefers-reduced-motion: reduce) {
  .changed {
    animation: none;
  }
}
```

`.num` tem `white-space: nowrap` só acima de 300px de painel; abaixo, um intervalo (`6,194,940 – 8,650,898`) usa `.num--range { white-space: normal }` e quebra no `–`.

O `body` hoje usa o fundo do sistema; com `--bg` explícito, as telas atuais ganham o mesmo fundo nos dois temas (mudança visual pequena; o `th { opacity: 0.7 }` continua acima de 6,5:1 (6,57:1 no claro e 7,57:1 no escuro; passa AA)).

#### Contraste (WCAG 2.x, fórmula da luminância relativa, calculado para este documento)

Texto normal pede 4,5:1; borda de controle e foco pedem 3:1.

| Par                                           | Claro              | Escuro               |
| --------------------------------------------- | ------------------ | -------------------- |
| `--fg` / `--bg`                               | 17,72              | 14,50                |
| `--fg` / `--surface`                          | 16,12              | 12,94                |
| `--muted` / `--bg` · `--surface`              | 7,73 · 7,03        | 7,18 · 6,41          |
| `--zero` / `--bg` · `--surface` · `--changed` | 5,28 · 4,81 · 4,92 | 5,45 · 4,86 · 4,69 |
| `--add` / `--bg` · `--surface` · `--changed`  | 5,48 · 4,99 · 5,11 | 12,07 · 10,78 · 10,38 |
| `--mult` / `--bg` · `--surface` · `--changed` | 5,02 · 4,57 · 4,68 | 12,76 · 11,39 · 10,97 |
| `--focus` / `--bg` (anel, 3:1)                | 6,70               | 10,20                |
| `--danger` / `--bg`                           | 6,47               | 9,69                 |
| `--fg` · `--muted` / `--changed` | 16,50 · 7,20 | 12,47 · 6,17 |
| `--control` / `--bg` (borda, 3:1)             | 5,28               | 5,45                 |
| chip `--grow-fg`/`--grow-bg`                  | 7,15               | 7,29                 |
| chip `--pick-fg`/`--pick-bg`                  | 7,57               | 7,89                 |
| chip `--set-fg`/`--set-bg` | 8,23 | 9,66 |
| `--danger` / `--surface` | 5,89 | 8,65 |
| `--focus` / `--surface` · `--changed` | 6,10 · 6,24 | 9,11 · 8,77 |
| `--control` / `--surface` (borda, 3:1) | 4,81 | 4,86 |

`--line` (1,27 e 1,36) é só separador decorativo, nunca a única borda de um controle. Primeira escolha para `--zero` claro foi `#71717a`, que deu 4,40 sobre `--surface` e foi trocada.

#### Tipografia

| Token       | Tamanho        | Uso                                                                     |
| ----------- | -------------- | ----------------------------------------------------------------------- |
| `--text-xl` | 28px / 600     | o valor da resposta (C1)                                                |
| `--text-lg` | 16px / 600     | título da página (o nome do ramo)                                       |
| `--text-md` | 14px / 400     | corpo, frase da resposta                                                |
| `--text-sm` | 13px / 400     | linhas da lista                                                         |
| `--text-xs` | 12px / 400–600 | selos, legendas, "calculated N s ago", `.code`; **nada menor que 12px** |

- Fonte: `system-ui` (Segoe UI no Windows), a que o app já usa. `font-variant-numeric: tabular-nums` em todo valor (`.num`); `mono` só para o código de L4.
- Altura de linha 1,4; nomes em _sentence case_; sem caixa alta em selos.
- O resto do app hoje usa o tamanho padrão do navegador (16px) com `h1` em 1,25rem. Os tokens valem para os componentes novos; levar as telas antigas a 14px é pergunta 10 de §3.11.

#### Espaço, raio, borda, movimento

- Escala de 4px: `--s1` 4, `--s2` 8, `--s3` 12, `--s4` 16, `--s5` 24. Margem lateral do painel: 16 (a do `body` atual).
- Linha: `min-height: var(--row-h)` (32px, acima do alvo mínimo de 24 × 24 do WCAG 2.5.8), `padding: 4px 8px`, separador `1px solid var(--line)`.
- Recuo: 12px por nível pela classe `.lvl-1` … `.lvl-6` (teto visual em 6; abaixo de 300px, 8px e teto em 4), sem estilo inline (C8).
- Raio: 4 nos selos, 6 nos botões e na busca, 8 nos cartões (resposta, etapas).
- Movimento: só o destaque de mudança (C11), `--fade` 2,4 s; com `prefers-reduced-motion: reduce`, sem animação (o destaque fica parado até o próximo Refresh). Nada de rolagem animada.

### 3.3 Componentes

Os nomes de componente são sugestão para o React (`src/renderer/`); cada um diz anatomia, estados, comportamento, teclado e ARIA.

#### C1. Cabeçalho de resposta (`AnswerHeader`)

```
Drop Rate · Character 1 (Royal Guardian)                         [Refresh]
2,797,522x
Largest added bonus: Golden Food, 66% of all added bonuses.
Largest multiplier: Equipment ×31.8.
At zero for now: Prayers, Menagerie.
✓ Same as Stats · calculated 3 s ago
```

- **Anatomia:** linha 1, o stat e o personagem ativo (`--text-xs`, `--muted`) e o botão Refresh à direita; linha 2, o valor (`--text-xl`, `.num`, alinhado à esquerda); linhas 3–5, a frase; linha 6, a linha de confiança. Fundo `--surface`, raio 8, `padding: 12px`. A linha 1 é visual; no DOM, o `<h2>` vem primeiro (nome em `sr-only` e o valor) e o Refresh depois dele, posto à direita por grid. Abaixo de 300px de largura do painel, o valor cai para 22px.
- **Frase**, montada do dado, nunca escrita à mão por stat:
  - com etapas (soma e depois multiplicadores): `Largest added bonus: {maior parte da soma}, {fatia}% of all added bonuses. Largest multiplier: {maior fator} ×{fator}.`
  - terceira linha, só quando há partes em 0 ou ×1 no primeiro nível: `At zero for now: Prayers, Menagerie.` (sem `(0)`/`(×1)`); com mais de 2: `At zero for now: Prayers, Menagerie and {n} more.` (nomes na ordem do jogo; a frase inteira ≤ 110 caracteres por linha)
  - árvore sem etapas, com soma exata: `{n} parts count. The largest is {nome} ({fatia}%).`
  - sem soma exata: `{n} parts count; {z} are at 0.`
  - com o ganho por +1 (depois, C17): acrescenta `Biggest gain from +1: {folha} (+{x}% {stat}).`
  - sistema (sem total, como Stamps): `Your stamps give {n} bonuses in {g} groups; {z} give nothing yet.` (frase do mockup, tela C; serve).
- **Linha de confiança:** `✓ Same as Stats` quando a raiz é igual ao texto da Stats **do mesmo mosaico** do cálculo; a árvore **não** aparece se a raiz divergir (resposta 4): a tela mostra só o número da Stats e `Breakdown unavailable`, e o caso é registrado; a paridade vale para o personagem ativo (não deveria acontecer; é o teste P1 da 006 visível), nunca enquanto a Stats andou e a árvore espera o Refresh: aí a linha diz `Last calculated {N} s ago` (C11). `calculated N s ago` atualiza a cada 5 s, **fora de região viva**.
- **Estados:** `ready`, `calculating`, `game-changed` (C11), `game-closed` (§3.5), `unavailable` (§3.5), `breakdown-unavailable` (raiz ≠ Stats), `not-active` (C19).
- **Teclado/ARIA:** o valor e o nome formam o `<h2>` da página (`<h2>Drop Rate <span class="num">2,797,522x</span></h2>`), que recebe o foco (`tabindex="-1"`) ao abrir a página. Refresh é `<button>`.

#### C2. Linha da lista (`PartRow`)

```
Part                              Adds       Share of this list
🍔 Golden Food                    +56,036%   66% of this list ▕████▏  ›
   Owned food · Quantity 38                                          (leaf detail, open)
```

- **Anatomia, da esquerda para a direita:** ícone do sistema (emoji, `aria-hidden`, só quando o dado tem); nome (`--text-sm`, até 2 linhas, `-webkit-line-clamp: 2`); selos (C4, C7); valor (`.num`, cor do papel: `--add`, `--mult`, `--zero`); fatia e barra (só em soma exata); marca de fim: `›` (ramo: abre a página dele) ou `▸`/`▾` (folha ou grupo: abre embaixo). O nome é filho flex com `min-width: 0`, para o corte funcionar.
- **Refluxo:** abaixo de 300px de largura do painel (`@container`; a 200% de zoom a janela tem 210px CSS), a linha vira duas: na 1ª, ícone e nome (até 2 linhas); na 2ª, selos · valor · fatia em texto. A barra some (a fatia continua escrita); selo longo quebra linha; o valor passa para a linha de baixo, e um intervalo quebra no `–` (`.num--range { white-space: normal }`). Nunca rolagem horizontal.
- **Nome cortado:** ao abrir o detalhe de uma folha, ele começa pelo nome inteiro quando o nome foi cortado.
- **Valor:** §3.6. Prefixo `+` (soma), `×` (multiplica), nada (cru); 0 e ×1 em `--zero`.
- **Os dois percentuais têm rótulo visível:** um cabeçalho de colunas acima da lista (`--text-xs`, `--muted`): `Adds` (numa soma) ou `Multiplies` (num produto), e `Share of this list`; a fatia diz `66% of this list` na linha. No refluxo: `+56,036% · 66% of this list`.
- **Ícone e total do passo vêm do dado** (campos do contrato: `icon` e `step: { op, after }`); a tela não os deduz.
- **Barra de contribuição:** `<meter min="0" max="1" value="0.664">` nativo, `aria-hidden="true"` (a fatia já está em texto: "66%"), largura fixa de 56px, trilho com borda `--control`, preenchimento `--add`. Aparece **só** quando a linha tem `share` e o pai é `sum` ou `product` (C15); nos modos `mixed`, `cap`, `condition` e `unknown`, sem barra. Fatia abaixo de 1% mostra "<1%" sem barra. No Drop Rate, isso vale para as 31 partes da soma; as etapas de passo e de multiplicador não têm barra (os 17 filhos do `Post-Processing` não somam nem multiplicam o pai: 55,7 e 1.978,9 contra 3.306,96).
- **Sem `ⓘ` na linha:** o ícone parecia botão e não era. O nome acessível diz ", has a calculation"; a conta é o primeiro filho do ramo aberto ou um filho informativo da folha (C6).
- **Estados:** normal, hover (`--surface`), foco (anel `--focus` por dentro), aberto (`▾`, detalhe embaixo com fundo `--surface`), mudou (C11), zero (valor em `--zero`; o nome continua `--fg`).
- **Comportamento:** ramo → abre os filhos **no lugar** (C8), calculados quando o ramo é aberto (plano B, resposta 6); folha → abre ou fecha, também no lugar, os filhos informativos: a frase do tipo (C4), a conta se houver (C6), "Game details" (C10) e `Copy`. Vários ramos abertos ao mesmo tempo.
- **Teclado/ARIA:** a linha é um `treeitem` do treeview (§3.8), com `aria-level`, `aria-setsize`, `aria-posinset` e, se tiver filhos, `aria-expanded`. Nome acessível na ordem nome, valor, fatia, selo: "Golden Food, plus 56,036%, 66% of this list, 1 part"; a fatia visual é `66% of this list`. Parte com conta termina em ", has a calculation". Um mesmo sistema em duas etapas leva a etapa no nome: `Equipment (adds)` e `Equipment (multiplies)`, e o primeiro filho do ramo diz "Equipment counts in two places: once with the bonuses that add up, once as a multiplier. The game uses both."
- **Calculando esta parte:** ao abrir um ramo ainda não calculado, a linha mostra `calculating this part…` no lugar dos filhos (`aria-busy="true"` no `group`); prontos, os filhos entram, e a região viva diz `{nome}: {n} parts ready` só se o foco ainda estiver nessa linha. A raiz e as etapas saem na hora; nada trava a árvore enquanto um ramo calcula.

#### C3. Etapas e passos (`StageChain`, `StepRow`)

```
Read left to right: the game adds, adjusts, then multiplies.
[Bonuses that add up]   →  [Game adjustments]  →  [Multipliers]
 Total so far: 846x         Total so far: 1,304x    Final: 2,797,522x
 +84,384%                   fixed steps             ×2,145
```

- **StageChain:** três botões-cartão (`--surface`, raio 8) com o nome da etapa (`--text-xs`, `--muted`), o **total acumulado** até ali em destaque (`Total so far: 846x`; no último, `Final: 2,797,522x`; `--text-sm` 600) e, embaixo, em letra menor, a operação da etapa (`+84,384%`, `fixed steps`, `×2,145`); uma legenda de uma linha acima: `Read left to right: the game adds, adjusts, then multiplies.`; `aria-label` do cartão: "Multipliers, times 2,145, total 2,797,522x". Clicar rola até a seção da etapa e põe o foco no título dela (`scroll-margin-top` no título, para nada fixo cobri-lo). A 420px cabe em uma linha (3 × ~120px); abaixo de 360px, quebra em coluna, sem setas.
- **StepRow** (ajustes e multiplicadores): três colunas, `op` (`+ 2`, `× 1.28`), nome, e o **total acumulado** depois do passo, com cabeçalho de coluna visível `Total so far` (`--text-xs`, `--muted`): `× 1.4 · LUK part · → 1.116`. Nome acessível: "times 1.4, LUK part, total so far 1.116". Abaixo de 300px, `op` e total vão para a 2ª linha.
- **Nomes das etapas:** "Bonuses that add up", "Game adjustments" (era "Fixed steps", que não dizia nada ao iniciante), "Multipliers" (proposta de 10/11). O valor da primeira é a soma em pontos percentuais (`+84,384%`), não o resultado depois do `÷ 100` (o mockup mostra "846x" ali: ver §3.10).

#### C4. Selos de tipo de folha (`LeafTag`)

Texto sempre visível (nunca só cor); cor pela **família**, que diz ao jogador novo o que ele pode fazer com aquela folha. **A família também aparece em texto:** é a primeira frase do detalhe da folha (`You can raise this.` / `You unlock or pick this.` / `Set by the game.`) e o título de grupo na legenda (C13). Todo selo de tipo tem `border: 1px solid currentColor`, além do fundo. Teste: com `forced-colors: active`, a família de cada folha aberta continua legível.

| Dado (`kind`)     | Rótulo do selo                              | Família                      | Frase (um clique na linha)                                                                  | Exemplo real                                    |
| ----------------- | ------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Level             | `Level`                                     | Grows as you play (`--grow`) | "A level you upgraded. Raise it in this item's menu."                                       | Golden Sixes stamp level = 230 (mockup, tela D) |
| Quantidade        | `Quantity`                                  | Grows                        | "A count you grow by collecting or killing more."                                           | Kills of Ancient Golem = 43                     |
| Pontos investidos | `Invested points`                           | Grows                        | "Points you put in. Spend more points here to raise it."                                    | Points in the talent (Robbinghood) = 0          |
| Tier              | `Tier`                                      | Grows                        | "A rank step, like a sigil colour or an artifact form. The next tier gives more."           | Trove sigil tier                                |
| Recorde           | `Record`                                    | Grows                        | "Your best result so far. Beat it to raise the bonus."                                      | Best bonus of this talent among your characters |
| Condição          | `Condition · {sub}`                         | Unlock or pick (`--pick`)    | "A yes or no check the calculation uses. How it adds up, above, shows what each answer does." + a frase do subtipo; quando a regra conhece o efeito, "Here, {yes/no} means the bonus counts." | Points in the talent above 0 = no |
| Escolha           | `Choice`                                    | Unlock or pick               | "Something you selected. Change the pick to change the bonus."                              | Prayer in slot 2                                |
| Valor fixo        | `Fixed value`                               | Set by the game (`--set`)    | "Set by the game. You can't change it."                                                     | Curve (decay): 40 and 65 = 40                   |
| Bônus cru | `Raw bonus` | Unlock or pick | "A ready bonus from an item, companion, set or card. Get or wear a better one to raise it." | Boss Battle Spillover (banned list) = 1 |
| sem tipo | `?` (borda tracejada, `--muted`, sem fundo; nome acessível "unknown type") | — | "We don't know yet what kind of number this is. The number itself is right: it comes from the game." | LUK curve = 0.797 |

- Rótulos dos selos = os que a bancada já mostra (mapa `KIND` das páginas). **Atenção:** é `Invested points`, não "Points invested" (o mockup acertou; o pedido deste documento dizia o contrário).
- **Subtipos de Condition** (mapa `SUB` da bancada; conteúdo do Glossário M, em forma de pergunta): `owned` "Do you have it (bought, built, found or unlocked)?", `done` "Did you finish it?", `active` "Is it on or equipped right now?", `equals a value` "Is it set to exactly this value, like the vote of the week?", `limit` "Did it pass this limit, like level above 0?", `max` "Is it at max level?". O selo mantém `limit` (bancada e Glossário M concordam).
- Valor da condição: `yes` / `no`, os dois em `--fg`: a cor não pode dizer "conta" ou "não conta", porque numa condição invertida (`Level is 0 or less = no`) é o **no** que deixa o bônus contar.
- **Nomes de comparação em palavras** (regra de exibição, a registrar no padrão para todas as árvores): `Level ≤ 0` → `Level is 0 or less`; `Dungeon map > 0` → `Dungeon map above 0`; `X = 1` → `X is 1`. O símbolo fica no ⓘ.
- `?` tem um sentido só: **tipo de folha desconhecido**. Nome que falta é `no name yet` (C7); nunca os dois no mesmo selo. Nas contagens deste documento, "?" continua sendo o nome da bancada para essas folhas.
- **Teclado/ARIA:** o selo não é botão (a linha é); o texto do selo entra no nome acessível (`Condition, limit`: o `·` é `aria-hidden`). A frase entra no detalhe aberto (`aria-controls`). Nada de `title`.
- **Legenda:** link "What the tags mean" no rodapé da árvore, que abre a página da legenda (tela D do mockup).

#### C5. "At 0 (N)" (`ZeroGroup`)

```
▸ At 0 (1) · not adding anything now
```

- Sempre o último item da lista do ramo, fechado. Abre embaixo, com as partes em `--zero`, cada uma com seu selo (é o que o jogador avançado procura: "o que está em 0 e eu poderia ligar?").
- Num ramo de multiplicadores, o mesmo grupo para ×1: rótulo `At ×1 (N) · no effect yet`, com a frase do Glossário M "These multiply by 1 now: no effect yet, but they can grow." (pergunta 3). A gravação chama o grupo de "N more parts at ×1"; a tela usa o rótulo par do "At 0".
- No Drop Rate do retrato: a soma tem 1 sistema em 0 (🙏 Prayers) e os multiplicadores 1 em ×1 (🪼 Menagerie); a proposta de 10/11 conta 7 fontes e 1 multiplicador por fonte.
- **Teclado/ARIA:** `<button aria-expanded aria-controls>`; o texto lido é "At 0, 1 part, not adding anything now".

#### C6. Fórmula ⓘ (`HowItAddsUp`)

```
ⓘ How it adds up
Owned × Companion bonus
1 × 130 = 130
```

- **Onde:** é o primeiro filho de um ramo aberto (`ⓘ How it adds up = 62.5`, um `treeitem` que abre as duas linhas) e um dos filhos informativos de uma folha que tenha conta. Aberto por padrão só quando a conta tem até 2 linhas e nenhum termo `no name yet`; senão, fechado: `▸ How it adds up = 62.5` (o resultado aparece sempre, mesmo fechado). Duas linhas, como a bancada: nomes (`--text-sm`, `--fg`), números com o resultado (`--text-sm`, `.num`, `--muted`). Quebra de linha livre; nada de caixa flutuante.
- **Conferência visível:** o resultado escrito depois de `=` é o valor da linha (teste P2 da 008 nas notas de produto).
- **Leitura legível** (regra de exibição; o dado não muda; se aprovada, vira regra no padrão, porque toda correção vale para todas as árvores):
  - teto e piso com as palavras do Glossário M: `min(x, 10)` → `x, capped at 10` (Cap); `max(1, x)` → `x, at least 1` (Minimum); sem número fixo, `min(a, b)` → `lowest of (a, b)` e `max(a, b)` → `highest of (a, b)`; `ceil(x)` → `round up(x)`; `floor(x)` → `round down(x)`; `round(x)` fica; `pow(a, b)` → `a ^ b` **(fora do GM)**.
  - um termo que ainda é caminho de código (`OptionsListAccount[189]`, `CustomLists.RANDOlist[92][0]`, `Dream[13]`) aparece como `game value` (nome genérico, selo `no name yet`) e conta no rodapé "{b} parts have no name yet"; o caminho só em "Game details". A regra de nome da bancada é que tira o termo, não a tela.
  - ramo cujo nome é a própria conta (`min(5, pow(1.1 + ...))` como nome) mostra o nome `Calculation`.
  - **jargão de conta sai do nome da linha** e vai para o ⓘ e "Game details" (regra de exibição, a registrar no padrão): `Curve: decay (A × L ÷ (L + B))` → `Level curve (slows down)`; `Curve: decayMulti (…)` → `Level curve, as a multiplier (slows down)`; `Curve: add (A × L)` → `Level curve (same gain each level)`; `decay constant`, `add constant`, `Start value` → `Curve number` (Fixed value); `Level factor` → `Level share (fast, then slows)`; `Percent to number (÷ 100)` → passo `÷ 100` · `Percent to number`.
  - fórmula de "laço banido" e afins ("0: this talent is banned from the All-talent levels" / "banned → 0") aparece como está: já é frase.
- **ARIA:** `<section aria-labelledby>` com o título "How it adds up"; as duas linhas são `<p>`; o leitor lê o texto, sem símbolo `ⓘ` (`aria-hidden`).

#### C7. Selos de honestidade (`TruthTag`)

Contorno de 1px `--control`, sem fundo, `--text-xs`, texto `--fg`: distinto do selo de tipo. A diferença nunca depende só do fundo: o selo de honestidade começa por minúscula e fica depois do selo de tipo; na legenda (C13), os dois estão em grupos com título. Cada um com uma frase no detalhe.

**Id do selo (spec P8 e contrato) → rótulo na tela.** Trocas aprovadas pelo Vinicius (resposta 8): `saved by the game`, `no name yet`, `shown earlier`, `repeated step`, `changes while you play` e só "parts"; ficam `?` e `Raw bonus`. `limit wins now`, `At zero for now` e `Game adjustments` são propostas deste DESIGN, ainda sem validação:

| Id (spec, dado) | Rótulo na tela |
| --- | --- |
| `?` | `?` (rótulo mantido, resposta 8; nome acessível "unknown type") |
| `unnamed` | `no name yet` |
| `from the game's cache` | `saved by the game` |
| `from the game` | `from the game` |
| `changes at runtime` | `changes while you play` |
| `Same as above` | `shown earlier` |
| `not counting now` (`binding: false`) | `limit wins now` |
| `stopped here`, `unavailable`, `game bug: counted twice` | iguais |


| Selo                      | Quando                                                                                                                      | Frase (fora do GM)                                                                                              | Abre?                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `?`            | folha sem tipo | ver C4 | — |
| `saved by the game`   | o valor vem de um cache que outra conta encheu                                                                              | "The game had this result saved. Open it to see how the game worked it out."                                       | sim, na conta que gravou                                |
| `from the game`           | cache que vem da memória do jogo                                                                                            | "Read straight from the running game. Nothing to open below it."                                                | não                                                     |
| `stopped here`            | passou do limite de linhas ou de tempo                                                                                      | "This part is too big to show whole here. Open it on its own to see the rest." + botão "Open {name} on its own" | sim, como página própria                                |
| `limit wins now` | num min/max, o lado que não vence agora (`binding: false`) | "A limit decides this number right now, so this part changes nothing today." | não; a linha vai para o fim, na ordem original |
| `unavailable`             | a conta falhou (ator em cena, erro)                                                                                         | "Could not be calculated with this reading. The rest is still right."                                           | não; valor "—"                                          |
| `changes while you play`      | valor de tabela que o jogo muda enquanto roda (8 no Drop Rate)                                                              | "The game changes this value while it runs."                                                                    | não                                                     |
| `game bug: counted twice` | o código do jogo conta a mesma fonte duas vezes (achado: o Hat Rack entra duas vezes no Cape Vine, em Defence)              | "The game itself counts this twice. The app shows what the game calculates."                                    | não; as duas linhas ficam, cada uma com o selo          |
| `no name yet` | a peça não tem nome provado | na lista, um nome genérico de jogador (`Game value`, `Part 3` de um laço) com o selo; frase "No player name yet for this game value."; o nome do código só em "Game details" (L4) | — |
| `shown earlier`           | a mesma peça (mesma chamada) já apareceu aberta antes nesta árvore (regra NR-P da pesquisa, aprovada para a próxima rodada) | "This part already appears above, with the same value. Go there to see how it adds up."                         | não abre aqui; o botão "Go to it" leva à primeira (C16) |

- **`game bug: counted twice`**: contorno `--control` e texto `--fg`, como os outros selos de honestidade (a cor do papel do valor não serve à interface, M4); se precisar de destaque, contorno `--danger` (6,47:1 e 9,69:1). Texto do selo sempre visível, frase no detalhe. O valor não é corrigido: o app mostra o número do jogo (P2). Só entra com prova registrada no padrão (bloco, argumento e o ponto do código que conta duas vezes); sem prova, nada de selo. Nome acessível: "game bug, counted twice". **(fora do GM)**
- **"Working value of the game (X)"** na lista vira `Saved game value` + `saved by the game`; o `X` vai para "Game details" **(fora do GM**: o Glossário M não tem esse caso; o padrão "Value from an earlier step" é outro, o passo anterior sem nome); vira regra no padrão se aprovado.
- Rodapé de toda árvore: `{a} parts with an unknown type · {b} parts have no name yet · What the tags mean`; os dois números abrem a lista dessas linhas (cenário A4). Cada contagem só aparece quando é maior que 0; com as duas em 0, o rodapé é só `What the tags mean`. Progresso de laço ("Earlier trophies with the same stat", 8 no Drop Rate) **não** entra no "?" do rodapé: tem contagem própria em "Game details" da árvore, porque não é folha.

#### C8. Árvore no lugar e caminho (`FormulaTree`, `PathBar`)

```
Stats › Drop Rate › Bonuses that add up › Talents        (caminho da linha em foco)
▾ Drop Rate                                   2,797,522x
  ▾ Bonuses that add up                         +84,384%
    ▸ 🎯 Talents                     +62.5%   <1% of this list
    ▾ 🍔 Golden Food                +56,036%  66% of this list
        calculating this part…
  ▸ Game adjustments                       Total so far 1,304x
```

- **Árvore como pastas (resposta 7c):** cada linha com ▸ abre os filhos ali mesmo; vários níveis e vários ramos abertos na mesma tela. Substitui a "página por ramo" de 10/11.
- **Recuo:** 12px por nível, com **teto visual em 6 níveis** (72px). Do 7º nível em diante a linha fica no recuo do 6º e ganha um indicador de nível à esquerda do nome, `L9` (`--text-xs`, `--muted`, `aria-hidden`: o `aria-level` diz o nível ao leitor). Abaixo de 300px de painel (a 200% de zoom, 210px CSS): 8px por nível e teto em 4 níveis (32px), com o mesmo indicador. Cada grupo aberto tem uma guia vertical de 1px `--line` no recuo do pai.
- **Caminho = linha em foco:** `<nav aria-label="Path"><ol>` acima da árvore, com o caminho da linha que tem o foco (atualiza no foco, fora de região viva). Clicar num item põe o foco naquela linha (os ancestrais já estão abertos). Mais de 4 itens: primeiro, `…`, dois últimos; o `…` é um botão "Show full path" que mostra o caminho inteiro quebrando linha.
- **C15 dentro de cada nó aberto:** os filhos de qualquer ramo seguem a lista longa (5 a 10 maiores na ordem do jogo, `Small (N)`, `At 0 (N)`, `Show all N parts`); `Small`, `At 0` e `Show all N parts` são `treeitem`s do mesmo grupo.
- **Voltar:** depois de ir à primeira aparição de uma peça (C16), `Backspace` ou `Alt+←` devolvem o foco à linha de origem (histórico de foco).
- Todo alvo fora da árvore (caminho, `…`, rodapé, seletor) tem `min-height: 24px` e `min-width: 24px`. Profundidade não tem limite (17 níveis no Drop Rate).

#### C9. Portas de entrada: Stats e aba Formulas (`StatsPanel`, `FormulasTab`)

- **MVP (recomendado nas notas de produto, pergunta 3):** a aba Stats **continua `<table>`**, com `<th scope="row">` (o `StatsPanel.test.tsx:43-51` confere `rowheader` e `row`, e o `AGENTS.md` proíbe enfraquecer teste). Na linha que tem árvore, só a célula do valor ganha um `<button>` dentro do `<td>`: `2,797,522x ›`, nome acessível "Drop Rate, 2,797,522 times, see how it's calculated". O painel troca a tabela pela página do stat, com o breadcrumb começando em `Stats`. As linhas sem árvore continuam como hoje. Os testes de `rowheader` e `row` não mudam; entra um teste novo para o botão.
- **A Stats tem 10 linhas para 11 números:** a linha Damage mostra Min e Max (`6,194,940 – 8,650,898`, que quebra no `–` abaixo de 300px). Ela abre uma página-ponte com as duas árvores, `Stats › Damage`, cada uma em `›`: `Stats › Damage › Max` e `Stats › Damage › Min`. As outras nove linhas abrem direto a árvore delas.
- O teste "has no field to fill in" continua valendo (botão não é campo).
- Clicar na aba Stats, selecionada ou não, mostra a tabela. A árvore aberta fica em memória: a linha `Drop Rate ›` volta a ela onde parou. O app lembra a última aba aberta na sessão (tira um clique de todos os cenários de §3.9).
- **Aba `Formulas` (resposta 7b):** no fim das abas, lista os números que têm árvore (os 11 da Stats: Damage aparece como `Max damage` e `Min damage`), cada um com o valor e `›`; **sem busca livre** (a busca, C12, fica para uma spec futura). O caminho começa em `Formulas`. A mesma tabela simples (`<table>`, `<th scope="row">`, o valor como botão), para as duas portas lerem igual.
- O seletor de personagem (C19) fica no topo da página do stat. Durante a implementação (decidido pelo Vinicius em 14/11): só no painel lateral, não na aba Formulas, porque os valores da aba são sempre do ativo; mostra "Nome (classe)".

#### C10. Game details (`GameDetails`)

```
▸ Game details
  Game call     GetTalentNumber(1, 655)
  Reads         SkillLevels[655] = 100
  Exact value   62.5
  [Copy]
```

- Última camada, sempre fechada: o último filho informativo de um ramo aberto ou de uma folha aberta. Lista de definição (`<dl>`), valores em `.code`.
- **Copy** copia uma linha separada por tab: o nome da linha, a chamada (bloco e argumentos) e o número cru, sem separador de milhar (`Golden Food	GoldFoodBonuses(…)	56036.189754`; a tela mostra o formatado), todos átomos do R7, nunca texto do código do jogo. Depois de copiar, o botão diz "Copied" por 2 s, e a frase vai pela região viva da página (§3.8), não por um `aria-live` no botão.
- Para a árvore inteira: "Game details" no fim da página do stat traz linhas, ⓘ, "?" e progresso de laço, lidos do dado, para quem compara com a bancada; devem ser iguais ao arquivo da base congelada (`BASELINE-3.1-READY.txt`).
- **Privacidade:** nenhum caminho cru com o nome de um personagem (`PlayerDATABASE.<nome>…`, `…Lv0[<nome>]`) aparece aqui nem no Copy. O trecho do nome vira o número do personagem (`PlayerDATABASE[character 2].…`); o nome só aparece onde o app já o mostra (o "Character" do Screen map e o C1). Vale para toda leitura de estado com texto do jogador (padrão §4, 006 R7). Teste: com o jogo falso, o texto de "Game details" e do Copy não contém nenhum nome de personagem do estado.
- **Progresso de laço** (2.058 das 8.123 linhas do ExpMulti-4) só aparece quando pedido: um botão `Show repeated steps (N)` aqui, que abre essas linhas na lista da página, marcadas `repeated step`. Fechado por padrão em toda página.

#### C11. Valor ao vivo e comparação (`ChangeBadge`)

- **Recalcular:** ao abrir e no Refresh (notas de produto, R10). O C1 ganha a faixa `The game now shows {texto novo}. Refresh to see what changed.` (botão `Refresh now`; o Refresh de cima some enquanto a faixa está), sem mudar nada sozinho: uma árvore que muda enquanto é lida confunde.
- **Quando a faixa acende:** só quando muda o texto da Stats para a raiz, ou uma peça da página aberta. **Nunca** por contadores que andam sozinhos (kills, timers, tempo de jogo) sem mudar esses valores. Troca do personagem ativo: a árvore se refaz sozinha para o novo (resposta 5), sem faixa. Com a faixa, a linha de confiança diz `Last calculated {N} s ago`, nunca `≠` (C1).
- **Depois do Refresh:**
  - raiz: `2,797,522x` e embaixo `was 2,790,100x · up 0.27%` (`--text-xs`);
  - linha que mudou: fundo `--changed` que some em `--fade`, e embaixo do valor só `was +56,036%` (o valor novo está ao lado; a palavra "was" não depende de cor); o texto fica até o próximo Refresh;
  - ramo fechado com algo que mudou dentro: o texto visível `changed inside` (`--text-xs`, `--muted`), não um ponto.
- **Foco:** depois de `Refresh now`, a faixa some e o foco vai para o `<h2>` da página; enquanto calcula, a região viva diz `Calculating the breakdown…` e, ao fim, a frase do Refresh. Abaixo de 300px, a faixa empilha texto e botão.
- **Árvore de sistema** (fatia de sistemas): fora da leitura rápida, o topo diz `Updated up to N s after the game`, e o Refresh é sempre oferecido.
- `prefers-reduced-motion: reduce`: sem animação; o fundo fica até o próximo Refresh.
- Leitor de tela: uma frase só, numa região `aria-live="polite"` da página: "Drop Rate updated: 2,797,522x, up 0.27%. 3 parts changed." Nada de anúncio por linha.
- O que mudou "desde ontem" fica fora (exige gravar em disco; notas de produto P10).

#### C12. Busca (`FindBox`, spec futura: fora da 008, resposta 1)

- `<div role="search">` com `<input type="search">` rotulado "Find a stat or system" e, embaixo (não em popup), a lista de resultados `<ul>` de botões. `↓` do campo vai ao primeiro resultado; `↑`/`↓` andam; `Esc` limpa.
- Resultados agrupados sempre na mesma ordem (a do mockup, tela A): Stats, Skills, Classes, Systems, Subsystems, Pieces; cada grupo com uma linha cinza que diz o que é; cada resultado com o caminho em linguagem de jogador e o valor ao vivo.
- Casa o nome de jogador e, em segundo, a chamada (`TotalStats STR` acha "STR"; `DamageDealed Max` acha "Max damage", nome do Glossário M); a chamada nunca aparece no resultado.
- Campo vazio: os 10 números da Stats e os sistemas como atalhos.
- **Classes:** o grupo "Classes" e as árvores de talento por classe só mostram as classes que a conta tem. Talentos de uma classe que a conta não tem valem 0 e **não aparecem**, nem no "At 0 (N)"; o rodapé da página diz quantos ficaram de fora: `Talents of classes you don't have are not shown (N)`. Assim nada some sem aviso (P5), e o jogador novo não vê centenas de zeros que não pode ligar.

#### C13. Legenda (`TagsLegend`)

Página "What the tags mean" (tela D do mockup): os 9 tipos e os selos de honestidade, cada um com o selo, a frase e um exemplo real. Aberta pelo rodapé (C7). Lista `<dl>`.

#### C14. Formatação de números (`formatValue`)

Uma função só no renderer, sobre a `formatNumber` que já existe (§3.6).

#### C15. Lista longa: as que mais pesam primeiro (`PartList`)

Obrigatório com os números novos (Drop Rate com 2.414 linhas no BASELINE-3.1, já com o `shown earlier`; sem ele, 5.024). Vale para a lista de partes de toda página (C2).

**Como o impacto é medido antes do recálculo (P9 das notas de produto):** pelo campo `share` que o worker calcula depois de montar a árvore (Share S da pesquisa, `share-s/SPEC-share.txt`), sem refazer o estado do jogo. A tela não calcula peso: lê `share`, `shareMode`, `sign` e `binding` do dado.

| `shareMode` do pai | `share` de cada linha | Como a tela mostra |
| --- | --- | --- |
| `sum` | parcela ÷ valor do pai. Com constante na conta (`1 + a + b`), a constante não é linha e os shares somam menos que 1 | a fatia (`66%`); a parte fixa aparece como linha cinza `Fixed part · {%}` no fim, para a soma fechar à vista |
| `sum` com parcela negativa | abs(parcela) ÷ Σ abs(parcelas), `sign: -1` | a fatia com sinal: `−4%` |
| `product` | abs(ln f) ÷ Σ abs(ln f) (×1 pesa 0) | a fatia do fator; fator < 1 (`sign: -1`) aparece com sinal: `×0.8 · −6%` (ele reduz o total; nunca escondido) |
| `product-zero` | os fatores 0 dividem o peso; os outros ficam com 0 | no lugar da porcentagem, `zeroes the total`; o C1 do ramo diz `{nome} is ×0, so this total is 0.` |
| `cap` / `cap-zero` (min/max) | a linha que não mexe no pai: 0 e `binding: false`; as que mexem dividem o peso | a linha sem efeito ganha o selo `limit wins now` (C7) e vai para o fim, na ordem original; a que vale como teto leva a fatia |
| `mixed` (curvas, frações) | peso pelo efeito de tirar a linha; serve para ordenar | a fatia, com `≈` (`≈ 40%`): é ordem, não parcela |
| `condition` / `unknown` | `null` | sem fatia nem barra; a linha vai para o fim, na ordem original (não some) |

- **O que entra na ordem por impacto:** só as linhas que o jogador sobe. Valor fixo e Condição ficam de fora da escolha das maiores (uma constante de curva pode ter 27,8% do log, como o `Fixed ×150000000` do DamageDealed-Max, mas ninguém a sobe); o `share` deles continua no dado e na linha, e eles aparecem no "Show all" na ordem do jogo.
- **Cobertura hoje:** cerca de metade das linhas tem `share` (medido pelo Share S antes do BASELINE-3.1: Drop Rate 2.367 de 4.078, DamageDealed-Max 2.077 de 4.185; refazer sobre o BASELINE-3.1 no protótipo). **Sem `share`, nada é escondido por impacto**: a página mostra as 10 primeiras na ordem do jogo e `Show all N parts`.
- É o impacto **dentro do pai**, não no total do stat; a tela nunca diz "most of your Drop Rate" com ele (Parte 2). O peso global (produto dos `share` do caminho) só ordena "Where a gain counts most" (C17), nunca reescreve a árvore.

**Regra de exibição:**

1. Lista com até 10 partes que contam: todas, na ordem do jogo.
2. Mais de 10, com `share` nas linhas que o jogador sobe: mostra as maiores, **de 5 a 10**: as maiores até cobrirem 90% do `share` da página, no mínimo 5 e no máximo 10. As mostradas ficam **na ordem do jogo entre si** (decisão de 10/11), não por tamanho.
3. As de impacto quase zero (`share` abaixo de 0,5%) vão para uma linha recolhida: `Small (N) · +2,114% together · 3%` (numa soma, o total do grupo aparece, para a conta fechar à vista).
4. As outras, nem grandes nem quase zero, e as de Valor fixo e Condição: atrás de `Show all N parts` (N = todas as partes que contam).
5. `Show all N parts` abre a lista **inteira na ordem do jogo**, as maiores no lugar delas; o texto do botão não muda, e o estado vai só no `aria-expanded` (para o leitor não dizer o estado duas vezes). A escolha vale para aquela página na sessão.
6. Depois vêm, nesta ordem: as linhas com `share` nulo e as `limit wins now`, na ordem original; e, fechados, `Small (N)`, `At 0 (N)` e, só quando pedido em "Game details", as linhas de `Show repeated steps (N)`.

```
Bonuses that add up                         +84,384%
Part                     Adds       Share of this list
Showing the 5 largest of 30. Together they are 90% of this total.
 🎽 Equipment           +6,081%    7% of this list ▏      ›
 🦉 Owl                 +4,967%    6% of this list ▏      ›
 ⚔️ Legend Talents      +3,500%    4% of this list ▏      ›
 🌾 Farming             +5,709%    7% of this list ▏      ›
 🍔 Golden Food        +56,036%   66% of this list ████   ›
 [Show all 30 parts]
 ▸ Small (20) · +3,192% together · 4%
 ▸ At 0 (1) · not adding anything now
```

(Conta do retrato pela regra acima: as 5 maiores somam 76.293 de 84.384 = 90,4%; 30 partes contam, 20 estão abaixo de 0,5% e somam 3.192 = 3,8%; Prayers em 0. É a mesma lista em §3.4 e no mockup; a ordem entre as linhas aqui é ilustração, na tela é a do jogo. Valores do retrato de 08/11; a árvore do BASELINE-3.1 dá o mesmo total.)

- **Teclado/ARIA:** `Show all N parts` é disclosure (`aria-expanded`, `aria-controls` na lista); ao abrir, o foco fica no botão e a região polite diz "Showing all 30 parts, in the game's order". A legenda `Showing the 5 largest of 30. Together they are 90% of this total.` é texto comum, lido antes da lista.
- **Desempenho:** com essas regras, uma página fechada tem de 5 a ~25 linhas; aberta, até ~150 (Stamps tem 144 membros no retrato). Sem virtualização até 300 linhas por página (ela quebra o Ctrl+F e a leitura em sequência); acima disso, virtualizar (§4.3).
- **Testes:** com o jogo falso, uma soma de 31 partes mostra de 5 a 10 linhas que cobrem ≥ 90% (ou 10), na ordem do dado; mostradas + "Small" + as de "Show all" somam o pai; abrir "Show all" dá exatamente a ordem do dado.

- **Galho de várias fontes:** o dado chama `Sum of N sources (X)` ou `Multiplier from N sources (X)`; a tela mostra `X and {N−1} more` ou `X and {N−1} more, as a multiplier` (`Tasks and 7 more`), com a frase da página `{N} parts add up to +292%, which becomes ×3.92.`, e o nome do dado vai para "Game details". Entra na lista como um ramo comum (`›`), e a página dele segue esta mesma regra C15; no dado, até 20 linhas por fonte extra.

#### C16. Peça repetida (`SameAsAbove`)

A regra NR-P da pesquisa, aprovada para a próxima rodada, faz uma peça que já apareceu igual na árvore virar uma linha só, com o selo `shown earlier` e o caminho da primeira, em vez de abrir de novo. Com ela, o Drop Rate cai para ~1.800 linhas e o Sailing de 43.016 para 4.718, sem perder nenhuma fonte distinta. Os números são da sessão principal, a conferir no BASELINE seguinte.

```
 🍀 Clover Shrine bonus      +25%   shown earlier   Go to it ›
    In: Shrines › Clover Shrine
```

- **Anatomia:**
  - a linha normal (C2), com nome, valor e impacto;
  - a linha inteira é o botão (C2) e leva à primeira aparição; o selo `shown earlier` (C7) e o texto `Go to it ›` no fim da linha, que **não** é um segundo botão (botão dentro de botão é HTML inválido);
  - embaixo, em `--text-xs` e `--muted`, `In: {pai} › {peça}` (os dois últimos itens do caminho, como o breadcrumb recolhido, C8).
- **Comportamento:**
  - Enter na linha abre os ancestrais da primeira ocorrência e põe o foco nela; a região viva diz `You came from {nome}. Backspace goes back.` (C8);
  - voltar (`Alt+←`) devolve o foco a esta linha;
  - o valor continua na linha e conta no impacto da página (C15), porque a peça entra de novo na conta.
- **Nome acessível:** "Clover Shrine bonus, plus 25 percent, shown earlier in Shrines, go to it". Frase do selo: "This part already appears earlier in this breakdown, with the same value."
- **Dado:** `flags.sameAs` = o id da primeira aparição (R19). No BASELINE-3.1, o Drop Rate tem 244 referências `shown earlier` em 2.414 linhas; o campo `n.ref` da gravação compacta guarda o caminho da primeira ocorrência.
- **Não fazer:**
  - esconder a linha, porque ela é uma fonte da conta desta página;
  - reabrir a peça aqui;
  - usar o selo para peças diferentes com o mesmo nome. A identidade é a da peça: bloco + argumentos.
- **Teste:** com o jogo falso, uma chamada repetida em dois ramos sai aberta na primeira vez e com `shown earlier` na segunda. As duas linhas têm o mesmo valor, e a linha leva à primeira.

#### C17. Onde um ganho conta mais (`GainList`, fatia "Where a gain counts most", depois do MVP)

```
Where a gain counts most · Drop Rate
Biggest gain from +1: Golden Cake amount (+9.9% Drop Rate).
 Golden Cake amount   [Quantity]   each +1 here means 10× more   +9.9%  ›
 Food slots owned         [Quantity]                         +8.2%  ›
 ...
 Turns a bonus on (one-time jump)                                  ›
This compares +1 on each thing you can raise. It does not know what each +1 costs in the game.
```

- **De onde vem:** o campo `marginal` do dado (ganho relativo na raiz com a folha +1), que sai das fórmulas da árvore, sem recalcular o jogo. Só existe para folhas `Level`, `Quantity` e `Invested points`; todas as linhas com o mesmo número do jogo sobem juntas.
- **Ordem:** pelo `marginal`, do maior para o menor (esta lista é a única ordenada por tamanho; a árvore continua na ordem do jogo). Sem `marginal` na raiz, a estimativa `marginalLocal × peso global` entra marcada `estimated`.
- **"Cheapest" não aparece:** o custo do jogo não está na árvore. O rótulo é `Biggest gain from +1`, nunca "cheapest" nem "best next upgrade" (fica dentro da missão: explica a conta, não recomenda).
- **Pegadinhas, ditas na própria linha:**
  - o "Log Factor" da bancada +1 é 10× a quantidade, não "um a mais": a linha chama a folha pelo que ela conta (`Golden Cake amount`) e diz `each +1 here means 10× more`; "Log Factor" só em Game details;
  - uma condição "> 0" no caminho faz o +1 de 0 para 1 abrir um bônus inteiro (+100%, +300%): essas linhas vão para um grupo à parte, `Turns a bonus on (one-time jump)`, fora da ordem por taxa.
- **Exemplo do retrato:** o maior ganho por +1 no Drop Rate é o `Golden Cake amount` (o "Log Factor" do Golden Cake, +9.9%), depois Food slots owned (+8.2%) (Share S da pesquisa).
- **Não confundir com a sensibilidade do padrão §6** (`+1% here gives`, por sistema, que exige recalcular o estado). As duas medem coisas diferentes: +1 numa folha vs +1% num sistema. A tela F usa o `marginal`; a sensibilidade fica como pergunta aberta.

#### C18. Aviso de versão do jogo (`VersionNote`, R15)

```
Names and tags were checked on an older game version. Values are live.
```

- **Quando:** o jogo instalado não é a versão em que os nomes, os tipos e os ⓘ foram conferidos (`checkedOnThisGame: false` no contrato).
- **Como:** uma faixa única no topo da página do stat, `--surface`, contorno `--control`, texto `--fg`, `--text-xs`. **Nenhuma marca por linha**: depois de um patch, até a versão nova do app, todas as linhas ficariam marcadas, e o aviso perderia o sentido.
- O valor continua o do jogo (P2): o que pode ter envelhecido é o nome ou o tipo, nunca o número.
- Leitor de tela: a faixa é texto comum, lido antes do `<h2>`; não é região viva.
- Estado em §3.5; rótulo em §3.7. **(fora do GM)**

#### C19. Seletor de personagem (`CharacterPicker`, resposta 7d)

```
Character  [Character 1 (Royal Guardian) · active ▾]
Not the active character. These numbers can't be compared with Stats.
```

- `<select>` nativo com `<label>` "Character", no topo da aba Formulas e da página do stat. Abre **no personagem ativo**; as opções são `Character N (class)`, com `· active` no ativo. Nenhum nome de personagem.
- Escolhido um não ativo: a faixa `Not the active character. These numbers can't be compared with Stats.` (`--surface`, contorno `--control`) acima da árvore, e o C1 não mostra a linha de confiança (`Same as Stats`) nem a regra de paridade: não há Stats para comparar. Ler e calcular personagens inativos é trabalho do plan.
- Trocar de personagem refaz a árvore; a região viva diz `Breakdown for Character N (class)`.
- Teste: o seletor abre no ativo; com outro escolhido, a faixa aparece e `Same as Stats` não.

### 3.4 Telas (janela de 420 × 640, `Character 1 (Royal Guardian)`, números do retrato de 08/11)

**Página do stat (L0–L2):**

```
IdleOn Companion
Game running · Reader attached · last reading 1 s ago
[Screen map] [Stats]
──────────────────────────────────────────────────
Stats › Drop Rate
┌────────────────────────────────────────────────┐
│ Drop Rate · Character 1 (Royal Guardian)       │
│                                      [Refresh] │
│ 2,797,522x                                     │
│ Largest added bonus: Golden Food, 66% of all   │
│ added bonuses. Largest multiplier: Equipment   │
│ ×31.8. At zero for now: Prayers, Menagerie.    │
│ ✓ Same as Stats · calculated 3 s ago           │
└────────────────────────────────────────────────┘
Read left to right: the game adds, adjusts, then multiplies.
[Bonuses that add up] → [Game adjustments] → [Multipliers]
 Total so far: 846x      Total so far: 1,304x   Final: 2,797,522x
 +84,384%                fixed steps            ×2,145
Bonuses that add up                     +84,384%
Part                     Adds       Share of this list
Showing the 5 largest of 30. Together they are 90% of this total.
 (as 5 linhas de C15, na ordem do jogo)
 [Show all 30 parts]
 ▸ Small (20) · +3,192% together · 4%
 ▸ At 0 (1) · not adding anything now
Game adjustments                              Total so far
 × 1.4   LUK part                               → 1.116
 ...
```

**Ramo aberto no lugar (L3) e filhos informativos da folha (L4)** (v4: tudo na mesma árvore; o desenho abaixo mostra o conteúdo, que agora abre recuado sob a linha, C8):

```
Stats › Drop Rate › Talents › Boss Battle Spillover
Boss Battle Spillover                     +62.5%
ⓘ How it adds up
(25 × (Points in the talent + All-talent levels)
 ÷ ((Points in the talent + All-talent levels) + 100))
 × game value
(25 × 100 ÷ (100 + 100)) × 5 = 62.5
Made of 4 parts
 Boss Battle Spillover (all-talent levels)   0  ›
 ▾ Points in the talent  [Invested points]  100
   Points you put in. Spend more points here to raise it.
   ▸ Game details
 Level is 0 or less     [Condition · limit]  no
 Dungeon map above 0    [Condition · limit]  no
▸ Game details
1 part has no name yet · What the tags mean
```

### 3.5 Estados

| Estado                  | O que aparece                                                                                                  | Texto (inglês)                                                                                                                                   | ARIA                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Calculando | o C1 mostra na hora o texto da Stats para a raiz (P2) e, no lugar da frase, `Calculating the breakdown…`; linhas cinza sem texto só na lista, para a tela não pular | `Calculating the breakdown…`; ao fim, na região polite: `Drop Rate breakdown ready.` (a aba Stats continua com `Calculating`, o texto do teste dela) | `aria-busy="true"` só na lista |
| Calculador fora         | a aba inteira, como a Stats                                                                                    | `Calculator unavailable. The formulas can't be calculated now. The screen map keeps working.` (mockup, tela E)                                   | texto comum                                            |
| Uma parte `unavailable` | só aquela linha: valor `—` e selo; o resto segue                                                               | C7                                                                                                                                               | nome acessível inclui "unavailable"                    |
| `?`                     | selo tracejado e a frase calma; nunca vermelho                                                                 | C4                                                                                                                                               | —                                                      |
| Jogo fechado | a árvore e a Stats ficam com a **última leitura** (resposta 5; muda a 004: a Stats passa a guardar os últimos números); o C1 diz quando foi; Refresh desativado com o motivo | `Game closed · last reading 42 s ago`; Refresh: `Refresh works when the game is open` | `aria-disabled="true"` e `aria-describedby` no Refresh |
| Sem personagem          | página vazia com uma frase                                                                                     | `Choose a character in the game to see its numbers.`                                                                                             | —                                                      |
| Trocou de personagem | a árvore se refaz sozinha para o novo ativo (resposta 5) | `Calculating the breakdown…` e, ao fim, `Breakdown for Character N (class)` | região viva |
| Raiz ≠ Stats | defeito: a árvore não aparece; só o número da Stats e `Breakdown unavailable`; o caso é registrado | `Breakdown unavailable` | texto comum |
| Personagem não ativo | a faixa de C19; sem paridade nem `Same as Stats` | `Not the active character. These numbers can't be compared with Stats.` | texto comum |
| Ramo calculando | `calculating this part…` no lugar dos filhos | `calculating this part…` | `aria-busy` no `group` |
| Segundo pedido com um em voo | troca o pedido em espera; nunca dois em voo; `Refresh` durante o cálculo não empilha | — | — |
| Primeira volta incompleta ou sem `_vars` | `Calculating the breakdown…`, sem árvore | `Calculating the breakdown…` | `aria-busy` |
| Outra versão do jogo (R15) | a faixa de C18 no topo; nenhuma marca por linha | `Names and tags were checked on an older game version. Values are live.` | texto comum |
| Árvore cortada          | linha `stopped here` no ponto do corte, com o botão para abrir a parte sozinha; o total do topo continua certo | `This tree reached its {N}-line limit. Open {name} on its own to see the rest.`                                                                  | botão comum                                            |
| Mudou no jogo | faixa no C1, só quando muda a raiz ou uma peça da página aberta | `The game now shows {texto}. Refresh to see what changed.` (C11) | a faixa entra uma vez na região polite |

### 3.6 Formatação de números

| Caso                          | Regra                                                                                                       | Exemplo                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Raiz do stat                  | **o texto da aba Stats**, sem refazer                                                                       | `2,797,522x` (ver o achado 4 de §1.1) |
| \|v\| ≥ 1.000                 | arredonda ao inteiro mais perto (não `ceil`: a linha não é a tela do jogo), separador en-US                 | `56,036`                              |
| \|v\| ≥ 1e12                  | `T` como o jogo, uma casa quando < 100T                                                                     | `350.3T`                              |
| \|v\| ≥ 1e15                  | notação do jogo (`formatNumber`: mantissa cortada em 2 casas)                                               | `1.49E33`                             |
| 1 ≤ \|v\| < 1.000             | até 3 algarismos significativos, sem zero à direita                                                         | `62.5`, `170`, `1.43`                 |
| 0 < \|v\| < 1                 | até 3 algarismos significativos                                                                             | `0.797`                               |
| 0                             | `0` em `--zero`                                                                                             | `0`                                   |
| Parte que soma                | prefixo `+`; `%` só quando o catálogo diz que a unidade é ponto percentual (as partes da soma do Drop Rate) | `+56,036%`                            |
| Parte que multiplica          | prefixo `×`; ×1 em `--zero`                                                                                 | `×31.8`, `×1`                         |
| Stat final                    | sufixo `x`, como o jogo                                                                                     | `2,797,522x`                          |
| Condição                      | `yes` / `no`                                                                                                | `no`                                  |
| Negativo                      | sinal de menos verdadeiro (U+2212)                                                                          | `−1`                                  |
| Valor exato                   | só em "Game details" e no ⓘ: todas as casas até 6, sem zeros à direita                                      | `56,036.189754`                       |
| Fatia | inteiro; `<1%` abaixo de 1; com sinal `−` quando a linha reduz o total; `≈` no modo `mixed`; `zeroes the total` no lugar da fatia num fator 0 | `66%`, `−6%`, `≈ 40%` |
| Tempo                         | `N s ago`, `N min ago`, como a barra de status                                                              | `calculated 3 s ago`                  |
| Espaço entre número e unidade | espaço inseparável (U+00A0), para não quebrar na linha                                                      | `3 s ago`                             |

Nada de `K`/`M`/`B` (o jogo não usa; o mockup também não). Unidade desconhecida: sem unidade, nunca uma inventada.

### 3.7 Regras de uso e de escrita

**Faça:**

- Comece toda página pela resposta (C1) e termine pelo rodapé de honestidade (C7).
- Mantenha a ordem do jogo; destaque com barra e frase; em lista longa, mostre primeiro as que mais pesam, ainda na ordem do jogo (C15).
- Escreva o selo inteiro (`Condition · owned`), com a frase a um clique.
- Mostre o nome de jogador; mande o nome do código para "Game details".
- Diga o que continua certo quando algo falha ("The rest is still right.").
- Use as palavras da barra de status para tempo ("last reading", "s ago").

**Não faça:**

- Não reordene por tamanho; não esconda zeros (recolha em "At 0").
- Não escreva "most of it" sem o peso; não recomende ("do this"): explique a conta (relatório §6.3 põe recomendação fora da missão).
- Não explique por `title` nem por hover só.
- Não use cor como único sinal; não use vermelho para "?".
- Não mostre caminho de código (`Research[7][9]`) em L0–L2.
- Não mostre o nome de um personagem dentro de caminho cru, em lugar nenhum (nem em "Game details", nem no Copy): use o número do personagem (C10).
- Não mostre classes que a conta não tem; diga quantas ficaram de fora (C12).
- Não esconda partes por impacto quando a página não é soma nem produto (C15).
- Não use `style=` nem posição em JS; não use K/M/B.
- Não anuncie a cada segundo em região viva.

**Escrita (inglês da interface):** _sentence case_; verbos no imperativo curto (`Refresh`, `Open`, `Copy`, `Show all`); "you/your" para o jogador; números sempre com unidade quando ela é conhecida; uma frase de explicação ≤ 90 caracteres; sem ponto de exclamação; sem jargão de código (`cache` só no selo já aprovado `saved by the game`).

**Glossário de rótulos** (os tipos de folha, os subtipos e o "At" batem com o Glossário M; o resto é **fora do GM**):

| Conceito                          | Rótulo na UI                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a aba nova (depois)               | `Formulas`                                                                                                                                                    |
| a conta de um ramo (ⓘ)            | `How it adds up`                                                                                                                                              |
| a última camada                   | `Game details`                                                                                                                                                |
| etapas do Drop Rate | `Bonuses that add up`, `Game adjustments`, `Multipliers`; `Total so far`, `Final`; `Read left to right: the game adds, adjusts, then multiplies.` |
| grupo de zeros                    | `At 0 (N)` · `not adding anything now`; `At ×1 (N)` · `no effect yet`                                                                                         |
| tipos de folha                    | `Level`, `Quantity`, `Invested points`, `Tier`, `Record`, `Condition · owned/done/max/active/limit/equals a value`, `Choice`, `Raw bonus`, `Fixed value`, `?` |
| famílias de tipo (legenda e 1ª frase do detalhe) | `Grows as you play` · `You can raise this.`; `Unlock or pick` · `You unlock or pick this.`; `Set by the game` · `Set by the game.` |
| honestidade (rótulo na tela; ids em C7) | `?`, `no name yet`, `saved by the game`, `from the game`, `changes while you play`, `shown earlier`, `limit wins now`, `stopped here`, `unavailable`, `game bug: counted twice`, `repeated step` |
| versão do jogo | `Names and tags were checked on an older game version. Values are live.` |
| personagem | `Character`, `Character N (class) · active`, `Not the active character. These numbers can't be compared with Stats.`, `Breakdown for Character N (class)` |
| árvore | `calculating this part…`, `Show full path`, `{nome}: {n} parts ready` |
| jogo fechado | `Game closed · last reading N s ago` |
| colunas da lista | `Part`, `Adds` / `Multiplies`, `Share of this list`, `{N}% of this list` |
| confiança | `Same as Stats`, `calculated N s ago`, `Last calculated N s ago`, `Breakdown unavailable` |
| mudança | `The game now shows … Refresh to see what changed.` · `Refresh now`, `was …`, `up/down N%`, `changed inside` |
| rodapé | `{a} parts with an unknown type`, `{b} parts have no name yet` (cada um só quando > 0), `What the tags mean` |
| valor de cache sem nome           | `Saved game value`                                                                                                                                           |
| ramo sem nome cujo nome é a conta | `Calculation`                                                                                                                                                 |
| busca                             | `Find a stat or system`                                                                                                                                       |
| peso (depois) | `Where a gain counts most`, `Biggest gain from +1`, `each +1 here means 10× more`, `Turns a bonus on (one-time jump)`, `estimated`; nunca "cheapest" |

**Rótulos × Glossário M** (12/11; Glossário M ainda não validado pelo Vinicius). Rótulos dos selos, dos 6 subtipos e de "At 0 (N)" batem; as linhas abaixo são as divergências e a escolha.

| Rótulo                                                                  | DESIGN (antes)                                                                      | Glossário M                                                                                                        | Escolhido                                                                                     | Por quê                                                                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Level (frase)                                                           | "A level you raised. Raise it to raise this."                                       | "Upgrade level. Raise it in the menu of this item."                                                                | "A level you upgraded. Raise it in this item's menu."                                         | o glossário diz onde subir; frase completa lê melhor que fragmento                                             |
| Quantity (frase)                                                        | "How many you have or collected. Get more to raise this."                           | "A count you grow by collecting or killing more."                                                                  | a do Glossário M                                                                              | mais curta, com prova no jogo                                                                                  |
| Invested points (frase)                                                 | "Points you put into it. Move points here to raise this."                           | "Points you put in. Spend more points here to raise it."                                                           | a do Glossário M                                                                              | "spend" é a palavra do jogo para pontos                                                                        |
| Tier (frase)                                                            | "A step on a ladder, like a rarity or a statue tier..."                             | "Rank step (colour or form). Next tier = bigger multiplier."                                                       | "A rank step, like a sigil colour or an artifact form. The next tier gives more."             | exemplos do glossário; "multiplier" nem sempre é verdade, e "=" é símbolo, não frase                           |
| Record (frase)                                                          | "Your best mark ever. Beat it to raise this."                                       | "Your best result so far. Beat it to raise the bonus."                                                             | a do Glossário M                                                                              | mesma ideia, mais clara                                                                                        |
| Choice (frase)                                                          | "What is in a slot right now. Swap it to change this."                              | "Something you selected. Change the pick to change the bonus."                                                     | a do Glossário M                                                                              | cobre também deus ligado e preset, que não são vaga                                                            |
| Fixed value (frase)                                                     | "A number written in the game. You can't change it."                                | "Set by the game. You can't change it, it's part of the formula."                                                  | "Set by the game. You can't change it."                                                       | o fim ("part of the formula") vale para toda linha e não informa                                               |
| Raw bonus (frase)                                                       | "A bonus an item, companion, set or card gives as it is..."                         | "A ready bonus from another source. Open that source to raise it."                                                 | "A ready bonus from an item, companion, set or card. Get or wear a better one to raise it."   | folha não abre: "Open that source" manda o jogador procurar um botão que não existe; "ready" do glossário fica |
| Condition (frase e valor) | yes/no; "A yes or no check: {sub}." | "On/off check. 1 means it counts, 0 means it doesn't yet." | "A yes or no check the calculation uses. How it adds up, above, shows what each answer does." e, quando a regra conhece o efeito, "Here, {yes/no} means the bonus counts."; valor `yes`/`no` na mesma cor | numa condição invertida (`Level is 0 or less = no`) é o "no" que conta: "yes means it counts" e "1 means it counts" leem ao contrário (revisão g, achado 1) |
| Subtipos de Condition (frase)                                           | perguntas curtas ("do you own it?")                                                 | "Owned check: 1 if you have it." etc.                                                                              | perguntas com os exemplos do glossário ("Do you have it (bought, built, found or unlocked)?") | pergunta sim/não casa com o valor yes/no; os exemplos vêm do glossário                                         |
| `limit`                                                                 | trocar por `reached`                                                                | `limit` ("Threshold check")                                                                                        | `limit`                                                                                       | bancada e glossário concordam; a frase explica                                                                 |
| `?` (frase)                                                             | "We don't know yet what kind of number this is. The value is still the game's own." | "Not identified yet. The value is right, the name is missing."                                                     | a do DESIGN                                                                                   | "?" é tipo desconhecido, não nome faltando (nome faltando é `no name yet`); misturar os dois engana                |
| Cor e ícone dos tipos                                                   | 3 famílias de cor, só texto                                                         | uma cor por tipo (azul, verde-água, cinza, ouro, verde/vermelho, roxo, laranja, âmbar, índigo) e um ícone por tipo | 3 famílias, só texto                                                                          | 9 cores não se decoram; verde/vermelho falha para daltônico; o app não tem biblioteca de ícones                |
| Grupo ×1                                                                | `At ×1 (N) · not multiplying anything now`                                          | "N more parts at ×1": "These multiply by 1 now: no effect yet, but they can grow."                                 | `At ×1 (N) · no effect yet`, com a frase do glossário                                         | par com "At 0"; a frase do glossário diz que pode crescer                                                      |
| `min`/`max` no ⓘ                                                        | `lowest of`, `highest of`                                                           | "Cap N / min(...)", "Minimum N / max(...)"                                                                         | `capped at N` e `at least N` quando há número fixo; `lowest of`/`highest of` nos outros casos | as palavras do glossário dizem o papel (teto, piso)                                                            |
| Selos de honestidade, etapas, ações, `Saved game value`, `Calculation` | propostos                                                                           | sem entrada                                                                                                        | os do DESIGN, marcados **fora do GM**                                                         | o glossário cobre folhas, padrões de linha, stats e sistemas, não a interface                                  |

Os nomes de stat e de sistema da busca (C12) e das páginas vêm do Glossário M (§3 e §4 dele: "Max damage", "Min damage", "Max HP", 114 sistemas, 106 com prova), com a chamada do jogo só como texto de busca.

### 3.8 Acessibilidade

**Padrão escolhido (v4): o treeview do APG inteiro.** A resposta 7c pede a árvore que abre no lugar; então vale o padrão completo, nunca pela metade (a bancada mostrou o risco: `role="tree"` sem as setas é pior que nenhum ARIA):

- `role="tree"` com `aria-label="{stat} breakdown"`; cada linha `role="treeitem"`; filhos num `role="group"`;
- `aria-level`, `aria-setsize`, `aria-posinset` em toda linha (a árvore é carregada aos pedaços, então os três são declarados, não calculados pelo navegador); `aria-expanded` só em quem tem filhos;
- **roving tabindex:** a árvore é uma parada de Tab; só a linha ativa tem `tabindex="0"`, as outras `-1`;
- os filhos informativos de uma folha (frase do tipo, conta, Game details, Copy) e `Small`/`At 0`/`Show all N parts` também são `treeitem`s, para tudo andar pelas mesmas teclas.

**Teclado:**

| Tecla | Efeito |
| --- | --- |
| `Tab` / `Shift+Tab` | seletor → caminho → Refresh → etapas → árvore (uma parada) → rodapé |
| `↓` / `↑` | próxima / anterior linha visível |
| `→` | linha fechada: abre (calcula se preciso); aberta: vai ao primeiro filho |
| `←` | linha aberta: fecha; fechada ou folha: vai ao pai |
| `Home` / `End` | primeira / última linha visível |
| `*` | abre todos os irmãos da linha (cada um calcula no lugar, `calculating this part…`) |
| `Enter` | abre ou fecha; em `Show all N parts`, mostra todas; em `Copy`, copia; numa linha `shown earlier`, vai à primeira aparição |
| letra | vai à próxima linha visível cujo nome começa com ela (recomendado pelo APG) |
| `Backspace` / `Alt+←` | volta o foco à linha de onde se foi para uma primeira aparição |
| `Esc` | fecha o grupo da linha em foco e põe o foco no pai |

**Leitor de tela:** a página do stat tem `<h2>` (o nome e o valor), que recebe o foco ao abrir; a árvore é o treeview acima; ícones emoji e `›` com `aria-hidden`; o nome acessível da linha segue a ordem nome, valor, fatia, selo, estado; uma região `aria-live="polite"` por página (`<p class="sr-only" id="announce">`), usada por todas as mensagens (Refresh, `Copied`, `Show all`, cálculo pronto), uma frase por ação; "calculated N s ago" não é viva.

**Barra de status (trazer para a 008):** hoje o `role="status"` de `StatusBar.tsx` envolve o "last reading N s ago", que muda a cada segundo, e o leitor de tela pode anunciar a cada segundo. Correção proposta: o `role="status"` passa a envolver só a mensagem (o jogo ou o leitor mudou, erro); o "last reading N s ago" fica fora da região viva, como o "calculated N s ago". Teste: o texto da região viva não muda quando só o tempo muda. Alternativa, se o tempo precisar ser lido: uma cópia `sr-only` que atualiza a cada 10 s, também fora da região viva.

**Leitura de símbolos (nome acessível):** `+` = `plus`, `×` = `times`, sufixo `x` = `times` (`2,797,522 times`), `−` = `minus`, `≈` = `about`, `<1%` = `less than 1%`; `✓`, `≠`, `›` e `↑` são `aria-hidden`, e o texto diz tudo sozinho. A região viva também anuncia, uma vez, a faixa de jogo mudado e `Breakdown for {personagem}` depois de uma troca de personagem. `End` leva ao fim da árvore (substitui o "Skip to end of list" da v3).

**Alto contraste (`forced-colors: active`):** selos de tipo e de honestidade têm borda de 1px (sobrevivem sem fundo); a linha que mudou tem o texto `was …`; o `<meter>` fica como o sistema desenha, e a fatia em texto continua; o anel de foco usa `outline` (não `box-shadow`). Teste F1.

**Foco visível:** anel de 2px `--focus` (6,70:1 e 10,20:1), por dentro da linha; nunca `outline: none` sem substituto.

**Contraste:** §3.2, todos os pares de texto ≥ 4,5:1 nos dois temas, inclusive sobre `--changed` (o menor é `--zero` no escuro, 4,69:1; a primeira escolha, `#3a3410`, dava 3,70:1 e foi trocada); bordas de controle ≥ 3:1.

**Tamanho e zoom:** texto ≥ 12px; alvos ≥ 32px de altura na lista e ≥ 24 × 24px fora dela. **O app não tem zoom hoje** (`Menu.setApplicationMenu(null)` em `src/main/index.ts:54` tira os atalhos do menu). A 008 exige `Ctrl+=` / `Ctrl+-` / `Ctrl+0` (e `Ctrl`+roda), de 100% a 200%, tratados em `before-input-event` com `webContents.setZoomFactor`, com o fator guardado nas Settings; é mudança no `main` (fronteira de módulo, ler `ARCHITECTURE.md`), e a spec ganha um requisito. A 200% a janela tem 210px CSS: a linha reflui (C2), a etapa vira coluna (C3), sem rolagem horizontal.

**Sem depender de cor:** `+`/`×` no valor, `yes`/`no` na condição (as duas respostas na mesma cor), texto em todo selo, a família também em texto (C4), borda tracejada no `?`, `was …` e `up/down N%` na mudança.

### 3.9 Testes de design

Rodar com a janela em 420 × 640, no estado "Game running · Reader attached" (o que mais ocupa a barra de status), com o retrato da bancada (só na máquina do Vinicius) ou com o jogo falso do calculador. "Clique" conta também tecla, **a partir do app aberto na aba Screen map** (a aba padrão). O tempo inclui o cálculo da árvore: o orçamento abaixo supõe até 2 s de cálculo (o teto vem do protótipo); passou disso, o cenário mede a partir de `Drop Rate breakdown ready.`

**Teste dos 5 segundos (verificável):** mostrar a página do Drop Rate por 5 s, esconder, perguntar: (1) quanto é o seu Drop Rate? (2) what adds the most, and what multiplies the most? (3) alguma coisa não está contando? **Passa** se pelo menos 4 de 5 acertam (1) e (2), e 3 de 5 acertam (3); em (2), vale cada parte com o papel certo (Golden Food soma, Equipment multiplica); em (3), a linha `At zero for now` dá a resposta. **Portão:** na 008, o teste automático (abaixo) e o Vinicius; o teste com 5 pessoas com pouca experiência no Idleon é o portão para abrir o app a outros jogadores. Quem roda: o Vinicius; resultado em `specs/008-…/teste-5s.md` (pessoa, 3 respostas, acertou ou errou). Com o teste automático junto: em jsdom, o C1 vem antes da primeira lista no DOM, a frase tem ≤ 110 caracteres por linha e o texto de L0–L2 não casa com as expressões de P3.

| #   | Perfil   | Pergunta                                       | Caminho na UI                                                        | Cliques / tempo             | Passou se                                                                                                          |
| --- | -------- | ---------------------------------------------- | -------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| N1  | novo | "Meu Drop Rate é baixo, por quê?" | Screen map → Stats → linha Drop Rate → lê C1 (com `At zero for now`) | 2 / ≤ 15 s + cálculo | diz a maior parte da soma (Golden Food), o maior fator (Equipment) e um sistema em 0 (Prayers) |
| N2  | novo | "O que é esse selo `Condition · limit`?" | Screen map → Stats → Drop Rate → Talents → Boss Battle Spillover → linha `Level is 0 or less` | 5 / ≤ 20 s + cálculo | explica que é um sim/não e, pela frase "Here, no means the bonus counts", que o bônus conta; acha "What the tags mean" sem ajuda |
| N3  | novo | "Meu item novo mudou alguma coisa?" | troca no jogo → faixa `The game now shows …` → `Refresh now` | 1 / ≤ 5 s depois do Refresh | aponta a linha que mudou (`was …`), sem confundir com as que não mudaram; a faixa não acendeu antes da troca |
| N4  | novo | "Esse `?` quer dizer que está errado?" | num stat que ainda tem "?" (no BASELINE-3.1, o Drop Rate tem 3 "?" reais): rodapé → a linha | 4 / ≤ 15 s + cálculo | responde que o número é do jogo e só o tipo é desconhecido |
| A1  | avançado | "Qual sistema está em 0 que eu poderia ligar?" | Screen map → Stats → Drop Rate → `At 0 (1)` → Prayers → Midas Minded | 5 / ≤ 20 s + cálculo | chega à prayer Midas Minded, lê o ⓘ ("0 while this prayer is in no prayer slot") e diz o que faria |
| A2  | avançado | "Conferir uma linha contra o IT" | Screen map → Stats → Drop Rate → Golden Food → `Game details` → Copy | 5 / ≤ 25 s + cálculo | tem o número cru (`56036.189754`) e a chamada copiados, sem texto do código do jogo |
| A3  | avançado | "Ver a fórmula exata" | Screen map → Stats → Drop Rate → Talents → Boss Battle Spillover | 5 / ≤ 15 s + cálculo | lê as duas linhas do ⓘ; o resultado `62.5` é igual ao valor da linha |
| A4  | avançado | "O que a árvore ainda não sabe?" | num stat com "?": rodapé `{a} parts with an unknown type` → lista | 4 / ≤ 15 s + cálculo | a lista tem as folhas "?" do dado, cada uma levando ao lugar dela; o progresso de laço aparece à parte em "Game details" |
| A5  | avançado | "Comparar a árvore com a bancada" | Drop Rate → `Game details` da árvore | 1 / ≤ 5 s | lê linhas · ⓘ · "?" · laço, iguais ao arquivo da base congelada (`BASELINE-3.1-READY.txt`) |
| K1  | teclado | N1 e A2 só com teclado, mouse desligado | Tab, setas, Enter, `Alt+←` | igual a N1 e A2 | o foco nunca some: `document.activeElement !== body` depois de cada ação, inclusive depois de `Refresh now` |
| Z1  | zoom | fator 2.0 na janela de 420px (210px CSS) | Stats, Formulas, Drop Rate com 7+ níveis abertos, folha aberta e legenda | — | `document.documentElement.scrollWidth <= clientWidth` em todas; a linha refluiu (C2) |
| M1  | movimento | `prefers-reduced-motion: reduce` | Refresh; clique numa etapa | — | `document.getAnimations().length === 0` depois do Refresh, e a rolagem até a etapa não anima |
| S1  | leitor de tela | nome acessível de cada linha | jsdom | — | segue nome, valor, fatia, selo; não contém `×`, `›`, `?` nem `x` soltos (vira `times`, §3.8) |
| X1  | contraste | tokens de `styles.css` | teste de unidade | — | lê os tokens e calcula os pares da tabela de §3.2: ≥ 4,5 texto, ≥ 3 borda e foco |
| F1  | alto contraste | tema Contraste do Windows ligado (`forced-colors: active`) | N1 e N3 | igual | passam: selos com borda, fatia em texto, `was …` visível, foco visível |

**Falhou** em qualquer cenário: o caminho precisou de ajuda, passou do tempo em mais de 2 de 5 pessoas, ou o jogador leu um número de forma errada (unidade, "x" vs "×").

### 3.10 Ajustes no mockup

`docs\product\mockup-008-arvores-no-app.html` (agente b, 83 KB), lido em 12/11. O mockup acerta a maior parte: resposta primeiro, as três etapas, ordem do jogo, "At 0 (N)" fechado, a página de sistema com "Feeds these numbers", a legenda dos 9 tipos (com `Invested points`), os estados, o "Later" separado. O que ele deve mudar para seguir este documento:

| #   | No mockup                                                                                                                              | Ajuste                                                                                                               | Por quê (§)                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| M1  | árvore aninhada com `role="tree"` e `treeitem` | **v4: a forma do mockup vale** (resposta 7c); falta o padrão inteiro: `aria-setsize`/`posinset`, `*`, letra, `Esc`, o recuo com teto em 6 níveis e o `calculating this part…` | §3.8, C8 |
| M2  | `--faint` `#8a949e` sobre `#fbfbfa` = **2,98:1**; escuro `#6e7881` sobre `#181c21` = **3,80:1**; sobre o fundo de mudança, 2,73 e 2,40 | usar os tokens de §3.2 (`--zero`, `--muted`)                                                                         | AA 4,5:1                                          |
| M3  | `--plus` sobre `--chg` no claro = 4,47:1; `--muted` sobre `--chg` no escuro = 4,26:1                                                   | idem                                                                                                                 | AA                                                |
| M4  | `--accent` `#a5650f` (âmbar) e `--mult` `#8a5a0b` (âmbar) quase iguais                                                                 | o destaque de interface não pode ter a cor do "multiplica"; foco e links em `--focus` azul                           | cor do papel do valor é sagrada                   |
| M5  | a frase da resposta diz "de onde vem a maior parte"; na tela E: "Most of it came from Equipment, which multiplied it by 31.8"          | `Largest added bonus: … Largest multiplier: …` até existir o peso                                                    | Parte 2                                           |
| M6  | raiz `2,797,523x`                                                                                                                      | o texto da Stats; e conferir no jogo (o jogo mostrou `2.797.522x`)                                                   | §1.1 achado 4, pergunta 1                         |
| M7  | etapa 1 mostra `846x` ("Bonuses that add 846x")                                                                                        | `Bonuses that add up +84,384%`; o 846 é o começo dos passos fixos                                                    | C3                                                |
| M8  | "13 multipliers"                                                                                                                       | conferir a contagem com o dado (a proposta de 10/11 diz 18; o `Post-Processing` tem 17 filhos, alguns de passo fixo) | P2: nenhum número da tela sem conferência         |
| M9  | "Biggest parts (4)" antes da corrente, sem dizer o critério                                                                            | manter só se a lista for das partes de uma soma exata, com a fatia; senão, tirar até o peso                          | C2, Parte 2                                       |
| M10 | o selo explica por `title` ("o selo tem a mesma frase como dica (title)")                                                              | a frase abre na linha, por clique e teclado                                                                          | §3.8; `title` não chega ao teclado                |
| M11 | "changed" amarelo por 5 s                                                                                                              | `--fade` 2,4 s e o texto "was …" fica até o próximo Refresh; com `prefers-reduced-motion`, o fundo fica parado       | C11                                               |
| M13 | "Character 1 · live"                                                                                                                        | `Drop Rate · Character 1 (Royal Guardian)` e `calculated N s ago`: a árvore não é ao vivo, é recalculada no Refresh                        | C1, C11                                           |
| M14 | `stopped here` com "5,000-line limit"                                                                                                  | manter a frase; o número do limite vem do plano (não medido; padrão §11)                                             | §3.5                                              |
| M15 | subtipo `limit` no selo                                                                                                                | manter `limit` (bancada e Glossário M concordam); a pergunta vira a frase do subtipo                                 | C4                                                |
| M16 | a árvore abre "Every part, in the game's order" inteira, com "Biggest parts (4)" à parte | trocar pela lista longa de C15 (as maiores na ordem do jogo, `Small (N)`, `Show all N parts`); o "Biggest parts" separado sai, para não repetir linhas | C15; o Drop Rate novo tem ~4.078 linhas |
| M17 | `<div id="results" aria-live="polite">` relê a lista inteira a cada tecla | região viva só com a contagem ("12 results") | §4.3 |
| M18 | progresso de laço sem opção própria | `Show repeated steps (N)` em "Game details" | C10 |
| M19 | sem o selo `game bug: counted twice` | acrescentar no Cape Vine (Defence), com a frase de C7 | C7 |
| M20 | sem os galhos `Sum of N sources (X)` e `Multiplier from N sources (X)` | usar os nomes novos, como ramo comum com `›` e página que segue C15 | C15 |
| M21 | caminho `Formulas › Drop Rate` | no MVP, `Stats › Drop Rate` (a aba `Formulas` vem com a busca) | C9 |
| M22 | corrente com totais acumulados (846x → 1,304x → 2,797,523x) | etapas como no C3: `+84,384%`, `1,304`, `×2,145` | C3 |
| M23 | nome real de personagem nos exemplos | `Character 1 (Royal Guardian)` | CODING_STANDARDS |
| M24 | sem o selo `shown earlier` | acrescentar, com `First shown in:` e `Go to it` | C16 |
| M25 | `--changed: #3a3410` nos dois blocos escuros | `#26230a` | §3.2 |
| M26 | `.t-twice` com contorno `--mult`; `.t-truth` em `--muted`; `.t-stop` em `--danger` | todos os selos de honestidade com contorno `--control` e texto `--fg`; `--danger` só no `unavailable` | C7 |
| M27 | linha de confiança fica "✓ Same as Stats" com a faixa de mudança | `Last calculated N s ago` enquanto espera o Refresh; desenhar o estado `Breakdown unavailable` (raiz ≠ Stats) | C1, C11 |
| M28 | "Calculating · big formula" sem o número | o `<h2>` com o texto da Stats e `Calculating the breakdown…` | §3.5 |
| M29 | sem a 3ª linha da resposta; "(66%)" solto; corrente com "13 multipliers" e sem total | `At zero for now: Prayers, Menagerie.`; `66% of all added bonuses`; cartões com `Total so far` e `Final` (C3) | C1, C3 |
| M30 | selos e rótulos antigos (`?`, `unnamed`, `from the game's cache`, `changes at runtime`, `Same as above`, `not counting now`, `Raw bonus`, `Fixed steps`) | os rótulos da v3 (tabela de ids em C7) | C4, C7 |
| M31 | rodapé com contagens em 0 e contagens que não abrem nada | contagem só quando > 0, e como botão | C7 |
| M32 | a 420px, `.gain` e um `<dt>` da legenda estouram; sem a largura 210 | `flex-wrap`/`min-width: 0`; acrescentar 210 aos botões de janela | C2, C17, Z1 |
| M33 | o `·` de `Condition · owned` sem `aria-hidden`; chips com raio 999px | `<span aria-hidden="true">·</span>`; `--r-control` | C4, §3.2 |
| M34 | sem a faixa de versão (R15) | desenhar C18 em E | C18 |
| M35 | sem aba Formulas com a lista dos números; sem seletor de personagem | aba Formulas sem busca (C9); seletor e faixa `Not the active character` (C19) | C9, C19 |
| M36 | jogo fechado | árvore e Stats com a última leitura e `Game closed · last reading N s ago` | §3.5 |
| M37 | `type unknown` e `Ready bonus` (v3) | `?` e `Raw bonus` (resposta 8) | C4 |
| M38 | raiz ≠ Stats | só o número da Stats e `Breakdown unavailable` | C1 |

### 3.11 Perguntas abertas de design

| #   | Pergunta                                                                                                                              | Recomendação                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | O jogo mostra "2.797.522x" e o `formatNumber` (com `Math.ceil`) daria "2,797,523x" para 2.797.522,90. O Drop Rate é truncado no jogo? | Conferir no jogo com dois valores de fração diferente; se for truncado, corrigir na Stats num `fix/` próprio. A árvore só copia o texto da Stats             |
| 2   | Árvore aninhada (mockup) ou página por ramo (proposta de 10/11)? | **Respondida (7c):** árvore que abre no lugar, com o treeview do APG inteiro (§3.8, C8) |
| 3   | Nos multiplicadores, `At 0 (N)` ou `At ×1 (N)`?                                                                                       | `At ×1 (N)`: "0" num multiplicador é falso (×0 zera o total)                                                                                                 |
| 4   | `Raw bonus` e `limit` são claros para um jogador novo?                                                                                | Manter os rótulos da bancada, que o Glossário M também usa; o que esclarece é a frase do selo (§3.7, "Rótulos × Glossário M"). Revisar só se o N2 falhar     |
| 5   | Os emoji dos sistemas (🎯 Talents) ficam?                                                                                             | Ficam (molde do V1, ajudam a escanear), separados do nome no dado e com `aria-hidden`                                                                        |
| 6   | Reescrever `min`/`max`/`pow`/`ceil` em palavras no ⓘ?                                                                                 | Sim, nas duas linhas, como regra de exibição registrada no padrão                                                                                            |
| 7   | Uma vista "árvore inteira" para quem valida?                                                                                          | Não no MVP: "Game details" com as contagens, a busca e o Copy resolvem A2–A5. Reavaliar se o A5 falhar                                                       |
| 8   | Refresh manual ou recálculo sozinho?                                                                                                  | Manual, com a faixa `Game changed · Refresh` (notas de produto, R10)                                                                                  |
| 9   | Formato do Copy                                                                                                                       | Uma linha com tab: nome, chamada, valor exato                                                                                                                |
| 10  | Levar o app todo para 14px e os tokens de cor (Stats, Screen map, Settings)?                                                          | Sim, num `fix/` ou `feat/` próprio depois da 008, para não misturar o diff                                                                                   |
| 11  | A barra de status anuncia a cada segundo no leitor de tela                                                                            | Follow-up: tirar o "last reading N s ago" da região viva                                                                                                     |
| 12  | As abas não têm `tabpanel` nem setas                                                                                                  | Completar quando a aba `Formulas` entrar                                                                                                                     |
| 13  | Barra só em soma exata deixa os multiplicadores sem barra                                                                             | Aceitar no MVP; o peso traz a lista "Where a gain counts most" com barras                                                                                    |
| 14  | Nomes de 100+ caracteres (condições de prayer)                                                                                        | Duas linhas na lista e pedir à bancada uma regra de nome curto para condições compostas                                                                      |
| 15  | "Working value of the game (X)" vira `Saved game value`?                                                                             | Sim, com o selo `saved by the game`; registrar como regra no padrão, valendo para todas as árvores                                                       |
| 16  | A frase da resposta é montada do dado para qualquer stat; quem escreve os moldes?                                                     | Moldes no repo (texto nosso, sem texto do jogo), um por forma de árvore (etapas, soma, sistema), testados com o jogo falso                                   |
| 17  | As 5 a 10 maiores (C15) ficam na ordem do jogo ou por tamanho?                                                                        | Na ordem do jogo (decisão de 10/11); a fatia e a barra já mostram o tamanho. Mudar só se o N1 falhar                                                         |
| 18  | Os limiares de C15 (90% de cobertura, `share` < 0,5% para "Small") | Valores de partida; ajustar no protótipo com o Drop Rate novo e o ExpMulti-4 |
| 19  | A tela F usa o `marginal` (+1 na folha) e a sensibilidade do padrão §6 (+1% no sistema) fica de fora? | Sim: o `marginal` sai da árvore sem recalcular e responde "o que eu subo"; a sensibilidade pede recálculo e emenda (notas de produto, pergunta 5) |

### 3.12 Revisão de acessibilidade (g)

Revisão de acessibilidade e leitura do iniciante (34 achados), aplicada em 12/11. O que mudou:

| Achado | Mudança | Onde |
| --- | --- | --- |
| 1 | a frase do `Condition` diz quando o bônus conta ("Here, {yes/no} means the bonus counts"); `yes`/`no` na mesma cor; comparações em palavras (`Level is 0 or less`) | C4, §3.4 |
| 2 | o DESIGN exige zoom `Ctrl+=` / `Ctrl+-` / `Ctrl+0`, que o app não tem hoje (`src/main/index.ts:54`) | §3.8 |
| 3 | a linha reflui abaixo de 300px (210px CSS a 200%); valor do C1 em 22px | C1, C2 |
| 4 | correção proposta para a barra de status: o tempo sai da região viva | §3.8 |
| 5, 8, 27 | terceira linha `At zero for now`; fatia com "of all added bonuses"; teste dos 5 s com iniciantes, sem o Vinicius | C1, §3.9 |
| 6 | durante o cálculo, o topo já mostra o texto da Stats e `Calculating the breakdown…` | §3.5 |
| 7 | a faixa só acende quando muda a raiz ou uma peça da página aberta, nunca por contadores; nada de `≠` durante a espera | C1, C11, §3.5 |
| 9, 13 | jargão de conta sai do nome da linha; galhos `X and {N−1} more`; uma palavra só ("parts"); P3 pega os dois | C6, C15, P3 |
| 10, 23 | cliques contados a partir da aba Screen map, com o tempo do cálculo; o app lembra a última aba | §3.9, C9 |
| 11 | contagens do rodapé só quando > 0; N4 e A4 num stat que ainda tem "?" | C7, §3.9 |
| 12 | `Equipment (adds)` e `Equipment (multiplies)` | C2 |
| 14, 33 | cada linha é uma parada de Tab; setas como extra; sai o atalho `i`; `←` só fecha | §3.8 |
| 15 | ⓘ aberto só com até 2 linhas e sem `no name yet`; o resultado sempre à vista | C6 |
| 17, 18 | cartões das etapas com o total depois de cada uma; mudança só com `was …` | C3, C11 |
| 20, 21 | Copy com o número cru; detalhe começa pelo nome inteiro quando cortado | C10, C2 |
| 22 | voltar é histórico; botão `‹ Back to …`; `You came from …` depois de `Go to it` | C8 |
| 24 | uma região viva por página | §3.8 |
| 28–31 | nome acessível do selo; ", has a calculation"; alvos ≥ 24px; `<h2>` antes do Refresh; `Refresh now` na faixa | C1, C2, C4, C8 |
| 32, 34 | frase de Invested points no esboço; frase do `?` | §3.4, C4 |

**Share S (12/11):** C15 passa a ler `share`/`shareMode`/`sign`/`binding` do worker (soma, produto, produto com 0, teto, misto, condição); Valor fixo e Condição saem da escolha das maiores; sem `share`, nada se esconde. Novo selo `limit wins now`. Nova C17, "Where a gain counts most", pelo `marginal` (+1 em Level, Quantity e Invested points), sem "cheapest".

Na v3, os nomes de selo do achado 16 entraram como **rótulos de tela** (`saved by the game`, `repeated step`), com os ids da spec intactos (tabela de C7); o `shown before` do achado 25 virou `shown earlier` (revisão Fable 2); `read live` e "Groups"/"Bonuses" na busca não entraram. O achado 19 já estava resolvido (`--changed` escuro `#26230a`, `--zero` 4,69:1); o 26 é da spec.

---

## Parte 4. Pesquisa (12/11)

Pesquisa na rede só para design, com termos genéricos (nada do jogador, do save ou do projeto). Fontes primárias primeiro.

### 4.1 Fontes

| #   | Fonte                                                                                                                                                                                      | O que diz, em resumo                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | [Progressive Disclosure (NN/g)](https://www.nngroup.com/articles/progressive-disclosure/)                                                                                                  | o que a maioria usa fica na primeira tela; acima de 2 níveis de divulgação a usabilidade costuma cair; o rótulo do gatilho diz o que vem |
| F2  | [Tooltip Guidelines (NN/g)](https://www.nngroup.com/articles/tooltip-guidelines/)                                                                                                          | dica nunca guarda informação necessária à tarefa; dica só no hover é inacessível ao teclado                                              |
| F3  | [Data Tables: Four Major User Tasks (NN/g)](https://www.nngroup.com/articles/data-tables/)                                                                                                 | primeira coluna com identificador legível; ajudar a comparar e a manter o lugar (destaque de linha)                                      |
| F4  | [Alternatives to Pagination on Product-Listing Pages (NN/g)](https://www.nngroup.com/articles/alternatives-pagination-listing-pages/)                                                      | botão "Show More" grande no fim da lista; ele some quando não há mais nada                                                               |
| F5  | [Tree View Pattern (WAI-ARIA APG)](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)                                                                                                     | `tree`/`treeitem`/`group`, `aria-expanded`, setas, Home/End, busca por letra, `aria-level`/`posinset`/`setsize`                          |
| F6  | [Disclosure (Show/Hide) Pattern (WAI-ARIA APG)](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)                                                                                      | um `button` com `aria-expanded` (e `aria-controls` opcional); Enter e Espaço alternam                                                    |
| F7  | [Tables Tutorial (W3C WAI)](https://www.w3.org/WAI/tutorials/tables/)                                                                                                                      | tabela de dados com `th` e `scope`; tabela simples só precisa de `th`                                                                    |
| F8  | [Intl.NumberFormat() constructor (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)                                   | `notation: "compact"` dá "988M", com 2 algarismos significativos por padrão                                                              |
| F9  | [Defensive Stat Breakdowns (poe.ninja)](https://poe.ninja/posts/defensive-stat-breakdowns)                                                                                                 | todo stat abre no mesmo formato: o valor base e a lista de fontes, depois "increased", depois "more"                                     |
| F10 | [Path of Building (repositório)](https://github.com/PathOfBuildingCommunity/PathOfBuilding), módulo `CalcBreakdown.lua`                                                                    | a aba Calcs mostra como cada stat é derivado, por um gerador de "breakdown" separado do cálculo                                          |
| F11 | [Damage for Beginners (Maxroll, Diablo IV)](https://maxroll.gg/d4/getting-started/damage-for-beginners)                                                                                    | marcas `[+]` (soma num balde) e `[x]` (multiplicador à parte); exemplo com base 100, a soma entre parênteses e o multiplicador fora      |
| F12 | [Damage Explained (Maxroll, Last Epoch)](https://maxroll.gg/last-epoch/resources/damage-explained) e [Last Epoch Support](https://support.lastepoch.com/hc/en-us/articles/46361876714907/) | três categorias em ordem: added, increased, more                                                                                         |
| F13 | [Beware of Stat Weights (Raidbots)](https://support.raidbots.com/article/66-beware-of-stat-weights)                                                                                        | o peso por stat é uma aproximação grosseira de um momento; simular a troca real é melhor                                                 |
| F14 | [IdleonToolbox (repositório)](https://github.com/Morta1/IdleonToolbox)                                                                                                                     | só referência visual (páginas por sistema, busca única); nunca fonte de dado                                                             |
| F15 | [Web Interface Guidelines (Vercel)](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)                                                                | a checklist da skill `web-design-guidelines` (§4.3)                                                                                      |

Last Epoch: não achei prova de que o jogo mostre a lista de fontes na dica; há pedido de jogadores no fórum ([Character screen and stat breakdown, a discussion on how to](https://forum.lastepoch.com/t/character-screen-and-stat-breakdown-a-discussion-on-how-to/13644)). Serve como sinal de que a lista de fontes é desejada, não como modelo. F12 e F14 foram citadas pelos resultados de busca, sem leitura da página inteira.

### 4.2 O que a pesquisa mudou ou confirmou

| Decisão                          | Antes                                                                | Depois da pesquisa                                                                                                                                                                    | Fonte                     |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Camadas de divulgação            | 5 camadas (L0–L4)                                                    | **confirmada, com um limite**: dentro de uma página, no máximo 2 níveis abertos (a linha e o seu detalhe); descer mais é outra página, não mais um nível aberto                       | F1                        |
| Rótulo dos gatilhos              | "Show all", "Game details"                                           | o rótulo diz o que vem e quanto: `Show all 31 sources`, `Show repeated steps (2,058)`; o botão some quando não há mais                                                                    | F1, F4                    |
| Explicação dos selos             | frase na linha, sem `title`                                          | **confirmada**: dica só no hover é inacessível, e a frase do tipo é necessária ao jogador novo, então fica na tela, por clique e teclado                                              | F2                        |
| Treeview vs disclosure           | disclosure + página                                                  | **confirmada**: o treeview do APG pede setas, Home/End, busca por letra e `aria-level`/`posinset`/`setsize`; a disclosure é só `button` + `aria-expanded`                             | F5, F6 (**v4:** invertida pela resposta 7c: árvore no lugar, treeview do APG inteiro) |
| Forma da decomposição            | três etapas do Drop Rate                                             | **confirmada como padrão do gênero**: base → o que soma → o que multiplica (PoE "increased/more", Last Epoch "added/increased/more", Diablo IV `[+]`/`[x]`)                           | F9, F11, F12              |
| Sinal de soma e de multiplicador | prefixo `+` e `×`                                                    | **confirmada**: o Diablo IV marca `[+]` e `[x]` na própria dica do jogo                                                                                                               | F11                       |
| Mesmo formato para todo stat     | moldes de frase por forma de árvore                                  | **confirmada**: o poe.ninja usa um formato só para todo stat                                                                                                                          | F9                        |
| Peso antes do recálculo          | sem barra fora de soma exata                                         | **confirmada e ampliada**: impacto só da página (fatia na soma, fatia do log no produto), nunca "peso no total"; o peso no total por +1% fica rotulado como aproximação de um momento | F13                       |
| Lista longa                      | tudo, na ordem do jogo                                               | **mudou**: as 5 a 10 que mais pesam primeiro, `Small (N)`, `Show all N parts` no fim da lista (C15)                                                                                 | F1, F4 e os números novos |
| Formato compacto (K/M/B)         | não usar                                                             | **confirmada**: o compacto padrão tem 2 algarismos significativos e muda o número que o jogador compara com o jogo                                                                    | F8                        |
| Tabelas                          | lista de botões no lugar da tabela da Stats só nas linhas com árvore | **confirmada**: a tabela da Stats é simples (`th` na linha basta); a árvore não é tabela, é lista                                                                                     | F7, F3                    |
| Primeira coluna legível          | nome de jogador                                                      | **confirmada**: identificador legível primeiro, código no fim                                                                                                                         | F3                        |

### 4.3 Checklist da `web-design-guidelines` (Vercel), aplicada

Aplicada ao DESIGN e ao mockup (`docs\product\mockup-008-arvores-no-app.html`, só leitura). Formato `arquivo:linha`.

**mockup-008-arvores-no-app.html**

- `:885` – placeholder sem reticências e sem `spellcheck="false"` (termos do jogo): `Try "drop", "stamp" or "mining"…`.
- `:889` – `aria-live="polite"` na lista inteira de resultados: relê tudo a cada tecla; deixar viva só a contagem (M17).
- `:1403` – `role="treeitem"` com `aria-level`: treeview correto no mockup, mas o DESIGN escolhe disclosure (M1).
- `:428` – `outline: none` no `li:focus`, com `:focus-visible` como substituto logo abaixo: passa.
- `:962` – "Biggest parts" e "Every part, in the game's order" repetem linhas; sem regra de lista longa (M16).
- `:2208` – botão ⓘ só com ícone tem `aria-label="How it's calculated"`: passa.
- números escritos à mão, sem `Intl.NumberFormat`: certo para um mockup estático; no app, o formatador de §3.6.
- sem `text-wrap: balance` nos títulos; sem `scroll-margin-top` nos alvos da corrente das etapas.
- listas de 31 (Drop Rate) e 144 (Stamps) linhas sem virtualização: aceitável até 300 por página (C15).

**DESIGN-008-arvores-no-app.md** (corrigido neste documento)

- C8 – o botão `…` do breadcrumb não tinha nome acessível: agora "Show full path".
- C2 – nome cortado precisa de `min-width: 0` no filho flex: acrescentado.
- C3 – alvo da corrente sem `scroll-margin-top`: acrescentado.
- C8 – títulos sem `text-wrap: balance`: acrescentado.
- §3.6 – espaço inseparável entre número e unidade (`3 s ago`), para não quebrar na linha.

**Divergências conscientes da checklist** (registradas, não seguidas):

- **Title Case em botões e títulos:** o app usa _sentence case_ em tudo ("Let the game close", "Set up Steam", "Connect next time"); a 008 segue o app.
- **Reticências no estado de carregamento:** `Calculating` sem reticências, porque é o texto da aba Stats e do teste `StatsPanel.test.tsx`.
- **`Intl.NumberFormat` com a língua do sistema:** o formato é en-US fixo de propósito, igual ao do jogo (P2); a língua do sistema daria `2.797.522x` num Windows em português e deixaria de bater com a tela do jogo.
- **Virtualizar listas acima de 50:** só acima de 300 linhas por página; abaixo disso, a lista inteira no DOM mantém o Ctrl+F e o leitor de tela (C15).
- **Estado na URL:** não se aplica (janela Electron sem URL); o caminho fica em memória, com o breadcrumb.

---

## Mudanças da v3

12/11, ~12h. Revisões Fable 2 (29 achados, DESIGN), Fable (pacote) e Fable 4 (mockup).

- **C9:** a Stats continua tabela; só a célula do valor com árvore vira botão.
- **Uma lista do Drop Rate:** "5 largest of 30", `Show all 30 parts`, `Small (20)`, `At 0 (1)`, igual em C15, §3.4 e no mockup.
- **R15:** C18, faixa única `Names and tags were checked on an older game version. Values are live.`
- **Rótulos:** `At zero for now` (C1) × `limit wins now` (selo); `?`, `no name yet`, `saved by the game`, `changes while you play`, `shown earlier`, `Raw bonus` (na família Unlock or pick), `Game adjustments`; os ids da spec não mudam (tabela em C7).
- **Números:** os dois percentuais rotulados (`Adds`, `Share of this list`); totais acumulados ditos (`Total so far`, `Final`); leitura de `×`, `x`, `≈` no nome acessível.
- **P3:** a terceira expressão pega `cache`, `runtime`, `unnamed` e `Log Factor`.
- **Família:** também em texto (1ª frase do detalhe e legenda) e por borda; `--set-bg` claro `#e4e4e7`; a frase do `th` a 70% corrigida (6,57:1); três pares novos na tabela de contraste.
- **Correções:** `.num` quebra abaixo de 300px; foco no `<h2>` depois de `Refresh now`; C16 sem botão dentro de botão; sem `ⓘ` na linha; `changed inside` em texto.
- **§3.9:** K1, Z1, M1, S1, X1 e F1; o teste dos 5 s tem dono, registro e portão.
- **Estados:** jogo fechado segue a Stats; troca de personagem; segundo pedido; primeira volta; versão do jogo.
- **Exemplos:** `Character 1 (Royal Guardian)`; números da base do `BASELINE-3.1-READY.txt` (v5).
- **Mockup:** M25 a M34.

---

## Mudanças da v4

12/11, 13h50. Aplica `docs\product\respostas-008.md`.

- **7c, árvore no lugar:** C8 reescrita (`FormulaTree`): pastas que abrem no lugar, recuo de 12px com teto em 6 níveis e indicador `L9` (8px e teto em 4 abaixo de 300px); caminho = linha em foco; C15 dentro de cada nó aberto. P6 trocado. §3.8 adota o treeview do APG inteiro (roving tabindex, setas, Home/End, `*`, letra, Enter).
- **Plano B (6):** cada ramo é calculado quando é aberto; estado `calculating this part…` na linha.
- **7b:** aba Formulas com os números que têm árvore, sem busca livre; a busca (C12) vai para spec futura.
- **7d:** C19, seletor de personagem; abre no ativo; os outros com `Not the active character` e sem paridade.
- **4:** raiz ≠ Stats → só o número da Stats e `Breakdown unavailable`, com registro.
- **5:** jogo fechado: árvore e Stats com a última leitura (inverte a v3); troca de personagem refaz a árvore sozinha.
- **8:** rótulos aprovados; voltam `?` e `Raw bonus`; C7, §3.7 e P3 atualizados.
- **Anexo:** o DESIGN vira `specs/008-*/design.md`; o mockup fica na bancada. Mockup: M1 revisto, M35 a M38.
