# IdleOn Companion — v1 (Screen Map) — Design

Data: 06/11/2026 · Status: aprovada; **revisada em 06/11 após a Task 0** (o jogo cai quando o canal fecha → guardião, §4; revisão aprovada pelo Vinicius em 06/11) · Autor: Claude (sessão de brainstorming com o Vinicius)

> Cópia de `C:\Users\Vinicius\idleon-companion\docs\specs\2026-11-06-idleon-companion-v1-design.md`, trazida para o
> repositório em 07/11/2026 sem mudança de design. Mudanças: o nome do repositório em §8 (o real) e as seções
> "Out of Scope" e "Open Questions" do kit no fim, com as decisões de processo de 07/11.

## 1. Objetivo

Um app de desktop que roda ao lado do Legends of Idleon (Steam) e mostra, ao vivo, **onde o jogador está e o que está aberto**:
mundo, mapa, menu, janela de sistema, aba do Codex, personagem e alvo AFK. A v1 é a base de um companion que vai crescer
(próximo grande passo: **Formula Breakdown**, as fórmulas de cada sistema com a árvore de cálculo e os números reais).

- **Para quem:** o Vinicius agora; outros jogadores depois. Nenhuma decisão da v1 pode impedir a distribuição futura.
- **Sucesso na v1:**
  - abrir o jogo pela Steam abre o companion (janela ou ícone na bandeja, conforme configuração);
  - o painel acompanha mapa/menu/janela/aba com atraso ≤ ~1 s;
  - um número de tela sem nome aparece como "unnamed #N" e o jogador nomeia ali mesmo; o nome passa a valer na hora;
  - fechar, travar ou matar o app do companion (janela/bandeja) nunca derruba o jogo; o guardião do canal (§4) só termina
    depois do jogo;
  - nada do que o app faz chama função do jogo, grava no save ou acessa a rede.

## 2. Fora do escopo da v1

- Formula Breakdown e qualquer cálculo (vem como módulo, ver §6).
- Reserva pelo save local (`mySave`) quando o jogo não abriu pelo companion: na v1 só há o aviso.
- Companions, `_vars` e login: nada de Firebase na v1.
- Instalador (.exe), auto-update, outros idiomas (a interface é **em inglês**).
- Sincronizar o catálogo de nomes entre jogadores.

## 3. Restrições (não negociáveis)

1. **Risco zero de banimento.** Pelo código do jogo (N.js, `lib/firebase.js`, casca Electron, verificados em 06/11): não há
   detecção de depurador; a punição é manual (chat do dev `Ban_<nome>` → `OptionsListAccount[26]=4`). O que pune é valor
   impossível no save. Portanto:
   - dentro do jogo só roda **leitura de propriedades** (nenhuma chamada de função do jogo, nenhuma escrita);
   - o app **não acessa a rede** (nada de Firebase, nada de HTTP);
   - a pausa do depurador acontece **uma vez por sessão** (medida: ~268 ms na carga).
2. **O jogo nunca depende do app.** Qualquer falha do app degrada só o app.
3. **Arquivos do jogo nunca vão para o repositório.** O N.js, o `default.pak` e similares são lidos do jogo instalado do usuário.
4. **Feito para crescer** (pedido explícito): novas features entram como módulos sem refazer a base (§6).

## 4. Arquitetura

Dois processos: um **guardião** mínimo, que segura o canal do depurador e lê, e o **app Electron** (janela/bandeja).

**Por quê (Task 0, 06/11 13:56):** matar o processo que segurava o canal derrubou o jogo em ~1,5 s; log do jogo:
`devtools_pipe_handler.cc(146)] Connection terminated while reading from pipe`. O Chromium do jogo fecha quando o canal
fecha. Por isso o canal fica num processo pequeno, sem interface, que nunca termina antes do jogo; a janela pode fechar,
travar ou morrer sem afetar o jogo.

```
Steam "Jogar"
  └─> opção de inicialização: "<repo>\scripts\steam-launch.cmd" %command%
        └─> guardião (electron.exe com ELECTRON_RUN_AS_NODE=1: Node puro, sem janela)
              ├─ update-watch: hash do N.js + marcadores antes de conectar (§7.2)
              ├─ game-launch : abre LegendsOfIdleon.exe + --remote-debugging-pipe (fd 3/4)
              ├─ cdp         : protocolo do Chrome pelo canal (mensagens \0, timeout 20 s)
              ├─ engine-ref  : pega a referência ao motor uma vez (breakpoint em getGameAttribute)
              ├─ reader      : a cada ~1 s roda read.js (só leitura) → Reading quando muda
              ├─ link        : named pipe local \\.\pipe\idleon-companion (JSON por linha, §5.4) → app
              └─ abre o app destacado (--from-steam) e só termina depois que o jogo fecha
        app Electron (processo principal) ←link→ guardião
              ├─ catalog     : names.json → traduz Reading; acha números sem nome; grava nomes
              ├─ settings    : configurações do usuário
              └─ janela (renderer, React) ←IPC→ painel ao vivo + "Name it"
```

