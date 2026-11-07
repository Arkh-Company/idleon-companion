# Feature Specification: Instalação e configuração (install-and-setup)

**Feature Branch**: `spec/002-install-and-setup`

**Created**: 2026-11-07

**Status**: Draft

**Input**: design aprovado pelo Vinicius no brainstorming de 07/11/2026 (a descrição completa está no fim, em
"Origem do design").

## Por que esta feature

Na Task 12 da 001 (07/11, com o jogo real), a leitura funcionou, mas apareceram dois problemas, com as causas isoladas
por testes A/B:

1. **A compra de gemas falha** com qualquer lançador de console (`.cmd`) entre a Steam e o jogo: a Steam não sobe o
   overlay (a linha "GameOverlay: started … for game process" some do `Steam\logs\console_log.txt`), e a janela de
   compra não tem onde abrir. Com um programa com janela (um `.exe`) no lugar do `.cmd`, o overlay sobe e a compra
   funciona, também com o canal do depurador e a sessão anexada.
2. **O X e o Alt+F4 do jogo não fecham** enquanto o guardião está anexado à página do jogo, mesmo sem pausa e sem
   leitura. Desanexar libera o fechamento na hora. Apertar o X não manda nenhum sinal pelo canal, então o companion não
   tem como perceber e desanexar sozinho.

Além disso, hoje a instalação é à mão: clonar o repositório, compilar e colar na Steam uma opção de inicialização que
aponta para um `.cmd`. O Vinicius quer mandar o companion a alguns amigos, que devem instalá-lo como um app comum, sem
colar nada na Steam, e receber as versões novas sem pedir.

Para quem: o Vinicius e alguns amigos que jogam Legends of Idleon pela Steam no Windows. O Vinicius manda o primeiro
instalador.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instalar e deixar a Steam pronta em uma tela (Priority: P1)

Um amigo recebe do Vinicius o link do instalador, instala o IdleOn Companion sem pedir administrador, abre o app e vê
uma tela só de configuração: a Steam encontrada, a conta usada por último (a configuração vale para ela) e o jogo
encontrado. Ele clica em "Close Steam and set up": a Steam fecha pelo jeito normal, o companion grava a opção de
inicialização do jogo (guardando uma cópia do arquivo de configuração da Steam antes) e reabre a Steam. A partir daí,
"Jogar" na Steam abre o jogo com o companion lendo, e a loja de gemas funciona.

**Why this priority**: é o que faz o companion existir para alguém além do Vinicius, e é a correção da compra de gemas
(o guardião passa a ser lançado pelo próprio programa do app, nunca por um `.cmd`). Sem esta história, nada mais tem
para quem servir.

**Independent Test**: numa conta do Windows sem o companion, instalar pelo instalador, clicar em "Close Steam and set
up", jogar pela Steam: o painel acompanha o jogo, e a janela de compra de gemas abre na loja do jogo (sem concluir a
compra).

**Acceptance Scenarios**:

1. **Given** o Windows sem o companion, **When** o usuário roda o instalador, **Then** o app fica instalado só para
   aquele usuário, sem pedido de administrador, num caminho fixo, com atalho no menu Iniciar e desinstalador, e o app
   abre ao fim da instalação.
2. **Given** o app aberto pela primeira vez, a Steam aberta e o jogo instalado, **When** a tela de configuração
   aparece, **Then** ela mostra a Steam encontrada, a conta usada por último, o jogo encontrado e o estado da opção de
   inicialização ("not set", a do companion, ou outra), com os botões "Close Steam and set up", "Details" e "Not now".
3. **Given** a tela de configuração com a opção da conta vazia, **When** o usuário clica em "Close Steam and set up",
   **Then** a Steam fecha pelo jeito normal, o companion guarda uma cópia do arquivo de configuração da conta, grava a
   opção `"<caminho do app>" --keeper %command%` só para o Legends of Idleon, reabre a Steam e mostra "All set. Press
   Play in Steam as usual."
4. **Given** a opção da conta com outro texto (por exemplo, o `.cmd` da v1), **When** o usuário clica em "Close Steam
   and set up", **Then** o companion mostra o texto atual e o novo e só troca depois de uma confirmação; sem a
   confirmação, nada muda na Steam.
