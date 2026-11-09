# Contrato: IPC e aba (mudança)

## IPC

- Novo `stats:update`, main → window, com `Stats` ([data-model](../data-model.md)). O preload guarda o último valor e o reenvia a quem assinar tarde.
- `CompanionApi` ganha `onStats`.

## Janela

Duas abas: `Screen map` (o painel da 003) e `Stats`.

| Linha | Formato |
| --- | --- |
| Drop Rate | `2,797,522x` |
| Damage | `6,194,940 – 8,650,898` |
| HP, MP, STR, AGI, WIS, LUK | inteiro para cima, com separador; `T` a partir de trilhão |
| Accuracy | notação `E`, 2 casas truncadas (`1.49E33`) |
| AFK Gains | `160,506%` |

Textos fixos: `Calculating`, `Calculator unavailable`, `unavailable`. Nenhuma caixa de texto. Com outra classe, os números aparecem normalmente, sem aviso.
