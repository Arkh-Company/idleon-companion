# justfile — ponto de entrada único: humanos, Claude Code, hooks e CI chamam estes nomes.
# Descoberta: `just --list`. No Windows usa o PowerShell 7 (pwsh).
[windows]
set shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-Command"]

# Sem ANSI = menos tokens; sem telemetria no CodeGraph
export NO_COLOR := "1"
export CODEGRAPH_TELEMETRY := "0"
# PYTHONUTF8 evita UnicodeEncodeError no Windows (o semgrep da receita security também o pede)
export PYTHONUTF8 := "1"

default:
    @just --list

# Dependências travadas (falha se o pnpm-lock.yaml estiver velho, como na CI), .env a partir do exemplo e hooks do git (lefthook)
setup:
    pnpm install --frozen-lockfile
    node -e "const fs = require('node:fs'); if (!fs.existsSync('.env')) fs.copyFileSync('.env.example', '.env')"
    lefthook install

# Índice do CodeGraph: cria na primeira vez, sincroniza nas seguintes
index:
    node -e "process.exit(require('node:fs').existsSync('.codegraph') ? 1 : 0)" && codegraph init --yes || codegraph sync

# Refaz o HTML local dos diagramas do archify a partir dos JSON (specs/*/diagramas/)
diagramas:
    node .claude/scripts/diagramas.mjs

# Ferramentas de IA da comunidade na versão mais nova (princípio 1 do kit), sem hooks
skills-update:
    node .claude/scripts/skills-update.mjs

# Repositório privado no GitHub, configurações, primeiro push da main, o ruleset "kit: main", o workflow semanal e o acesso dos donos do CODEOWNERS, no time, com --dar-acesso (pede a sua confirmação)
github owner *opcao:
    node .claude/scripts/github.mjs {{ if owner =~ '^[A-Za-z0-9][A-Za-z0-9-]*$' { owner } else { error("dono inválido: use o login de uma conta ou organização do GitHub") } }} {{ if opcao == "" { "" } else if opcao == "--dar-acesso" { opcao } else { error("opção inválida: só --dar-acesso") } }}

# App local: longo/interativo, nunca serve como verificação
dev:
    pnpm exec electron-vite dev

# Os *args do test e do test-one vão crus ao `pwsh -Command`, e o settings.json do projeto libera `just test *` e `just test-one *` sem pedir:
# por isso o just aceita, palavra por palavra, só o `-t <nome>` do vitest (o nome de letras, números, `_ . -`, sem
# começar por `-`) e recusa o resto (como no Python). O resto vai direto pelo `pnpm exec vitest run --pool=threads`, que pede
# permissão. O alvo do test-one vai entre aspas, com as aspas dobradas, e não começa por `-` nem `@`, e a regex vai em
# linha em cada `=~` (como no Python).
VITEST_ERRO := "just test e just test-one aceitam só -t <nome>: o resto vai direto pelo pnpm exec vitest run, que pede permissão"
ALVO_ERRO := "o alvo não pode começar por - nem por @ (seria uma opção): use o caminho do arquivo ou o node id"

# --pool=threads, não o padrão forks: no Windows, encerrar os node.exe filhos do forks (um por worker, a cada execução)
# disparou telas azuis 0x153 KERNEL_LOCK_ENTRY_LEAKED_ON_THREAD_TERMINATION (lock do fltmgr.sys preso ao fechar o
# named pipe do worker; bug do Windows, sem correção da Microsoft em 11/2026). Com threads, os workers vivem num processo
# só. Não é otimização opcional: não volte ao forks. Um teste que precise de processo próprio (process.chdir, addon
# nativo) roda à parte com `pnpm exec vitest run --pool=forks <arquivo>`.
test *args:
    pnpm exec vitest run --pool=threads --dir src {{ if args =~ '^(?:-t [A-Za-z0-9_.][A-Za-z0-9_.-]*(?: -t [A-Za-z0-9_.][A-Za-z0-9_.-]*)*)?$' { args } else { error(VITEST_ERRO) } }}

# Um alvo dentro de src/: arquivo ou pasta. Ex.: just test-one src/main.test.ts -t "carrega"
test-one target *args:
    pnpm exec vitest run --pool=threads --dir src '{{ if target =~ '^[-@]' { error(ALVO_ERRO) } else { replace_regex(target, "['\u{2018}-\u{201B}]", "$0$0") } }}' {{ if args =~ '^(?:-t [A-Za-z0-9_.][A-Za-z0-9_.-]*(?: -t [A-Za-z0-9_.][A-Za-z0-9_.-]*)*)?$' { args } else { error(VITEST_ERRO) } }}

