# Updates come from a public releases-only repository, unsigned, and never install with the game open

The app (never the keeper, the reader or the game) checks `Arkh-Company/idleon-companion-releases` over HTTPS with
electron-updater, downloads in the background and checks the published sha512; the code stays private. The hash only
catches a corrupt download: whoever controls that repository can ship code to every friend. That risk is accepted, with
2FA on the publishing GitHub account (Vinicius, 07/11), and allowed by the constitution's amendment 1.1.0.

## Considered Options

- **Sign each release with an own key checked by the app.** Rejected for now: a key to keep and a step per release, for
  a few friends.
- **Squirrel with update.electronjs.org.** Rejected: versioned folders and a stub would make Steam track a process other
  than the keeper.

## Consequences

An update installs only with the game closed (the keeper is the same executable). The release is published by a local
`just release` with the token in Vinicius's own terminal.
