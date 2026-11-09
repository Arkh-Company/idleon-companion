# Feature Specification: Catálogo de leitura (reading-catalog)

**Feature Branch**: `spec/005-reading-catalog`

**Created**: 2026-11-09

**Status**: Draft

**Input**: desenho aprovado pelo Vinicius em 09/11/2026, depois de testar a versão 0.5.0 e ler o log de diagnóstico de uma troca de item.

## Por que esta feature

A aba Stats funciona, mas o Drop Rate demora a acompanhar o jogo depois de tirar e colocar um item. O log mediu volta rápida de 5,0 s, volta inteira de 19,1 s, cálculo de 1,3 s, e de 2,9 a 5,8 s entre o equipamento lido e o número mudar: o equipamento chega numa fatia e os valores que o jogo recalcula chegam em outras.

A causa de fundo é que a leitura não sabe o que importa. A lista atual veio de uma análise do código que superestima o que as fórmulas usam e, ao mesmo tempo, deixou de fora quase todo o `DNSM`, o cache que mais pesa nos números.

**Regra central: a leitura rápida só traz o que muda status ou bônus mostrados na ferramenta.** Conforme a ferramenta cresce, entram as leituras de cada feature, consultando um catálogo do que o estado do jogo oferece.

## Clarifications

### Session 2026-11-09

- Q: Em quanto tempo, no máximo, o Drop Rate precisa mudar na aba depois de tirar ou colocar um item? → A: Até 1 s.
- Q: O que separa as leituras? → A: Só duas, rápida e lenta; a lenta é para o que só muda com patch ou muito devagar dentro do jogo.
- Q: O que conta como impacto provado ao alterar uma peça? → A: Qualquer diferença no valor bruto de um número mostrado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver o número acompanhar o jogo (Priority: P1)

O jogador tira ou coloca um item e, em até 1 s, o Drop Rate muda na aba, num passo só, sem passar por um valor intermediário.

**Why this priority**: é a queixa que originou a feature e o valor que o jogador percebe.

**Independent Test**: com o jogo aberto, tirar e colocar um item várias vezes e medir, no log de diagnóstico, o tempo até o número mudar e quantas mudanças ele teve.

**Acceptance Scenarios**:

1. **Given** um personagem com os números na tela, **When** o jogador tira um item que dá Drop Rate, **Then** o número muda em até 1 s.
2. **Given** a mesma situação, **When** o jogador coloca o item de volta, **Then** o número volta ao valor anterior em até 1 s.
3. **Given** uma troca de item, **When** o número muda, **Then** ele vai direto ao valor final, sem valor intermediário.
4. **Given** a leitura nova ligada, **When** se comparam os quadros do jogo com a linha de base, **Then** ela não perde mais quadros.

---

### User Story 2 - Consultar o catálogo (Priority: P2)

Quem planeja uma feature abre uma tabela no repositório e vê, para cada peça do estado do jogo, o que ela é, que números afeta, quando muda, a que mecânica pertence, que feature a usa e em que leitura fica.

**Why this priority**: é o que permite decidir leituras com evidência, em vez de suposição.

**Independent Test**: escolher peças ao acaso no estado do jogo e achar cada uma no catálogo, com todas as colunas preenchidas.

**Acceptance Scenarios**:

1. **Given** o catálogo, **When** se procura qualquer peça do inventário, **Then** ela está lá com natureza, impacto, momento de mudança, mecânica e leitura.
2. **Given** o catálogo no repositório, **When** ele é revisado, **Then** não há valor da conta, nome de jogador nem trecho do código do jogo.

---

### User Story 3 - Adicionar uma feature (Priority: P3)

Uma feature nova declara os números que mostra, o catálogo diz quais peças eles usam, e só essas sobem de leitura.

**Why this priority**: mantém a leitura rápida pequena conforme a ferramenta cresce.

