# Feature Specification: Base de telas (screen-base)

**Feature Branch**: `spec/003-screen-base`

**Created**: 2026-11-08

**Status**: Draft

**Input**: desenho aprovado pelo Vinicius em 08/11/2026, a partir do material de produto (`docs/product/spec-003-base-de-telas.md`, `mapa-de-telas.md` e `resultados-testes-no-jogo.md`, fora deste repositório).

## Por que esta feature

Hoje o app diz "unnamed #N" e pede ao jogador para digitar o nome. O catálogo tem 20 nomes errados e não conhece abas nem subtelas. Decisão do Vinicius: **tudo mapeado e nomeado de fábrica; o jogador não nomeia nada.** Esta é a primeira base dos próximos blocos (dashboard, informações da tela e fórmula).

**Regra central: o app nunca mostra um nome errado.** Ou o nome tem prova, ou aparece "Unknown screen".

A base de provas vem da rodada no jogo real em 08/11/2026 (84 janelas abertas, 266 estados comparados com foto) e da leitura dos sprites do jogo instalado.

## Clarifications

### Session 2026-11-08

- Q: Onde aparecem os números de tela novos que o guardião achar? → A: Só no `keeper.log`; o jogador não vê nada.
- Q: Quando as tabelas do jogo não puderem ser lidas, o que aparece no lugar do nome? → A: "Unknown map" e "Unknown monster".
- Q: Junto com o `names.json`, o app apaga também o `.bak` e o `.bad`? → A: Sim, os três.
- Q: Qual regra vale se duas casarem, e quando as tabelas são lidas? → A: Ficam para o plano.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber em que tela estou (Priority: P1)

O jogador abre qualquer janela do jogo, e o painel mostra o nome certo em até cerca de 1 s.

**Why this priority**: é o valor central da feature e a base dos blocos seguintes.

**Independent Test**: com estados capturados na rodada, cada estado resulta no nome esperado, sem jogo aberto. No jogo, abrir Sailing mostra "Sailing".

**Acceptance Scenarios**:

1. **Given** o jogo com Sailing aberto, **When** o leitor lê o estado, **Then** o painel mostra "Sailing".
2. **Given** a janela 64 aberta, **When** o leitor lê o estado, **Then** o painel mostra "Orion", não "The Hole".
3. **Given** um número de tela sem prova, **When** o leitor lê o estado, **Then** o painel mostra "Unknown screen".

---

### User Story 2 - Saber a aba e a subtela (Priority: P2)

Trocar de aba ou de subtela atualiza o painel.

**Why this priority**: a janela sozinha não diz o que o jogador está vendo em sistemas com várias abas.

**Independent Test**: estados capturados de Breeding, Codex e The Hole resultam na aba ou subtela esperada.

**Acceptance Scenarios**:

1. **Given** Breeding aberto, **When** o jogador passa pelas 4 abas, **Then** o painel mostra o nome de cada uma.
2. **Given** o Codex aberto em Cards, na subtela Sets, **When** o leitor lê o estado, **Then** o painel mostra "Codex › Cards › Sets".
3. **Given** uma janela com abas e uma aba sem nome confirmado, **When** o leitor lê o estado, **Then** o painel mostra o nome da janela e "Unknown tab".
4. **Given** uma janela fechada com um valor antigo no campo da aba, **When** outra janela abre, **Then** o painel nunca mostra a aba da janela anterior.

---

### User Story 3 - Situações fora dos menus (Priority: P3)

O painel distingue a seleção de personagem, a tela AFK Gains e estar dentro de uma caverna.

**Why this priority**: são estados em que o jogador está sem menu aberto, e o painel precisa dizer algo certo.

**Independent Test**: estados capturados de cada situação resultam no texto esperado.

**Acceptance Scenarios**:

