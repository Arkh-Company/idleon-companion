# Contrato: a revisão (`<id>.review.json`)

Um arquivo por receita, ao lado dela (FR-024c). Guarda o resultado da última trava sobre o jogo real e a resposta do
Vinicius na galeria. Nunca é importado pelo app: só a conferência real, a galeria e os testes o leem.

## Forma

```json
{
  "version": 1,
  "blueprintSha": "<sha256 da receita canônica>",
  "lock": { "ok": true, "gameSha": "<sha256 do N.js>", "at": "2026-11-25T14:02:00-03:00" },
  "verdict": "approved",
  "note": null,
  "history": [
    { "at": "2026-11-24T21:10:00-03:00", "verdict": "fix", "note": "…", "blueprintSha": "<sha256 anterior>" }
  ]
}
```

- **`blueprintSha`:** o sha256 do JSON da receita em forma canônica (chaves em ordem, sem espaço). Uma receita que muda
  tem outro hash, e a revisão deixa de valer para ela.
- **`lock`:** quem escreve é a conferência real (`just trees`); `null` enquanto a receita nunca passou por uma rodada.
  `ok: false` guarda só que falhou; os motivos ficam em `TREES_OUT/lock/<id>.json`.
- **`verdict` e `note`:** quem escreve é a galeria (`just gallery`). `note` só com `fix`, até 2.000 caracteres.
- **`history`:** cada resposta anterior entra aqui quando chega uma nova, com o hash que ela viu; o `at` dessa entrada é a hora em que a resposta saiu do lugar (uma resposta nova ou a receita mudada).
- **Horários:** no fuso `America/Sao_Paulo`.

## Quem grava e o que confere

| Quem | Grava | Confere antes |
| --- | --- | --- |
| Conferência real | `blueprintSha`, `lock` | O id é do catálogo; o caminho sai do id, nunca de texto de fora |
| Galeria | `verdict`, `note`, `history` | O veredito é `approved` ou `fix`; a nota tem até 2.000 caracteres e não tem nenhum nome de personagem do retrato; o `blueprintSha` da revisão é o da receita atual (senão a árvore volta à trava) |

## Portão no CI (`src/calculator/declared/reviews.test.ts`)

- **Sempre:** todo arquivo de revisão tem a forma acima, um id do catálogo e uma receita ao lado; nenhuma nota tem mais de
  2.000 caracteres.
- **Da Fase 7 em diante (FR-011, FR-029, SC-001, SC-002):** cada uma das 289 receitas tem uma revisão com `blueprintSha`
  igual ao hash da receita atual, `lock.ok: true` e `verdict: "approved"`. Uma receita mudada sem nova trava e nova
  aprovação deixa o CI vermelho.

O portão confere o que foi registrado, não a conta: a conta só é conferida no PC do Vinicius (FR-026). Por isso ele é
candidato a ADR (research, Candidatas a ADR, item 2).
