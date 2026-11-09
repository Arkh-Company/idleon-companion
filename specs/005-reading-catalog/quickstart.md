# Quickstart: validar o catálogo de leitura

## Pré-requisitos

- `just setup` feito e app gerado com `just package` (a opção da Steam apontando para ele).
- O jogo instalado. Quem abre o jogo e mexe na Steam é o Vinicius.

## Sem o jogo

```bash
cd 'C:\Users\Vinicius\ClaudeCowork\idleon-companion' && just check
```

Prova as regras do catálogo (SC-003, SC-004, SC-006), o terceiro nível do caminho com armadilhas, o agendamento das vagas e o cálculo com contexto único sobre o jogo inventado dos testes.

Na máquina do Vinicius, com a cópia real fora do repositório, repetir o que `prototipo/vivo.cjs v4 direto` mediu, agora com o `calculator.js` compilado (SC-005): 135 de 135 pares iguais a um cálculo do zero.

## Com o jogo

| Cenário | O que fazer | Resultado esperado |
| --- | --- | --- |
| SC-001, item | Tirar e colocar um item que dá Drop Rate, 10 trocas ou mais | Menos de 1 s até o número mudar, num passo só, em todas as trocas |
| SC-001, mecânicas | Trocar obol, prayer e mapa; mover um objeto do Research | Número afetado muda em menos de 1 s |
| SC-002, quadros | Comparar com `prototipo/quadros.cjs` o app ligado com as janelas sem leitura | p95 e p99 sem piora além do ruído |
| FR-021, entrada | Entrar num personagem | Nenhum número antes de terminar a primeira volta, em cerca de 3 s |
| Troca de mapa e de personagem | Trocar de mapa; trocar de personagem | Nada do mapa ou personagem anterior fica na tela |

## Depois de um patch do jogo

```bash
cd 'C:\Users\Vinicius\ClaudeCowork\idleon-companion' && node scripts/reading-inventory.ts '<caminho do retrato real>'
```

Imprime só as peças novas e as que sumiram (FR-022), com personagens como `Personagem` e `OutrosPersonagens`.
