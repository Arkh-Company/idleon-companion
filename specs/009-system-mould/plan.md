# Implementation Plan: Molde por sistema nas árvores de fórmula

**Branch**: `spec/009-system-mould` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-system-mould/spec.md`

## Summary

O primeiro nível de toda árvore deixa de ser a cadeia de passos do jogo e passa a ser os **pools do próprio jogo**, na ordem da conta. Um "Additive pool" soma os bônus antes; um "Multi pool" multiplica tudo. Dentro de cada pool, as fontes ficam agrupadas **por sistema**, com emoji e na ordem da V1. Os passos de conta sem nome são achatados em qualquer nível, e a conta inteira vai para o ⓘ da linha de cima. No Drop Rate, os pools e os grupos saem iguais à V1 da bancada.

A janela muda em três pontos:
- o resumo de duas linhas acima da árvore sai;
- a fatia passa a ficar num botão;
- um botão "Changes" mostra setas ao vivo, contra o momento em que foi ligado ou contra uma marca. Ele substitui o "was", a linha que acende e o "mark" escrito;
- a árvore aberta mostra os valores em tempo real, e a faixa "Game changed · Refresh" sai.

Tudo é montado no worker de árvores, depois da montagem da 008 (research R1–R3). A janela só desenha e refaz o valor dos grupos para as setas (R5).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 24 nos workers, Electron e React 19 na janela (o mesmo da 008)

**Primary Dependencies**: as da 008; nenhuma nova

**Storage**: `settings.json` do app ganha `changes` e `share`, dois booleanos (contracts/ipc.md). Marcas, pins e formas não mudam de forma

**Testing**: vitest, com o jogo inventado da 008 (`fake-game.js`, `fake-mosaic.ts`, `tree-fixture.ts`); `just parity` para a V1 (fora da CI); a sonda das 716 árvores fora do repositório

**Target Platform**: Windows 10/11, app Electron empacotado (NSIS)

**Project Type**: desktop-app

**Performance Goals**: o molde não chama o jogo; ele é linear sobre as linhas já montadas. O tempo de abrir uma árvore fica no da 008, medido na sonda (research R9)

**Constraints**:
- só leitura do jogo, sem rede para o jogo;
- nada do código do jogo no Git (texto do jogo pode);
- nenhum nome de personagem fora da tela;
- cada nível soma ou multiplica até o pai;
- as chaves de peça continuam as da 008.

**Scale/Scope**: as 716 árvores do catálogo. O Drop Rate tem cerca de 3.000 linhas abertas. A tabela de sistemas cobre os blocos das fontes de primeiro nível das 716 árvores.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende |
| --- | --- |
| Missão e não-objetivos | Só reorganiza a árvore já gravada. Não chama função do jogo, não usa rede e não grava no save |
| TDD e `just check` | Cada passada nova (pools, sistemas, achatamento) e cada botão nasce de um teste que falha; `just check` fecha cada fase |
| Nada especulativo | Três campos novos no nó (`role`, `combine`, `poolKind`), todos pedidos pela spec; nenhuma opção a mais |
| Arquitetura | Nenhuma fronteira nova entre módulos. O molde fica no worker de árvores, e a janela só desenha. `ARCHITECTURE.md` ganha uma frase sobre os pools e o botão "Changes" |
| Código | Arquivos com menos de 400 linhas. `mould.ts` é reescrito e a regra de sistemas fica em arquivo próprio; nomes em inglês |
| Segurança | Os papéis e campos novos passam pela conferência do main (`tree-check.ts`). O canal novo (`view:*`) aceita só dois booleanos |
| Specs | A 008 está congelada. A mudança na FR-006 dela é a FR-001 desta spec, sem editar a 008 |

Resultado: passa. Re-checado depois da Fase 1: passa, sem violação a justificar.

## Project Structure

### Documentation (this feature)

```text
specs/009-system-mould/
├── plan.md              # este arquivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   ├── tree-node.md     # o nó com pools e grupos (muda o treeResult da 008)
│   └── ipc.md           # view:get / view:set
├── checklists/
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── calculator/tree/
│   ├── mould.ts          # reescrito: o primeiro nível vira os pools do jogo (R1)
│   ├── pools.ts          # novo: lê a conta da raiz e separa Additive e Multi pools
│   ├── systems.ts        # novo: a tabela bloco → sistema com prova, a ordem da V1 (R2); usa tags.ts
│   ├── flatten.ts        # novo: achata a linha de conta sem nome, com o ⓘ que fecha (R3)
│   └── places.ts         # chama o achatamento nos níveis
├── calculator/
│   └── parity-v1.integration.test.ts   # novo: Drop Rate = V1 (R4), em just parity
├── shared/
│   └── formula-tree.ts   # NODE_ROLES ganha pool e system; campos combine e poolKind
├── main/
│   ├── tree-check.ts     # aceita os papéis e campos novos; pool/system sem peça
│   ├── payloads.ts       # view:get / view:set
│   └── settings.ts       # changes e share
└── renderer/
    ├── SidePanel.tsx     # tira o AnswerHeader (R7)
    ├── FormulaTree.tsx   # linhas de pool e sistema; fatia no botão; setas
    ├── ViewToggles.tsx   # novo: botões "Changes" (com a base) e fatia
    └── tree-changes.ts   # novo: base, valores dos grupos refeitos (combine) e a seta
```

**Structure Decision**: o mesmo app da 008. O molde é uma passada a mais na montagem do worker de árvores, e as preferências de vista ficam na janela com o `settings.json`. Não há pacote nem processo novo.

## Fases (as mesmas de tasks.md)

1. **Foundational**: o nó com pools e sistemas, a conferência do main e a tabela de sistemas (FR-003, FR-011, SEC-003).
2. **US2, toda árvore agrupada por sistema**: pools do jogo e grupos por sistema em toda árvore (FR-001 a FR-006, FR-008, FR-012). Vem antes da US1, porque a US1 especializa a regra geral.
3. **US1, de onde vem o meu Drop Rate**: os pools da V1 e a paridade com a bancada (FR-005, FR-010).
4. **US3, nenhum degrau sem nome**: o achatamento em todo nível (FR-007).
5. **A vista da árvore**: sem o resumo, a fatia num botão, o Changes com setas, a árvore ao vivo sem Refresh e as preferências (FR-001, FR-013 a FR-015, NFR-002 a NFR-004, SEC-005, SEC-006).
6. **Polish**: `ARCHITECTURE.md`, a tabela de sistemas completa pela sonda e as tarefas `[sessão]` com o jogo real (SC-001 a SC-004, NFR-001).

## Complexity Tracking

Sem violação da constituição.

## Diagramas

![Arquitetura antes](diagramas/arquitetura-antes.svg)

![Arquitetura depois](diagramas/arquitetura-depois.svg)

![Sequência](diagramas/sequencia.svg)

HTML interativo: `just diagramas`, depois abra `diagramas/local/`
