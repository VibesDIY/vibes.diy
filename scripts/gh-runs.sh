#!/usr/bin/env bash
#
# gh-runs.sh — slim GitHub Actions workflow-run status.
#
# The GitHub MCP tool `mcp__github__actions_list` (method `list_workflow_runs`)
# returns the raw API payload — full run objects, ~400KB on one line for this
# repo — which blows the agent tool-result token cap and gets spilled to a file
# (see VibesDIY/vibes.diy#2640). This wrapper projects each run down to the
# handful of fields you actually need to answer "did the deploy for commit X
# finish?": name, head_sha, status, conclusion, event, created_at, html_url.
#
# Two modes:
#
#   --from-file <path>   Project an already-fetched payload. No network, no
#                        token — works in EVERY session, including cloud agent
#                        sessions where the MCP result already spilled to a file.
#                        This is the robust path: let the MCP tool spill, then
#                        point this at the spilled file.
#
#   (live fetch)         Hit the API directly. Convenience for local/dev shells
#                        that have a real GitHub auth (gh CLI, or a token that
#                        the org's egress policy permits). In cloud agent
#                        sessions direct REST is gated — you'll get a 403
#                        "GitHub access is not enabled" — use --from-file there.
#
# Usage:
#   scripts/gh-runs.sh --from-file <path>    # project a spilled/saved payload
#   scripts/gh-runs.sh                       # live: latest runs across the repo
#   scripts/gh-runs.sh --branch <branch>     # live: runs for a branch
#   scripts/gh-runs.sh --sha <sha>           # live: runs for a commit sha
#   scripts/gh-runs.sh --per-page <n>        # live: how many runs (default 15)
#   scripts/gh-runs.sh --repo <owner/repo>   # override repo (default: origin remote)
#   scripts/gh-runs.sh --json                # raw slim JSON instead of a table
set -euo pipefail

BRANCH=""
SHA=""
PER_PAGE=15
REPO=""
AS_JSON=0
FROM_FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --from-file) FROM_FILE="${2:-}"; shift 2 ;;
    --branch)    BRANCH="${2:-}"; shift 2 ;;
    --sha)       SHA="${2:-}"; shift 2 ;;
    --per-page)  PER_PAGE="${2:-}"; shift 2 ;;
    --repo)      REPO="${2:-}"; shift 2 ;;
    --json)      AS_JSON=1; shift ;;
    -h|--help)   sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "gh-runs.sh: unknown argument: $1" >&2; exit 64 ;;
  esac
done

# Slim projection, shared by both modes.
render() {
  if [ "$AS_JSON" -eq 1 ]; then
    jq '[.workflow_runs[] | {name, head_sha: (.head_sha[0:8]), status, conclusion, event, created_at, html_url}]'
  else
    jq -r '"\(.total_count) run(s); showing newest first:",
           (.workflow_runs[] |
             "  \(.created_at)  \(.head_sha[0:8])  \(.status)/\(.conclusion // "-")  \(.name)  \(.html_url)")'
  fi
}

# ---- Mode 1: project an already-fetched payload (no network) ----------------
if [ -n "$FROM_FILE" ]; then
  if [ ! -r "$FROM_FILE" ]; then
    echo "gh-runs.sh: cannot read file: $FROM_FILE" >&2
    exit 66
  fi
  render < "$FROM_FILE"
  exit 0
fi

# ---- Mode 2: live fetch (local/dev shells with real GitHub auth) -------------
# Default repo: derive owner/repo from the origin remote, fall back to this repo.
if [ -z "$REPO" ]; then
  origin="$(git config --get remote.origin.url 2>/dev/null || true)"
  REPO="$(printf '%s' "$origin" | sed -E 's#^.*[:/]([^/]+/[^/]+?)(\.git)?$#\1#')"
  [ -z "$REPO" ] && REPO="VibesDIY/vibes.diy"
fi

query="per_page=${PER_PAGE}"
[ -n "$BRANCH" ] && query="${query}&branch=${BRANCH}"
[ -n "$SHA" ]    && query="${query}&head_sha=${SHA}"

# Prefer the gh CLI (handles auth + the org's egress policy); fall back to curl.
resp=""
if command -v gh >/dev/null 2>&1; then
  resp="$(gh api "repos/${REPO}/actions/runs?${query}" 2>/dev/null || true)"
fi
if [ -z "$resp" ]; then
  TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  if [ -z "$TOKEN" ]; then
    echo "gh-runs.sh: no gh CLI and no GH_TOKEN/GITHUB_TOKEN — can't live-fetch." >&2
    echo "  In a cloud agent session, call the MCP tool, let it spill to a file," >&2
    echo "  then: scripts/gh-runs.sh --from-file <that file>" >&2
    exit 69
  fi
  http="$(curl -sS -o /tmp/gh-runs-resp.$$ -w '%{http_code}' \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${REPO}/actions/runs?${query}" || true)"
  resp="$(cat /tmp/gh-runs-resp.$$ 2>/dev/null || true)"
  rm -f /tmp/gh-runs-resp.$$
  if [ "$http" != "200" ]; then
    echo "gh-runs.sh: live fetch failed (HTTP ${http:-?})." >&2
    if printf '%s' "$resp" | grep -q "GitHub access is not enabled"; then
      echo "  This session's direct REST is gated by the org egress policy." >&2
      echo "  Use the MCP tool instead, let it spill to a file, then:" >&2
      echo "    scripts/gh-runs.sh --from-file <that file>" >&2
    fi
    exit 1
  fi
fi

printf '%s' "$resp" | render
