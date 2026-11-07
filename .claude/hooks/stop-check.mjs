#!/usr/bin/env node
// Stop hook: run the project's check command when the working tree changed since the last run.
// On failure, block the stop ONCE (decision "block") so Claude fixes it; if it is still failing on
// the automatic retry (stop_hook_active), let the turn end and warn the human instead of looping.
// Check command = args after the script path, or CLAUDE_CHECK_CMD, e.g. "npm run check" | "just check".
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cmd = process.argv.slice(2).join(' ') || process.env.CLAUDE_CHECK_CMD;
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8')); } catch {}
if (!cmd || input.background_tasks?.length) process.exit(0); // not configured, or work still in flight

// Fingerprint the tree (status + tracked diff + untracked content) to skip Q&A turns and give-ups.
const git = (args, stdin) =>
  spawnSync('git', args, { encoding: 'utf8', input: stdin, maxBuffer: 64 * 1024 * 1024 }).stdout ?? '';
if (git(['rev-parse', '--is-inside-work-tree']).trim() === 'true') { // outside git: always run
  const untracked = git(['-c', 'core.quotePath=false', 'ls-files', '-o', '--exclude-standard']);
  const tree = createHash('sha1')
    .update(git(['status', '--porcelain']) + git(['diff', 'HEAD']) + git(['hash-object', '--stdin-paths'], untracked))
    .digest('hex');
  const stamp = join(tmpdir(), `claude-check-${input.session_id ?? 'default'}`);
  let last = '';
  try { last = readFileSync(stamp, 'utf8'); } catch {}
  if (tree === last) process.exit(0);
  writeFileSync(stamp, tree);
}

const r = spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (r.status === 0) process.exit(0);

const code = r.status ?? 'signal';
const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split(/\r?\n/).slice(-40).join('\n').slice(-4000);
// 127 = command not found under sh. ponytail: cmd.exe reports a missing tool as plain exit 1,
// so on Windows a typo'd check command blocks once, then stop_hook_active ends the turn.
if (code === 127 || input.stop_hook_active) {
  console.log(JSON.stringify({ systemMessage: `\`${cmd}\` falhou (exit ${code}); não vou tentar de novo automaticamente.` }));
  process.exit(0);
}
console.log(JSON.stringify({
  decision: 'block',
  reason: `\`${cmd}\` falhou (exit ${code}). Corrija a causa (sem afrouxar a checagem) e termine.\n${tail}`,
}));
