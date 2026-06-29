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

## The recipe (three steps)

Always write the storage-state file under `/tmp` (or the session scratchpad),
**never inside the repo** — it holds a live session cookie, and `clerk-authed-shot.mjs`
refuses a repo-local `--storage` path by default for exactly that reason.

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

# 3) Clean up — delete the session file when you're done so reusable
#    session state doesn't linger longer than the task needs it.
rm -f /tmp/state.prod.json
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

## Driving interactions, not just screenshots

`clerk-authed-shot.mjs` only **navigates + screenshots** — it can't click. When a
flow needs interaction (grow the vibe card, open Share, switch handle), write a
small Playwright script that **reuses the same exported `--storage` state**. You
don't need to reverse-engineer the launch options every time — copy them verbatim
from `clerk-authed-shot.mjs`. The load-bearing bits:

- **Resolve Playwright the way the helpers do — don't hardcode a path.** A fresh
  clone has no repo `node_modules`, so Playwright comes from elsewhere (the global
  `lib/node_modules`, `NODE_PATH`, etc.) and the exact location varies by
  environment. Copy `loadChromium()` from `clerk-authed-shot.mjs`: it
  `createRequire`s `playwright` / `playwright-core` across several candidate bases
  (script dir, cwd, the global `…/lib/node_modules`, `NODE_PATH`) and returns the
  first that resolves — robust across cloud and workstation.
- **Cloud launch accommodations** are mandatory (same as the shot/login scripts):
  resolve the cloud Chromium via `/opt/pw-browsers/chromium`, launch headless with
  `proxy: { server: process.env.HTTPS_PROXY }` and
  `args: ["--no-sandbox","--disable-dev-shm-usage","--disable-quic","--ssl-version-max=tls1.2"]`.
  Copy the `resolveCloudChromium()` helper straight out of `clerk-authed-shot.mjs`.
- **Load the session** with `browser.newContext({ storageState: "/tmp/state.prod.json", viewport })`.

**Gotcha — `networkidle` hangs on `/vibe/$owner/$app` card routes.** Some vibes keep
a long-lived connection open, so the page never reaches `networkidle` and
`page.goto(url, { waitUntil: "networkidle" })` times out at 60s (observed on
`/vibe/garden-gnome/to-do`; `bouncing-div` was fine). For `/vibe/` routes use
`waitUntil: "domcontentloaded"` + an explicit `waitForTimeout` settle instead.
`clerk-authed-shot.mjs` itself uses `networkidle`, so a card route may screenshot
empty/timeout there — drive it from your own script with `domcontentloaded`.

