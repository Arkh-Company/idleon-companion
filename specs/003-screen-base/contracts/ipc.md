# Contrato: IPC e painel (mudança)

## IPC

- Sai `catalog:name` (`IPC.catalogName`, `CompanionApi.name`, `namePayload`).
- `context:update` continua, com o `GameContext` novo de [../data-model.md](../data-model.md).

## Painel "Screen map"

Uma tabela, nesta ordem:

| Linha | Conteúdo |
| --- | --- |
| Screen | `screen.label`: `Sailing`, `Codex › Cards › Sets`, `Breeding › Unknown tab`, `Unknown screen`, `Character select`, `AFK Gains`, o nome da caverna ou `None` |
| World | `screen.world` |
| Map | `names.map`: o nome ou `Unknown map`, sem o número |
| Character | `character` ou `No character selected` |
| AFK target | `names.afk`: o nome, `Unknown monster` ou `None` |

Saem as linhas Menu, Window e Codex tab, o texto `unnamed #N`, o asterisco `deduced` e o "Name it". Nenhuma caixa de texto
em toda a janela; as caixas de marcar de Settings continuam (FR-013).
