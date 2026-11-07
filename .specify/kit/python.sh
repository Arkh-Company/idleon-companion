#!/usr/bin/env bash
# Python do próprio `specify` (que traz o PyYAML), apontado pelo SPECKIT_PYTHON_EXECUTABLE do .claude/settings.json.
# Com um preset instalado, os scripts do Spec Kit precisam de um Python com PyYAML, e o do sistema quase nunca o tem.
# Fica num script porque um [env] do mise.toml que chame o `mise` entra em recursão.
raiz=$(mise where pipx:specify-cli) || exit 1
raiz=${raiz//\\//} # no Windows o mise devolve C:\Users\..., e o bash quer C:/Users/...
for python in "$raiz/specify-cli/Scripts/python.exe" "$raiz/specify-cli/bin/python"; do
  [ -f "$python" ] && exec "$python" "$@"
done
echo "python.sh: Python do specify não encontrado em '$raiz/specify-cli' (rode 'mise install')." >&2
exit 1
