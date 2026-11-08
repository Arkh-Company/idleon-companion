# Quickstart: validar a 002 de ponta a ponta

Roteiro manual, com o Vinicius presente: mexe na Steam e no jogo real. Os testes automáticos rodam em `just check`;
este roteiro cobre o que eles não alcançam (instalador, Steam, overlay, atualização). Mexer na Steam ou matar processo
só com o OK explícito do Vinicius.

## Pré-requisitos

- Windows com a Steam e o Legends of Idleon instalados; a opção de inicialização do jogo anotada (para comparar).
- `just check` verde no branch da feature.
- Para §6: o repositório `Arkh-Company/idleon-companion-releases` criado (com o OK do Vinicius) e o `GH_TOKEN` no
  terminal dele.

## 1. Instalador

```bash
cd 'C:\Users\Vinicius\ClaudeCowork\idleon-companion' && just package
```

Esperado: `dist\IdleOn Companion Setup <versão>.exe`. Rodar: sem pedido de administrador; o app fica em
`%LOCALAPPDATA%\Programs\IdleOn Companion\`; atalho no menu Iniciar; "IdleOn Companion" em Aplicativos instalados
(FR-001). O SmartScreen pode avisar ("More info" → "Run anyway").

## 2. Tela de configuração (US1)

1. Abrir o app: a janela mostra só a tela de configuração, com a Steam, a conta (nome) e o jogo encontrados e o estado
   da opção (FR-005, FR-006).
2. "Details": o texto exato, o arquivo e a cópia (FR-011).
3. Com o jogo aberto: o botão desativado com "Close the game first" (FR-014).
4. Jogo fechado, "Close Steam and set up": os passos aparecem; a Steam fecha e reabre; "All set." (FR-007, FR-029).
5. Conferir: a opção na Steam ganhou só a parte do companion; o resto do texto continua (FR-008);
   `%APPDATA%\IdleOn Companion\steam-backup\` tem a cópia (FR-027); `steam-setup.json` não tem nome de conta (FR-028).
6. Comparar o `localconfig.vdf` com a cópia: só a linha da opção difere.
7. Só com o teclado: Tab chega em cada botão da tela e Enter o aciona (FR-034).

## 3. Jogar, comprar, fechar (US1, US2)

1. "Jogar" na Steam: o jogo abre, o painel acompanha (como na 001). No `console_log.txt` da Steam aparece
   "GameOverlay: started … for game process".
2. Abrir a loja de gemas e um item pago: a janela de compra da Steam abre (sem concluir), 3 de 3 vezes (SC-002).
3. Apertar o X do jogo: não fecha; a barra mostra o lembrete (FR-018).
4. "Let the game close" (na barra; repetir pela bandeja noutra sessão): "Reader off · You can close the game now";
   o X fecha o jogo em ≤ 2 s (SC-003).
5. Noutra sessão: "Let the game close", depois "Reconnect": uma pausa nova no `keeper.log` (`attached` com `pausedMs`),
   o painel volta em ≤ 2 s (SC-004).

## 4. Desfazer (US3)

1. Settings → "Remove from Steam": a opção volta ao texto sem a parte do companion (SC-005).
2. "Set up Steam" de novo, depois desinstalar pelo Windows: o desinstalador pergunta, fecha a Steam, tira a parte e
   reabre; o jogo abre pela Steam sem o companion (FR-013).
3. Repetir recusando fechar a Steam: o desinstalador mostra o texto a tirar e termina.

## 5. Desenvolvimento

Opção da Steam apontando para o repositório (sem `.cmd`):
`"<repo>\node_modules\electron\dist\electron.exe" "<repo>" --keeper %command%`, depois de `just build`. O jogo abre
lendo.

## 6. Atualização (US4)

1. Instalar a versão N; publicar a N+1 com `just release` (no terminal do Vinicius).
2. App aberto sem o jogo: "Update ready" na barra; "Restart to update" instala e reabre na N+1; a opção da Steam segue
   válida (FR-022, FR-024).
3. Com o jogo aberto: "Update ready" com o botão desativado; sair do app não instala; fechar o jogo e sair instala
   (FR-023).
4. Sem internet: só "Could not check for updates" em Settings (FR-025).
5. Atualizar não mexe na Steam (o desinstalador velho roda com `--updated`).
