"use strict";

// PreToolUse hook: redirects the bloated GitHub MCP `actions_list` calls to the
// slim `scripts/gh-runs.sh` wrapper.
//
// `mcp__github__actions_list` with method `list_workflow_runs` returns the raw
// API payload (~400KB on one line for this repo), which exceeds the agent
// tool-result token cap and gets spilled to a file — see VibesDIY/vibes.diy#2640.
// We can't add field projection to GitHub's MCP server, so instead we deny the
// call and the deny reason names the exact alternative command to run. The
// reason text is fed straight back to the agent, so this is self-documenting at
// the call site — no reliance on anyone having read the docs.
//
// Fails open on any error — never blocks legitimate work due to hook malfunction.

const { isEnabled, safeParseStdin, log, block } = require("./lib/ar-hook-utils.cjs");

const HOOK_NAME = "actions-list-redirect";

// Methods of `actions_list` whose raw payload blows the token cap. Keep this
// tight: only the bloated list methods, so status checks via the wrapper while
// every other `actions_list` method stays available.
const BLOCKED_METHODS = new Set(["list_workflow_runs"]);

// Single-quote a value for inclusion in a shell command, so branch/repo names
// with metacharacters (spaces, &, #, /) stay one argument when copy-pasted.
function shquote(v) {
  return `'${String(v).replace(/'/g, `'\\''`)}'`;
}

function redirectMessage(input) {
  const branch = input && (input.branch || input.head_branch);
  const sha = input && input.head_sha;
  const repo = input && input.owner && input.repo ? `${input.owner}/${input.repo}` : null;
  let live = "scripts/gh-runs.sh";
  if (sha) {
    live += ` --sha ${shquote(sha)}`;
  } else if (branch) {
    live += ` --branch ${shquote(branch)}`;
  }
  // If the blocked call targeted a specific repo, carry it into the suggestion.
  if (repo) {
    live += ` --repo ${shquote(repo)}`;
  }
  return (
    `BLOCKED: mcp__github__actions_list(method: "list_workflow_runs") returns the raw ` +
    `~400KB API payload and blows the tool-result token cap (VibesDIY/vibes.diy#2640). ` +
    `Get the same data slim (name, head_sha, status, conclusion, event, created_at, ` +
    `html_url) via scripts/gh-runs.sh — two ways depending on your session:\n\n` +
    `1. Cloud agent session (live fetch may be policy-gated or unavailable — no gh ` +
    `   CLI, and direct REST is often blocked by org egress policy; the common case ` +
    `   here): you cannot avoid the raw fetch, so contain it. Either delegate this ` +
    `   call to a subagent that returns only those fields, OR call the MCP tool, let ` +
    `   the ~400KB result spill to a file, then project it with:\n` +
    `       scripts/gh-runs.sh --from-file <spilled-file-path>\n` +
    `   (No token needed — pure jq over the saved payload. Add --json for JSON.)\n\n` +
    `2. Local/dev shell with real GitHub auth (gh CLI or a permitted token):\n` +
    `       ${live}\n` +
    `   Flags: --branch <b> | --sha <s> | --per-page <n> | --repo <owner/repo> | --json.\n\n` +
    `For a single field, or a method this hook doesn't cover, use the GitHub MCP read tools directly.`
  );
}

try {
  if (!isEnabled(HOOK_NAME)) {
    process.exit(0);
  }

  const stdin = safeParseStdin();
  if (!stdin || stdin.tool_name !== "mcp__github__actions_list") {
    process.exit(0);
  }

  const input = stdin.tool_input || {};
  const method = input.method || "";

  if (BLOCKED_METHODS.has(method)) {
    log(HOOK_NAME, { action: "block", method });
    block(redirectMessage(input));
  }

  process.exit(0);
} catch {
  // Fail-open: never block on hook errors
  process.exit(0);
}
