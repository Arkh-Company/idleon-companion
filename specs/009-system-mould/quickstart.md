# Quickstart: conferir a 009 de ponta a ponta

## Sem o jogo (CI e qualquer máquina)

```bash
just check
```

Os testes rodam no jogo inventado e cobrem:
- os pools a partir da conta da raiz: soma, produto, soma que multiplica e Drop Rate;
- os grupos por sistema e a ordem;
- o grupo neutro que fica no lugar;
- a fonte única;
- tudo em "Other";
- o achatamento, com o ⓘ que fecha;
- os papéis novos na conferência do main;
- os botões "Changes" e "fatia";
- as setas ao vivo e contra uma marca;
- a fonte sem cálculo.

## Paridade com a V1 (só na máquina do Vinicius)

1. Na bancada, gere a V1 sobre o mesmo retrato:
   - comando: `TREE=<gravação do retrato> OUT=<PARITY_BENCH_DIR>/parity/dropRate-v1.json node screen-proposal/build-v1mold.cjs`;
   - a gravação é a do mesmo retrato que a paridade da 008 usa.
2. Rode a paridade, com as variáveis `PARITY_*` no ambiente do terminal:

```bash
just parity
```

Espera-se 0 diferenças em pools, grupos, ordem, valores e fontes por grupo (SC-002). O resumo vai para o `registro.md`.

## Sonda das 716 árvores (fora do repositório)

A sonda monta as 716 árvores sobre o jogo instalado e o retrato, abre cada ramo e conta:
- as linhas de galho de conta com `no name yet`: espera-se 0 (SC-001);
- os níveis que não somam ou multiplicam até o pai: espera-se 0 (SC-003);
- as fontes que caem em "Other": o número que falta para a tabela de sistemas.

Ela fica no scratchpad da sessão e lê o `N.js` e o `default.pak` extraídos do `app.asar`. Nada disso entra no Git.

## Com o jogo aberto

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Abrir o Drop Rate | O primeiro nível são os pools da V1, todos fechados, sem o resumo de duas linhas |
| 2 | Abrir o Additive Pool | Os sistemas com emoji, na ordem da V1; um sistema que vale 0 fica no lugar |
| 3 | Abrir Forge stats 2 | "Additive pool" e "Multi pool"; o ⓘ da raiz diz "Additive pool × Multi pool" |
| 4 | Ligar a fatia | Cada linha mostra só "26%", sem texto extra |
| 5 | Ligar "Changes" e trocar uma carta no jogo | Em até 1 s, a carta, o grupo Cards e o pool ganham "▲ +N%" (ou "▲ +0.12" numa linha "×"), sem Refresh e sem a faixa "Game changed" |
| 6 | Escolher uma marca em "Changes" | As setas comparam com a marca |
| 7 | Fechar e abrir o app | Os botões voltam como estavam |
