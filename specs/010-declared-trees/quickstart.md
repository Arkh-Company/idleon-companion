# Quickstart: conferir a 010 de ponta a ponta

As receitas `just trees`, `just draft` e `just gallery` são novas e só existem depois que o Vinicius aprovar a mudança no
`justfile` (Fase 1).

## Sem o jogo (CI e qualquer máquina)

```bash
cd 'C:\Users\Vinicius\ClaudeCowork\idleon-companion' && just check
```

Os testes rodam no jogo inventado (`src/calculator/fixtures/`) e nas receitas do repositório, e cobrem:

- **gabarito:** a corrente de pools (soma, produto, trocas, escritas seguidas juntadas), a forma "expressão" e a raiz fora
  da regra recusada com o motivo;
- **trava:** os três casos da US2, cada um reprovado com o motivo:
  - fonte que falta;
  - pools fora de ordem;
  - nível que não fecha;
- **trava, abaixo do pool:** o fechamento remontado numa cadeia de dois níveis ou mais, a parte transparente, a condição
  `&&` que discorda do gabarito, o termo de duas fontes e o `{character}` / `*`;
- **montagem:** pools, grupos (mesmo de uma fonte só), classe, fonte em 0 ou ×1, ids e chaves de peça, o ⓘ;
- **receitas:** todas as 289 passam na conferência de carga e nas checagens de receita; uma receita por número de destino
  `arvore`;
- **regras de forma:** o registro e o código amarrados, e o conflito montado à mão (US4);
- **revisões:** a forma dos arquivos e, da Fase 7 em diante, as 289 aprovadas no hash atual;
- **main e janela:** a limpeza dos arquivos da versão 1, a faixa uma vez, o alerta no log.

## No PC do Vinicius, com o jogo real

As variáveis `TREES_GAME_DIR`, `TREES_SNAPSHOT` e `TREES_OUT` vão no ambiente do terminal antes de cada comando (veja o
`.env.example`). Uma rodada por vez, nunca em laço (NFR-003).

### 1. Sonda das raízes (Fase 2)

```bash
cd 'C:\Users\Vinicius\ClaudeCowork\idleon-companion' && just trees roots
```

Confira `TREES_OUT/roots.json`: quantas raízes em cada forma; as que ficaram fora da regra viram uma tabela para o Vinicius.

### 2. Rascunho de um lote

```bash
cd 'C:\Users\Vinicius\ClaudeCowork\idleon-companion' && just draft w1
```

Escreve os rascunhos em `src/calculator/blueprints/w1/` e os guias em `TREES_OUT/draft/`.

### 3. Trava de um lote, de um número ou de tudo

```bash
cd 'C:\Users\Vinicius\ClaudeCowork\idleon-companion' && just trees w1
```

Confira em `TREES_OUT`:

- **`summary.txt`:** cada número passou ou reprovou, com o motivo; o tempo e a memória da rodada;
- **`rules.md`:** as regras que falharam e os conflitos;
- **`alerts.json`:** os alertas;
- **`changes.json`:** quantas árvores mudaram e como.

Os arquivos `<id>.review.json` do lote ganham o resultado da trava.

### 4. Galeria

```bash
cd 'C:\Users\Vinicius\ClaudeCowork\idleon-companion' && just gallery w1
```

A galeria abre em até 5 s. Aprove ou peça correção com nota; a resposta vai para o `<id>.review.json` ao lado da
receita. As imagens ficam em `TREES_OUT/img/`, fora do Git.

## As histórias, uma a uma

| História | Como conferir |
| --- | --- |
| US1 | Com o app da Fase 7 e o jogo aberto, abrir o Drop Rate: 4 pools na ordem do jogo (Additive, Multi, Additive, Multi), grupos com emoji dentro, nenhum "Other" nem "no name yet", a raiz igual ao valor da Stats, em até 5 s |
| US2 | Na receita do Drop Rate, tirar a fonte `Summoning WinBonus 9` e rodar `just trees stats-drop-rate`: reprova com "fonte que falta" e o nível que não fecha. Trocar os pools 1 e 2: reprova com a ordem esperada. Desfazer as duas mudanças |
| US3 | `just gallery w1`, aprovar uma árvore e pedir correção em outra com nota: as duas respostas ficam nos `*.review.json`, e a correção aparece como pendência daquela receita |
| US4 | `just check` roda as checagens de receita sobre as 289; o teste do conflito montado à mão aponta a árvore e os dois números. `TREES_OUT/rules.md` traz as checagens de árvore da última rodada |
| US5 | No CI, a gravação inventada com uma fonte a mais que a receita gera o alerta no log e nenhuma linha extra. No jogo real, `alerts.json` traz os alertas da rodada |
| US6 | Abrir a versão nova com um `pins.json` e um `marks.json` da versão 1 na pasta de dados: a faixa "Pins and marks from the old trees were removed: the trees were rebuilt." aparece, os dois arquivos somem, e a faixa não volta depois de fechada |