# O leitor contra o jogo falso no Edge headless (só no Windows com o Edge): fora do check, porque o Edge não garante
# zero tráfego próprio ao subir. O parâmetro com $ vira variável de ambiente da receita e liga o describe do Edge.
test-edge $IDLEON_EDGE_TESTS="1":
    pnpm exec vitest run --pool=threads --dir src src/keeper/reader.integration.test.ts

# Árvores declaradas sobre o jogo real (spec 010, contracts/real-trees-run.md e gallery.md): só no PC com o jogo, fora
# do check e da CI. Um processo só: nunca duas rodadas juntas (trees, draft ou gallery), nunca em laço (o PC dá tela azul).
# TREES_GAME_DIR, TREES_SNAPSHOT e TREES_OUT vêm do ambiente do terminal: o just não lê o .env. O alvo passa por uma
# regex, como o dono do `github`, e vai entre aspas simples ao pwsh.
TREES_ERRO := "alvo inválido: um id do catálogo ([a-z0-9-], até 80), w1 a w7, character, account, all ou roots"
GALERIA_ERRO := "lote inválido: pilot, w1 a w7, character ou account"

# Conferência real: trava, montagem e checagens de cada número do alvo; `just trees roots` é a sonda das raízes
trees target:
    $env:TREES_TARGET = '{{ if target =~ '^[a-z0-9-]{1,80}$' { target } else { error(TREES_ERRO) } }}'; $env:TREES_MODE = '{{ if target == "roots" { "roots" } else { "check" } }}'; pnpm exec vitest run --pool=threads --dir src --passWithNoTests src/calculator/declared/real-trees.integration.test.ts

# Rascunho das receitas do alvo que ainda não têm receita escrita
draft target:
    $env:TREES_TARGET = '{{ if target =~ '^[a-z0-9-]{1,80}$' { target } else { error(TREES_ERRO) } }}'; $env:TREES_MODE = 'draft'; pnpm exec vitest run --pool=threads --dir src --passWithNoTests src/calculator/declared/real-trees.integration.test.ts

# Galeria de aprovação de um lote: monta a ferramenta em TREES_OUT/gallery-app/ e abre (nunca entra no instalador)
gallery lot:
    pnpm exec vite build --config scripts/gallery/vite.config.ts && pnpm exec electron "$env:TREES_OUT/gallery-app/main.js" '{{ if lot =~ '^(?:pilot|w[1-7]|character|account)$' { lot } else { error(GALERIA_ERRO) } }}'

lint:
    pnpm exec eslint .

fmt:
    pnpm exec prettier --write .

fmt-check:
    pnpm exec prettier --check .

typecheck:
    pnpm exec tsc --noEmit --pretty false

# Segredo no código (gitleaks, com a regra do kit para nomes como key, token e senha): as regras do commit e da CI;
# o .gitleaks-dir.toml estende o .gitleaks.toml só para ignorar os .env locais
secrets:
    gitleaks dir . --config .gitleaks-dir.toml --no-banner --redact -v

# Fronteiras entre os processos (ARCHITECTURE.md): as regras do .dependency-cruiser.cjs
arch:
    pnpm exec depcruise src --config .dependency-cruiser.cjs

# Critério de pronto (Stop hook e CI), do mais rápido ao mais lento
check: fmt-check lint typecheck arch secrets test

# Análise estática com as regras OWASP do semgrep: só aviso, fora do check; busca as regras na rede
security:
    semgrep scan --config p/owasp-top-ten --metrics=off --quiet --json --exclude .claude --exclude .specify --exclude specs | node .claude/scripts/semgrep-tabela.mjs

# Main, guardião, preload e janela pelo electron-vite, em out/
build:
    pnpm exec electron-vite build

# Instalador NSIS por usuário em dist\ (electron-builder), sem publicar
package: build
    pnpm exec electron-builder --win nsis --publish never

# Roda sozinha no job `instalador` do release.yml; à mão, só no terminal do próprio usuário, com o GH_TOKEN dele: a sessão nunca lê nem pede o token (002, research R8)
# O rascunho vem antes: sem ele, cada publicador do electron-builder cria o seu, e a versão sai em dois rascunhos. Um rascunho que já exista (de uma tentativa que falhou) é reaproveitado
# Publica o instalador na release pública Arkh-Company/idleon-companion-releases
release: build
    gh release view "v$(node -p "require('./package.json').version")" --repo Arkh-Company/idleon-companion-releases --json id *> $null || gh release create "v$(node -p "require('./package.json').version")" --repo Arkh-Company/idleon-companion-releases --draft --title "$(node -p "require('./package.json').version")" --notes "IdleOn Companion"
    pnpm exec electron-builder --win nsis --publish always
    gh release edit "v$(node -p "require('./package.json').version")" --repo Arkh-Company/idleon-companion-releases --draft=false --latest

clean:
    node -e "for (const p of ['dist', 'out', 'coverage']) require('node:fs').rmSync(p, { recursive: true, force: true })"
