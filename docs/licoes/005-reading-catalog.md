# Lições da feature 005-reading-catalog

1. Uma conta de tempo fechada com a medida do protótipo precisa ser refeita quando o código real mede outro valor. O alvo de 1 s foi planejado com 99 ms, e o cálculo compilado chegou a 460 ms antes de voltar a 132 ms. Origem: conferência da sessão na fase 3.
2. Medir o cálculo só no protótipo não basta: o `calculator.js` compilado sobre a cópia real do jogo mostrou o custo de erros cruzando o `node:vm` e confirmou os números iguais. O jogo inventado dos testes não vê nada disso. Origem: conferência da sessão nas fases 3 e na revisão final.
3. Um número planejado por cadência precisa ser medido como taxa real: no Windows, `setInterval(83)` dá cerca de 10,7 por segundo, e o medidor de quadros tinha a mesma limitação. Origem: `/code-review` da feature.
4. Uma tarefa que empacota por grupo precisa de um teste com o catálogo real: o catálogo de teste tinha 2 grupos, o real tinha 35, e a volta da leitura rápida ia a 5 s. Origem: revisão da fase 2.
5. Mudar a leitura de uma peça muda o atraso de tudo que a consome, não só do cálculo: a checagem contra a `StatList` passou a acusar "unavailable" falso porque a lista chegava pela leitura lenta. Origem: revisão da fase 4.