**Independent Test**: acrescentar um número inventado a uma feature de teste e ver a verificação exigir que as peças dele estejam nas leituras certas.

**Acceptance Scenarios**:

1. **Given** um número novo declarado, **When** as peças dele têm impacto provado e mudam jogando, **Then** elas passam à leitura rápida.
2. **Given** o catálogo e as listas de leitura, **When** os dois divergem, **Then** a verificação do projeto falha.

---

### User Story 4 - Patch do jogo (Priority: P4)

Depois de um patch, o inventário roda de novo e aponta o que é novo ou mudou de nome. O que for desconhecido continua sendo lido, na leitura lenta.

**Why this priority**: o jogo muda com frequência, e o app não pode quebrar nem perder dados por isso.

**Independent Test**: comparar um inventário com um estado de exemplo que tenha uma peça a mais e uma renomeada, e ver as duas apontadas.

**Acceptance Scenarios**:

1. **Given** uma peça que o catálogo não conhece, **When** o app lê o estado, **Then** ela vai para a leitura lenta, sem erro.
2. **Given** um novo inventário, **When** ele é comparado ao catálogo, **Then** as peças novas e as que sumiram aparecem listadas.

---

### Edge Cases

- **Entrar num personagem**: a primeira volta lê tudo, antes de mostrar qualquer número.
- **Peça que só importa numa situação ausente dos retratos**: aparece sem impacto e vai para a leitura lenta, onde continua sendo lida, só com atraso.
- **Rascunho do jogo que muda o tempo todo**: mudar muito não torna a peça importante; sem impacto provado, fica na lenta.
- **Peça maior que o teto de uma leitura**: vai sozinha, como hoje.
- **Grupo de conteúdo maior que o teto**: é dividido em leituras seguidas.
- **Troca de personagem ou de mapa**: continuam valendo as regras da 004 para descartar o ciclo parcial.

## Requirements *(mandatory)*

### Functional Requirements

**Catálogo**

- **FR-001**: O projeto MUST ter um catálogo, em tabela no repositório, com uma linha por peça do estado: chaves de topo, entradas do `DNSM`, subchaves do personagem e `_vars`.
- **FR-002**: Cada linha MUST trazer nome, tipo, tamanho, natureza, números afetados, ações em que muda, mecânica, feature que a usa e leitura.
- **FR-003**: A natureza MUST ser uma destas: dado de origem, cache derivado, tabela fixa, rascunho ou interface.
- **FR-004**: O catálogo MUST NOT conter valor da conta, nome de jogador nem trecho do código do jogo.

**Análise**

- **FR-005**: O inventário MUST listar todas as peças de um estado real, com nome, tipo e tamanho. Dos `_vars`, MUST listar só as chaves da lista fechada da 004.
- **FR-006**: A natureza MUST sair de quem escreve e quem lê a peça no código do jogo instalado, lido só como texto, na máquina do Vinicius, fora do repositório.
- **FR-007**: O impacto MUST ser medido alterando os valores de uma peça por vez sobre um estado real e recalculando; a remoção só MUST ser usada quando não der para alterar. Qualquer diferença no valor bruto de um número mostrado MUST contar como impacto provado.
- **FR-008**: O impacto MUST ser medido sobre 2 estados: personagem parado e depois de trocar equipamento.
- **FR-009**: As ações em que cada peça muda MUST vir de um roteiro jogado pelo Vinicius: trocar item, obol, talento, buff, trocar de mapa e matar. O log desse roteiro MUST trazer só nomes de peças, horários e o texto dos números mostrados, sem valor do estado nem nome de personagem.
- **FR-010**: A mecânica MUST sair do nome das rotinas que usam a peça, com conferência do Vinicius nos casos duvidosos.
- **FR-011**: Nenhuma etapa da análise, além do roteiro jogado, MUST tocar no jogo em execução.

**Regra de decisão**

