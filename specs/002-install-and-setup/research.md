# Research: install-and-setup (002)

Fase 0 do plano. Cada entrada: Decision / Rationale / Alternatives. Fontes: o código da 001, os achados da Task 12
(07/11, com o jogo real), a documentação do electron-builder (context7, `/electron-userland/electron-builder`), o npm
(07/11) e a leitura, só de nomes de chave, de um `localconfig.vdf` real.

## R1. Um executável, dois papéis (`--keeper`)

- **Decision**: o pacote tem uma entrada nova, `src/start/index.ts`, que olha o `process.argv`: com `--keeper` importa
  `src/keeper/index.ts` (o guardião, sem janela); com `--remove-from-steam` importa o modo do desinstalador (R6); sem
  nenhum, importa `src/main/index.ts` (o app). O guardião passa a rodar dentro do processo principal do Electron (sem
  `ELECTRON_RUN_AS_NODE`, que a Steam não sabe pôr), mas continua sem importar `electron`: os argumentos do jogo são os
  que vêm depois de `--keeper`; o caminho do app para abrir a janela é `process.execPath` (empacotado) ou
  `process.execPath` + a pasta do repositório (desenvolvimento, `process.defaultApp`); o `read.js` vem de
  `process.resourcesPath` (empacotado) ou de `src/keeper/read.js` (desenvolvimento).
- **Rationale**: a Task 12 mostrou que a compra de gemas só funciona quando a Steam lança direto um programa com janela
  (GUI subsystem); o `electron.exe` rodando um script do guardião como processo principal, sem `.cmd`, subiu o overlay e
  abriu a compra, também com o canal e a sessão anexada. O exe empacotado é o mesmo `electron.exe` renomeado. Uma entrada
  que só despacha mantém as fronteiras da 001 (`keeper-alone`, `main-not-keeper-or-renderer`).
- **Alternatives**: dois executáveis (um guardião só Node) — o Node puro é um programa de console, o mesmo problema do
  `.cmd`; `ELECTRON_RUN_AS_NODE` na opção da Steam — a Steam no Windows não aceita variável de ambiente na opção; um
  `.vbs`/`.cmd` que esconde a janela — continua sendo um console entre a Steam e o jogo.

## R2. Instalador