1. **Given** a seleção de personagem, **When** o leitor lê o estado, **Then** o painel mostra "Character select", e a falta de campos de personagem não é tratada como erro.
2. **Given** a tela AFK Gains, **When** o leitor lê o estado, **Then** o painel mostra "AFK Gains".
3. **Given** o jogador dentro de uma caverna, com a janela da caverna fechada, **When** o leitor lê o estado, **Then** o painel mostra o nome da caverna.

---

### User Story 4 - Nada a preencher (Priority: P4)

O "Name it" desaparece. Número desconhecido aparece como "Unknown screen", sem campo.

**Why this priority**: remove trabalho do jogador, depois que os nomes de fábrica existem.

**Independent Test**: percorrer a interface e não encontrar nenhum campo de nome; o `names.json` antigo não existe depois de abrir a nova versão.

**Acceptance Scenarios**:

1. **Given** qualquer tela desconhecida, **When** o painel a mostra, **Then** não há campo nem botão para nomear.
2. **Given** um usuário com `names.json` da versão anterior, **When** ele abre a nova versão, **Then** o arquivo e os seus `.bak` e `.bad` são apagados, e nada depende deles.

---

### User Story 5 - Nomes do jogo de cada usuário (Priority: P5)

Os nomes de mapas e monstros vêm do jogo instalado em cada máquina.

**Why this priority**: o catálogo embutido não pode acompanhar o jogo de cada um, e o app será distribuído.

**Independent Test**: com tabelas de um arquivo de exemplo, o painel mostra o nome do mapa e do alvo AFK vindos delas; com o arquivo ilegível, o app segue funcionando.

**Acceptance Scenarios**:

1. **Given** o jogo instalado, **When** o jogador está num mapa, **Then** o painel mostra o nome do mapa lido do jogo dele.
2. **Given** um alvo AFK, **When** o leitor lê o estado, **Then** o painel mostra o nome do monstro lido do jogo dele.
3. **Given** as tabelas ilegíveis, **When** o leitor lê o estado, **Then** o app não quebra e mostra "Unknown map" e "Unknown monster".

---

### User Story 6 - Patch do jogo com tela nova (Priority: P6)

Depois de um patch, o app não quebra nem inventa nome: mostra "Unknown screen" até uma versão nova trazer o nome, e o guardião aponta sozinho os números de tela que o catálogo não conhece.

**Why this priority**: o jogo muda com frequência, e a regra central precisa valer depois de cada patch.

**Independent Test**: um código de jogo de exemplo com números novos resulta na lista dos números desconhecidos, e o jogo abre sem atraso.

**Acceptance Scenarios**:

1. **Given** um patch com uma tela nova, **When** o jogador a abre, **Then** o painel mostra "Unknown screen".
2. **Given** o código do jogo instalado com números que o catálogo não conhece, **When** o guardião verifica o jogo, **Then** ele registra esses números no `keeper.log`, e o jogador não vê nada.
3. **Given** a verificação em andamento, **When** o jogo abre, **Then** a abertura não atrasa e nada é chamado dentro do jogo.

---

### Edge Cases

- **Valor antigo depois de fechar**: uma aba só vale junto da janela dela (FR-005).
- **Comportamento ausente** (seleção de personagem, carregamento): não é erro; a leitura segue (FR-008).
- **Caverna com a janela fechada**: identificada pelo estado do personagem (FR-009).
- **Nomes incertos** (janelas 53, 58 e 75 no mapa): sem prova, "Unknown screen" (FR-003).
- **Personagem de outra classe**: talentos ainda não vistos (Grimoire, Compass, Medallions, Tesseract) sem prova aparecem como "Unknown screen".
- **Diálogo com NPC, carregamento e login**: não detectáveis; valem como jogo normal.
- **Tabelas do jogo ausentes ou em formato novo**: o app segue e mostra "Unknown map" e "Unknown monster" (FR-016).
- **Código do jogo sem suspeita, mas com número novo**: o guardião aponta o número sem mudar o que ele já faz para proteger o jogador (o vigia de update da 001).

