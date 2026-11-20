# Catálogo de números

Todos os números do jogo que o app pode mostrar, mundo por mundo, com a decisão de cada um. É a base do projeto recomeçado do zero: a lista do que ganha árvore de fórmula e o que fica guardado para outras telas.

O Vinicius validou as marcas do W1 ao W7, do Personagem e da Conta em 20/11/2026, número por número.

## Arquivos

- [numeros.json](numeros.json): os 1.289 números.
- [regras.md](regras.md): as regras que decidem o que entra, com as exceções.
- [painel-de-farm.md](painel-de-farm.md): os ganhos por tempo, para a feature futura do painel de farm.

## Campos de cada número

| Campo                                | O que é                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `id`                                 | Identificador estável do número                                                 |
| `nome`                               | Nome em inglês, pelo texto do jogo                                              |
| `mundo`                              | W1 a W7, Personagem ou Conta                                                    |
| `sistema`                            | Sistema do jogo onde o número mora                                              |
| `caixa`                              | Caixa de organização, a mesma das páginas de inventário                         |
| `tipo`                               | O que o número é (lista abaixo)                                                 |
| `tipo_folha`                         | O papel do número dentro de uma conta, quando ele é folha; vazio quando é galho |
| `destino`                            | Para que o número serve (lista abaixo)                                          |
| `marca`                              | `sim` (entra no catálogo de árvores), `nao` ou vazio                            |
| `regra`                              | Número da regra que decidiu a marca, em [regras.md](regras.md)                  |
| `motivo`                             | Por que o número tem essa marca                                                 |
| `tela`                               | Onde o número aparece no jogo                                                   |
| `prova`                              | Referência ao código do jogo (bloco e modo), nunca trecho de código             |
| `arvore_mae`                         | Só nos de destino `dentro-de-arvore`: as árvores onde o número aparece          |
| `destino_proposto`, `motivo_destino` | Só nos `a-classificar`: o destino proposto, que ainda falta confirmar           |

## Caixas

Bônus · Ganho por tempo · Custo · Chance e taxa · Limite e tempo · Progresso · Outro

## Tipos

| Tipo              | Exemplos                                         |
| ----------------- | ------------------------------------------------ |
| Stat              | Drop Rate, Damage, Efficiency                    |
| Multi             | EXP Multiplier, Loot Value Multi                 |
| Chance            | Multi-Ore, Card Drop Chance                      |
| Velocidade        | Build Rate, Brew Speed, Charge Speed             |
| Ganho por tempo   | Div Pts per hr, Essence Gain /HR                 |
| Custo             | custo do próximo nível                           |
| Redutor de custo  | Bubble cost reduction                            |
| Limite            | vagas de Inventory, nível máximo, capacidade     |
| Contagem          | quanto você tem: penas, baús, Gilded Stamps      |
| Nível             | nível do stamp, da skill                         |
| Tempo             | tempo de espera, de incubação                    |
| Liberado          | sim/não da tela                                  |
| Bônus de item     | o bônus de cada stamp, carta, estátua ou bribe   |
| Valor por unidade | quantidade por drop, por ciclo, por armadilha    |
| Outro             | o que não cabe nos anteriores, com `motivo_tipo` |

## Tipos de folha

O papel na conta, do ponto de vista do jogador, nunca a origem do dado: Level, Quantidade, Valor fixo, Bônus cru, Condição, Escolha, Tier, Recorde, Pontos investidos. Galho (valor composto), progresso e contexto não são folha.

## Destinos

| Destino            | O que é                                                                                  | Números |
| ------------------ | ---------------------------------------------------------------------------------------- | ------- |
| `arvore`           | Entra no catálogo de árvores agora                                                       | 289     |
| `dentro-de-arvore` | Folha ou galho de uma árvore que existe                                                  | 214     |
| `planejador`       | Custo, nível, contagem e limite, para uma futura tela de quanto custa e quanto falta     | 392     |
| `painel-de-farm`   | Ganho por tempo, para a feature futura                                                   | 41      |
| `alvo-atual`       | Muda com a pedra, o mapa ou o monstro, para uma futura tela do que se está fazendo agora | 40      |
| `clicker`          | Poppy, Clamworks, Orion e Bubba, que já têm otimizadores                                 | 32      |
| `copia`            | O mesmo número em outra tela                                                             | 10      |
| `descartado`       | Simples demais, sim/não da tela ou só dentro de minigame                                 | 136     |
| `a-classificar`    | Marcado sem uma regra que decidisse; tem `destino_proposto`                              | 135     |
