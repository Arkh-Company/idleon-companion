# Data Model: install-and-setup (002)

## SteamSetupRecord — `%APPDATA%\IdleOn Companion\steam-setup.json`

Escrito só pelo app (e pelo modo `--remove-from-steam`), por arquivo temporário + `rename`. Inválido → tratado como
vazio, e o arquivo vai para `steam-setup.json.bad` (o mesmo padrão do `names.json`).

```ts
type SteamSetupFile = {
  accounts: Record<string /* accountId32, só dígitos */, SteamSetupRecord>;
};
type SteamSetupRecord = {
  inserted: string;      // o texto exato que o companion acrescentou (ex.: '"C:\\…\\IdleOn Companion.exe" --keeper ')
  before: string;        // a opção como estava antes da primeira configuração ("" quando vazia), para "Details"
  backupFile: string;    // caminho da cópia do localconfig.vdf de antes do companion
  setAt: number;         // ms desde 1970, da última configuração
};
```

- Nenhum nome de conta (FR-028): só o id numérico de 32 bits, a pasta `userdata\<id>`.
- `inserted` é o que "Remove from Steam" tira; uma conta sai do arquivo quando a remoção termina.
- `backupFile` aponta para `steam-backup\<id>-localconfig.vdf`, criado uma vez e nunca sobrescrito (FR-027).

## SteamState — o que a tela de configuração mostra (main → janela)

```ts
type SteamState = {
  steam: "found" | "not-found";
  account: { id: string; name: string } | null; // name: PersonaName lido na hora, nunca gravado
  game: "installed" | "not-installed";
  option: {
    current: string;      // texto atual da opção ("" quando vazia)
    next: string;         // o texto depois de acrescentar a parte do companion
    state: "not-set" | "companion" | "other";
    consoleScript: boolean; // o texto do usuário tem .cmd/.bat antes de %command% (aviso)
  } | null;               // null quando a Steam, a conta ou o arquivo não puderem ser lidos
  configured: boolean;    // a conta mais recente tem a parte do companion
  gameOpen: boolean;      // FR-014
  error?: string;         // arquivo ilegível ou formato inesperado (nada é gravado)
  details: { file: string; backup: string } | null;
  manualOption: string; // a parte do companion seguida de %command%, para colar à mão (Edge Cases, FR-011)
};
```

Regras: `option.state = "companion"` quando o texto atual contém a parte do companion (então `configured`); `"other"`
quando não está vazio e não a contém; `"not-set"` quando vazio.

## SetupProgress — passos do fluxo (main → janela)

`"closing-steam" → "setting-up" → "opening-steam" → "done"`, ou `"failed"` com `reason`:
`"game-open" | "steam-did-not-close" | "unreadable-config" | "steam-did-not-open"`. Só `"steam-did-not-open"` vem
depois da gravação (a configuração está feita; a tela pede para abrir a Steam à mão).

## Status (elo e janela) — muda

```ts
interface Status {
  game: "running" | "closed" | "not-launched";
  reader: "attached" | "connecting" | "error" | "released"; // NOVO: "released" depois de "Let the game close"
  message?: string;
  lastReadingAt?: number;
}
```

Transições do leitor (ver `diagramas/ciclo-de-vida`): `connecting → attached`; `attached → released` (release);
`released → connecting → attached` (reconnect, uma pausa); qualquer → `error` como na 001; o jogo fechar leva o
status a `game: "closed"`.

## UpdateState — main → janela

```ts
type UpdateState =
  | { state: "none" }
  | { state: "downloading"; version: string }
  | { state: "ready"; version: string; canInstall: boolean } // canInstall falso com o jogo aberto
  | { state: "check-failed" };                                // só a linha em Settings
```

## Opção de inicialização

Texto livre da Steam. Parte do companion: `"<exe>" --keeper ` antes de `%command%` (desenvolvimento:
`"<electron.exe>" "<repo>" --keeper `). Regras de acrescentar e tirar em [research.md](research.md) R5.