## Requirements *(mandatory)*

### Functional Requirements

**Catálogo e identificação**

- **FR-001**: O catálogo padrão MUST ser o do mapa de telas: 108 janelas, menus, Quik Ref, Codex, abas e subtelas.
- **FR-002**: A identificação MUST ser uma lista de regras avaliada sobre a leitura (por exemplo: menu 0.2, janela 5 e aba 2 → Obols › Upgrades).
- **FR-003**: O app MUST mostrar um nome só com prova: foto da rodada no jogo, ou texto do sprite ligado ao valor no código do jogo. Sem prova: "Unknown screen".
- **FR-004**: As 23 janelas não abertas na rodada MUST ter nome só se a prova por sprite existir; as demais aparecem como "Unknown screen" até serem vistas.
- **FR-005**: Uma aba MUST valer só junto da janela dela, porque os campos guardam o valor antigo depois de fechar.
- **FR-006**: Aba ou subtela sem nome confirmado numa janela conhecida MUST aparecer como "Unknown tab", ao lado do nome da janela, no mesmo formato dos outros nomes (por exemplo: "Breeding › Unknown tab").

**Leitura**

- **FR-007**: O leitor MUST passar a ler, só por propriedade: `engine.scene.name`, `AttackSelected`, `InventorySelected`; `OptionsList[1]`, `[3]`, `[18]`, `[19]`; `OptionsListAccount[489]`; `NONdummies[37]`; `Holes[0][índice do personagem]`; os campos de comportamento listados no material de referência, com o nome exato de cada um; e os do Arcade (`_GenINFO[51]` e `[59]`). O teste de só-leitura MUST cobrir os novos.
- **FR-008**: Comportamento ausente MUST NOT ser erro: a leitura segue.
- **FR-009**: `Holes[0]` MUST identificar a caverna mesmo com a janela 69 fechada.

**Situações fora dos menus**

- **FR-010**: O painel MUST distinguir a seleção de personagem, a tela AFK Gains e estar dentro de uma caverna.

**Sem nada a preencher**

- **FR-011**: O "Name it" MUST sair por completo: o componente, o canal `catalog:name`, a gravação de nomes e os status `deduced`/`confirmed` na interface.
- **FR-012**: O app MUST apagar, na primeira abertura da nova versão, o `names.json` da versão anterior em `%APPDATA%` e os seus `names.json.bak` e `names.json.bad` (decisão do Vinicius). Se não der para apagar, o app MUST seguir funcionando e tentar de novo na próxima abertura.
- **FR-013**: Nenhum campo para o jogador preencher MUST existir em toda a interface. Campo é caixa de texto; as caixas de marcar de Settings continuam.

**Nomes do jogo de cada usuário**

- **FR-014**: Os nomes de mapas e monstros MUST vir do jogo instalado em cada máquina, lidos das tabelas do código do jogo (decisão do Vinicius). O arquivo do jogo MUST ser lido só como texto e MUST NOT ser executado pelo app; os nomes tirados dele aparecem como texto simples.
- **FR-015**: O arquivo do jogo MUST NOT entrar no repositório nem no instalador. O código de jogo de exemplo dos testes MUST ser inventado, sem trecho do arquivo real.
- **FR-016**: Quando as tabelas não puderem ser lidas, ou não tiverem o número do mapa ou do monstro, o app MUST seguir funcionando e MUST mostrar "Unknown map" e "Unknown monster", sem inventar um nome.

**Patch do jogo**

- **FR-017**: O guardião MUST registrar sozinho, só no `keeper.log`, os números de tela do código do jogo instalado que o catálogo não conhece (decisão do Vinicius).
- **FR-018**: A verificação MUST rodar depois de o jogo ser aberto, MUST NOT atrasar a abertura e MUST NOT chamar nada dentro dele: ela só lê o arquivo instalado, como o vigia de update já faz.

**Painel e testes**