- **Decision**: electron-builder 26.18.0 (MIT, publicado 29/10/2026), alvo `nsis` com `oneClick: true` e
  `perMachine: false`: instala sem administrador em `%LOCALAPPDATA%\Programs\IdleOn Companion\`, com `productName` e
  `executableName` "IdleOn Companion", atalho no menu Iniciar e desinstalador. `read.js` vai em `extraResources`.
  Configuração em `electron-builder.yml`. Sem assinatura de código.
- **Rationale**: o caminho fixo por usuário é o padrão do NSIS do electron-builder quando `perMachine` é falso, e não
  muda entre versões, então a opção da Steam continua válida. O electron-builder empacota a saída do electron-vite
  (`out/`) sem mudar o build.
- **Alternatives**: electron-forge + Squirrel (descartada no brainstorming: pastas `app-x.y.z` e um executável-ponte
  que a Steam acompanharia no lugar do guardião); `oneClick: false` (pergunta pasta e modo, abre a porta para um caminho
  que a opção da Steam não conhece); zip portátil (sem atualização).

## R3. Atualização automática

- **Decision**: electron-updater 6.8.11 (MIT) no processo principal do app, nunca no guardião. Provedor `github`,
  `owner: Arkh-Company`, `repo: idleon-companion-releases` (público, só releases; sem token no app). `autoDownload` ligado;
  `allowDowngrade` falso (padrão: FR-032). Procura ao abrir o app e a cada 6 horas. O electron-updater confere o
  `sha512` do `latest.yml` publicado antes de instalar (FR-021). `autoInstallOnAppQuit` fica ligado só enquanto o
  status do elo diz que o jogo não está aberto e nenhum `LegendsOfIdleon.exe` roda; "Restart to update" chama
  `quitAndInstall(true, true)` só nesse estado (FR-022, FR-023). A API é a da linha 6.x (a 7.x, ainda não publicada,
  troca `autoInstallOnAppQuit` por `autoInstallEvent`).
- **Rationale**: é o atualizador do próprio electron-builder; lê o `app-update.yml` gerado no build e baixa da release
  pública. A emenda 1.1.0 da constituição permite exatamente isso: só o app, HTTPS, hash conferido.
- **Alternatives**: update.electronjs.org (pede Squirrel); um atualizador próprio (mais código para o mesmo hash);
  procurar só ao abrir (o app pode ficar aberto dias na bandeja).

## R4. Arquivos da Steam

- **Decision**:
  - Pasta da Steam: `reg query HKCU\Software\Valve\Steam /v SteamPath` (e `SteamExe`), por `execFile`, sem shell.
  - Conta usada por último: `config\loginusers.vdf`, a entrada com `"MostRecent" "1"`; a chave é o SteamID64, e a pasta
    da conta é `userdata\<SteamID64 − 76561197960265728>\`. O nome mostrado na tela é o `PersonaName`, lido na hora e
    nunca gravado (FR-028).
  - Jogo instalado: `steamapps\appmanifest_1476970.acf` numa das bibliotecas de `config\libraryfolders.vdf` (appid
    1476970 conferido na máquina do Vinicius, 07/11).
  - Opção: `userdata\<id>\config\localconfig.vdf`, caminho `UserLocalConfigStore > Software > Valve > Steam > apps >
    1476970 > LaunchOptions` (nomes de chave conferidos num arquivo real; a busca ignora maiúsculas, porque a Steam já
    escreveu `apps` e `Apps`).
  - Leitura do formato: um leitor próprio de KeyValues em texto (strings entre aspas, chaves, escapes `\"` `\\` `\n`
    `\t`, comentários `//`) que guarda a posição de cada valor. A gravação **não** reescreve o arquivo: troca só o
    trecho do valor de `LaunchOptions` (ou insere a linha, ou o bloco do jogo, quando faltam), e o resto do arquivo fica
    byte a byte igual. Grava por arquivo temporário + `rename`.
  - Steam aberta: `tasklist /FI "IMAGENAME eq steam.exe"`. Fechar: `steam.exe -shutdown` e esperar o processo sumir, até
    30 s (FR-010, Edge Cases). Reabrir: `steam.exe` destacado. Jogo aberto: `tasklist` com `LegendsOfIdleon.exe` ou o
    status do elo (FR-014).
  - Cópia: na primeira gravação de cada conta, `%APPDATA%\IdleOn Companion\steam-backup\<id>-localconfig.vdf`, nunca
    sobrescrita (FR-027).
- **Rationale**: a Steam regrava o `localconfig.vdf` ao fechar, então só se grava com ela fechada; trocar só o trecho do
  valor garante que nada além da opção muda (FR-007) e torna o teste simples (o arquivo antes e depois diferem só ali).
  O formato é pequeno; um leitor de ~100 linhas com testes sai mais barato que uma dependência sem manutenção.
- **Alternatives**: pacotes `vdf`/`@node-steam/vdf` (reserializam o arquivo inteiro, mudam espaços e ordem, e estão
  parados); o registro do Windows para a conta (`AutoLoginUser` não diz a conta da pasta `userdata`); matar a Steam
  (proibido, FR-010).

## R5. Acrescentar e tirar a parte do companion

- **Decision**: a parte do companion é `"<exe>" --keeper ` (em desenvolvimento, `"<electron.exe>" "<repositório>"
  --keeper `). Acrescentar: com `%command%` no texto do usuário, a parte entra logo antes do primeiro `%command%`; sem,
  o texto vira `"<exe>" --keeper %command% <texto>` (na Steam, opções sem `%command%` vão depois do comando, então o
  efeito é o mesmo). O texto exato inserido é guardado por conta. Tirar: remove esse texto inserido uma vez do texto
  atual; se não estiver lá (o usuário tirou à mão), não muda nada. Aviso de console: o texto do usuário tem `.cmd` ou
  `.bat` antes de `%command%`. Funções puras, sem Steam, com testes.
- **Rationale**: decisão do Vinicius (07/11): nunca apagar o que o usuário tinha; desfazer tira só a parte do companion,
  mesmo que ele tenha mudado o resto depois.
- **Alternatives**: restaurar o texto de antes (apagaria o que o usuário mudou depois); trocar o texto todo (recusado
  pelo Vinicius).

## R6. Desinstalador

