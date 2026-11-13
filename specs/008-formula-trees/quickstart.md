# Quickstart: conferir a 008 de ponta a ponta

## Sem o jogo (CI e qualquer máquina)

```bash
just check
```

Roda a suíte inteira com o jogo inventado:
- contrato e cópia fixada;
- isolamento nos dois workers;
- gravador, montagem e selos;
- paridade raiz = Stats;
- canais e arquivos salvos;
- janela: painel lateral, treeview, painéis, Pin, marcas, farm e radar.

Espera-se tudo verde.

## Paridade com a bancada (só na máquina do Vinicius)

Pré-requisitos, todos fora do repositório:
- a bancada no BASELINE-4 (`99d1772`) ou numa base posterior nomeada;
- o retrato `lab\out\retrato-character-9.json`, sem nome no nome do arquivo;
- as árvores montadas da bancada, sem compactação.

```bash
just parity
```

A receita lê três variáveis de ambiente, que a tarefa da receita acrescenta ao `.env.example` só com o nome:
- `PARITY_BENCH_DIR`: a pasta da bancada;
- `PARITY_SNAPSHOT`: o retrato;
- `PARITY_GAME_DIR`: a pasta do jogo instalado.

Sem elas, ou com um caminho que não existe, o teste pula sozinho. Espera-se 0 diferenças linha por linha em valor, tipo, ⓘ e "?" nas árvores `ok` do catálogo (SC-002); o resumo vai para o `registro.md`.

## Com o jogo aberto (sessão)

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | O app empacotado (`just package`) aberto pela Steam; personagem num mapa de combate | Stats com números em menos de 1 s |
| 2 | Tocar no Drop Rate da Stats | A janela alarga para 840 px; a raiz igual à Stats; a resposta curta em duas linhas; os passos do jogo em até 5 s |
| 3 | Abrir um ramo | Os filhos aparecem logo abaixo, calculados na hora |
| 4 | Abrir Stamps no jogo | O painel de Stamps aparece em até 1 s; o painel lateral não muda |
| 5 | Fixar o gilded chance; trocar um item no jogo | O pin acende; "Game changed · Refresh" na árvore aberta |
| 6 | "Mark before" com um nome; trocar equipamento; escolher a marca | Cada linha que mudou mostra o valor da marca e o atual |
| 7 | Farmar 10 min num mapa; ir à cidade e voltar | A faixa do farm conta, pausa na cidade e continua |
| 8 | Escolher no seletor um personagem inativo; entrar com ele no jogo | Os números do inativo iguais aos do personagem ativo (0 diferença) |
| 9 | Fechar o jogo | Stats, árvore e painéis com a última leitura e "last reading N s ago" |
| 10 | Teste dos 5 segundos com uma pessoa que joga e nunca viu o app | Ela diz o valor do Drop Rate e a maior parte; resultado em `teste-5s.md` |

Os retratos e as fotos de uma sessão ficam no `lab\` e são apagados com o sim do Vinicius ao fim da conferência.