5. **Given** a configuração feita, **When** o usuário aperta "Jogar" na Steam, **Then** o jogo abre com o companion
   lendo (como na 001), o overlay da Steam sobe e a janela de compra de gemas abre na loja do jogo.
6. **Given** a tela de configuração, **When** o usuário clica em "Details", **Then** ela mostra o texto exato da opção
   que será gravada, a conta, o arquivo que muda e onde fica a cópia; **When** clica em "Not now", **Then** a tela
   fecha sem mexer na Steam, e "Set up Steam" fica em Settings.

---

### User Story 2 - Deixar o jogo fechar e reconectar (Priority: P2)

Com o companion lendo, o jogador quer fechar o jogo pelo X. Ele clica em "Let the game close" na barra de status (ou no
menu do ícone da bandeja): o guardião solta o jogo, a barra mostra "Reader off · You can close the game now", e o X do
jogo volta a fechar. Se ele mudar de ideia, "Reconnect" volta a ler, com uma nova pausa única de cerca de 300 ms.

**Why this priority**: hoje o jogador não consegue fechar o jogo pelo X com o companion ligado, um defeito que todo
jogador sente em toda sessão. Vem depois da P1 porque só importa para quem já tem o companion lendo.

**Independent Test**: com o jogo aberto pelo companion e lendo, clicar em "Let the game close" e apertar o X do jogo:
o jogo fecha. Noutra sessão, clicar em "Let the game close" e depois em "Reconnect": as leituras voltam, com uma pausa.

**Acceptance Scenarios**:

1. **Given** o jogo aberto pelo companion e lendo, **When** o usuário clica em "Let the game close" na barra de status,
   **Then** o guardião solta a referência ao motor e desanexa da página, a barra mostra "Reader off · You can close the
   game now", o botão vira "Reconnect", e o X e o Alt+F4 do jogo fecham o jogo.
2. **Given** o mesmo estado, **When** o usuário clica com o botão direito no ícone da bandeja, **Then** o menu tem "Let
   the game close" (ou "Reconnect", depois do clique), com o mesmo efeito, também com a janela escondida.
3. **Given** o leitor desligado por "Let the game close" e o jogo aberto, **When** o usuário clica em "Reconnect",
   **Then** o guardião reanexa, pega a referência ao motor com uma nova pausa única, as leituras voltam, e o
   botão/item volta a ser "Let the game close".
4. **Given** o leitor desligado por "Let the game close", **When** o usuário fecha o jogo, **Then** o guardião termina
   como na 001 (depois do jogo), e o app segue "Close companion when the game closes".
5. **Given** o companion lendo, **When** a barra de status aparece, **Then** ela lembra, em uma linha curta, que o X do
   jogo só fecha depois de "Let the game close".

---

### User Story 3 - Desfazer a configuração da Steam (Priority: P3)

O jogador quer o jogo como era antes: em Settings, "Remove from Steam" devolve a opção de inicialização anterior, com o
mesmo fluxo de fechar e reabrir a Steam. Desinstalar o companion também desfaz. "Set up Steam" refaz a configuração
(por exemplo, depois de entrar com outra conta na Steam).

**Why this priority**: dá confiança para instalar (dá para voltar atrás) e evita que um app desinstalado deixe a Steam
apontando para um programa que não existe mais, o que impediria o jogo de abrir.

**Independent Test**: com a configuração feita, clicar em "Remove from Steam": a opção volta ao texto anterior (vazio
ou o que havia) e o jogo abre normalmente pela Steam, sem o companion. Desinstalar com a configuração feita: o mesmo.

**Acceptance Scenarios**:

1. **Given** a configuração feita, **When** o usuário clica em "Remove from Steam" em Settings e confirma, **Then** a
   Steam fecha pelo jeito normal, a opção volta exatamente ao texto anterior à configuração, a Steam reabre, e o jogo
   abre sem o companion.
2. **Given** a configuração feita, **When** o usuário desinstala o companion, **Then** o desinstalador devolve a opção
   anterior antes de apagar o app (fluxo em Open Questions), e o jogo continua abrindo pela Steam.
