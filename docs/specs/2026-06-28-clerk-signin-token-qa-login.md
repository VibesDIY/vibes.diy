# Spec: headless qa-pr login via Clerk sign-in tokens

**Status:** verified end-to-end (2026-06-28, prod + preview) — see _Implementation status_.
**Goal:** let the `qa-pr` agent log into the vibes.diy web app as a real user in an
unattended cloud session — so the authenticated spine (generate → edit → publish →
remix) runs in the cloud — **with no app code changes**.

**Supersedes** the device-id browser-login approach (PR #2779, closed). That path
worked but required a parallel in-app auth path + a ~25-file Clerk→adapter
migration. This approach logs in **through Clerk itself**, so the app stays
pure-Clerk and the entire mechanism lives in the `qa-pr` skill.

## Why this, not device-id

The device-id design existed because there was no `CLERK_SECRET_KEY` _in the repo_.
But the Clerk instance owner can hand the secret to the qa-pr **harness** (cloud
session env only, never committed — same model as `VIBES_DEVICE_ID`). With the
secret available, Clerk's own **sign-in tokens** are the native, supported way to
do exactly this, and they win on the two things that matter:

- **Fidelity:** the agent gets a _real Clerk session_ — identical to what a real
  user has — so qa-pr exercises the actual production auth path, not a bespoke one
  that could drift.
- **Maintenance:** zero app surface. No adapter, no `getToken`/`getTokenClaims`
  branches, no `<AuthSignedIn>` wrappers. The app only ever knows Clerk.

## Mechanism

[Clerk sign-in tokens](https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token) plus the ticket strategy. Two steps, both harness-side:

### 1. Mint (backend, needs the secret)

A dependency-free Node script (`scripts/clerk-signin-token.mjs`) calls the Clerk
Backend API with the secret for the **target instance**, selected by `--instance`:

- `--instance prod` (default) → `CLERK_SECRET_KEY` (prod Clerk `clerk.vibes.diy` /
  `pk_live`, serving `vibes.diy`, `prod-v2`, **and `cli-v2`** — cli is an exact prod
  clone, same Clerk)
- `--instance preview` → `CLERK_SECRET_KEY_PREVIEW` (dev/preview Clerk
  `*.clerk.accounts.dev` / `pk_test`, serving `dev-v2.vibesdiy.net` and the
  `pr-*.workers.dev` previews; falls back to `CLERK_SECRET_KEY` if the preview var
  is unset). **cli is _not_ on this instance** — see the correction below.

Then:

1. Resolve the user: `GET https://api.clerk.com/v1/users?email_address=<email>`
   (email defaults to `git config user.email`) → `userId`. (Or pass `--user-id`.)
2. Mint: `POST https://api.clerk.com/v1/sign_in_tokens` `{ user_id }` → `{ token }`.

Sign-in tokens are one-time and default to 30-day expiry; the harness mints a fresh
one per run. No npm dependency — plain `fetch`.

### 2. Consume (browser, no secret) — via `clerk-qa-login.mjs` (main path)

The app has no token-handling route and doesn't auto-consume a URL param, so the
token is consumed by driving Clerk's global on the target origin (where
`window.Clerk` is live). **This is done by a single script, `clerk-qa-login.mjs`,
not by the agent.** The script mints (step 1) and consumes in one process, drives a
cloud-configured Chromium, and prints only non-secret evidence:

```bash
node .claude/skills/qa-pr/scripts/clerk-qa-login.mjs --instance preview --origin <origin>
# → { ..., "consume": { "ok": true, ... }, "authed": { "clerkUserId": "user_…", … }, "PASS": true }
```

**Why a script and not the agent's own `evaluate_script`:** the minted token is a
credential, and the harness security policy forbids it from ever entering the
agent's transcript or a tool-call argument (confirmed in verification — the
classifier blocks materializing it). The script keeps the token in-process: minted
→ passed to the page as a function argument → consumed, never printed. The
inline-`evaluate_script` form the agent would type can't be done without leaking
the token, which is exactly why the script is the primary mechanism.

What the script runs in the page:

```js
async (ticket) => {
  // ticket arrives as an argument, never inlined
  const clerk = window.Clerk;
  if (!clerk) return { ok: false, err: "window.Clerk not present" };
  await clerk.load?.();
  const si = await clerk.client.signIn.create({ strategy: "ticket", ticket });
  if (si.status !== "complete") return { ok: false, status: si.status };
  await clerk.setActive({ session: si.createdSessionId });
  return { ok: true, userId: clerk.user?.id ?? null };
};
```

`create({ strategy: "ticket" }) + setActive()` is the Core-2 form that the Clerk
team's own fix for [#8219](https://github.com/clerk/javascript/issues/8219)
confirms works (the newer `signIn.ticket()` had a status bug). After `setActive`,
the SPA holds a real Clerk session (httpOnly `__session` cookie + a valid session
JWT); the harness proceeds with the normal qa-pr spine. To authenticate a browser
another tool drives, the script can `--cdp <url>` attach instead of launching; for
a Playwright spine it can `--storage <file>` export the session cookies.

