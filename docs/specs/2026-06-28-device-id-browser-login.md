# Spec: device-id browser login (headless auth for the web app)

**Status:** draft / spec-first. Reviewed by Codex (added Seam 3) and Charlie
(unified auth adapter, asset-bridge caveat, remint cadence — all folded in below).
Seams 1 + 3 are **prototype-validated** (see _Prototype_ below).
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
- A device token is a short-lived ES256 JWT with the cert in its `x5c` header. The
  signer (`identity/device-id/sign.ts`, `key.ts`) is **isomorphic** (jose +
  WebCrypto), so it runs in a browser. The CLI's `createDeviceIdGetToken` is
  node-only only because it's wired to `getKeyBag` (fs); a browser-targeted factory
  fed the keybag item directly is feasible — and is prototyped (Seam 1).
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

Four integration seams in the web app. Seams 1 + 3 are prototype-validated; 2 + 4
are the remaining web-app integration work.

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

### Seam 2 — UI signed-in state (unified auth adapter)

The app gates protected UI on Clerk's `useAuth().isSignedIn`
(`vibes.diy/pkg/app/routes/auth.tsx`, and the generate preflight at
`vibes.diy/pkg/app/routes/chat/prompt.tsx:48`). A keybag must make the app report
"signed in" without Clerk.

_Revised per Charlie's review:_ a single OR'd `deviceIdActive` flag is **not
enough** — `vibes-diy-provider.tsx` also depends on Clerk `loaded`,
`session?.getToken`, `addListener`, `user?.id`, and `openSignIn`, and there are
many direct `@clerk/react` consumers across `pkg/app` (incl. `routes/auth.tsx`).
And **synthetic Clerk session injection is to be avoided.**

Instead, introduce a small **unified auth adapter** with a stable surface —
`isLoaded`, `isSignedIn`, `userId`, `getToken`, `openSignIn`, `subscribe` — backed
by Clerk normally and by the device-id keybag when one is active (identity from
the cert's `creatingUser` claim). Swap the provider and the route/component gates
to consume the adapter instead of `@clerk/react` directly. This keeps one auth
abstraction for the whole app rather than special-casing `isSignedIn` in N places.
(The unit-test mock `vibes.diy/tests/app/clerk-test-mock.ts` `setTestAuth` is
precedent for substituting auth state, but the adapter is the production seam.)

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

### Seam 4 — asset-session bridge for device-id (published-app assets)

_(Raised by Charlie's review.)_

Published/preview apps load subresources (images, video) from the asset host,
gated by a short-lived cookie minted at `/_auth/session`. The **server** bridge
(`vibes.diy/api/svc/public/asset-session.ts`, `verifyAnyBearer`) already accepts a
device-id bearer — but the **client** helper
(`vibes.diy/pkg/app/lib/asset-session.ts`) currently **no-ops for non-`clerk`
auth types**, so a device-id session would skip minting the asset cookie and
asset-gated subresources could fail to load. Since the qa-pr spine publishes an
app and views it, extend the client helper to drive the bridge for device-id too
(post the minted device token as the bearer). Low risk — the server side already
supports it.

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

1. **Browser device-token minter** — ✅ prototyped: `createDeviceIdGetTokenFromItem`
   in `vibes.diy/identity/device-id/browser-token.ts` feeds the keybag item to the
   isomorphic `DeviceIdKey` + `DeviceIdSignMsg` (jose), bypassing the node-only
   `getKeyBag`. Remaining: export it from the browser-safe `@vibes.diy/identity`
   entry, and a `Buffer`-free keybag parse (the env parser in `device-id-env.ts`
   uses `Buffer`; the browser path uses `sthis.txt.base64`).
2. **`getToken` branch** in `vibes-diy-provider.tsx`: if a keybag is active,
   return `{ type: "device-id", token }`; else current Clerk path. Re-mint off the
   token `exp` with a ~30–45s safety buffer (see _Re-mint cadence_).
3. **Unified auth adapter** (Seam 2): introduce the `isLoaded`/`isSignedIn`/
   `userId`/`getToken`/`openSignIn`/`subscribe` surface; back it with Clerk or the
   keybag; migrate the provider and route/component gates onto it. No synthetic
   Clerk session.
4. **`getTokenClaims` device-id branch** (`vibes.diy/api/impl/index.ts:317`): when
   the token is `device-id`, return the cert's embedded `creatingUser` claim
   instead of `ClerkApiToken.decode()`, so the generate preflight
   (`routes/chat/prompt.tsx:57`) passes. Reuse the server-side cert-claim
   extraction. (Claim extraction proven in the prototype.)
5. **Asset-session client bridge** (Seam 4): extend
   `vibes.diy/pkg/app/lib/asset-session.ts` to drive `/_auth/session` for
   device-id auth (server already accepts it).
6. **Keybag intake**: read `localStorage["vibes.diy.device-id-keybag"]` (name TBD)
   on init; validate; activate.
7. **qa-pr wiring**: inject the env cert (prod vs preview by target origin) via
   `initScript`; drop the Google-session preflight when device-id is active;
   update the skill's _Browser environment_ section so the **authenticated** spine
   is cloud-default too.
8. **Docs**: update `agents/cloud-browser-setup.md` (auth now covered in cloud) and
   the qa-pr skill; note the local-workstation path becomes the fallback.

### Re-mint cadence (resolved, per Charlie)

Current shape: CLI caches ~60s; token `exp` ~120s; `nbf` backdated; server
`clockTolerance` 60s. Browser minter should schedule the re-mint off `exp` with a
~30–45s safety buffer (refresh before the last ~30–45s of validity), which still
lands near the 60s cadence and avoids clock-skew edge races.

## Prototype (validates Seams 1 + 3)

`vibes.diy/identity/device-id/browser-token.ts` +
`browser-token.spike.test.ts` (gated on `VIBES_DEVICE_ID`/`_PREVIEW`, inert in CI).
The spike mints a token from the real keybag on the isomorphic path and asserts:
valid ES256 JWT with the `x5c`/`x5t`/`x5t#S256` chain; signature verifies against
the cert's public key (`subjectPublicKeyInfo`); and the Clerk `userId` is
recoverable client-side from the cert (`creatingUser.claims`) — i.e. Seam 3 works
without `ClerkApiToken.decode()`. Not yet proven: live server acceptance and the
in-app wiring (Seams 2 + 4). The spike is throwaway — fold into a fixture-based
test or delete before merge.

## Dependencies / known risks

- **`#2671` — device-id forged-cert rejection.** Charlie flags a known open
  weakness (a golden test currently marked failing for a forged-cert rejection
  path). It doesn't block this feature (we mint with a real cert), but it's the
  trust-boundary backstop for the device-id verifier and should be tracked
  alongside; cross-link before merge.

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

_Resolved in review:_ auth-state approach → **unified auth adapter**, not a
provider shim or synthetic Clerk session (Seam 2, per Charlie). Re-mint cadence →
**off `exp` with a ~30–45s buffer** (per Charlie).
