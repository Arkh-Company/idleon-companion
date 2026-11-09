# Lições da feature 004-data-base

1. Toda aresta que o plano desenhou saindo de um arquivo de entrada virou um módulo de ligação (`readers.ts`, `link-routes.ts`, `stats-pipeline.ts`), porque a entrada não tem teste. Nomear esse módulo já no plano evita o diagrama e o documento ficarem atrás do código. Origem: revisão da feature.
2. A tabela de transições não tinha a linha "a fonte parou sem avisar", que só apareceu como achado na fase 4 e virou o prazo de 30 s na fase 7. Numa máquina de estados, essa linha entra desde o desenho. Origem: revisão da feature.
3. O jogo inventado dos testes prova o isolamento, não o cálculo: rodar o `calculator.js` compilado sobre a cópia real, fora do repositório, respondeu em minutos o que nenhum teste responderia. Foi assim que apareceram as tabelas que vinham do save e os 780 MB de memória. Origem: conferência da sessão nas fases 4 e 5.
4. O worker desempacotado vive sem `package.json` ao lado e só carrega porque o Node detecta a sintaxe ESM. Pôr `import.meta` ou um chunk relativo em `calculator.js` quebra só no app instalado, não nos testes nem no `just build`. Origem: revisão da feature.
5. Corrigir um teste pode tirar dele outra prova: trocar a espera de 120 s por um `setFiles` deixou o `reset()` sem cobertura do prazo. Numa correção de teste, vale conferir o que ele já provava antes. Origem: rodada 2 da fase 6.