**Ciclo de vida**
- Steam → guardião sobe, abre o jogo e abre o app com `--from-steam`. Configuração **Show window when the game starts**:
  o app mostra a janela ou fica só na bandeja.
- Enquanto o jogo roda o app fica vivo; o ícone da bandeja mostra/esconde a janela.
- App fechado ou morto com o jogo aberto: o guardião segue lendo; abrir o app à mão conecta de novo e volta ao vivo.
- O jogo fechou → o guardião manda `status closed` e termina; configuração **Close companion when the game closes**
  decide se o app fecha.
- App aberto à mão sem guardião (o named pipe não existe): sem leitura ao vivo; a janela mostra
  *"Live reading needs the game to be launched through Steam with the companion launch option."*
- Segunda cópia do app: só traz a janela da primeira para frente (`requestSingleInstanceLock`). O guardião nunca abre o
  jogo duas vezes: se o named pipe já existe, ele sai sem abrir nada.
- **Limite conhecido:** matar o guardião à mão (Gerenciador de Tarefas) derruba o jogo, porque é o mesmo canal.
  Documentado em `docs/steam-setup.md`.

## 5. Componentes e contratos

### 5.1 Reading (o que o leitor entrega)
```ts
type Reading = {
  t: number;                 // epoch ms
  map: number;               // CurrentMap
  menu: number;              // MenuType (0 nada, 1 Itens, 2 Talentos, 3 Codex, 4 Mapa do mundo, 5 Menu, 6 Ataques; .1/.2/.78 atalhos)
  menu2: number;             // MenuType2 (janela de sistema / aba do Menu)
  menu2tab: number;          // MenuType2TabSelected
  skillTab: number;          // SkillTabSelected
  char: string | null;       // UserInfo[0]; null = fora de personagem
  afk: string | null;        // AFKtarget (id de monstro)
  codexTab: number | null;   // OptionsList[12]
  codexSel: string | number | null; // Quests: OptionsList[13][2]; Amigos: NonCloudsave[0][2]
};
```
`world` é derivado: `floor(map / 50) + 1`.

### 5.2 read.js
- Arquivo de texto com uma única `function () { ... }` executada com o motor como `this` (`Runtime.callFunctionOn`).
- Só acessa propriedades e índices; o leitor recarrega o arquivo quando ele muda (ajuste sem reabrir o jogo).
- Acesso a ajudantes sem chamar `getBehavior`: `PixelHelperActor[n].behaviors.cache.h[nome].script` (é o que o
  `getBehavior` do jogo faz por dentro).
- Modo "probe" (opcional, para mapear telas novas): grava em `probe.log` os números internos que mudam, silenciando contadores.

### 5.3 Catálogo (`names.json`)
```ts
type Entry = { name: string; status: "deduced" | "confirmed" };
type Catalog = {
  version: 1;
  menu: Record<string, Entry>;      // MenuType (chave pode ser "0.1")
  menu2: Record<string, Entry>;     // MenuType2
  codex: Record<string, Entry>;     // OptionsList[12]
  quickref: Record<string, Entry>;  // ícones do Quik Ref (referência)
  maps: string[];                   // CustomLists.MapDispName do jogo instalado
  afk: Record<string, string>;      // MonsterDefinitions Name do jogo instalado
};
```
- O app traz um catálogo padrão (o mapeamento de 06/11: 71 janelas, 10 menus, 7 abas do Codex, 14 ícones do Quik Ref;
  confirmados no jogo: menus 3, 4, 5; janelas 2, 5, 6, 8, 9, 10, 12, 13, 14, 17, 21, 23, 28, 30, 35, 38, 45, 56, 72, 82,
  94, 100 e The Hole (faixa 64–69); o resto é `deduced`).
- A cópia do usuário fica em `%APPDATA%\IdleOn Companion\names.json`; cópia de segurança antes de cada gravação;
  arquivo inválido → volta ao padrão.
