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
    node --watch src/main.ts

# Os *args do test e do test-one vão crus ao `pwsh -Command`, e o settings.json do projeto libera `just test *` e `just test-one *` sem pedir:
# por isso o just aceita, palavra por palavra, só o `-t <nome>` do vitest (o nome de letras, números, `_ . -`, sem
# começar por `-`) e recusa o resto (como no Python). O resto vai direto pelo `pnpm exec vitest run`, que pede
# permissão. O alvo do test-one vai entre aspas, com as aspas dobradas, e não começa por `-` nem `@`, e a regex vai em
# linha em cada `=~` (como no Python).
VITEST_ERRO := "just test e just test-one aceitam só -t <nome>: o resto vai direto pelo pnpm exec vitest run, que pede permissão"
ALVO_ERRO := "o alvo não pode começar por - nem por @ (seria uma opção): use o caminho do arquivo ou o node id"

test *args:
    pnpm exec vitest run --dir src {{ if args =~ '^(?:-t [A-Za-z0-9_.][A-Za-z0-9_.-]*(?: -t [A-Za-z0-9_.][A-Za-z0-9_.-]*)*)?$' { args } else { error(VITEST_ERRO) } }}

# Um alvo dentro de src/: arquivo ou pasta. Ex.: just test-one src/main.test.ts -t "carrega"
test-one target *args:
    pnpm exec vitest run --dir src '{{ if target =~ '^[-@]' { error(ALVO_ERRO) } else { replace_regex(target, "['\u{2018}-\u{201B}]", "$0$0") } }}' {{ if args =~ '^(?:-t [A-Za-z0-9_.][A-Za-z0-9_.-]*(?: -t [A-Za-z0-9_.][A-Za-z0-9_.-]*)*)?$' { args } else { error(VITEST_ERRO) } }}

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

# Critério de pronto (Stop hook e CI), do mais rápido ao mais lento
check: fmt-check lint typecheck secrets test

# Análise estática com as regras OWASP do semgrep: só aviso, fora do check; busca as regras na rede
security:
    semgrep scan --config p/owasp-top-ten --metrics=off --quiet --json --exclude .claude --exclude .specify --exclude specs | node .claude/scripts/semgrep-tabela.mjs

build:
    pnpm exec tsc -p tsconfig.build.json

clean:
    node -e "for (const p of ['dist', 'coverage']) require('node:fs').rmSync(p, { recursive: true, force: true })"