3. **Given** a Steam com outra conta usada por último, **When** o usuário clica em "Set up Steam" em Settings, **Then**
   a tela de configuração aparece para essa conta, com o mesmo fluxo da história 1.

---

### User Story 4 - Receber versões novas sozinho (Priority: P4)

O Vinicius publica uma versão nova num repositório GitHub público só de releases. O app instalado nos amigos encontra a
versão, baixa em segundo plano, confere o hash publicado e mostra "Update ready". A atualização nunca é aplicada com o
jogo aberto (o guardião é o mesmo programa do app, e trocar os arquivos derrubaria o jogo); ela entra quando o jogo
está fechado e o app sai ou o usuário pede.

**Why this priority**: sem ela, o Vinicius manda cada versão à mão. Vem por último porque as histórias 1 a 3 já
funcionam com versões instaladas à mão.

**Independent Test**: com a versão N instalada e a N+1 publicada, abrir o app sem o jogo: aparece "Update ready";
sair do app: na próxima abertura, a versão é a N+1, com a configuração da Steam ainda válida. Repetir com o jogo aberto:
a atualização espera o jogo fechar.

**Acceptance Scenarios**:

1. **Given** uma versão nova publicada, **When** o app está aberto, **Then** ele a baixa em segundo plano, confere o
   hash publicado e mostra "Update ready"; um download com hash errado é descartado e não instala.
2. **Given** "Update ready" e o jogo aberto, **When** o usuário sai do app ou o jogo segue aberto, **Then** nada é
   instalado, e a barra diz que a atualização entra depois que o jogo fechar.
3. **Given** "Update ready" e o jogo fechado, **When** o usuário clica em "Restart to update" ou sai do app, **Then** a
   versão nova é instalada no mesmo caminho, o app reabre na versão nova (no primeiro caso), e a opção da Steam segue
   válida sem refazer a configuração.
4. **Given** o computador sem internet, **When** o app procura versões, **Then** a falha não mostra erro ao jogador
   além de uma linha discreta em Settings, e o companion funciona normalmente.

---

### Edge Cases

- **A Steam não fecha pelo jeito normal** dentro de um tempo razoável: o companion não mexe em nada, diz que a Steam não
  fechou e oferece tentar de novo; nunca mata o processo da Steam.
- **O jogo está aberto** quando o usuário clica em "Close Steam and set up" ou "Remove from Steam": o botão fica
  desativado com "Close the game first" (fechar a Steam derrubaria o jogo).
- **A Steam não é encontrada, ou o jogo não está instalado**: a tela mostra o que falta, sem o botão de configurar; em
  "Details", o texto exato da opção para quem quiser colar à mão.
- **Nenhuma conta usada por último** (Steam nunca logada): a tela pede para entrar na Steam uma vez e voltar.
- **O arquivo de configuração da Steam não pode ser lido ou tem formato inesperado**: o companion não grava nada, mostra
  o motivo e o texto da opção para colar à mão; a cópia guardada nunca é sobrescrita por uma cópia pior.
- **A Steam não reabre** depois da gravação: o companion diz que a configuração está feita e pede para abrir a Steam à
  mão.
- **A opção já é a do companion** (configuração repetida): "Set up Steam" informa que está tudo certo e não grava de
  novo.
- **A versão da 001 rodando do repositório** (desenvolvimento) e o app instalado na mesma máquina: as duas convivem sem
  usar a mesma pasta de dados por engano nem disputar o elo de forma que um jogo fique sem leitura sem aviso (o como
  fica para o plano).
- **"Let the game close" sem jogo aberto ou sem leitura**: o botão não aparece (ou fica desativado).
- **"Reconnect" falha** (o jogo recarregou, a página mudou): a barra mostra o motivo e o botão continua "Reconnect".
- **O jogo atualizou** entre a configuração e o próximo "Jogar": o vigia de update da 001 continua valendo igual.
- **O download de uma versão é interrompido**: recomeça na próxima procura, sem instalar nada pela metade.
- **O SmartScreen do Windows** avisa no primeiro instalador (sem assinatura de código): a página da release diz como
  seguir ("More info" → "Run anyway").

