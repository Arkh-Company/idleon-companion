# Feature Specification: Base de dados (data-base)

**Feature Branch**: `spec/004-data-base`

**Created**: 2026-11-09

**Status**: Draft

**Input**: desenho aprovado pelo Vinicius em 09/11/2026, a partir do material de produto (`docs/product/spec-004-base-de-dados.md`, `resultados-testes-no-jogo.md` e `2026-11-08-relatorio-blocos-possiveis.md`, fora deste repositório).

## Por que esta feature

A parte do app que copia o estado da conta e calcula sobre ele com o código do próprio jogo, numa cópia no PC do jogador. Não é um banco de dados. É a segunda base dos blocos fórmula, informações da tela e dashboard: sem ela, nenhum deles tem número para mostrar.

Provado em 08/11/2026 com o jogo aberto: Drop Rate, Damage, HP, MP, STR, AGI, WIS, LUK, Accuracy e AFK Gains calculados offline bateram com a tela de um personagem Royal Guardian.

**Regra central: o jogo nunca é afetado.** Dentro do jogo em execução, o app só lê propriedades. Se um cálculo não der certo, a aba diz "unavailable".

## Clarifications

### Session 2026-11-09

- Q: A leitura roda com a aba "Stats" fechada? → A: Sim, roda sempre.
- Q: Como ler o estado sem travar o jogo? → A: Em leitura contínua por fatias pequenas, em vez de um retrato único; um protótipo mede o custo antes do plano.
- Q: O que a aba mostra enquanto calcula? → A: "Calculating" só antes do primeiro cálculo; depois os números se atualizam no lugar.
- Q: Quando os `_vars` são relidos? → A: Na rotação, a cada ciclo de leitura.
- Q: Qual o tempo máximo de um cálculo? → A: Fica para o plano, depois de medir.
- Q: Qual o tamanho máximo da fatia? → A: 25 KB, depois da medição com o jogo aberto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Números ao vivo (Priority: P1)

Enquanto o jogo roda, o app mantém o estado atualizado em leitura contínua e calcula os números do personagem ativo, sem o jogador pedir e sem travar o jogo.

**Why this priority**: é o valor central da feature e o que os blocos seguintes vão usar.

**Independent Test**: com um retrato reconstruído, sem jogo aberto, o cálculo dá os valores esperados. No jogo, Drop Rate e Damage batem com o Player Info.

**Acceptance Scenarios**:

1. **Given** o jogo com o personagem Royal Guardian, **When** o estado foi lido, **Then** a aba mostra os 10 números iguais aos do Player Info, com o arredondamento do jogo.
2. **Given** o jogador navegando ou em combate, **When** o app lê o estado, **Then** cada leitura é pequena e o número mostrado reflete o estado dentro do alvo de idade.
3. **Given** a leitura ligada, **When** se comparam os quadros do jogo com e sem ela, **Then** ela não perde mais quadros que a linha de base sem leitura.
4. **Given** a troca de personagem ou de mapa, **When** o app lê o estado, **Then** o ciclo parcial é descartado e nada mistura dois personagens.

---

### User Story 2 - Sem rede e sem login (Priority: P2)

Companions e `_vars` vêm da memória do jogo. Nada depende de internet nem de conta.

**Why this priority**: a missão proíbe rede fora do atualizador, e o cálculo precisa desses valores para bater com a tela.

**Independent Test**: com a rede desligada, o mesmo retrato dá o mesmo resultado.

**Acceptance Scenarios**:

1. **Given** a rede desligada, **When** o app calcula, **Then** os números são os mesmos de com a rede ligada.
2. **Given** a leitura de `_vars`, **When** o app percorre a memória, **Then** só as chaves da lista fechada são guardadas, e nenhuma outra é guardada nem registrada, mesmo que exista um token de login por perto.

---

### User Story 3 - Honestidade quando não dá (Priority: P3)

Se um cálculo falha, ou um patch do jogo quebra o motor, a aba diz "unavailable". Nunca inventa um número, e o jogo nunca é afetado.

**Why this priority**: o jogo muda com frequência, e um número errado é pior que nenhum.

**Independent Test**: com um código de jogo inventado que não inicializa, a aba mostra "Calculator unavailable" e o resto do app segue.

