# Iterating on vibes.diy: local dev → cli deploy → MCP validation

How to drive a feature/perf/bug change from your laptop, through a `@c` (cli) deploy, and validate it with Chrome DevTools MCP. Cross-references [chrome-mcp-debug.md](chrome-mcp-debug.md) (the bug-reproduction loop), [deploy-tags.md](deploy-tags.md) (tag conventions), and [dev-state.md](dev-state.md) (what's safe to wipe).

## Local dev

```bash
cd vibes.diy/pkg
NODE_OPTIONS="--max-old-space-size=12288" pnpm dev
```

12 GB heap because the default ~1.5 GB OOMs during Vite's optimizeDeps pass. Wait for `Local: https://localhost.vibesdiy.net:8888/` then point the browser there.

URLs in local dev:

| Surface                                                        | URL                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| Main app (vibes.diy equivalent)                                | `https://localhost.vibesdiy.net:8888`                           |
| Viewer route                                                   | `https://localhost.vibesdiy.net:8888/vibe/<userSlug>/<appSlug>` |
| Iframe sandbox origin                                          | `https://<appSlug>--<userSlug>.localhost.vibesdiy.net:8888`     |
| Stable-entry override (per [environments.md](environments.md)) | `localhost.vibesdiy.net:8888/@stable-entry/`                    |

`localhost.vibesdiy.net` resolves to 127.0.0.1 in DNS — that's how cookies and SameSite work for the iframe sandbox subdomain. The cert is self-signed (vite-plugin-mkcert) and trusted automatically once you accept it the first time. SSR + HMR both work over https.

When edits in `vibes.diy/api/svc/...` (server-only paths) don't take effect: kill the PID on :8888 and restart. Vite HMR doesn't pick up the SSR module cache. See [dev-state.md](dev-state.md#restarting-the-dev-server) for the exact command.

When an importmap change doesn't propagate: `rm -rf vibes.diy/pkg/node_modules/.vite/` and restart. **Never** `rm -rf .wrangler/state/` — that wipes local D1 and your dev apps.

## cli deploy loop

`vibes-diy@c*` deploys to `cli-v2.vibesdiy.net`, which is an **exact clone of prod** ([environments.md](environments.md#cli-is-a-prod-clone)) and is what `vibes.diy/vibe/...` proxies to. So `vibes.diy/vibe/<u>/<a>` exercises the cli build for viewer routes.

### 1. Pick the next c-tag

```bash
git tag -l 'vibes-diy@c*' --sort=-version:refname | head -5
```

Bump the patch (`c2.2.17` → `c2.2.18`). Treat tags as immutable — never reuse, even after a screw-up.

### 2. Pre-commit gate

```bash
cd /Users/jchris/code/fp/vibes.diy/vibes.diy
time pnpm check > /tmp/pnpm-check.log 2>&1
grep -E "Test Files|Tests +[0-9]+ passed|FAIL " /tmp/pnpm-check.log | tail -5
```

The chromium runner and api-tests setup hooks are documented flakes — see [flaky-tests.md](flaky-tests.md). Re-run once if you see them; don't block commits when the same tests fail across runs and pass in isolation.

```bash
# Format ALL changed files. CI runs prettier --check.
git diff --name-only HEAD | grep -E '\.(ts|tsx|md)$' | xargs npx prettier --write
```

### 3. Commit + tag + push

```bash
git add -A
git commit -m "<scope>: <change>"

git push origin <your-branch>

git tag -a vibes-diy@c2.2.X HEAD -m "c2.2.X: <one-line summary>"
git push origin vibes-diy@c2.2.X
```

`c*` tags do **not** require explicit user confirmation. `p*` (prod) tags do — see [deploy-tags.md](deploy-tags.md).

### 4. Wait for CI to actually deploy — DO NOT `say` until this returns

```bash
until gh run list --limit 5 --json status,conclusion,headBranch \
  --jq '.[] | select(.headBranch == "vibes-diy@c2.2.X") | .status' \
  | grep -q "completed"; do sleep 30; done
gh run list --limit 5 --json status,conclusion,headBranch,createdAt \
  --jq '.[] | select(.headBranch == "vibes-diy@c2.2.X") | "\(.createdAt[11:19]) \(.status) \(.conclusion)"'
```

Run via `Bash` with `run_in_background: true` so you don't block on it. The notification fires when CI finishes.

Only after `completed success`:

```bash
echo 'cli c two two X deployed' | say
```

`say` is a completion signal — never run it after `git push`. See [deploy-tags.md](deploy-tags.md#say-notification).

## Validation with Chrome DevTools MCP

The chrome MCP is keyed to the user's chrome profile — they're logged in to vibes.diy with cookies set. Drive **vibes.diy/vibe/...**, not `cli-v2.vibesdiy.net` directly: `vibes.diy` proxies to cli, and the cookies live on `vibes.diy`.

### Navigate

```
mcp__chrome-devtools__list_pages           # see what's open
mcp__chrome-devtools__navigate_page         # url=, type="url"
mcp__chrome-devtools__navigate_page         # type="reload", ignoreCache=true to bust
```

Prefer `navigate_page` over `new_page` — it keeps the user's tab and session.

### Inspect what's actually rendered

```
mcp__chrome-devtools__take_screenshot                    # visual confirmation
mcp__chrome-devtools__take_snapshot                      # a11y tree, better for text content
mcp__chrome-devtools__list_console_messages              # types: ["log", "warn", "error"]
mcp__chrome-devtools__list_network_requests              # everything; filter via resourceTypes
mcp__chrome-devtools__evaluate_script                    # `() => window.__featureDebug` etc.
```

For SSR-rendered shapes (e.g. confirming `<iframe src=...>` shipped in the first byte), `curl -s <url> | grep -oE '<iframe[^>]*>'` is faster than running MCP — just hit the URL directly.

For loader data baked into HTML, `evaluate_script` with a function that returns `performance.getEntries()` gets you timing without a HAR export.

### Capture a HAR-equivalent

The user can export HAR from DevTools and drop it at `/tmp/fastN.har`. Parse with `jq`:

```bash
# WS upgrade timing
jq '.log.entries[] | select(.request.url | test("wss://")) | {url:.request.url, time:.time, started:.startedDateTime, firstSend:._webSocketMessages[0].time}' /tmp/fastN.har

# All requests in a window
jq -r '.log.entries | sort_by(.startedDateTime) | .[] | select(.startedDateTime as $t | ($t >= "<from>" and $t <= "<to>")) | "\(.startedDateTime[14:23]) \(.time)ms \(.response.status) \(.request.method) \(.request.url)"' /tmp/fastN.har
```

## Tailing the cli worker

Use this when you've added log markers to the deployed code:

```bash
pkill -f "wrangler tail vibes-diy-v2-cli" 2>/dev/null
sleep 1
rm -f /tmp/wsperf-tail.log
pnpm exec wrangler tail vibes-diy-v2-cli --format pretty --search '<your-prefix>' \
  > /tmp/wsperf-tail.log 2>&1 &
until grep -q "Connected to" /tmp/wsperf-tail.log; do sleep 1; done
```

Tail dies on every deploy with `Error: This script has been upgraded` — restart it and continue. Use `Monitor` with `tail -f /tmp/wsperf-tail.log | grep --line-buffered -E '<pattern>'` to stream events into the conversation.

## Cleanup

After the loop:

1. Remove temporary `console.log` markers and `window.__*Debug` writers (keep only what ships).
2. Run `pnpm check` again.
3. Tag and deploy a cleanup `c*` (`c2.2.Y`).
4. Wait for CI completion. **Then** `say`.

## End-to-end: a complete iteration in commands

```bash
# 1. Make changes locally, test in pnpm dev at https://localhost.vibesdiy.net:8888
# 2. Pre-commit
cd /Users/jchris/code/fp/vibes.diy/vibes.diy
git diff --name-only HEAD | grep -E '\.(ts|tsx|md)$' | xargs npx prettier --write
time pnpm check > /tmp/pnpm-check.log 2>&1
# 3. Commit, tag, push
git add -A && git commit -m "<msg>"
git push origin <branch>
git tag -a vibes-diy@c2.2.X HEAD -m "c2.2.X: <summary>"
git push origin vibes-diy@c2.2.X
# 4. Wait for CI (run in background, get notified)
until gh run list --limit 5 --json status,conclusion,headBranch \
  --jq '.[] | select(.headBranch == "vibes-diy@c2.2.X") | .status' \
  | grep -q "completed"; do sleep 30; done
# 5. Validate via MCP — navigate to https://vibes.diy/vibe/<u>/<a>, screenshot, network, etc.
# 6. Only after CI completed success:
echo 'cli c two two X deployed' | say
```