- **FR-019**: O painel MUST mostrar a tela e a aba de forma simples, para o Vinicius conferir usando: a tabela de hoje, com uma linha "Screen" (janela › aba › subtela) no lugar das linhas Menu, Window e Codex tab; World, Map, Character e AFK target ficam. Sem janela aberta, a linha mostra "None".
- **FR-020**: Os testes MUST usar dados capturados na rodada (estado → nome esperado), sem nomes de jogadores e sem jogo aberto.

### Key Entities

- **Regra de tela**: as condições sobre a leitura, o nome que resulta e a prova que o sustenta (foto ou sprite).
- **Leitura**: os campos lidos do jogo a cada ciclo, agora com a cena, os campos de opções e os de comportamento.
- **Tabelas do jogo**: nomes de mapas e monstros lidos do jogo instalado na máquina do usuário.
- **Número desconhecido**: número de tela presente no código do jogo instalado e ausente do catálogo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nas 84 janelas abertas na rodada, o nome certo em 100% dos casos, nos testes com dados capturados.
- **SC-002**: Nenhuma tela aparece com nome sem prova.
- **SC-003**: Fechar uma janela e abrir outra nunca mostra a aba da anterior.
- **SC-004**: Nenhum campo para o jogador preencher em toda a interface.
- **SC-005**: O teste de só-leitura continua passando com os campos novos.
- **SC-006**: O painel acompanha a troca de tela e de aba em até cerca de 1 s.
- **SC-007**: A verificação de números novos não aumenta o tempo até o jogo abrir de forma perceptível.

## Assumptions

- A base de provas é a do mapa de telas e dos resultados dos testes de 08/11/2026, com o hash do código do jogo daquela rodada.
- A leitura é pequena e barata: medida em 1 KB e 1,8–23 ms na maioria dos ciclos, sem erro em quase 2 horas.
- Só um personagem foi usado na rodada (Markhe, Royal Guardian): telas de outras classes, de evento e de item dependem de acontecerem, e morte não foi testada na detecção de AFK Gains.
- Nenhuma emenda da constituição: "onde o jogador está" já está na missão.
- A spec 001 é congelada; a remoção do "Name it" entra por esta feature.
- A arquitetura guardião + elo + app continua.

### Deixado para quem construir (plano)

- A forma das regras do catálogo.
- Como ler as tabelas de mapas e monstros do código do jogo instalado.

## Out of Scope *(mandatory)*

- Fórmulas, retrato do estado inteiro, `_vars`, companions, números calculados, dashboard e cartões por sistema.
- Diálogo com NPC, carregamento e login, que não são detectáveis e valem como jogo normal.
- As sondas de NPC e `ARC.*` do leitor de testes.
- Anti-objetivos (nunca): nome sem prova; campo para o jogador preencher; arquivo do jogo no repositório ou no instalador; chamar função do jogo, gravar no save ou automatizar cliques; acesso à rede fora do atualizador do app.

## Open Questions *(mandatory)*