- `maps`/`afk` vêm das tabelas do jogo instalado. Na v1 vêm prontos no catálogo padrão (gerados em 06/11);
  regenerar a partir do jogo fica para o módulo game-tables.

### 5.4 Contrato de mensagens (IPC) — fixo
| Canal | Direção | Conteúdo |
|---|---|---|
| `context:update` | principal → janela | `GameContext` (§6.2) |
| `status:update` | principal → janela | `{ game: "running" \| "closed" \| "not-launched", reader: "attached" \| "connecting" \| "error", message?, lastReadingAt? }` |
| `catalog:name` | janela → principal | `{ table: "menu" \| "menu2" \| "codex", key: string, name: string }` |
| `settings:get` / `settings:set` | janela ↔ principal | `Settings` |
| `reader:confirm-attach` | janela → principal | o usuário clicou "Connect anyway" depois do aviso do vigia de update (§7.2) |
| `module:<id>:*` | ambos | reservado para módulos (§6.3) |

**Elo guardião ↔ app (fixo):** named pipe local `\\.\pipe\idleon-companion` (`net` do Node; nada de TCP), uma mensagem
JSON por linha.
| Mensagem | Direção | Conteúdo |
|---|---|---|
| `{ "type": "reading", "reading": Reading }` | guardião → app | leitura nova (§5.1) |
| `{ "type": "status", "status": Status }` | guardião → app | `game` / `reader` / `message` / `lastReadingAt` |
| `{ "type": "confirm-attach" }` | app → guardião | o usuário confirmou conectar depois do aviso do vigia de update (§7.2) |

Ao conectar, o app recebe o último `status` e a última `reading`. O app é só cliente: se o elo cair, tenta de novo a cada 5 s.

### 5.5 Configurações
`{ showWindowOnGameStart: boolean; closeWithGame: boolean; alwaysOnTop: boolean }`, em `%APPDATA%\IdleOn Companion\settings.json`.
Padrões: `showWindowOnGameStart: true`, `closeWithGame: true`, `alwaysOnTop: false`.

### 5.6 Janela (v1)
- **Live:** World · Map (`264 Emperor's Castle Doorstep`) · Menu · Window · Codex tab (+ item selecionado) · Character · AFK target.
- **Status:** Game running / Reader attached / last reading N s ago.
- Número sem nome → `unnamed #N` + campo **Name it** (Enter grava; o nome vira `confirmed`).
- Entradas `deduced` aparecem com um marcador discreto ("from game code"), `confirmed` sem marcador.
- **Settings:** as três opções de §5.5.

## 6. Extensibilidade (como cresce)

### 6.1 Fontes de dados (peças separadas, cada uma com contrato)
| Fonte | O que dá | Na v1 |
|---|---|---|
| `live-screen` | Reading (§5.1) | sim |
| `live-snapshot` | retrato dos `gameAttributes` sob demanda, só lendo propriedades | não |
| `game-code` | o N.js do jogo instalado rodando offline num worker (harness provado em 06/11: 92,9% dos sub-casos) | não |
| `game-tables` | nomes de mapas, monstros, itens, tirados do jogo instalado | não (catálogo pronto) |
| `local-save`, `companions`, `server-vars` | save local, companions, `_vars` | não |

### 6.2 Contexto único
```ts
type GameContext = {
  screen: { world: number; map: number; menu: number; window: number; tab: number;
            codexTab: number | null; codexSel: string | number | null };
  character: string | null;
  afk: string | null;
  names: { map?: string; menu?: Entry; window?: Entry; codexTab?: Entry; afk?: string }; // traduzido pelo catálogo
  unnamed: Array<{ table: "menu" | "menu2" | "codex"; key: string }>;
  snapshot?: unknown;   // preenchido por live-snapshot quando um módulo pedir
  updatedAt: number;
};
```

### 6.3 Módulos
```ts
type CompanionModule = {
  id: string;                         // "screen-map", "formula-breakdown", ...
  title: string;
  needs: Array<"live-screen" | "live-snapshot" | "game-code" | "game-tables">;
  matches(ctx: GameContext): boolean; // ex.: ctx.screen.window === 44 (Sailing)
  service?: (ctx: ServiceContext) => ModuleService; // processo principal (ex.: calcular fórmulas num worker)
  Panel: React.ComponentType<{ ctx: GameContext; send: (msg: unknown) => Promise<unknown> }>;
  settings?: Record<string, unknown>;
};
```
- A janela mostra os painéis dos módulos cujo `matches` é verdadeiro (a v1 tem um só: **Screen map**, sempre visível).
- Cálculo pesado roda em `worker_threads` no processo principal; a janela só recebe resultados.
- Regra para qualquer módulo: nunca chama função do jogo, nunca grava no save, nunca acessa a rede.