- **Decision**: `build/installer.nsh` com a macro `customUnInit`, dentro de `${ifNot} ${isUpdated}` (uma atualização
  roda o desinstalador velho com `--updated` e não pode mexer na Steam): pergunta se pode fechar a Steam; com sim, roda
  `"$INSTDIR\IdleOn Companion.exe" --remove-from-steam` e espera; o código de saída diz o resultado (0 feito ou nada a
  fazer, 2 jogo aberto → aborta com "Close the game first", 3 a Steam não fechou). Com não, ou código 3, mostra o texto
  a tirar (`"$INSTDIR\IdleOn Companion.exe" --keeper`) e segue (FR-013). `--remove-from-steam` roda o mesmo fluxo de
  "Remove from Steam" sem janela e sem a trava de instância única.
- **Rationale**: `customUnInit` roda antes de qualquer arquivo sair e antes da checagem de app aberto do desinstalador
  (que mataria o guardião e o jogo). O desinstalador só existe no disco a partir da primeira versão, então a primeira
  já leva a macro.
- **Alternatives**: `customUnInstall` (a ordem em relação à remoção dos arquivos não está documentada; a primeira
  instalação de teste do quickstart confere o `customUnInit`); mexer no VDF pelo NSIS (duplicaria o leitor).

## R7. Deixar o jogo fechar

- **Decision**: duas mensagens novas no elo, do app para o guardião: `{"type":"release"}` e `{"type":"reconnect"}`.
  `release` para o leitor e espera ele soltar a referência (`Runtime.releaseObjectGroup`) e desanexar
  (`Target.detachFromTarget`), sem fechar o canal; o status vira `reader: "released"`. `reconnect` começa um leitor
  novo, que pega o motor com uma pausa nova. `stop()` do leitor passa a devolver uma promessa resolvida depois da
  soltura, para um "Reconnect" logo depois não correr com ela. IPC novos: `reader:release`, `reader:reconnect`. O menu
  da bandeja é refeito a cada status.
- **Rationale**: a Task 12 mostrou que só a sessão anexada à página trava o X; o canal sozinho não. O caminho de soltura
  já existe no leitor (o `finally` do loop).
- **Alternatives**: fechar o jogo pelo companion (seria chamar o jogo ou matar o processo; fora das regras); detectar o
  X (o teste 2e mostrou que não há sinal).

## R8. Quem publica a release (to plan)

- **Decision**: uma receita local, `just release`, que o Vinicius roda no terminal dele, com o `GH_TOKEN` dele: build,
  `electron-builder --win nsis --publish always` para `Arkh-Company/idleon-companion-releases`. A sessão nunca lê nem
  pede o token.
- **Rationale**: o build do NSIS precisa de Windows, que é a máquina dele; sem segredo novo no GitHub; cada release é
  um ato dele, em linha com o risco aceito (2FA na conta que publica).
- **Alternatives**: workflow no CI do repositório privado (um token com escrita no repositório público, gravado como
  segredo; um runner Windows; mais uma peça para manter, para alguns amigos).

## R9. Desenvolvimento e app instalado

- **Decision**: os dois usam a mesma pasta de dados (`%APPDATA%\IdleOn Companion`) e o mesmo elo; a opção da Steam
  aponta para um só (o instalado, ou o `electron.exe` do repositório com `"<repo>" --keeper`, sem `.cmd`). Em
  desenvolvimento o atualizador fica desligado (`app.isPackaged` falso). `scripts/steam-launch.cmd` sai.
- **Rationale**: só um guardião roda por vez (o elo recusa o segundo); duas janelas ligadas ao mesmo guardião funcionam
  (o elo aceita vários clientes).
- **Alternatives**: pasta e elo separados para desenvolvimento (mais configuração, e os nomes do jogador ficariam em dois
  lugares).

## R10. Testes

- **Decision**: testes puros (vitest) para o leitor de VDF e a troca do trecho, acrescentar/tirar a parte, a conta mais
  recente, a decisão de instalar a atualização, o despacho da entrada, as mensagens novas do elo e do IPC, e o guardião
  soltando e reanexando com o `Cdp` falso (o padrão da 001). A tela de configuração e a barra com testing-library. O
  fluxo que fecha e reabre a Steam recebe as operações de sistema por parâmetro (como `KeeperDeps`), e os testes usam
  falsos. Instalador, desinstalador e atualização real: roteiro manual no `quickstart.md`.
- **Rationale**: a constituição pede testes sem rede e sem credenciais; a lição 3 da 001 pede que os caminhos de
  proteção (nunca gravar com a Steam aberta, nunca instalar com o jogo aberto) tenham teste no `just check`.
- **Alternatives**: testes contra uma Steam real (lentos, mexem na máquina do desenvolvedor).
