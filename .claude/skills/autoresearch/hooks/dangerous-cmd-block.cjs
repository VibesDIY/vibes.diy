'use strict';

// PreToolUse hook: blocks destructive bash commands.
// Regular `git push` is allowed — only force-push variants and hard-destructive ops are blocked.
// Fails open on any error — never blocks legitimate work due to hook malfunction.

const { isEnabled, safeParseStdin, log, block } = require('./lib/ar-hook-utils.cjs');

const HOOK_NAME = 'dangerous-cmd-block';

// Each entry: [substring to match, label for error message]
const BLOCKED_PATTERNS = [
  ['git push --force',  'git push --force'],
  ['git push -f',       'git push -f'],
  ['push --force',      'push --force'],
  ['git reset --hard',  'git reset --hard'],
  ['reset --hard',      'reset --hard'],
  ['git clean -fd',     'git clean -fd'],
  ['git clean -f',      'git clean -f'],
  ['git branch -D',     'git branch -D'],
  ['git checkout .',    'git checkout .'],
  ['git restore .',     'git restore .'],
  ['rm -rf /',          'rm -rf /'],
  ['rm -rf ~',          'rm -rf ~'],
  ['rm -rf .',          'rm -rf .'],
];

try {
  if (!isEnabled(HOOK_NAME)) {
    process.exit(0);
  }

  const stdin = safeParseStdin();
  if (!stdin || stdin.tool_name !== 'Bash') {
    process.exit(0);
  }

  const command = (stdin.tool_input && stdin.tool_input.command) || '';

  for (const [pattern, label] of BLOCKED_PATTERNS) {
    if (command.includes(pattern)) {
      log(HOOK_NAME, { action: 'block', matched: label, command });
      block(
        `BLOCKED: Destructive command detected: '${label}'. ` +
        `This command is blocked for safety during autoresearch sessions.`
      );
    }
  }

  process.exit(0);
} catch {
  // Fail-open: never block on hook errors
  process.exit(0);
}
