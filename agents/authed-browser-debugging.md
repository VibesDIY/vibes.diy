# Authenticated browser debugging & screenshots (cloud sessions)

How to drive a **logged-in** Vibes browser for ad-hoc debugging and screenshots
in a cloud session — outside the full [`qa-pr`](../.claude/skills/qa-pr/SKILL.md)
spine. The login mechanism is the same Clerk sign-in-token flow qa-pr uses
(verified end-to-end on both instances); this doc is the short, reusable recipe
for "sign in as the operator, open some authed URLs, grab screenshots."

> **Unauthenticated** pages (homepage, pre-auth build form) need none of this —
> just use the `mcp__chrome-devtools__*` tools directly (see
> [`chrome-mcp-debug.md`](chrome-mcp-debug.md)). This doc is only for surfaces
> behind sign-in.

## The recipe (two steps)

```bash
# 1) Authenticate and EXPORT the session to a storage-state file.
#    Token is minted + consumed in-process; only the session cookie lands in the file.
node .claude/skills/qa-pr/scripts/clerk-qa-login.mjs \
  --instance prod --origin https://vibes.diy --email <operator@email> \
  --storage /tmp/state.prod.json
#    → confirm "PASS": true with a non-null authed.clerkUserId before continuing.

# 2) Open authed URLs and screenshot them, reusing that session.
node .claude/skills/qa-pr/scripts/clerk-authed-shot.mjs \
  --storage /tmp/state.prod.json --out /tmp/shots \
  https://vibes.diy/chat/<handle>/<slug> \
  https://vibes.diy/chat/<handle>/<other-slug>
```

`clerk-authed-shot.mjs` loads the storage state into a fresh Playwright context,
self-applies the cloud Chromium + proxy + TLS-1.2 + `--no-sandbox` accommodations
(same as `clerk-qa-login.mjs`; see [`cloud-browser-setup.md`](cloud-browser-setup.md)),
waits for the app `<iframe>` to actually paint, screenshots each URL, and prints
**non-secret** evidence per shot (`finalUrl`, `signedInEmail`, `iframeReady`, the
shot path). Flags: `--mobile` (390×844), `--viewport WxH`, `--full` (full page),
`--no-iframe-wait` (non-app pages), `--settle <ms>`.

**Instance discipline** (a token minted on the wrong instance won't activate),
same as everywhere: `--instance prod` (`CLERK_SECRET_KEY`, `clerk.vibes.diy`)
for `vibes.diy` / `prod-v2` / `cli-v2`; `--instance preview`
(`CLERK_SECRET_KEY_PREVIEW`, `*.clerk.accounts.dev`) for `dev-v2.vibesdiy.net`
and `pr-*.workers.dev` previews.

## Why a Playwright script and not the chrome-devtools MCP browser

You can authenticate the browser `clerk-qa-login.mjs` itself drives, but you
**cannot** attach the session to the chrome-devtools MCP's own Chrome. That Chrome
is launched with `--remote-debugging-pipe` (a file-descriptor transport), **not a
TCP `--remote-debugging-port`** — so there is no CDP URL to give
`clerk-qa-login.mjs --cdp`. (`--cdp` works only against a Chrome that exposes a
real `http://127.0.0.1:<port>` CDP endpoint.) Verify for yourself:

```bash
ps aux | grep -i '[c]hrome' | grep -oE '\-\-remote-debugging-(port|pipe)[^ ]*'
# → --remote-debugging-pipe   (no port = nothing to attach to)
```

So for authenticated work the storage-state → Playwright path above is the
reliable mechanism. (Wiring the MCP Chrome with a CDP port so the MCP spine
attaches directly is a tracked follow-up; until then, screenshot via the script.)

## Gotchas learned the hard way

- **Route-nav beats clicking sidebar cards.** Navigate straight to
  `/chat/<handle>/<slug>` rather than opening the "My Apps" sidebar and clicking
  an app card. The card → right-side preview → **ENTER** path is finicky: the
  preview panel can stay stuck on a default app, so clicking "Chord Explorer" and
  hitting ENTER opened the wrong vibe. The sidebar just lists these same
  `/chat/...` URLs, so route-nav reaches the identical editor deterministically.
- **Wait for the app iframe to paint, or you get blank shots.** Right after the
  editor route loads, the App pane shows a placeholder ("Make apps with your
  friends / Shareable in seconds") before the generated app renders in its
  `<iframe>`. Screenshot too early and you capture the empty shell. The script
  polls the iframe body until it has content (`--no-iframe-wait` opts out for
  non-app pages).
- **Email lookup, not git identity.** The operator's git email is often a
  non-Clerk address, so pass `--email` (or `--user-id`) explicitly to
  `clerk-qa-login.mjs` — don't rely on `git config user.email`.

## Security — non-negotiable

- The minted sign-in token never leaves `clerk-qa-login.mjs`'s process (minted →
  passed to the page as a function argument → consumed). Never try to print it;
  the harness will (correctly) block it.
- The **storage-state file holds a live session cookie** — treat it as the secret
  it is. Never print, echo, `cat`, commit, or paste its contents into a log,
  triage, gist, or PR comment. Use it only as a file input to the script. Write it
  under `/tmp` (or the session scratchpad), not into the repo.
- Screenshots of the operator's own signed-in UI are fine to surface (they own the
  account); a screenshot must never frame a token, cookie value, or secret.
