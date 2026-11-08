# Data Model: Base de telas (screen-base)

## Reading (muda)

O que o guardião tira do jogo a cada segundo. Campos de antes continuam. Campos novos (nomes exatos em
[contracts/read-fields.md](contracts/read-fields.md)):

| Campo | Tipo | Origem |
| --- | --- | --- |
| `scene` | `string \| null` | `engine.scene.name` |
| `attack`, `bag` | `number \| null` | `AttackSelected`, `InventorySelected` |
| `ol1`, `ol3`, `ol18`, `ol19` | `number \| null` | `OptionsList[1]`, `[3]`, `[18]`, `[19]` |
| `ola489`, `nd37` | `number \| null` | `OptionsListAccount[489]`, `NONdummies[37]` |
| `hole` | `number \| null` | `Holes[0][índice do personagem]`; -1 = fora de caverna |
| `behaviors` | `Record<string, number \| string \| boolean \| null>` | campos de comportamento; comportamento ausente não gera chave |

Validação: `toReading` confere cada campo novo; um `behaviors` que não seja objeto plano de valores simples reprova a
leitura. Comportamento ausente não reprova (FR-008).

## ScreenRule (nova)

Uma linha do catálogo.

| Campo | Tipo | Regra |
| --- | --- | --- |
| `when` | `Record<string, number \| string>` | igualdade, em AND. A chave é um campo da `Reading` (`menu2`, `menu2tab`, `hole`...) ou uma chave de `behaviors` (`H27._GenINFO[124]`). Pelo menos uma condição |
| `name` | `string` | caminho inteiro, separado por " › " |
| `tabs` | `true`, opcional | a tela tem abas ou subtelas; se esta regra vencer, o painel acrescenta "› Unknown tab" |
| `proof` | `string` | obrigatório: `foto:<id>` ou `sprite:<nome>` |

Uma condição sobre uma chave ausente nunca casa.

## ScreenCatalog (nova)

| Campo | Conteúdo |
| --- | --- |
| `overlays` | `ScreenRule[]`: Character select (`scene`), AFK Gains (`ol18`) |
| `screens` | `ScreenRule[]`: menus, Quik Ref, Codex, janelas, abas, subtelas, cavernas e "None" |
| `unprovenWindows` | `number[]`: números de `MenuType2` que existem no jogo e ainda não têm prova |

Invariantes, cada uma testada:

- Toda regra tem `proof` no formato certo.
- Os números de janela das regras mais `unprovenWindows` são exatamente os 108 do mapa de telas.
- Um número de `unprovenWindows` não aparece em nenhuma regra (`KNOWN_WINDOWS` é a união dos dois).
- Nenhum estado capturado termina em empate.

## identifyScreen

`identifyScreen(reading, catalog)` → `string`.

```text
para cada lista em [overlays, screens]:
  casadas = regras da lista cujo `when` inteiro bate com a leitura
  se casadas está vazia: próxima lista
  maior = casadas com mais condições
  se há mais de uma em `maior`: "Unknown screen"          (R3)
  se a regra tem `tabs`: name + " › Unknown tab"
  senão: name
"Unknown screen"
```

## GameTables (nova)

| Campo | Tipo | Regra |
| --- | --- | --- |
| `maps` | `string[] \| null` | nome por número de mapa; `null` = não consegui ler |
| `monsters` | `Record<string, string> \| null` | nome por id; `null` = não consegui ler |

Nasce no guardião (`readGameTables(code)`), segue pelo elo e fica na memória do app, trocada a cada abertura do jogo.
Nunca vai para o disco.

## GameContext (muda)

```text
screen: { world, map, label }     label = identifyScreen(...)
character
afk                               o id lido, para os módulos
names: { map, afk }
snapshot?
updatedAt
```

- `names.map`: o nome da tabela ou "Unknown map".
- `names.afk`: "None" sem alvo (`null` ou `Nothing`); o nome da tabela; ou "Unknown monster".
- Saem: `screen.menu`, `window`, `tab`, `codexTab`, `codexSel`, `names.menu`, `names.window`, `names.codexTab` e `unnamed`.

## CapturedState (fixture de teste)

| Campo | Conteúdo |
| --- | --- |
| `photo` | número da foto da rodada |
| `reading` | a leitura daquele instante, com `char` trocado e `codexSel` nulo |
| `expected` | o `label` esperado |

## O que sai

`Catalog`, `Entry`, `CatalogTable`, `src/main/catalog/`, `default-names.json`, `scripts/convert-prototype-names.ts`,
`NameIt`, `namePayload`, `IPC.catalogName`, `CompanionApi.name` e a classe `.deduced`. Os arquivos `names.json`,
`names.json.bak` e `names.json.bad` são apagados da pasta do usuário a cada início do app, quando existirem.
