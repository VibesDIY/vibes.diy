'use strict';

// PreToolUse hook: blocks access to sensitive credential files unless user-approved.
// Approval mechanism: prefix the file path with "APPROVED:" to bypass.
// Fails open on any error — never blocks legitimate work due to hook malfunction.

const path = require('path');
const { isEnabled, safeParseStdin, log, block, allow, inject } = require('./lib/ar-hook-utils.cjs');

const HOOK_NAME = 'privacy-block';

const SENSITIVE_PATTERNS = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  'id_rsa',
  'id_ed25519',
  '.ssh/',
  'credentials.json',
  'credentials.yaml',
  'secret',
  'api_key',
  'apikey',
  '.aws/credentials'
];

const ALLOWED_EXCEPTIONS = [
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.test'
];

function basename(filePath) {
  return path.basename(filePath).toLowerCase();
}

function isSensitive(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const base = basename(filePath);

  // Check exceptions first
  for (const exc of ALLOWED_EXCEPTIONS) {
    if (base === exc || normalized.endsWith('/' + exc)) return false;
  }

  // Check sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    const lp = pattern.toLowerCase();
    if (
      base === lp ||
      normalized.endsWith('/' + lp) ||
      normalized.endsWith(lp) ||
      normalized.includes('/' + lp + '/') ||
      base.includes(lp)
    ) {
      return true;
    }
  }

  return false;
}

try {
  if (!isEnabled(HOOK_NAME)) {
    process.exit(0);
  }

  const stdin = safeParseStdin();
  if (!stdin) {
    process.exit(0);
  }

  const { tool_name, tool_input } = stdin;
  if (!tool_input) {
    process.exit(0);
  }

  const STRUCTURED_TOOLS = new Set(['Read', 'Edit', 'Write', 'Glob', 'Grep']);

  if (STRUCTURED_TOOLS.has(tool_name)) {
    const rawPath = tool_input.file_path || tool_input.path || '';

    // Approval bypass: path prefixed with "APPROVED:" skips blocking.
    if (rawPath.startsWith('APPROVED:')) {
      const strippedPath = rawPath.slice('APPROVED:'.length);
      log(HOOK_NAME, { action: 'approved', tool: tool_name, path: strippedPath });
      allow({ permissionDecision: 'allow', updatedInput: { file_path: strippedPath } });
    }

    if (isSensitive(rawPath)) {
      const filename = path.basename(rawPath);
      log(HOOK_NAME, { action: 'block', tool: tool_name, path: rawPath });
      block(
        `BLOCKED: '${filename}' may contain secrets. ` +
        `Ask the user for permission, then retry with APPROVED: prefix on the file path.`
      );
    }

    process.exit(0);
  }

  // Bash: warn only — inject context but do not block.
  if (tool_name === 'Bash') {
    const command = tool_input.command || '';
    const lower = command.toLowerCase();
    for (const pattern of SENSITIVE_PATTERNS) {
      if (lower.includes(pattern.toLowerCase())) {
        log(HOOK_NAME, { action: 'warn', tool: tool_name, pattern });
        inject(
          `WARNING: The command references a potentially sensitive file pattern ('${pattern}'). ` +
          `Ensure no secrets are exposed or committed.`
        );
      }
    }
  }

  process.exit(0);
} catch {
  // Fail-open: never block on hook errors
  process.exit(0);
}