**Gotcha — driving the interactive `vibes-diy login` CA callback.** If you need
the authed browser to complete a real device-cert enrollment (not just
screenshot), the `http://localhost:<port>/cert` callback the CLI waits on is
**routed through the agent proxy** (which rejects plain-HTTP) even with
`proxy.bypass` set — intercept it with `context.route()` and service it via a
direct Node `http.get`. Full recipe + the 5s-redirect-timer gotcha:
[identity-ship-verify.md § Step 3](identity-ship-verify.md#step-3--interactive-vibes-diy-login-headlessly-the-real-ca-callback-enroll-write).

**Unified vibe card selectors** (the merged agent-in-vibe surface, #2676/#2680) —
these are the stable `aria-label`s, found in `vibes.diy/base/components/UnifiedVibeCard.tsx`:

| Element                  | Selector                                                               |
| ------------------------ | ---------------------------------------------------------------------- |
| Grow / collapse the card | `[aria-label="Open vibe menu"]` / `[aria-label="Close vibe menu"]`     |
| Bottom nav               | `[aria-label="Home"]` · `[aria-label="Edit"]` · `[aria-label="Share"]` |
| Handle picker (▾)        | `[aria-label="Switch handle"]`                                         |
| Draft badge (#2772)      | `[aria-label="Draft — unpublished changes"]`                           |

Note: `data-vibe-switch` belongs to the **embeddable package/control surface**
(e.g. `vibes.diy/api/pkg/react/components/vibes-control.tsx`,
`vibes.diy/pkg/slack/serve/vibe-controls.tsx`, and
`vibes.diy/pkg/public/vibes-controls/`), **not** the `UnifiedVibeCard` app surface
— don't target it for app-surface QA.

## Two accounts at once (owner A + non-owner B)

Some flows need a **second** identity — non-owner "make it yours" fork, the
share-roster seen as a granted member vs the owner, attribution as a different
handle. The login tool already does this; no new tooling required.
`clerk-qa-login.mjs` mints with the **instance admin secret**, so it resolves
**whatever** identity you pass via `--email` / `--user-id` — it does _not_ have to
be your git identity (this repo's git email is `noreply@anthropic.com`, yet
`--email jchris@gmail.com` logs in as that Clerk user). So "account B" is simply a
second run with a different `--email` and its **own** `--storage` file:

```bash
# Account A (owner)
node .claude/skills/qa-pr/scripts/clerk-qa-login.mjs --instance prod --origin https://vibes.diy \
  --email <A@email> --storage /tmp/state.A.json
# Account B (non-owner)
node .claude/skills/qa-pr/scripts/clerk-qa-login.mjs --instance prod --origin https://vibes.diy \
  --email <B@email> --storage /tmp/state.B.json
```

Each file holds that account's session cookie — confirm `"PASS": true` with the
expected `authed.clerkUserId` for **each**. Then drive them independently: **one
Playwright context per storage file**. Two contexts in the same browser keep
separate cookie jars, so A and B stay signed in **simultaneously** — exactly what
owner-vs-non-owner and roster flows need:

```js
const ctxA = await browser.newContext({ storageState: "/tmp/state.A.json", viewport });
const ctxB = await browser.newContext({ storageState: "/tmp/state.B.json", viewport });
const pageA = await ctxA.newPage(); // owner: opens /vibe/<A>/<app>
const pageB = await ctxB.newPage(); // non-owner: opens the same vibe, taps a chip → forks to B
```

(Or just run `clerk-authed-shot.mjs` / your driver twice, once per `--storage`.)
Clean up **both** files when done: `rm -f /tmp/state.A.json /tmp/state.B.json`.

**Designated QA pair (prod).** Use **`jchris@gmail.com`** as account A (owner) and
**`jchris@vibes.diy`** as account B (the non-owner / second user) — both are
jchris's own accounts, kept for this purpose. They resolve to **two distinct Clerk
users**, so they exercise the real owner-vs-non-owner split.

> **Verified** (this is the smoke test to repeat): two logins into separate
> `--storage` files, then two contexts loaded together, returned both signed in at
> once with **different** `clerkUserId`s —
> `jchris@gmail.com` → `user_35qT44…F2V30` (A) and
> `jchris@vibes.diy` → `user_35qSx4…T4I7f` (B). `bothSignedIn: true`.

**Don't borrow real third parties.** The admin secret _can_ mint a token for any
user, but only log in as identities you're authorized to drive (the pair above, or
your own alt). Do **not** enumerate the Clerk user directory to find an account.

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
  `<iframe>`. Screenshot too early and you capture the empty shell. The preview
  iframe is **cross-origin** to the editor (`<app>--<owner>.<host>`), so you
  can't read it from the editor page — the script waits on the app's own child
  frame via Playwright's frame API until its body has content (`--no-iframe-wait`
  opts out for non-app pages).
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
  under `/tmp` (or the session scratchpad), not into the repo — `clerk-authed-shot.mjs`
  refuses a repo-local `--storage` path by default (`--allow-repo-path` to override),
  and **`rm -f` it when the task is done** so reusable session state doesn't linger.
- Screenshots of the operator's own signed-in UI are fine to surface (they own the
  account); a screenshot must never frame a token, cookie value, or secret.