- **FR-012**: Uma peça MUST ficar na leitura rápida quando tiver impacto provado num número mostrado e mudar com ações do dia a dia do jogador (trocar item, obol ou talento, buff, trocar de mapa).
- **FR-013**: Só existem duas leituras: rápida e lenta (decisão do Vinicius). A lenta MUST ser para o que só muda com patch ou muito devagar dentro do jogo.
- **FR-014**: Toda peça que não atender FR-012 MUST ficar na leitura lenta, inclusive rascunhos, tabelas fixas e peças desconhecidas.
- **FR-015**: Nenhuma peça MUST deixar de ser lida.

**Features**

- **FR-016**: Cada feature MUST declarar os números que mostra; a Stats declara os 10 números atuais.
- **FR-017**: A lista de cada leitura MUST sair do catálogo, e a verificação do projeto MUST falhar se os dois divergirem.

**Leitura**

- **FR-018**: As fatias MUST ser agrupadas por conteúdo, para o que muda junto vir junto, como o equipamento e os caches do `DNSM`.
- **FR-019**: O tamanho de 25 KB MUST valer só como teto de cada leitura.
- **FR-020**: O custo no jogo MUST seguir o medido: até 4 leituras por segundo, nunca duas em voo, só propriedades, nada residente na página.
- **FR-021**: A primeira volta ao entrar num personagem MUST ler tudo antes de mostrar número.
- **FR-022**: O inventário MUST poder rodar de novo depois de um patch e apontar o que é novo e o que sumiu.

### Key Entities

- **Peça**: uma unidade do estado do jogo que a leitura traz, com nome, tipo e tamanho.
- **Catálogo**: a tabela de todas as peças, com o que se sabe de cada uma.
- **Leitura**: rápida ou lenta, cada uma com sua frequência.
- **Fatia**: um grupo de peças lido de uma vez, definido pelo conteúdo e limitado pelo teto.
- **Número mostrado**: um valor que uma feature exibe e declara.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tirar e colocar um item reflete no Drop Rate em até 1 s, num passo só, em todas as trocas de um roteiro de pelo menos 10 trocas.
- **SC-002**: Com a leitura nova, o jogo não perde mais quadros que na linha de base, em p95 e p99.
- **SC-003**: O catálogo cobre 100% das peças do inventário.
- **SC-004**: Toda peça da leitura rápida tem impacto provado num número mostrado.
- **SC-005**: Sobre o mesmo estado, os 10 números da aba saem iguais aos de um cálculo completo do zero, inclusive depois de trocas de item e de mapa.
- **SC-006**: A verificação falha quando uma lista de leitura diverge do catálogo.

## Assumptions

- A análise usa a mesma cópia local do jogo e os estados reais já usados na 004, fora do repositório.
- Só a Markhe (Royal Guardian) está disponível para os testes.
- Medidas do log: `DNSM` tem 300 entradas e 74 KB; 75 mudaram no teste (14,6 KB) e 223 não mudaram (21,9 KB).
- `ItemzzSellPricesz` (10,2 KB) é a tabela de preços de venda, criada uma vez a partir de uma tabela do jogo. `CalcTalentDL1` (27,3 KB) é um rascunho reescrito em 7 pontos antes de ser percorrido. Sem as duas, os 11 valores saíram iguais; as 18 leituras em `TalentCalc` não foram todas acompanhadas.
- Sem as demais entradas do `DNSM`, o Drop Rate cai para menos de 1% do valor certo.
- `DNSM.TotStatMAP` tem STR, AGI e WIS finais, e `DNSM.AFKgainzzDNz` tem o AFK Gains final, idênticos aos calculados. O Drop Rate não está em cache.
- Fatia de 25 KB custa 0,60 ms (p50) e 1,65 ms (p95) na linha do jogo; 50 KB piorou o p95 do quadro em 6 de 6 rodadas.
- O estado tem cerca de 930 KB em 558 peças; os 10 outros personagens somam 462 KB.
- Ponto de partida para as fatias, a confirmar pelo catálogo: equipamento e caches do `DNSM` juntos; personagem em uso (inventário, buffs, prayers, mapa, HP, MP, experiência); uma fatia por sistema (Cards, stamps, alquimia, cozinha); e a lenta (outros personagens e o resto).
- Sem registrar os campos que o cálculo lê (decisão do Vinicius), uma peça que só importa numa situação ausente dos estados usados aparece sem impacto.
- Comida não é ação do jogador nesta análise: o prato fica no menu para sempre e o bônus só muda se outro bônus mexer no valor (Vinicius, 09/11). A coleta de AFK não foi jogada no roteiro: exige trocar de personagem.

