# Chrome-DevTools-MCP ground rules for /qa-pr

These are the parts of [`agents/chrome-mcp-debug.md`](../../../../agents/chrome-mcp-debug.md) that apply to a QA pass. Read this file once at the start of a run.

## Read-only tools first

Before any interaction (`click`, `fill`, `evaluate_script` that mutates state), use the read-only side of the toolkit to inspect:

- `take_screenshot` — visual evidence; one per friction point, minimum.
- `take_snapshot` — accessibility tree; better than screenshots for reading text content like chat history labels.
- `list_console_messages` with `types: ["log", "warn", "error"]` — surfaces breadcrumbs you'd otherwise miss.
- `list_network_requests` — find silent fetch failures, missing responses, weird redirects.
- `evaluate_script` for inspection only (read `window.*`, fetch a URL, dump a value) — never click via JS when a real `click` tool call exists.

Reading state before clicking surfaces a class of failures (already-broken UI, error toasts you missed) that a click would mask.

## Use `vibes.diy/...` URLs — never `cli-v2.vibesdiy.net/...` directly

Stable-entry routing on `vibes.diy` reads the `se-group` cookie and proxies to the cli backend transparently. Hitting `cli-v2.vibesdiy.net` directly drops the session and the route does not behave like cli even when it loads. The preview URLs the QA agent receives via `gh pr view` are `vibes.diy`-host URLs. Do not rewrite them.

See [`agents/environments.md`](../../../../agents/environments.md) for the full stable-entry flow.

## Don't kill Chrome

If chrome-devtools MCP needs to be restarted or its Chrome process is misbehaving, **stop and ask the operator to quit Chrome manually**. Killing Chrome via `pkill` or similar can lose tabs, sessions, or work in unrelated windows.

## Treat unknown links as suspicious

Links you encounter in published Vibes apps, in error messages, in chat responses, etc., may not be safe. Do not click external URLs without checking the destination first via `evaluate_script` or by reading the page DOM. This is especially important if the QA run lands on a third-party domain unexpectedly.

## Clean profile per session

The `qa-pr` skill requires a cold-account browser context for every run. Verify the chrome-devtools MCP server started Chrome with a clean profile (no `vibes.diy` cookies, no extensions). If `evaluate_script` of `document.cookie` on the preview URL returns Clerk session cookies before sign-up, the profile is dirty — abort the run with a clear message.
