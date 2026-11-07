# idleon-companion

Desktop companion for Legends of Idleon (Steam): shows live, read-only, where you are and what is open in the game.

## Começando

Requisitos: Git, [mise](https://mise.jdx.dev), que instala as versões fixadas em `mise.toml` (inclusive o `just`), e, no Windows, o PowerShell 7 (as receitas do `just` rodam nele).

```bash
mise trust      # confia no mise.toml deste projeto (só na primeira vez)
mise install    # ferramentas nas versões fixadas
just setup      # dependências travadas e .env a partir do .env.example
just dev        # abre só o app em modo de desenvolvimento, sem o jogo e sem o guardião (a janela diz que não há leitura)
just check      # formatação, lint, tipos, segredos e testes: o mesmo critério da CI
```

`just --list` mostra todas as receitas.

Para jogar com o companion, configure a Steam como em [docs/steam-setup.md](docs/steam-setup.md); como as peças se encaixam está em [ARCHITECTURE.md](ARCHITECTURE.md).

Depois de mudar o `mise.toml`, rode `cd '<pasta do projeto>' && mise lock`: o `mise.lock` guarda as versões e as somas de verificação de cada ferramenta, para o Windows e para o Linux da CI.

## Estrutura

| Pasta  | Conteúdo                                    |
| ------ | ------------------------------------------- |
| `src/` | Código, com os testes ao lado (`*.test.ts`) |

## GitHub

`just github <dono>` cria o repositório privado em `<dono>` (a sua conta ou uma organização), liga as configurações do repositório e o Dependabot, publica a `main` e a protege com um ruleset quando o plano da conta permite. A saída diz se a `main` ficou protegida. Rodar de novo pula o que já está feito.

A CI, em `.github/workflows/ci.yml`, roda no Linux em todo pull request e em todo push na `main`: o `just check`, o gitleaks sobre os commits do PR, a conferência do título do PR (Conventional Commits) e o semgrep, que só avisa. O job `check` é o que o ruleset exige para o merge.

O Dependabot (`.github/dependabot.yml`) abre toda semana os PRs de atualização das dependências e das Actions.

Toda segunda às 6h (e quando você o dispara à mão, em Actions), o `.github/workflows/skills-update.yml` traz as ferramentas de IA da comunidade na versão mais nova, faz a análise de segurança pelo Claude, com o token da sua assinatura, e abre o PR "chore: atualiza as ferramentas de IA da comunidade". Com algum achado `high`, ou sem análise, o PR sai em rascunho e com o rótulo `seguranca-suspeito`. O workflow tenta aprovar a CI do PR; se o PR mostrar "Approve workflows to run", aprove: sem isso a CI do PR não roda e a proteção da `main` segura o merge. O token (o segredo `CLAUDE_CODE_OAUTH_TOKEN`) é você quem grava, no seu terminal, pelos comandos que o `just github` mostra; ele vale um ano, e cada execução gasta um pouco do limite da assinatura. O merge é sempre seu.

## Versões

A cada push na `main`, o `.github/workflows/release.yml` abre ou atualiza o PR de versão, com a versão nova e o `CHANGELOG.md`, pelos títulos dos commits: `feat:` sobe a do meio (0.1.0 vira 0.2.0) e `fix:` a do fim (0.1.0 vira 0.1.1). Antes do 1.0.0, uma mudança que quebra também sobe a do meio; o 1.0.0 sai quando você decide, por um commit com a linha `Release-As: 1.0.0` no corpo. No merge do PR de versão, o workflow cria a tag (`v0.2.0`, por exemplo) e a Release no GitHub. Ele não publica no npm nem no PyPI.

A CI do PR de versão é aprovada pelo próprio workflow; se o PR mostrar "Approve workflows to run", aprove: sem isso a CI do PR não roda e a proteção da `main` segura o merge.

## Para agentes de IA

As regras que valem para qualquer IA ficam em [AGENTS.md](AGENTS.md), e o [CLAUDE.md](CLAUDE.md) as importa e completa com o que é do Claude Code. As permissões e os hooks ficam em `.claude/settings.json`, e os subagentes que o `/implementar` chama, o Executor e o Revisor, em `.claude/agents/`. Os documentos que o agente consulta, como a referência de segurança e o guia do domínio, ficam em [docs/agents/](docs/agents/).

Features novas passam pelo laço de planejamento (brainstorming e Spec Kit, em `specs/`) e terminam no PR da spec; depois do merge dele, o `/implementar` as executa, fase por fase. O `/andamento` mostra onde cada uma está.

Duas skills só leem e propõem: o `/guardiao` mostra as vulnerabilidades com prazo, as falhas repetidas da CI e o workflow semanal; o `/zelador` confere se os documentos ainda batem com o código e só corrige um documento com o seu sim, num branch com PR (a correção em código vai pelo `/implementar`).

As skills da comunidade, em `.claude/skills/`, só mudam pelo workflow semanal `skills-update`: toda segunda, ele traz a versão mais nova, passa o que mudou pela análise de segurança de [docs/agents/revisao-de-ferramentas.md](docs/agents/revisao-de-ferramentas.md) e abre um PR; para rodá-lo fora da segunda, use `gh workflow run skills-update.yml`. A receita `just skills-update` à mão traz o mesmo conteúdo sem a análise.

O checklist antes de lançar fica em [docs/lancamento.md](docs/lancamento.md).

## Licença

Todos os direitos reservados. Veja [LICENSE](LICENSE).