### Dependências

- A spec 004 está congelada; esta feature troca a decisão de como a leitura é ordenada (research R1 e R2, FR-001 da 004).
- O fix `fix/stats-latency`, guardado sem PR, não é pré-requisito.

### Deixado para quem construir (plano)

- O formato do catálogo e como ele é gerado.
- O número exato de fatias e a frequência de cada leitura dentro das 4 por segundo.
- As etapas de análise cabem no protótipo da feature, antes do plano.
- Como o cálculo cabe no alvo de 1 s. Medido: os 11 números levam 18 ms; o restante do tempo vai em carregar o jogo (540 ms), nos ajudantes (1.905 ms) e em restaurar o estado (cerca de 100 ms por número). O protótipo prova se dá para manter o cálculo pronto e aplicar só o que mudou, com os mesmos números (SC-005).

## Out of Scope *(mandatory)*

- A aba definitiva dos números.
- Comparar outras classes.
- Qualquer leitura nova do jogo além do que já é lido.
- Registrar os campos lidos pelo cálculo (decisão do Vinicius).
- Anti-objetivos (nunca): chamar função do jogo em execução; gravar no save; automatizar cliques; deixar código residente na página; arquivos do jogo no repositório; valor de conta ou nome de jogador no catálogo; peça sem leitura nenhuma; acesso à rede fora do atualizador do app.

## Open Questions *(mandatory)*

| Question | State | Answer |
| --- | --- | --- |
| Qual é o tempo-alvo para o Drop Rate refletir uma troca de item? | resolved | Vinicius, 09/11: até 1 s (SC-001). |
| O que separa as leituras rápida e lenta? | resolved | Vinicius, 09/11: só duas leituras; a lenta é para o que muda com patch ou muito devagar (FR-012 a FR-014). |
| Qual alteração de valor conta como impacto provado num número? | resolved | Vinicius, 09/11: qualquer diferença no valor bruto (FR-007). |
| Quantas trocas o roteiro de aceitação precisa ter? (SC-001) | resolved | Padrão do agente: pelo menos 10 trocas de item. |
| O log do roteiro tem limite de conteúdo? (security CHK009) | resolved | Padrão do agente: só nomes de peças, horários e o texto dos números mostrados (FR-009). |
| O inventário de `_vars` respeita a lista fechada? (security CHK005) | resolved | Padrão do agente: sim, só as chaves da lista fechada da 004 (FR-005). |
| Executar a cópia do jogo para a análise é permitido? | resolved | Sim: a constituição 1.2.0 permite a cópia offline, em processo isolado e sem rede. |
| Registrar os campos lidos pelo cálculo? | resolved | Vinicius, 09/11: não. |
| Medir o impacto removendo ou alterando a peça? | resolved | Desenho aprovado pelo Vinicius, 09/11: alterando valores; remoção só quando não der. |
| Peça desconhecida depois de um patch? | resolved | Vinicius, 09/11: cai na leitura lenta, sem quebrar (FR-014). |
| Das 65 peças com impacto que não mudaram no roteiro (grupo C de `prototipo/revisar.md`), quais mudam com ação do dia a dia e sobem para a rápida? | open | |