**Acceptance Scenarios**:

1. **Given** um patch em que o motor não inicializa, **When** o app tenta calcular, **Then** a aba mostra "Calculator unavailable" e o resto do app segue funcionando.
2. **Given** um número que falha sozinho, **When** o app calcula, **Then** só ele mostra "unavailable".
3. **Given** o cálculo travado ou caído, **When** o jogador continua jogando, **Then** o jogo não é afetado.

---

### User Story 4 - Conferir usando (Priority: P4)

Uma aba simples mostra os números calculados, para comparar com o jogo.

**Why this priority**: é como o Vinicius confere os números; a aba definitiva será decidida em outra feature.

**Independent Test**: com números de exemplo, a aba mostra as 10 linhas, sem nenhum campo para preencher.

**Acceptance Scenarios**:

1. **Given** um cálculo pronto, **When** o jogador abre a aba "Stats", **Then** ela mostra os 10 números do personagem ativo.
2. **Given** um personagem de outra classe, **When** o jogador abre a aba, **Then** ela mostra os números normalmente, sem aviso (decisão do Vinicius).

---

### Edge Cases

- **Alvo AFK fora da tabela de monstros**: o Damage precisa dele; sem ele, o Damage mostra "unavailable".
- **Seleção de personagem ou nenhum personagem**: não há leitura nova, e a aba não mostra números do personagem anterior.
- **Leitura solta ("Let the game close") ou desligada pelo vigia de update**: não há leitura nova, e a aba não mostra números do personagem anterior.
- **Sub-casos que dependem de atores em cena**: 7,1% dos sub-casos falham offline; o número afetado mostra "unavailable" em vez de um valor incerto.
- **Campos que a inicialização do cálculo reescreve** (como `AFKtarget`): valem os do retrato (FR-012).

## Requirements *(mandatory)*

### Functional Requirements

**Retrato**

- **FR-001**: O app MUST manter o estado atualizado enquanto o jogo roda, em leitura contínua por fatias de até 25 KB, com alvo de idade de até 1 s para tela e personagem, 5 s para os campos dos 10 números e 20 s para o estado inteiro, a confirmar por medição (decisão do Vinicius, 09/11).
- **FR-002**: Cada fatia MUST ser uma leitura curta e sem estado, uma por vez, com a lista de chaves e o cursor fora do jogo, e MUST NOT deixar nada residente na página do jogo.
- **FR-003**: O retrato MUST percorrer só propriedades de dados: MUST NOT acionar getter nem usar `JSON.stringify` em objeto do jogo. Objeto `String` vira texto.
- **FR-004**: O retrato MUST deixar de fora as tabelas grandes que o cálculo já tem: `CustomLists`, `ItemDefinitionsGET`, `MonsterDefinitionsGET`, `DialogueDefGET`, `PixelHelperActor` e `CustomMaps`.
- **FR-005**: O app MUST ler do jogo ao vivo os bônus de companions (`DNSM.CompanionBon`) e o cache de shiny (`DNSM.ShinyBonusS`).
- **FR-006**: O app MUST ler `_vars` da memória sem chamar a função que os contém, a cada ciclo da rotação, só as chaves de uma lista fechada, com limite de objetos inspecionados.
- **FR-007**: Nada fora da lista fechada MUST ser guardado ou registrado. O retrato MUST ficar só na memória: MUST NOT ir para o disco nem para o `keeper.log`.

**Cálculo**

- **FR-008**: O código do jogo instalado MUST rodar só num módulo novo, em processo isolado, sem nenhum objeto de rede e sem as APIs do app (decisão do Vinicius, com ADR).
- **FR-009**: A regra da 003 ("lido só como texto, nunca executado") MUST continuar valendo para os arquivos dela.
- **FR-010**: O cálculo MUST rodar no processo do app e MUST NOT rodar no guardião: o guardião caindo fecha o jogo.
- **FR-011**: O estado MUST ser restaurado antes de cada cálculo, e os blocos que gravam ou salvam (`CloudSAVE`, `SaveGamee`) MUST NOT ser chamados.
- **FR-012**: Depois da inicialização do cálculo, os valores simples do retrato e os bônus do FR-005 MUST ser reaplicados.
- **FR-013**: Os arquivos do jogo (`N.js`, `default.pak`) MUST vir da instalação de cada máquina e MUST NOT entrar no repositório nem no instalador.

