#!/usr/bin/env node
// PostToolUse hook (matcher "Edit|Write"): run the project's formatter on the file Claude just edited.
// Never blocks. Formatter = args after the script path, or CLAUDE_FORMAT_CMD, e.g.
//   "npx --no-install prettier --write --ignore-unknown" | "ruff format" | "gofmt -w" | "just fmt"
// Optional first arg --only=.py,.pyi (extensions, case-insensitive): any other file is left alone. For formatters
// without prettier's --ignore-unknown: `ruff format` would reformat a .json or .env file as if it were Python.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const only = args[0]?.startsWith('--only=')
  ? args.shift().replace('--only=', '').toLowerCase().split(',').filter(Boolean) // an empty entry would match any file
  : null;
const fmt = args.join(' ') || process.env.CLAUDE_FORMAT_CMD;
let file = '';
try { file = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path ?? ''; } catch {}
if (!fmt || !file) process.exit(0);
if (only && !only.some((ext) => file.toLowerCase().endsWith(ext))) process.exit(0);

// The path travels in an env var instead of being spliced into the command line,
// so a file named like `a$(rm -rf x).ts` cannot inject shell code.
const ref = process.platform === 'win32' ? '"%CLAUDE_HOOK_FILE%"' : '"$CLAUDE_HOOK_FILE"';
spawnSync(`${fmt} ${ref}`, {
  shell: true, // needed on Windows for npx/.cmd shims
  stdio: 'ignore',
  timeout: 30_000,
  env: { ...process.env, CLAUDE_HOOK_FILE: file },
});
process.exit(0); // ponytail: formatting is best-effort; real errors surface in the Stop-hook check
