# Spec: headless qa-pr login via Clerk sign-in tokens

**Status:** draft / spec-first.
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

- `--instance prod` (default) → `CLERK_SECRET_KEY` (for `vibes.diy`)
- `--instance preview` → `CLERK_SECRET_KEY_PREVIEW` (for `*.workers.dev` / cli;
  falls back to `CLERK_SECRET_KEY` if the preview var is unset)

Then:

1. Resolve the user: `GET https://api.clerk.com/v1/users?email_address=<email>`
   (email defaults to `git config user.email`) → `userId`. (Or pass `--user-id`.)
2. Mint: `POST https://api.clerk.com/v1/sign_in_tokens` `{ user_id }` → `{ token }`.

Sign-in tokens are one-time and default to 30-day expiry; the harness mints a fresh
one per run. No npm dependency — plain `fetch`.

### 2. Consume (browser, no secret)

The app doesn't have a token-handling route and doesn't auto-consume a URL param,
so the harness drives Clerk's global directly via chrome-devtools `evaluate_script`
on the preview origin (where `window.Clerk` is live):

```js
async () => {
  const ticket = "<MINTED_TOKEN>"; // interpolated by the harness
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
the SPA is signed in; the harness proceeds with the normal qa-pr spine.

## Per-environment secret (instance match)

The secret and the app's publishable key must be the **same Clerk instance**:

- **Prod** (`vibes.diy`): the prod `CLERK_SECRET_KEY`.
- **PR preview / cli** (`*.workers.dev`, dev/preview instance): the dev/preview
  `CLERK_SECRET_KEY`.

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
- **qa-pr skill:** add `scripts/clerk-signin-token.mjs`; the _Browser environment_
  section gains a "cloud authenticated login" step (mint → `evaluate_script`
  consume) that replaces the Google-OAuth preflight when `CLERK_SECRET_KEY` is set.
  The local-workstation Google-OAuth path stays as the fallback.

## Implementation status

- ✅ Mint script + skill wiring + this spec (no secret needed to author).
- ⏳ **Live verification deferred to a session with `CLERK_SECRET_KEY`** (preview
  instance): mint a token, run the consume snippet on the PR preview, confirm a
  real authenticated action as the operator. Until then this is unproven
  end-to-end — the BAPI shapes and the ticket flow are from Clerk's current docs.

## Open questions

1. Does the vibes app expose `window.Clerk` globally (default for `@clerk/react`
   `ClerkProvider`)? Expected yes; confirm in the live spike.
2. Resolve the operator's Clerk `userId` by email via BAPI, or pass it explicitly?
   (Script supports both; email-by-default is most ergonomic since qa-pr already
   reads `git config user.email`.)
3. Any Turnstile/bot-detection interaction with a ticket sign-in? (Tickets are a
   backend-authorized path; expected to bypass — confirm, and fall back to
   `@clerk/testing` Testing Tokens if needed.)