## Per-environment secret (instance match)

The secret and the app's publishable key must be the **same Clerk instance**
(verified by reading `window.Clerk.frontendApi` on each origin):

- **Prod instance** — `CLERK_SECRET_KEY`, Clerk `clerk.vibes.diy` (`pk_live`).
  Serves `vibes.diy`, `prod-v2.vibesdiy.net`, **and `cli-v2.vibesdiy.net`** (cli is
  an _exact prod clone_ per [`agents/environments.md`](../../agents/environments.md)
  — same Clerk, same DB).
- **Dev/preview instance** — `CLERK_SECRET_KEY_PREVIEW`, Clerk
  `sincere-cheetah-30.clerk.accounts.dev` (`pk_test`). Serves
  `dev-v2.vibesdiy.net` and the `pr-*.workers.dev` PR previews (preview shares
  dev's bindings).

> **Correction (2026-06-28):** an earlier draft grouped `cli` with the preview
> instance. That is wrong — `cli` runs the **prod** Clerk instance. Mint cli tokens
> with `--instance prod`.

A token minted on the wrong instance won't activate — same per-env discipline as
the CLI's `VIBES_DEVICE_ID` / `_PREVIEW`. qa-pr picks the secret by target origin.

## Security & scope

- `CLERK_SECRET_KEY` is a powerful credential (full Backend API). It lives **only**
  in the qa-pr harness session env, never committed, never echoed into logs/triage.
  Owner is OK with this (harness-env only); prefer a dev/preview-instance secret for
  preview runs to limit blast radius.
- The minted token is one-time and short-lived; treat it as a secret in transit
  (don't print it into triage/gist artifacts).

## What changes (and what doesn't)

- **App:** nothing.
- **qa-pr skill:** `scripts/clerk-signin-token.mjs` (mint, BAPI) **and
  `scripts/clerk-qa-login.mjs`** (the main-path login tool: mint + consume + verify
  in one process, token in-process). The _Browser environment_ section's "cloud
  authenticated login" step runs `clerk-qa-login.mjs` and replaces the Google-OAuth
  preflight when the instance secret is set. The local-workstation Google-OAuth path
  stays as the secondary fallback.

## Implementation status

- ✅ Mint script + login script + skill wiring + this spec.
- ✅ **Live verification — DONE 2026-06-28 on both instances** (`clerk-qa-login.mjs`,
  cloud session):
  - **Preview** (`--instance preview` → `dev-v2.vibesdiy.net`, Clerk
    `*.clerk.accounts.dev` / `pk_test`): ticket consumed, `status: complete`,
    `setActive` established a real session — non-null `clerkUserId`, httpOnly
    `__session` cookie set, valid session JWT obtained, no sign-in control rendered.
    `PASS: true`.
  - **Prod** (`--instance prod` → `vibes.diy`, Clerk `clerk.vibes.diy` / `pk_live`):
    same — ticket consumed, real session, ~800-char session JWT, `PASS: true`.
  - Both userIds were resolved from `jchris@gmail.com` (a distinct user record per
    instance, as expected). No secret or token appeared in any output/artifact.
  - PR #2787 itself is docs/skill-only (it doesn't touch `vibes.diy/**`), so it has
    no `pr-*.workers.dev` preview deploy — preview verification used the stable
    dev-instance origin `dev-v2.vibesdiy.net` instead.

## Open questions — resolved

1. **Does the vibes app expose `window.Clerk` globally?** **Yes.** Present and
   reliable after `await window.Clerk.load()` on both `dev-v2.vibesdiy.net` and
   `vibes.diy`; no repo config suppresses the global.
2. **Resolve `userId` by email or explicitly?** **Email-by-default**, confirmed
   ergonomic (`jchris@gmail.com` resolved on both instances). The script keeps the
   `--user-id` override, and ambiguous email matches hard-fail (Charlie's review).
3. **Turnstile/bot-detection on ticket sign-in?** **No challenge** on either
   instance — the backend-authorized ticket path went straight through (no
   `cl-captcha` / Turnstile widget present). The `@clerk/testing` Testing-Token
   fallback stays documented for the risk/attack-protection case.

## Follow-up (not blocking)

- Wire the chrome-devtools MCP Chrome with a CDP port (in
  [`scripts/setup-cloud-browser.sh`](../../scripts/setup-cloud-browser.sh)) so
  `clerk-qa-login.mjs --cdp $CHROME_CDP_URL` authenticates the MCP-driven browser
  directly and the full cloud spine runs through MCP. The CDP-attach mechanism is
  verified; only the port-exposure wiring remains. Until then the login script
  authenticates the browser it drives (and can `--storage`-export the session).