## 7. Erros, segurança e testes

### 7.1 Erros (em todos, o jogo segue rodando)
| Situação | Comportamento |
|---|---|
| Canal não aceito / conexão falha | status `reader: error` + log; tenta de novo a cada 5 s |
| Referência ao motor perdida (recarga) | pega de novo sozinho |
| Leitura falhou | ignora e tenta no próximo ciclo |
| Update do jogo mudou o ponto de parada (`getGameAttribute:function(`) | aviso *"Game updated: the reader needs an update"*; nada é lido |
| `names.json` inválido | volta ao padrão; mantém o arquivo ruim como `.bad` |
| Janela travou | só a janela recarrega |
| App fechado/morto com o jogo aberto | o guardião segue; o jogo segue; reabrir o app reconecta |
| Guardião morto à mão | o jogo cai (Task 0: o Chromium fecha com o canal); limite conhecido, documentado |

### 7.2 Segurança
- **Prova de só-leitura:** teste que executa o `read.js` contra um motor falso em que toda função é um Proxy que lança erro
  ao ser chamado. Passou = a leitura não chama nada.
- **Sem rede:** nenhum código de rede no guardião nem no app; o elo entre os dois é um named pipe local, não TCP;
  CSP da janela `default-src 'self'`.
- **Vigia de update:** ao abrir, o app calcula o hash do N.js instalado; se mudou desde a última sessão, procura
  `debugger`, `devtools`, `remote-debugging`, `isDevToolsOpened`, `outerWidth`, `Function.prototype.toString` e avisa
  antes de ler. Encontrou algo → não conecta até o usuário confirmar.
- Pausa do depurador uma vez por sessão; duração no log.

### 7.3 Testes
- **Unidade (vitest):** catálogo (traduzir, achar sem nome, gravar com backup, arquivo inválido), mundo a partir do mapa,
  configurações, enquadramento das mensagens do canal.
- **Integração:** Edge sem janela + página falsa que imita o jogo (`app.html` → iframe → `N.js` com motor em closure),
  como o teste de 06/11: abrir, conectar, pausar uma vez, ler, recarregar, fechar. Elo: guardião falso ↔ cliente pelo
  named pipe (último status/leitura ao conectar, reconexão).
- **Manual no jogo:** abrir pela Steam; janela ligada/desligada; nomear um número novo; trocar de mapa/menu/aba;
  fechar o jogo; matar o app com o jogo aberto (o jogo segue) e reabrir o app (volta ao vivo).

## 8. Repositório e ferramentas

- GitHub privado **Arkh-Company/idleon-companion**, criado com o **kit-base** (licença decidida no kit-base).
- Pasta local nova e vazia (ex.: `C:\Users\Vinicius\ClaudeCowork\idleon-companion`).
- **TypeScript + Electron + React**, build com **electron-vite**, testes com **vitest**.
- v1 sem instalador: `scripts\steam-launch.cmd` abre o app a partir do repo.
- Fora do repo: arquivos do jogo, saves, logs, `names.json`/`settings.json` do usuário.
- O protótipo de `C:\Users\Vinicius\idleon-companion` (`launcher.cjs`, `read.js`, `names.cjs`, `names.json`, `follow.cjs`)
  é a referência: a lógica é migrada para TypeScript dentro do repo.

### 8.1 Riscos e pontos em aberto
1. **Fechar o canal derruba o jogo? Sim (Task 0, 06/11 13:56).** Matar o `launcher.cjs` com o jogo aberto derrubou o
   jogo em ~1,5 s (`devtools_pipe_handler.cc(146)] Connection terminated while reading from pipe`); perda: o progresso
   desde o último save (~2 min). Decisão: o canal fica no guardião (§4), que só termina depois do jogo; a janela é o app
   Electron. Resta o limite de matar o guardião à mão (§7.1).
2. **Ponto de parada muda num update.** Mitigação: procurar o texto `getGameAttribute:function(` (estável entre versões
   minificadas) e avisar se sumir.
3. **Mapeamento de telas parcial.** Menus 1, 2, 6 e várias janelas são dedução pelo código; subtelas de Cards, Mapas e
   Info do mapa no Codex não foram isoladas. O "Name it" e o modo probe resolvem com o uso.