**Quando não dá**

- **FR-014**: Se o cálculo não inicializar, a aba MUST mostrar "Calculator unavailable" e o resto do app MUST seguir funcionando.
- **FR-015**: Um número que não puder ser calculado MUST mostrar "unavailable", sem valor inventado.
- **FR-016**: Uma falha ou travamento do cálculo MUST NOT afetar o jogo.

**Aba**

- **FR-017**: A janela MUST ter uma aba simples "Stats" ao lado do painel atual, com Drop Rate, Damage, HP, MP, STR, AGI, WIS, LUK, Accuracy e AFK Gains do personagem ativo (decisão do Vinicius: "nao deixe nada complexo, vou aprimorar isso depois").
- **FR-018**: Os números MUST seguir o arredondamento com que o jogo os exibe.
- **FR-019**: Com personagem de outra classe, a aba MUST mostrar os números normalmente, sem aviso (decisão do Vinicius).
- **FR-020**: A aba MUST NOT ter campo para o jogador preencher.
- **FR-024**: Antes do primeiro cálculo, a aba MUST mostrar "Calculating"; depois, os números MUST se atualizar no lugar, sem voltar a esse texto.

**Coerência e conferência**

- **FR-022**: Chaves que dependem entre si MUST vir na mesma fatia, e a troca de personagem ou de mapa MUST descartar o ciclo parcial.
- **FR-023**: Quando disponível, STR, AGI, WIS e LUK MUST ser comparados à lista `StatList` que o próprio jogo grava, e uma divergência MUST mostrar "unavailable".

**Testes**

- **FR-021**: Os testes MUST rodar sem jogo aberto e cobrir: só-leitura do retrato com um motor falso; `_vars` sem vazar um token falso; e um retrato reconstruído dando o mesmo cálculo. Sem nomes de jogadores e sem trecho do arquivo do jogo.

### Key Entities

- **Retrato**: cópia em memória do estado da conta, montada em mosaico de grupos de chaves, cada um coerente e com sua idade, com os bônus e os `_vars` da lista fechada.
- **Cálculo**: execução isolada do código do jogo sobre um retrato, que resulta nos números.
- **Número**: valor exibido na aba, ou "unavailable".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Com o personagem Royal Guardian, os 10 números batem com o Player Info, com o arredondamento do jogo.
- **SC-002**: Com a leitura ligada, o jogo não perde mais quadros que na linha de base sem leitura, em p95 e p99 na pior tela.
- **SC-003**: Com a rede desligada, o resultado é igual.
- **SC-004**: Nenhuma função do jogo em execução é chamada, e nada é gravado no save: o teste de só-leitura continua passando com o retrato.
- **SC-005**: Um token falso colocado perto dos `_vars` não aparece em nenhum retrato nem em nenhum log.
- **SC-006**: Com o cálculo falhando, o jogo e o resto do app seguem funcionando, e a aba diz "Calculator unavailable" ou "unavailable".

## Assumptions

- A prova existe para um só personagem (Royal Guardian): o Vinicius não consegue abrir outras classes até terça-feira, e comparar outras classes não é critério para fechar esta feature.
- Retrato inteiro medido em 917 KB, 9–21 ms dentro do jogo e 62–159 ms de ida e volta. O protótipo mediu 0,6 ms de função típica e 1,65 ms no p95 por fatia de 25 KB, sem piora visível de quadros, e o retrato em fatias deu os mesmos números que o inteiro, com a personagem parada (`prototipo/README.md`). O jogo roda Electron 11.5 (Chromium 87). `_vars`: 27 chaves, em 25 objetos inspecionados. `DNSM.CompanionBon`: 94 bônus.
- O retrato não copia os `_GenINFO` dos comportamentos, que o cálculo reconstrói: sub-casos que dependem deles podem divergir.
- Custo de memória e tempo de inicialização do cálculo dentro do app não foram medidos.
- A posição da Lava sobre leitura de memória é desconhecida e pesa antes de distribuir.
- A arquitetura guardião + elo + app continua. O guardião tira o retrato e o manda pelo elo.

### Dependências

