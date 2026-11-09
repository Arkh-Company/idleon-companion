# Quickstart: conferir a base de dados

## Antes de tudo

A emenda da constituição precisa estar na `main`.

## Sem o jogo

Comandos na raiz do repositório.

| Comando | O que prova |
| --- | --- |
| `just test-one src/keeper/state-reader.test.ts` | Rotação, sentinela, uma leitura por vez |
| `just test-one src/keeper/read-only.test.ts` | A leitura do estado não chama função do jogo nem aciona getter (SC-004) |
| `just test-one src/keeper/vars-reader.test.ts` | Token falso perto dos `_vars` não sai (SC-005) |
| `just test-one src/main/state-store.test.ts` | Mosaico, troca de personagem |
| `just test-one src/calculator` | Código de jogo inventado: resultado, falha e nenhuma rede (FR-008) |
| `just test-one src/renderer/StatsPanel.test.tsx` | Textos fixos e nenhuma caixa de texto |
| `just check` | O critério de pronto |

## Com o jogo (roteiro do Vinicius, depois da implementação)

Antes: a opção de inicialização da Steam aponta para o companion. Só o Vinicius mexe nela.

1. Abrir o jogo pela Steam, entrar com a Markhe, abrir a aba `Stats`: `Calculating`, depois os números.
2. Comparar os 10 números com o Player Info (SC-001).
3. Jogar alguns minutos em combate: os números acompanham, sem travada perceptível (SC-002).
4. Trocar de personagem: os números do anterior somem, e o novo aparece.
5. Com a rede desligada, o resultado é o mesmo (SC-003).
6. Em `%APPDATA%\IdleOn Companion\keeper.log`, nenhum valor de estado nem `_vars`.