4. **Distribuição futura:** o catálogo padrão contém nomes tirados das tabelas do jogo; antes de distribuir, gerar esses
   nomes a partir do jogo instalado de cada usuário (módulo game-tables) em vez de embuti-los.

## 9. Fatos verificados em 06/11/2026 (base deste design)

- Electron 11.5.0 / Chromium 87 do jogo aceita `--remote-debugging-pipe` mesmo com `devTools: false`.
- Referência ao motor via breakpoint em `getGameAttribute`; pausa de ~268 ms uma vez na carga; leitura a cada 1 s sem efeito visível.
- `MenuType`/`MenuType2`/`OptionsList[12]` mudam no mesmo segundo das ações no jogo (rodada de cliques 12:47–13:32).
- Opção de inicialização da Steam com `%command%` + script `.cmd` funciona no Windows.
- O save local (`mySave`) só chega ao disco a cada ~178 s (limite de escrita do Chromium) — por isso a leitura ao vivo.

## Out of Scope

O mesmo de §2: Formula Breakdown e qualquer cálculo; reserva pelo save local; companions, `_vars`, login e Firebase;
instalador, auto-update e outros idiomas; sincronizar o catálogo entre jogadores. Também fora: o modo probe do
`read.js` (§5.2 o marca como opcional) e regenerar `maps`/`afk` do jogo instalado (módulo game-tables, §5.3).

## Open Questions

| Question | State | Answer |
| --- | --- | --- |
| O jogo sobrevive quando o canal do depurador fecha? | resolved | Não (Task 0, 06/11 13:56). O canal fica no guardião (§4), que só termina depois do jogo. |
| Como a v1 é implementada, se o plano pedia `superpowers:subagent-driven-development` e o kit bloqueia a sessão de escrever código? | resolved | 07/11, Vinicius: pelo fluxo do kit. Esta pasta com spec, plano e tasks vai no PR da spec, e depois o `/implementar 001` roda a fase Done gate e 6 fases de código com Executor e Revisor. No fim, um PR de código. |
| Onde ficam os testes, se o `just check` roda `vitest run --dir src`? | resolved | 07/11, Vinicius: ao lado do código, em `src/` (ex.: `src/main/catalog/catalog.test.ts`), sem mudar o `justfile`. |
| A constituição pede `ARCHITECTURE.md` e uma regra do dependency-cruiser quando nasce a primeira fronteira entre módulos. Entra na v1? | resolved | 07/11, Vinicius: entra. A regra `arch` vai no `just check` (fase Done gate), e o `ARCHITECTURE.md` vai na última fase. |
| O catálogo do protótipo tem nomes em português (Bigorna, Itens, Amigos...), mas a interface é em inglês. | resolved | Segue §1 e a regra do usuário (interface em inglês): a conversão do catálogo traduz esses nomes para inglês (tabela fixa no script de conversão, tarefa T022). |
| Quem cria o `.dependency-cruiser.cjs`, se o hook `protect-files` não o conta como arquivo do critério de pronto e bloqueia a sessão? | resolved | durante a implementação: em 07/11 o Vinicius decidiu que o Executor cria o arquivo na Fase 1 (T016) e que a sessão põe o `arch` no `check` no fim da Fase 1 (T017). A lacuna do kit vai para a sessão do kit-base. |
| Um erro dentro do `read.js` faz o leitor pegar o motor de novo (e pausar o jogo outra vez)? | resolved | durante a implementação: não. Segue §3 (a pausa acontece uma vez por sessão) e §7.1: a leitura que falha é ignorada e o próximo ciclo lê de novo com a mesma referência; só a referência perdida (recarga, sessão morta) ou uma falha ao pegá-la leva a uma nova tomada. A T036 dizia "any error → re-acquire" e foi corrigida em 07/11. |
| O usuário fica sabendo quando as leituras falham sem parar (painel parado com "Reader attached")? | resolved | durante a implementação: em 07/11 o Vinicius decidiu que sim. Depois de 10 leituras seguidas que falharam, o status mostra "Reading failed: <motivo>", sem pausar o jogo e sem pegar o motor de novo; some quando uma leitura volta (T046). |
| O teste de integração com o Edge headless roda no `just check`? | resolved | durante a implementação: não. Em 07/11 o Vinicius decidiu que ele vira opcional (`just test-edge`, com `IDLEON_EDGE_TESTS=1`), porque a constituição pede testes sem rede real e o Edge não garante zero tráfego próprio ao subir (T047, T048). |