- **Emenda da constituição antes do código** (decisão do Vinicius): "nunca chamar função do jogo" vale para o jogo em execução; a cópia offline, em processo isolado, é permitida. Em branch e PR próprios.
- **ADR** registrando a exceção à regra de "nunca executar o arquivo do jogo".

### Deixado para quem construir (plano)

- Como o processo isolado recebe o `N.js` e o `default.pak` do jogo instalado.
- Como o `N.js` fica sem caminho até a rede, já que o isolamento de código não é, sozinho, barreira de segurança.
- O formato de cada número na aba.

## Out of Scope *(mandatory)*

- Árvore de fórmula, what-if, cartões por sistema, dashboard, histórico e login de backup.
- Comparar outras classes.
- A aba definitiva dos números, que será decidida em outra feature.
- Anti-objetivos (nunca): chamar função do jogo em execução; gravar no save; automatizar cliques; `N.js` ou `default.pak` no repositório ou no instalador; guardar ou registrar qualquer coisa fora da lista fechada de `_vars`; acesso à rede fora do atualizador do app.

## Open Questions *(mandatory)*

| Question | State | Answer |
| --- | --- | --- |
| Executar o `N.js` é permitido? | resolved | Vinicius, 09/11: só no módulo isolado novo, com ADR (FR-008, FR-009). |
| "Nunca chamar função do jogo" cobre a cópia offline? | resolved | Vinicius, 09/11: emenda de uma linha antes do código (Dependências). |
| Quando tirar o retrato? | resolved | Vinicius, 09/11: leitura contínua em fatias, depois da pesquisa sobre o custo no jogo (FR-001, relatório "Leitura do jogo sem travar"). |
| Quais números a aba mostra? | resolved | Vinicius, 09/11: os 10 já provados, numa aba simples (FR-017). |
| Comparar outras classes antes de fechar? | resolved | Vinicius, 09/11: só o Royal Guardian por enquanto (Assumptions). |
| Com outra classe, o que a aba mostra? | resolved | Vinicius, 09/11: os números normalmente, sem aviso (FR-019). |
| Retrato roda com a aba "Stats" fechada? | resolved | Vinicius, 09/11: roda sempre. |
| O que a aba mostra antes do primeiro cálculo e enquanto calcula? | resolved | Vinicius, 09/11: "Calculating" só antes do primeiro cálculo (FR-024). |
| Quando os `_vars` são relidos: a cada retrato ou uma vez por sessão do jogo? | resolved | Vinicius, 09/11: na rotação, a cada ciclo (FR-006). |
| Qual o tempo máximo de um cálculo antes de virar "unavailable"? | to plan | Vinicius, 09/11: o plano mede e escolhe. |
| Como o `N.js` fica sem caminho até a rede, e como o processo isolado recebe os arquivos do jogo? (security CHK009) | to plan | Vinicius, 09/11, no desenho: o plano responde no `research.md`. |
| Qual o formato de cada número na aba? (ux CHK004) | to plan | Vinicius, 09/11, no desenho: o plano responde. |
| Qual o tamanho e a forma de cada leitura? | resolved | Vinicius, 09/11, depois do protótipo: fatias de até 25 KB, uma por vez, nada residente no jogo (FR-001, FR-002). |
| Quão atual fica cada dado? | resolved | Padrão do agente: 1 s para tela e personagem, 5 s para os campos dos 10 números, 20 s para o estado inteiro, a confirmar por medição (FR-001). Confirmado pelo Vinicius, 09/11. |
| Os números têm conferência? | resolved | Padrão do agente: STR, AGI, WIS e LUK comparados à `StatList`; divergência vira "unavailable" (FR-023). Confirmado pelo Vinicius, 09/11. |
| O que fazer na troca de personagem ou de mapa? | resolved | Padrão do agente: descartar a leitura parcial (FR-022). Confirmado pelo Vinicius, 09/11. |
| O que acontece com alvo AFK fora da tabela de monstros? | resolved | Padrão do agente: o Damage mostra "unavailable" (Edge Cases). Confirmado pelo Vinicius, 09/11. |
| O que a aba mostra sem leitura nova? (ux CHK007) | resolved | Padrão do agente: não mostra números do personagem anterior (Edge Cases). Confirmado pelo Vinicius, 09/11. |
