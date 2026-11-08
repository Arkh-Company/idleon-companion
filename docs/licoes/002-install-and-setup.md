# Lições da feature 002-install-and-setup

1. Risco aceito: entre a checagem do jogo e o instalador encerrar os processos passam de 2 a 4 s, e apertar "Jogar" nessa janela derrubaria o jogo. O app não consegue fechar essa janela por completo. Origem: decisão do Vinicius na fase 8 (08/11).
2. Um `fireEvent` logo depois de um `await findBy*` corre com os efeitos passivos do React e só falha sob a carga da suíte inteira, então "passou isolado" não prova nada. Origem: revisão da feature, `App.test.tsx`.
3. A pasta de instalação e o nome do arquivo publicado vêm do `name` do `package.json`, não do `productName`; o que o electron-builder faz se confere no template dele, não na intuição. Origem: revisão das fases 7 e 9 (a ordem das macros do NSIS e a pasta real contradisseram a pesquisa).
4. Uma regra escrita numa fase pode ter como exemplo "ruim" o código entregue na mesma fase, e os achados menores se acumulam sem dono até a revisão da feature. Origem: revisão da feature, regra "Rules wired in the Electron entry are tested".
5. O pedido ao Executor não pode mandar editar a pasta da spec além do `tasks.md`: o hook bloqueia, e essa edição é da sessão. Origem: fase 5, `data-model.md`.