## Requirements *(mandatory)*

### Functional Requirements

**Instalação**

- **FR-001**: O companion MUST ter um instalador por usuário, que não pede administrador, instala sempre no mesmo
  caminho (`%LOCALAPPDATA%\Programs\IdleOn Companion\IdleOn Companion.exe`), cria um atalho no menu Iniciar e um
  desinstalador nas configurações do Windows.
- **FR-002**: O instalador MUST levar tudo o que o app e o guardião usam (o leitor e o catálogo de nomes embutido),
  e MUST NOT levar nenhum arquivo do jogo.
- **FR-003**: Um único programa MUST fazer os dois papéis: com `--keeper` e a linha de comando da Steam, roda como
  guardião (sem janela, segura o canal do depurador e lê, como na 001); sem esse argumento, é o app (janela e bandeja).
  A Steam MUST lançar esse programa diretamente, nunca por um lançador de console (`.cmd`, `.bat`).
- **FR-004**: O lançador `scripts/steam-launch.cmd` e as instruções de colar a opção à mão MUST sair do caminho do
  usuário; a documentação passa a descrever o instalador e a tela de configuração.

**Configuração da Steam**

- **FR-005**: Na primeira abertura do app sem configuração feita, o app MUST mostrar a tela de configuração (uma tela
  só) com: a Steam encontrada, a conta usada por último, o jogo encontrado e o estado atual da opção de inicialização.
