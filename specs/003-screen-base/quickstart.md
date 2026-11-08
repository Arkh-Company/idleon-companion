# Quickstart: conferir a base de telas

## Sem o jogo

Comandos na raiz do repositório.

| Comando | O que prova |
| --- | --- |
| `just test-one src/shared/screens` | Estados capturados dão o nome esperado (SC-001); toda regra tem prova, e os 108 números estão cobertos (SC-002); aba velha nunca aparece (SC-003) |
| `just test-one src/keeper/read-only.test.ts` | O leitor com os campos novos não chama função do jogo (SC-005) |
| `just test-one src/keeper/game-tables.test.ts` | Tabelas de um código inventado; formato novo vira `null` |
| `just test-one src/renderer/ui.test.tsx` | Nenhuma caixa de texto na janela (SC-004); painel com tela e aba |
| `just check` | O critério de pronto |

## Com o jogo (roteiro do Vinicius, depois da implementação)

Antes: a opção de inicialização da Steam volta a apontar para o companion, e não para `lab\sessao.cjs`. Só o Vinicius mexe
nela.

1. Abrir o jogo pela Steam. Na seleção de personagem, o painel mostra `Character select`.
2. Entrar com um personagem. Sem janela aberta, Screen mostra `None`, e Map mostra o nome do mapa.
3. Abrir Sailing: `Sailing` em até cerca de 1 s (SC-006). Trocar a aba: o painel acompanha.
4. Abrir a janela 64: `Orion`, não `The Hole`.
5. Abrir Breeding e passar pelas 4 abas. Fechar e abrir outra janela: a aba da anterior não aparece (SC-003).
6. Codex › Cards › Sets.
7. Entrar numa caverna do The Hole e fechar a janela: o nome da caverna continua.
8. Voltar do AFK: `AFK Gains`.
9. Procurar na janela qualquer campo de digitar: nenhum (SC-004).
10. Em `%APPDATA%\IdleOn Companion\`: `names.json`, `.bak` e `.bad` não existem.
11. Em `keeper.log`: nenhuma linha `unknown-screen-numbers` neste patch, e nenhuma `game-tables-unreadable`.
