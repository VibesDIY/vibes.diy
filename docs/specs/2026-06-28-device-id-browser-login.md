# Spec: device-id browser login (headless auth for the web app)

**Status:** draft / spec-first
**Goal:** let an agent log into the vibes.diy **web app** as a real user in an
unattended cloud session — so the authenticated `qa-pr` spine (generate → edit →
publish → remix) can run in the cloud, not only on a local workstation.

## Problem

The cloud browser plumbing now works (chrome-devtools MCP via the egress proxy —
see [`agents/cloud-browser-setup.md`](../../agents/cloud-browser-setup.md)), but
the **authenticated** half of `qa-pr` still can't run in the cloud. The web app
signs in through Clerk, which is **OAuth-only** (Google), and the operator's
Google account is protected by a **passkey** — there is no headless way to
complete that flow. So today the authenticated spine requires a local workstation
with a pre-seeded Google session.

## Key finding — the device cert already authenticates as the user

The CLI already does headless auth with a device cert in `VIBES_DEVICE_ID`
(`VIBES_DEVICE_ID_PREVIEW` for preview/dev). The important part: **the API
accepts that device token as a first-class identity, equivalent to a Clerk
login.**

- The device keybag item carries an ES256 private key plus a CA-signed cert; the
  cert embeds the user's Clerk identity as a `creatingUser` claim
  (`vibes-diy/cli/device-id-env.ts`, cert payload in `vibes.diy/identity/...`).
- A device token is a short-lived ES256 JWT with the cert in its `x5c` header —
  minted in plain JS (`createDeviceIdGetToken`), so it works in a browser via
  WebCrypto, not just in Node.
- The server verifies the cert and **coerces `device-id` and `clerk` to the same
  `userId` claim** — `coercedVerifiedAuthUser()` in
  `vibes.diy/api/svc/check-auth.ts` treats them identically. The asset-session
  bridge (`vibes.diy/api/svc/public/asset-session.ts`, `verifyAnyBearer`) also
  accepts either.

So on the **data plane**, a device token is already a valid login. The reason
device-id is "CLI-only" today is purely that the **web client** doesn't implement
that path — not a server limitation.

## Why not the alternatives

- **Clerk sign-in / actor tokens (the standard E2E pattern):** needs
  `CLERK_SECRET_KEY` to call Clerk's Backend API. It is **not** present in this
  repo (only public verify keys, `CLERK_PUB_JWT_KEY`). The token-exchange design
  in [`notes/fix-login.md`](../../notes/fix-login.md) assumes that secret and is
  not implementable as written.