- **FR-006**: A configuração MUST valer para a conta usada por último na Steam, e a tela MUST dizer o nome dessa conta.
- **FR-007**: O companion MUST mexer na Steam só depois de um clique do usuário em "Close Steam and set up" (ou "Remove
  from Steam"), e MUST, nessa ordem: fechar a Steam pelo jeito normal e esperar ela terminar; guardar uma cópia do
  arquivo de configuração da conta; gravar só a opção de inicialização do Legends of Idleon; reabrir a Steam.
- **FR-008**: Quando a opção atual da conta não está vazia e não é a do companion, o companion MUST mostrar o texto
  atual e o novo e MUST trocar só depois de uma confirmação.
- **FR-009**: O companion MUST guardar, para cada conta configurada, o texto da opção anterior, para "Remove from
  Steam" e o desinstalador devolverem exatamente esse texto.
- **FR-010**: O companion MUST NOT matar o processo da Steam nem gravar no arquivo da Steam com ela aberta.
- **FR-011**: "Details" MUST mostrar o texto exato da opção, a conta, o arquivo que muda e onde fica a cópia; "Not now"
  MUST fechar a tela sem mexer na Steam.
- **FR-012**: Settings MUST ter "Set up Steam" (refaz a configuração para a conta usada por último) e "Remove from
  Steam" (devolve a opção anterior, com o mesmo fluxo de fechar e reabrir a Steam e uma confirmação).
- **FR-013**: O desinstalador MUST devolver a opção anterior de cada conta configurada antes de apagar o app, ou, se
  não puder, MUST dizer ao usuário exatamente o que limpar na Steam (fluxo em Open Questions).
- **FR-014**: Com o jogo aberto, os botões que fecham a Steam MUST ficar desativados com "Close the game first".

**Deixar o jogo fechar**

- **FR-015**: A barra de status e o menu do ícone da bandeja MUST ter "Let the game close" enquanto o guardião está
  anexado ao jogo.
- **FR-016**: "Let the game close" MUST fazer o guardião soltar a referência ao motor e desanexar a sessão da página,
  mantendo o canal do depurador aberto (fechar o canal derruba o jogo, Task 0 da 001); a barra MUST mostrar "Reader off
  · You can close the game now", e o botão/item MUST virar "Reconnect".
- **FR-017**: "Reconnect" MUST reanexar e pegar a referência ao motor com uma nova pausa única (como a da 001, cerca de
  300 ms), e as leituras MUST voltar.
- **FR-018**: Enquanto lê, a barra de status MUST lembrar em uma linha curta que o X do jogo só fecha depois de "Let the
  game close".
- **FR-019**: Soltar e reanexar MUST seguir as restrições da 001: só leitura de propriedades, nenhuma função do jogo
  chamada, nada gravado no save.

**Atualização automática**

- **FR-020**: O app (nunca o guardião, nunca o jogo) MUST procurar versões novas num repositório GitHub público só de
  releases, por HTTPS, e baixá-las em segundo plano.
- **FR-021**: O app MUST conferir o hash publicado de cada download e MUST descartar um download com hash diferente.
- **FR-022**: Com uma versão baixada, o app MUST mostrar "Update ready"; com o jogo fechado, "Restart to update"
  instala e reabre; sair do app com o jogo fechado também instala.
- **FR-023**: O app MUST NOT instalar uma atualização com o jogo aberto (guardião rodando); a barra MUST dizer que a
  atualização entra depois que o jogo fechar.
- **FR-024**: Uma atualização MUST instalar no mesmo caminho, mantendo válida a opção da Steam, as configurações e os
  nomes do jogador.
- **FR-025**: Falhas de rede na procura MUST NOT interromper o companion nem mostrar erro além de uma linha em Settings.
- **FR-026**: Nada além da procura e do download de versões do app MUST acessar a rede (o guardião e o leitor seguem
  sem rede).

### Key Entities

- **Configuração da Steam (por conta)**: a conta, o texto da opção anterior, onde fica a cópia do arquivo da Steam, e
  quando foi feita. Serve para desfazer.
- **Opção de inicialização**: o texto que a Steam usa para abrir o jogo; o do companion é `"<caminho do app>" --keeper
  %command%`.
- **Versão publicada**: número da versão, o instalador e o hash publicado, no repositório público de releases.
- **Estado da atualização**: nenhuma, baixando, pronta (esperando o jogo fechar ou o usuário), com falha.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um amigo que nunca viu o projeto instala o companion e joga com ele lendo em menos de 5 minutos, sem
  digitar nada na Steam.
- **SC-002**: Com o companion instalado e configurado, a janela de compra de gemas abre em 3 de 3 tentativas na loja do
  jogo.
- **SC-003**: Depois de "Let the game close", o X do jogo fecha o jogo em até 2 segundos, em todas as tentativas.
- **SC-004**: "Reconnect" faz as leituras voltarem com exatamente uma pausa nova do jogo, e o painel volta a acompanhar
  o jogo em até 2 segundos.
- **SC-005**: "Remove from Steam" e a desinstalação deixam a opção de inicialização com exatamente o texto de antes da
  configuração, e o jogo abre normalmente pela Steam.
- **SC-006**: Uma versão nova publicada chega ao app instalado sem o usuário baixar nada à mão, e nenhuma atualização é
  instalada com o jogo aberto (zero quedas do jogo por atualização).
- **SC-007**: Em uma sessão de jogo com o companion, a única conexão de rede do companion é a procura/download de
  versões do app.

## Assumptions

- Os amigos usam Windows 10 ou 11, a Steam instalada no Windows e o Legends of Idleon pela Steam.
- A opção de inicialização fica no arquivo de configuração local da conta na Steam e não é sincronizada pela nuvem da
  Steam; a Steam regrava esse arquivo ao fechar, por isso ela precisa estar fechada na gravação.
- A conta usada por último é a que a Steam marca como mais recente no seu arquivo de logins.
- Sem assinatura de código: o primeiro instalador pode disparar o SmartScreen, e a página da release explica como
  seguir.
- O catálogo de nomes segue embutido como na 001; gerar o catálogo a partir do jogo de cada um fica para depois.
- A arquitetura da 001 continua: guardião + elo por named pipe + app; esta feature muda como o guardião é lançado e
  acrescenta soltar/reanexar.
- O código segue num repositório privado; o repositório público só recebe releases (instalador e metadados).

### Dependências

- **Emenda da constituição**: hoje ela diz "nunca acessar a rede (Firebase, HTTP)". A atualização automática precisa
  de uma emenda estreita, por `/speckit-constitution` num branch com PR: só o app pode procurar e baixar versões do
  próprio companion no repositório público de releases, por HTTPS e com o hash conferido; o guardião, o leitor e o
  jogo seguem sem rede. Sem a emenda, a história 4 não pode ser planejada.
- **Repositório público de releases** (por exemplo, `Arkh-Company/idleon-companion-releases`): criado só com o OK
  explícito do Vinicius.

### Deixado para quem construir (plano)

- Como ler e gravar o formato de configuração da Steam (texto KeyValues) com segurança.
- Como encontrar a Steam, a pasta dela, a conta usada por último, e saber se a Steam está aberta ou fechada.
- A cadência da procura de versões.
- Os textos finais das telas (em inglês).
- Como a versão rodando do repositório convive com o app instalado no desenvolvimento.
- Como a release é montada e publicada.

### Abordagens consideradas

1. **Instalador NSIS por usuário, em caminho fixo, com atualização pelo repositório de releases e um único programa
   com `--keeper`** — escolhida: o caminho fixo mantém a opção da Steam válida entre versões, e o guardião é o próprio
   processo que a Steam acompanha.
2. **Squirrel.Windows com serviço de atualização** — descartada: pastas por versão (`app-x.y.z`) e um executável-ponte
   que reabre e sai fariam a Steam acompanhar outro processo e quebrariam o guardião.
3. **Zip portátil sem instalador** — descartada: sem atualização automática.

## Out of Scope *(mandatory)*

- Assinatura de código (o SmartScreen é contornado com instrução).
- Publicar para jogadores em geral (é para o Vinicius e alguns amigos).
- Gerar o catálogo de nomes a partir do jogo instalado (módulo game-tables).
- Desconectar sozinho quando o jogador aperta o X do jogo: o teste 2e da Task 12 mostrou que o X não manda nenhum sinal
  pelo canal.
- Formula Breakdown e qualquer cálculo.
- Outros sistemas operacionais.
- Anti-objetivos (nunca): qualquer mudança na Steam sem o clique do usuário; matar o processo da Steam; aplicar
  atualização com o jogo aberto; o guardião, o leitor ou o jogo acessarem a rede; chamar função do jogo, gravar no
  save ou automatizar cliques.

## Open Questions *(mandatory)*

| Question | State | Answer |
| --- | --- | --- |
| Lançar o guardião por um `.exe` com janela resolve a compra de gemas? | resolved | Sim (Task 12, 07/11): com o `electron.exe` direto na opção da Steam, o overlay sobe e a compra abre, também com o canal e a sessão anexada. |
| Dá para desanexar sozinho quando o jogador aperta o X? | resolved | Não (teste 2e, 07/11): o X não manda nenhum evento pelo canal. Fica o botão "Let the game close" (decisão do Vinicius, na barra e na bandeja). |
| Formato do onboarding | resolved | Uma tela só (Vinicius, brainstorming de 07/11). |
| Quem fecha e reabre a Steam | resolved | O app, com o clique do usuário (Vinicius, brainstorming de 07/11). |
| Como o desinstalador desfaz a opção da Steam, se a Steam estiver aberta na hora? (proposta: pede para fechar a Steam pelo jeito normal, devolve a opção e reabre; se o usuário recusar, mostra o texto exato a limpar na Steam) | open | |
| Depois de "Not now", quando a tela de configuração aparece de novo? (proposta: só por "Set up Steam" em Settings) | open | |
| Com várias contas configuradas, "Remove from Steam" desfaz em todas ou só na conta usada por último? | open | |
| A emenda da constituição (rede só para a atualização do app) vai num PR próprio antes do `/speckit-plan`? | open | |
| Quem publica a release: uma receita local do Vinicius ou o CI do repositório privado? | open | |

## Origem do design

Brainstorming de 07/11/2026 com o Vinicius, aprovado ("Aprovo, pode rodar"). Decisões do usuário: para alguns amigos;
atualização automática; repositório público só de releases; onboarding em uma tela; o app fecha e reabre a Steam com o
clique do usuário; "Let the game close" na barra e na bandeja. Decisões propostas e aceitas: sem assinatura de código;
catálogo embutido; conta = a usada por último; o leitor vai dentro do app instalado. Achados completos da Task 12 nas
notas da sessão (`task12-achados-steam.md`).
