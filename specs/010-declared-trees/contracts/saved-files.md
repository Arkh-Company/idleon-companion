# Contrato: arquivos salvos na versão 2 e a limpeza dos antigos

Muda `specs/008-formula-trees/contracts/saved-files.md` (congelado). A forma de dentro de cada arquivo é a mesma da 008;
mudam a `version`, os ids de nó e as chaves de peça, que seguem as receitas (FR-028, research R12).

| Arquivo | Versão nova | O que muda |
| --- | --- | --- |
| `marks.json` | `version: 2` | As chaves de `values` são chaves de peça das árvores declaradas |
| `pins.json` | `version: 2` | `treeId` é um id do catálogo de 289; `nodeId` é um id de nó declarado ou `null` |
| `tree-shapes.json` | `version: 2` | As partes vêm das árvores declaradas |
| `settings.json` | sem versão nova | Ganha a chave só do main `oldTreesNotice: "pending"`, fora de `Settings`, como o zoom |

## A limpeza, na primeira abertura da versão nova (`src/main/old-trees.ts`)

Roda uma vez por abertura, antes de o main ler os três arquivos:

1. Para `marks.json`, `pins.json` e `tree-shapes.json`, na pasta de dados do app (`app.getPath("userData")`):
   - **versão 1:** o arquivo é apagado, junto com o `<nome>.tmp` e o `<nome>.bad`, se existirem; nada dele é levado
     para a versão 2, nem pelo nome;
   - **versão 2:** nada muda;
   - **outra forma:** segue a regra de hoje: vira `<nome>.bad`, e a janela avisa uma vez.
2. Se o `marks.json` ou o `pins.json` apagado tinha ao menos uma marca ou um pin, grava `oldTreesNotice: "pending"` no
   `settings.json`. O `tree-shapes.json` é dado derivado: apagá-lo não acende a faixa.
3. Nada fora desses arquivos é tocado: nenhum outro arquivo da pasta, nenhum arquivo fora dela.

## Falhas

- **Arquivo que não pode ser apagado** (travado pelo Windows): a limpeza segue com os outros, e a próxima abertura tenta
  de novo, como o `forget-names.ts`. Enquanto ele existir, o main não o lê como versão 2.
- **`settings.json` que não pode ser gravado:** a faixa aparece nesta sessão, a partir do resultado da limpeza em
  memória.
- **Nunca cai:** um erro de leitura, de remoção ou de gravação vira aviso no log, e o resto do app segue.
