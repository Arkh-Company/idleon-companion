# Contrato: a receita (`<id>.blueprint.json`)

Um arquivo por número de destino `arvore`, em `src/calculator/blueprints/<lote>/`, com `<lote>` igual a `w1` … `w7`,
`character` ou `account`. O nome do arquivo é o id do catálogo. Os campos estão em [data-model.md](../data-model.md); este
arquivo fixa a forma, a conferência na carga e as checagens de CI.

## Forma

```json
{
  "id": "stats-drop-rate",
  "root": {
    "name": "Drop Rate",
    "nameProof": { "names": "stats-drop-rate" },
    "ref": { "call": "TotalStats", "args": ["Drop_Rarity", 0, 0] }
  },
  "pools": [
    {
      "kind": "additive",
      "weight": 0.01,
      "groups": [
        {
          "system": "talents",
          "sources": [
            {
              "key": "boss-battle-spillover",
              "name": "Boss Battle Spillover",
              "nameProof": { "table": "TalentNames", "row": 655 },
              "ref": { "call": "GetTalentNumber", "args": [1, 655] },
              "classes": [7, 8, 9, 10],
              "children": [
                {
                  "key": "talent-bonus",
                  "name": "Boss Battle Spillover",
                  "nameProof": { "table": "TalentNames", "row": 655 },
                  "ref": { "call": "GetTalentNumber", "args": [1, 655] },
                  "children": [
                    {
                      "key": "talent-points",
                      "name": "Talent points",
                      "nameProof": { "names": "talent-points" },
                      "ref": { "read": "PlayerDATABASE[{character}].SkillLevels[655]" },
                      "leaf": "investedPoints"
                    }
                  ]
                },
                {
                  "key": "boss-battle-best",
                  "name": "Boss battle best",
                  "nameProof": { "names": "options-account-189" },
                  "ref": { "read": "OptionsListAccount[189]" },
                  "termPart": { "system": "achievements" },
                  "leaf": "record"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "kind": "additive",
      "groups": [
        {
          "system": "bundles",
          "sources": [
            {
              "key": "bundle-bonus",
              "name": "…",
              "nameProof": { "names": "…" },
              "constant": 0.3,
              "leaf": "fixedValue",
              "condition": {
                "key": "bundle-owned",
                "name": "…",
                "nameProof": { "names": "…" },
                "ref": { "read": "OptionsListAccount[232]" },
                "leaf": "condition",
                "conditionKind": "owned"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

O exemplo mostra a forma, não a receita do Drop Rate: as classes, as tabelas e os sistemas acima são ilustrativos, e o
segundo pool foi encurtado. Dois pools seguidos do mesmo `kind` são recusados; o exemplo só mostra os dois tipos de nó.

## Conferência na carga (`parseBlueprint`, em `src/calculator/declared/blueprint.ts`)

Uma receita fora destas regras responde `unknownNumber` para aquele número, e o teste de CI de todas as receitas falha.

- O `id` é um id do catálogo do app e é igual ao nome do arquivo.
- `pools` não é vazio, e dois pools seguidos nunca têm o mesmo `kind`.
- Todo `system` existe em `systems.json`.
- Toda `key` é um slug (`[a-z0-9-]`, até 60 caracteres), única entre os irmãos.
- Todo nó tem `name` e `nameProof`; nenhum `name` é "no name yet", "Game value" ou vazio.
- Todo nó tem `ref` ou `constant`, nunca os dois.
- Um nó com `children` não tem `leaf`; um nó sem `children` tem `leaf`, um dos 9 tipos.
- `conditionKind` só com `leaf: "condition"`; `classes` e `weight` só em fonte de pool; `termPart` só em filho.
- `ref.call` é um identificador; `ref.args` só tem números e textos curtos; `ref.read` é um caminho de nomes, pontos e
  índices (`[n]`, `[{character}]`, `[*]`), sem operador, parêntese, aspas ou espaço.
- Nenhum índice de personagem por extenso dentro de `PlayerDATABASE[...]` ou outro caminho por personagem (research R5).
- Nenhuma chave fora das listadas.

## Checagens de receita (CI, `scope: "blueprint"`)

As do registro de regras de forma que só precisam da receita (research R13): nenhum grupo "Other", todo nome com prova,
toda folha com tipo, nenhum índice de personagem cru, o emoji vem da tabela, um grupo não mistura pesos. Elas rodam
sobre as 289 receitas em `src/calculator/declared/blueprints.test.ts`, junto com:

- uma receita por número de destino `arvore` de `docs/catalogo/numeros.json`, e nenhuma a mais (FR-001);
- o `no-game-text.test.ts` de hoje, que já varre `src/` e passa a varrer também as receitas e `specs/010-declared-trees`.

## O que nunca entra

Valor da gravação, conta (fórmula), trecho do código do jogo, citação de texto como prova, nome de personagem, índice de
personagem por extenso.
