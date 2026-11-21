# Contrato: a galeria (`just gallery <lote>`)

Uma ferramenta de desenvolvimento em Electron, em `scripts/gallery/`, que nunca entra no instalador. Roda só no PC do
Vinicius, sem rede (NFR-004). A receita do `justfile` é nova e entra só com o sim do Vinicius.

## Montagem e execução

- O vite monta a ferramenta com a configuração própria (`scripts/gallery/vite.config.ts`), para
  `TREES_OUT/gallery-app/`: o main da ferramenta e duas páginas.
- **A página da árvore** importa `src/renderer/FormulaTree.tsx` e `src/renderer/styles.css` de verdade, com o
  `companion-stub.ts` no lugar do `window.companion`.
- **A página da galeria** mostra os cartões.
- `just gallery <lote>` monta e roda `pnpm exec electron TREES_OUT/gallery-app/main.js <lote>`, com `TREES_OUT` e
  `TREES_SNAPSHOT` no ambiente.
- O lote é `pilot` (só o Drop Rate), `w1` … `w7`, `character` ou `account`.

## Captura (FR-023)

1. Lê `TREES_OUT/trees/<id>.json` de cada número do lote cuja revisão tem `lock.ok` sobre o `blueprintSha` atual.
2. Pula a árvore cuja imagem é mais nova que o JSON dela.
3. Desenha a árvore numa janela fora da tela, na largura do painel lateral do app, com `openAll`: pools, grupos, fontes
   e filhos até as folhas.
4. Captura com `webContents.capturePage()`, em fatias de até 8.000 px de altura, em
   `TREES_OUT/img/<id>-<n>.png`.

A prop `openAll` do `FormulaTree` só abre tudo; na tela do app ela nunca é passada (FR-013).

## A janela da galeria (FR-024, FR-024b)

- **Segurança:** `sandbox`, `contextIsolation`, sem `nodeIntegration`, CSP `default-src 'self'`; toda requisição
  http(s) cancelada pela sessão da janela; nenhuma janela nova.
- **Topo:**
  - o lote;
  - a última mudança de `TREES_OUT/changes.json`: quantas árvores mudaram e quantas por tipo (nome, linha nova, linha
    removida, valor);
  - quantos números do lote ainda não passaram na trava. Esses números não ganham cartão.
- **Corpo:** uma seção por sistema (o `system` do catálogo do app), com os cartões na ordem do catálogo.
- **Cartão:**
  - o nome do número;
  - o sistema;
  - as imagens da árvore, em carga preguiçosa (`loading="lazy"`), num quadro com rolagem;
  - "Aprova", "Corrigir + nota" e o campo de nota.
  - Botões e campo nativos, com nome para o leitor de tela e alcançáveis pelo Tab.
  - Um cartão já aprovado no hash atual aparece marcado.
- **Tempo:** a galeria de um lote abre em até 5 s (FR-024), com as imagens já capturadas.

## Resposta

| Direção | Mensagem | Regra |
| --- | --- | --- |
| página → main da ferramenta | `review:save { id, verdict, note }` | O `id` é do lote aberto; `verdict` é `approved` ou `fix`; a nota tem até 2.000 caracteres, é obrigatória com `fix` e não pode ter nome de personagem do retrato (lido do `TREES_SNAPSHOT`, só em memória) |
| main da ferramenta → página | `{ saved: true }` ou `{ refused: "<motivo>" }` | Grava `<id>.review.json` ao lado da receita ([review.md](review.md)); o caminho sai do id, nunca do payload |

Uma revisão com `blueprintSha` diferente da receita atual é recusada com "a receita mudou: rode a trava de novo".

## Corrigir + nota

Cada `fix` vira, na sessão, uma mudança de receita ou de regra de forma registrada (FR-025): a nota é lida, a receita ou
o registro de regras muda, a trava roda de novo, e a árvore volta ao lote com a contagem de mudanças no topo.
