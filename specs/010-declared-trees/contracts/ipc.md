# Contrato: a faixa dos Pins e marcas antigos (IPC)

Dois canais novos, no objeto `IPC` de `src/shared/types.ts` (fixado pelo `types.test.ts`), validados em
`src/main/payloads.ts` como os da 008 e da 009. Os outros canais não mudam.

| Canal | Direção | Payload | Resposta | Regra |
| --- | --- | --- | --- | --- |
| `notice:oldTrees` | main → janela | `{ show: boolean }` | — | Replay da última no preload, como o `radar:update`. `show: true` enquanto `settings.json` tem `oldTreesNotice: "pending"` |
| `notice:dismissOldTrees` | janela → main | nenhum | `null` | Sem corpo; um payload qualquer é recusado. Tira a chave de `settings.json` (escrita inteira, `.tmp` + rename) e manda `{ show: false }` |

## A faixa na janela (`OldTreesBand.tsx`)

- **Lugar:** no topo do app, no mesmo lugar das outras faixas (`PatchBand`), acima de tudo.
- **Texto:** "Pins and marks from the old trees were removed: the trees were rebuilt." (FR-028).
- **Fechar:** um botão com nome para o leitor de tela ("Close"), alcançável pelo teclado. Ao fechar, a faixa some e não
  volta, nem nas aberturas seguintes.
- **Anúncio:** a faixa aparece numa região `status`, lida uma vez pelo leitor de tela.
- **Falha ao gravar:** se a chave não puder ser tirada do `settings.json`, a faixa some nesta sessão e volta na
  próxima abertura; o app segue.