- **Injecting a captured Clerk JWT into localStorage:** Clerk session tokens are
  very short-lived (~30–60s) and refresh requires the live Clerk session (the
  OAuth+passkey we're trying to avoid). Fragile, not unattended.
- **Automating Google OAuth:** blocked by the passkey.

Device-id is the one robust path, and the credential (`VIBES_DEVICE_ID`) is
already present in the cloud env.

## Design

Two integration seams in the web app, both already centralized.

### Seam 1 — token source (`getToken`)

`vibes.diy/pkg/app/vibes-diy-provider.tsx` exposes a single
`getToken(): Promise<Result<DashAuthType>>` that today returns
`{ type: "clerk", token }`. The transport
(`vibes.diy/api/impl/vibes-diy-api-transport.ts`, `sendApiMessage`) attaches
whatever it returns as the per-message `auth`. **This is the primary data-plane
change** (see also Seam 3 for the claims preflight): when a device keybag is
active, `getToken` returns `{ type: "device-id", token }` minted client-side from
the keybag (cache + re-mint on a short interval, mirroring the CLI's per-60s
re-mint).

### Seam 2 — UI signed-in state

The app gates protected UI on Clerk's `useAuth().isSignedIn`
(`vibes.diy/pkg/app/routes/auth.tsx`, and the generate preflight at
`vibes.diy/pkg/app/routes/chat/prompt.tsx:48`). When a device keybag is active,
the app must report "signed in" without Clerk. Approach: a small auth-state shim
that ORs a `deviceIdActive` flag into the signed-in check and surfaces the
identity from the cert's `creatingUser` claim (display name/email), so the
existing UI renders unchanged. The unit-test mock
(`vibes.diy/tests/app/clerk-test-mock.ts`, `setTestAuth`) is the precedent for
substituting auth state.

### Seam 3 — client-side claims (`getTokenClaims`)

_(Found in review by Codex — a third seam beyond the original two.)_

The first generate path doesn't just send the token; it first calls
`chatApi.getTokenClaims()` before `openChat`
(`vibes.diy/pkg/app/routes/chat/prompt.tsx:57`). `VibesDiyApi.getTokenClaims()`
(`vibes.diy/api/impl/index.ts:317`) **ignores the auth type** and always runs
`new ClerkApiToken(sthis).decode(token)`. A `device-id` token's identity lives in
the `creatingUser` claim inside the `x5c` cert, not as a Clerk-signed JWT body, so
this client-side decode fails **before** the server-side `device-id`↔`clerk`
coercion can help — which would block the core qa-pr generate step entirely.

`getTokenClaims()` must branch on `DashAuthType`: for `device-id`, extract the
embedded Clerk claim from the cert (the same `creatingUser.claims` the server
reads) instead of decoding the JWT body as a Clerk token. This is purely
client-side claim extraction — no signature trust is implied (the server still
verifies on every message); it only needs to return the right `ClerkClaim` shape
so the preflight passes. Reuse whatever cert-claim extraction the device-id
verifier already uses server-side rather than hand-rolling a parser.

### Per-environment cert

Exactly like the CLI's `VIBES_DEVICE_ID` (prod, `iss: vibes.diy`) vs
`VIBES_DEVICE_ID_PREVIEW` (preview/dev, `iss: DEV`): the harness injects the cert
that matches the target origin's CA. Prod gets the prod cert; PR-preview/cli gets
the preview cert. Mismatched certs fail verification, same as the CLI today.

### Injection mechanism

The keybag is provided to the browser by the `qa-pr` harness, not bundled. Two
options (decide in review):

1. **`initScript` (preferred):** `mcp__chrome-devtools__navigate_page` supports an
   `initScript` that runs before any page script. The harness sets a well-known
   key (e.g. `localStorage["vibes.diy.device-id-keybag"]`) from the env cert
   before the provider boots. Clean; no reload.
2. **`evaluate_script` + reload:** set the key, then reload so the provider picks
   it up on init.

The web app reads that key on init; if present and valid, it activates the
device-id path. No injected key → unchanged Clerk behavior.

## Security & scope

Per the product owner's call (2026-06-28): **no heavy prod gating.** It's "one
login for prod and one for PR preview"; using it on production is fine — it's a
fun site, and a botless account can use a different login. So:

- The device-id path activates **only** when a keybag is explicitly injected.
  Possessing `VIBES_DEVICE_ID` already _is_ being that user (same as the CLI), so
  this adds no new trust boundary — it lets the browser use a credential the CLI
  already uses.
- The keybag is a secret: never log it; the harness injects it transiently into a
  cold, disposable cloud profile and does not persist it.
- No production-origin block is required. (If we ever want one, the cleanest hook
  is to refuse activation unless the cert's issuer matches the current origin's
  expected CA — which the verification already enforces server-side anyway.)

## Implementation plan (after spec sign-off)

1. **Browser device-token minter** in the identity package — a WebCrypto path
   that imports the keybag JWK and mints the `x5c`-headed ES256 JWT (factor out /
   browser-port `createDeviceIdGetToken`; ensure no Node `Buffer` on the browser
   path — the env parser in `device-id-env.ts` uses `Buffer`, so add an
   `atob`-based decode for the browser).
2. **`getToken` branch** in `vibes-diy-provider.tsx`: if a keybag is active,
   return `{ type: "device-id", token }`; else current Clerk path.
3. **Auth-state shim** so `isSignedIn`-gated UI renders for the device-id session,
   sourcing identity from the cert claim.
4. **`getTokenClaims` device-id branch** (`vibes.diy/api/impl/index.ts:317`): when
   the token is `device-id`, return the cert's embedded `creatingUser` claim
   instead of `ClerkApiToken.decode()`, so the generate preflight
   (`routes/chat/prompt.tsx:57`) passes. Reuse the server-side cert-claim
   extraction.
5. **Keybag intake**: read `localStorage["vibes.diy.device-id-keybag"]` (name TBD)
   on init; validate; activate.
6. **qa-pr wiring**: inject the env cert (prod vs preview by target origin) via
   `initScript`; drop the Google-session preflight when device-id is active;
   update the skill's _Browser environment_ section so the **authenticated** spine
   is cloud-default too.
7. **Docs**: update `agents/cloud-browser-setup.md` (auth now covered in cloud) and
   the qa-pr skill; note the local-workstation path becomes the fallback.

## Testing

- Unit: browser minter produces a token the existing `device-id` verifier accepts
  (reuse server verify tests).
- Integration: in a cloud session, inject the preview cert, load a PR preview,
  assert `isSignedIn` UI + an authenticated API call succeeds as the user.
- Regression: no injected keybag → Clerk flow unchanged.

## Open questions (for review)

1. `initScript` vs `evaluate_script`+reload for injection — any CSP/storage
   partitioning gotcha on the preview origin?
2. localStorage key name + shape (raw keybag JSON vs the base64 the CLI accepts).
3. Should the auth-state shim live in the provider or a dedicated wrapper, to keep
   the Clerk path untouched and easy to reason about?
4. Re-mint cadence in the browser — match the CLI's 60s, or tie to token `exp`?
