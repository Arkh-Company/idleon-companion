# Lições da 010: árvores declaradas

1. **Um PR por fase muda quando os documentos vencem.** Com vários PRs, cada um deixa a `main` verdadeira: o que ele tira
   e o que ele cria entram no `ARCHITECTURE.md` no mesmo PR, não na tarefa de documentos do fim. (Revisor, fim do PR 1)
2. **Uma regra de fronteira que vale também para os testes prende o teste na pasta que sai.** Um teste de `names/` que
   usa um ajudante de `tree/` não pode acompanhar a peça; antes de apagar a pasta, liste o que migra. (Revisor, fim do
   PR 1)
3. **Um `just check` que falha sem mensagem pede uma rodada sem o proxy `rtk`.** O proxy engole a saída do vitest
   quando a suíte falha. (Executor e Revisor, fase Setup)
