# Lições da 010: árvores declaradas

1. **Um PR por fase muda quando os documentos vencem.** Com vários PRs, cada um deixa a `main` verdadeira: o que ele tira
   e o que ele cria entram no `ARCHITECTURE.md` no mesmo PR, não na tarefa de documentos do fim. (Revisor, fim do PR 1)
2. **Uma regra de fronteira que vale também para os testes prende o teste na pasta que sai.** Um teste de `names/` que
   usa um ajudante de `tree/` não pode acompanhar a peça; antes de apagar a pasta, liste o que migra. (Revisor, fim do
   PR 1)
3. **Um `just check` que falha sem mensagem pede uma rodada sem o proxy `rtk`.** O proxy engole a saída do vitest
   quando a suíte falha. (Executor e Revisor, fase Setup)
4. **"301 na regra" numa sonda não prova que nada foi decidido pela ordem.** O resultado depende dos valores do retrato;
   ligar por valor passou por acaso até a ligação pelo lugar gravado recusar três raízes. (Revisor, fim do PR 2)
5. **Toda ligação do gabarito usa o lugar gravado.** Escritas seguidas de mesmo valor (um acumulador somado com 0, um 0
   fixo) parecem duas origens quando se olha o valor; a leitura que alimenta o passo é que decide. (Sondas 9 a 13)
6. **O limite de 400 linhas só se cumpre com um teste.** Por revisão, ele foi achado três vezes; o `file-size.test.ts`
   fecha isso. (Revisor, fim do PR 2)
