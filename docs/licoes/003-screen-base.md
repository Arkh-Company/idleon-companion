# Lições da feature 003-screen-base

1. Um campo de comportamento compartilhado entre janelas (`H0.*`, ator 29) guarda o valor antigo ao trocar de janela. Uma regra de aba sobre um campo compartilhado precisa de foto do caso "valor antigo" ou de teste no jogo. Origem: revisão da feature, regras de `Items › Equipment`.
2. A fixture de estados capturados serve de sonda além de critério: ordenar os estados por foto e seguir um campo no tempo mostra o que nenhuma asserção por estado mostra. Origem: revisão da feature.
3. A prova prova o nome, não a condição: um sprite diz como o valor N se chama, e só um estado capturado prova que N naquele campo é a subtela aberta. Origem: revisão da feature, provas `sprite:`.
4. O teste de prova confere que a regra casa com o estado da foto, não que ela vence: a regra da janela é provada pela foto da primeira aba. Origem: revisão da feature.
5. `installed.code = undefined` é o único ponto em que a feature solta o texto do jogo, que agora atravessa `launch` e `startApp`. Lembrar disso se uma tarefa futura ler o arquivo mais cedo ou outra vez. Origem: revisão da feature, R8.