| Question | State | Answer |
| --- | --- | --- |
| O que fazer com o `names.json` do usuário? | resolved | Vinicius, 08/11: o app apaga (FR-012). |
| As 23 janelas não abertas na rodada, com que nome? | resolved | Vinicius, 08/11: só com prova por sprite; o resto "Unknown screen" (FR-004). |
| Nomes de mapas e monstros vêm do jogo de cada usuário nesta feature? | resolved | Vinicius, 08/11: sim (FR-014). |
| A verificação de números novos roda quando? | resolved | Vinicius, 08/11: automática, no guardião (FR-017). |
| Aba sem nome confirmado aparece como? | resolved | Vinicius, 08/11: "Unknown tab" ao lado do nome da janela (FR-006). |
| Onde o resultado da verificação de números novos aparece: só no `keeper.log`, ou também para o jogador? | resolved | Vinicius, 08/11: só no `keeper.log` (FR-017). |
| O que o painel mostra quando as tabelas do jogo não podem ser lidas: o número do mapa, ou "Unknown map"? | resolved | Vinicius, 08/11: "Unknown map" e "Unknown monster" (FR-016). |
| Junto com o `names.json`, o app apaga também o `names.json.bak` e o `names.json.bad`? | resolved | Vinicius, 08/11: sim, os três (FR-012). |
| Se duas regras casam com o mesmo estado, qual vale? | to plan | Vinicius, 08/11: o plano responde no `research.md`. |
| Quando as tabelas do jogo são lidas: a cada abertura do jogo, ou só quando o código do jogo muda? | to plan | Vinicius, 08/11: o plano responde no `research.md`. |
| Quando o `names.json` é apagado? | resolved | Padrão do agente: na primeira abertura do app na nova versão (FR-012). |
| Quando a verificação de números novos roda? | resolved | Padrão do agente: depois de o jogo ser aberto, para não atrasar a abertura (FR-018). |
| Que texto o painel mostra na seleção de personagem e na tela de ganhos AFK? | resolved | Padrão do agente: "Character select" e "AFK Gains" (US3). |
| As janelas 53, 58 e 75, com nome incerto no mapa, aparecem como? | resolved | Padrão do agente: "Unknown screen", até haver prova (Edge Cases, FR-003). |
| Como o app trata o arquivo do jogo? (security CHK006: lido só como texto, nunca executado, nomes como texto simples) | resolved | Padrão do agente: só lido como texto, nunca executado; os nomes aparecem como texto simples (FR-014). |
| O que acontece quando não dá para apagar os arquivos? (security CHK013) | resolved | Padrão do agente: o app segue funcionando e tenta de novo na próxima abertura (FR-012). |
| De onde vem o código de jogo de exemplo dos testes? (security CHK015) | resolved | Padrão do agente: é inventado, sem trecho do arquivo real (FR-015). |
| O que é o painel "simples" e o que ele mostra sem janela aberta? (ux CHK001, CHK005) | resolved | Padrão do agente: a tabela de hoje, com uma linha "Screen" (janela › aba › subtela) no lugar de Menu, Window e Codex tab; sem janela aberta, "None" (FR-019). |
| Subtela sem nome confirmado aparece como? (ux CHK008) | resolved | Padrão do agente: "Unknown tab", no mesmo formato, como "Breeding › Unknown tab" (FR-006). |
| O que aparece quando a tabela legível não tem o número do mapa ou do monstro? (ux CHK010) | resolved | Padrão do agente: "Unknown map" e "Unknown monster" (FR-016). |
| O que conta como campo a preencher? (ux CHK018) | resolved | Padrão do agente: caixa de texto; as caixas de marcar de Settings continuam (FR-013). |
| Nome em branco na tabela do jogo aparece como? | resolved | durante a implementação: Vinicius, 08/11: "Unknown map" ou "Unknown monster", sem inventar um nome (FR-016). |
| Qual nome vale quando o mapa de telas e o rótulo da tela diferem sem estar errados? | resolved | durante a implementação: Vinicius, 08/11: o nome do mapa de telas, que é mais curto, desde que a foto confirme que é a mesma tela (FR-003). |
| Caverna com foto em só um estado, janela aberta ou fechada, tem prova? | resolved | durante a implementação: Vinicius, 08/11: sim; `Holes[0]` é o mesmo nos dois estados, então a foto de um prova o nome no outro (FR-003, FR-009). |
| Como o `keeper.log` diz qual tabela não foi lida? | resolved | durante a implementação: `game-tables-unreadable` traz `unreadable`, com os nomes das tabelas não lidas, em vez dos booleanos do contrato `link.md`, para não ser lido ao contrário (FR-016). |
| O catálogo de telas segue a regra de importar só de `src/shared/index.ts`? | resolved | durante a implementação: Vinicius, 08/11: exceção; `src/shared/screens/index.ts` é a entrada própria, para o preload e a janela não carregarem as regras. |
