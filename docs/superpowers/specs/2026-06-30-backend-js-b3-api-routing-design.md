# Slice B3 — `_api` routing → BackendDO → Worker Loader isolate — design

Parent epic: [#2856](https://github.com/VibesDIY/vibes.diy/issues/2856), per-app `backend.js`.
Epic design: [`2026-06-29-per-app-backend-js-design.md`](./2026-06-29-per-app-backend-js-design.md) (this is the
focused, slice-level expansion of that doc's "Slice B3" section).

Predecessors merged: **B1** (the `BackendExecutor` seam + `BACKEND_JS=off|loader` flag,
`vibe/runtime/backend-executor.ts`), **B2a** (`parseBackendConfig`), **B2b** (push-time discovery → the
`active.backend` AppSettings entry `{handlers, intervalMs?}`).

> **Status: spec-first.** This captures the design only; implementation follows on the same branch/PR
> after Charlie's feedback. Built **dark** behind `BACKEND_JS=off` — nothing deploys until the epic is
> complete (whole-epic deploy, per owner direction).

## Goal

Stand up the **synchronous request path** end-to-end: an HTTP request to a vibe's reserved `_api`
prefix reaches that vibe's `fetch` handler, running in a Worker Loader isolate, and the handler's
`Response` flows back verbatim. This is the first **reader** of the `active.backend` entry B2b writes,
and the first slice to introduce the **BackendDO** — the per-vibe durable compute unit that B4 (alarms)
and B5 (`onChange`) extend without re-plumbing.

Non-goals (later slices): `scheduled`/alarms (B4), `onChange` (B5), real `ctx.db` write-back (B6),
secrets (B7), egress proxy + rate limiting (B8), live load / dependency bundling (#2845).

## Why the DO now (not deferred to B4)

`fetch` is stateless, so in B3 the DO is a thin front over the stateless `BackendExecutor.invoke`. We
introduce it now anyway because the hard, easy-to-get-wrong part of B3 **is** the addressing path —
`_api` → a per-vibe-addressed compute unit → isolate, with correct fallback and a collision-safe
per-vibe isolate identity. Building that against its real target (the DO) once is cheaper than building
it stateless and re-plumbing `fetch` through the DO in B4. The DO is also the natural home for the
per-vibe cache-key boundary and, later, the timer lane. Cost: B3 introduces DO topology (a
`new_classes` wrangler migration) — acceptable because the whole epic deploys once at the end.

## Architecture

```
TWO request forms reach a vibe's backend (both resolve to the same (owner, slug)):
  • published / runtime host:  https://{slug}--{owner}.{base}/_api/*        ← webhooks, iframe fetch('/_api/…')
  • viewer URL:                https://{base}/vibe/{owner}/{slug}/_api/*     ← logged-in viewer

        │  routeDecision() in workers/route-decision.ts adds a `backend-api`
        │  route, matched BEFORE the `cf-serve` (app-subdomain) and `ssr` branches
        ▼
  resolve (owner, slug)  [from host `{slug}--{owner}` OR from the /vibe/{owner}/{slug} path]
  strip the `…/_api` prefix → path rooted at "/"
        │
        ▼
  BackendDO.idFromName( lenc(owner) + lenc(slug) )      one instance per (owner, appSlug)
        │
        ▼
  DO.fetch(strippedRequest):
    1. resolve the SELECTED release for (owner, slug) at serve time (same resolver the page uses)
    2. load /backend.js from THAT release's Apps.fileSystem; derive handlers by parsing it
       └─ no release / no /backend.js / parse has no "fetch" export → 404  (cheap gate, no isolate)
       └─ empty / uncompilable                                       → 404  (fallback, never 500)
    3. backendExecutor.invoke({ source, handler:"fetch", trigger })   (B1 seam)
       │   isolate id = hash( codeHash, policyVersion, owner, slug )  ← hard per-vibe partition
       └─ isolate error                                              → 404  (fallback)
    4. return the isolate Response verbatim (status, headers, body)
```

## Components

### 1. Route match + prefix strip — a new `backend-api` route in `routeDecision`

The intercept must live in `workers/route-decision.ts` (the pure router `app.ts` delegates to), as a
new `backend-api` `Route`, because **`_api` reaches a vibe by two different request forms** and only
`routeDecision` sees both (Codex review):

- **Published / runtime host** — `https://{slug}--{owner}.{base}/_api/...`. This is what the author API
  documents (a Stripe webhook, an OAuth callback, or a same-origin `fetch('/_api/...')` from the vibe
  iframe all hit this host). `routeDecision` currently sends the whole app-subdomain (`{slug}--{owner}`)
  to `cf-serve`, where `/_api/...` would be treated as a static app file → 404. The new route **must be
  decided before the `cf-serve` (app-subdomain) branch**, matching `pathname` `/_api/...` on the app
  subdomain and taking `(owner, slug)` from the host.
- **Viewer URL** — `https://{base}/vibe/{owner}/{slug}/_api/...`, which otherwise falls through to
  `ssr`. Match before that fallthrough and take `(owner, slug)` from the path.

Both forms strip the trailing `…/_api` so the handler sees a path rooted at `/` (e.g.
`…/_api/webhooks/stripe` → `/webhooks/stripe`), then forward the `(owner, slug)`-addressed request to
`env.BACKEND_DO`. A `route-decision.test.ts` case pins both forms (and that a non-`_api` path on each
host is unchanged), mirroring the existing routing parity tests.

**Reserved token is `_api`** (underscore), not `/api`, so it can never collide with an app's own
`/api/...` client routes. Matches the author doc's "reserved `_api`."

### 2. BackendDO (new Durable Object class)

- **One instance per `(ownerHandle, appSlug)`** via `idFromName` of a **collision-safe** encoding:
  length-prefixed `owner` + `slug` (`lenc(s) = <len>":"<s>`), never bare concatenation (so
  `("ab","c")` and `("a","bc")` can't alias).
- B3 surface: `fetch(request) → Response` only. B4 adds `alarm()`; B5 adds `invokeOnChange()` — same
  class, no routing change.
- **Stateless in B3**: holds no durable state yet; the in-memory compiled-isolate cache (below) is its
  only state and is rebuildable on eviction.

### 3. Gate + source — both derived from the **selected release**, not the AppSettings entry

The `active.backend` AppSettings entry is keyed `{userId, ownerHandle, appSlug}` with **no release
scope** — it tracks the _latest push_ (`processBackendBindings`), which can be a dev push. But `_api`
serves a _specific_ release (production for a published vibe, the dev row in dev). Gating on the entry
would let the two **disagree** (Codex review): a production app with a `fetch` backend could 404 after a
later dev push drops `/backend.js`, or spin up for a dev-only handler against production source. So in
B3 the gate is **derived from the same selected-release filesystem we're about to run** — one source of
truth:

- **Resolve the selected release** for `(owner, slug)` at serve time (the same resolution the page/SSR
  path uses — see open question 2), yielding the release's `Apps.fileSystem` and its `/backend.js`
  content hash.
- **Gate by parsing that release's `/backend.js`** (`parseBackendConfig`, the cheap B2a parser, cached
  in the DO by content hash). No release / no `/backend.js` / no `"fetch"` export → **404** without
  spinning up the isolate. Parsing is cheap and Workers-safe; the isolate is the expensive thing the
  gate protects.
- **Compiled-isolate cache (SSR pattern):** the DO caches the parsed handlers + built `WorkerCode`/
  isolate keyed by the content hash, recompiling on eviction.

> **`active.backend`'s role, post-this-correction.** The entry remains the **push-time discovery
> record** (cheap "does the latest push declare a backend, and on what schedule") for consumers that
> are about the _current configuration_ rather than a served release — notably **B4**, which must decide
> which release's `config.scheduled` arms the alarm. B4 will have to make the same release-vs-latest-push
> choice explicitly; B3 simply doesn't read the entry on the serve path. (Flagged for B4.)

### 4. Isolate identity — hard per-vibe partition

- The Worker Loader id folds `{ codeHash, policyVersion, ownerHandle, appSlug }`, encoded
  collision-safe (length-prefixed), so **two different vibes with byte-identical `backend.js` never
  share an isolate**. Different vibes carry different secrets, write identity, and egress policy, so a
  shared isolate would be a tenant bleed. (Per-vibe partition is the security boundary; revisit sharing
  only if isolate cold-start cost ever justifies it, and only for code provably free of per-vibe state.)
- This satisfies B1's executor **invariant #1**: per-trigger context (the acting identity, the request)
  travels via the call args, never the hashed `WorkerCode`, so one isolate can serve many requests of
  one vibe without identity bleed across calls.

### 5. `ctx` surface in B3

- `ctx = { userInfo, appInfo: { ownerHandle, appSlug } }`.
- `userInfo` = the session user for an authenticated `_api` call, or `null` (webhooks / anonymous).
- `ctx.db` and `ctx.secrets` are **B6/B7**. In B3 they are present but **throw a clear
  "not available until B6/B7" error** when touched, so a handler that reaches for them fails loudly
  rather than silently seeing `undefined`. (Toward-target choice: the shape is final; the wiring lands
  in its slice.)

### 6. Fallback discipline (mirror `attemptVibeSsr`)

Every "no usable backend" condition resolves to **404 for the `_api` route, never a 500, and never
bleeding into page render**:

- no selected release, or its `/backend.js` is missing,
- the selected release's `/backend.js` parses with no `"fetch"` export,
- `/backend.js` empty or uncompilable,
- isolate throws during dispatch.

`attemptVibeSsr` is the template: it "never throws — any failure yields a fallback," and B3's `_api`
handler adopts the same boundary so a broken backend degrades to 404, not a page 500.

## Flag & live-path posture

- `BACKEND_JS=off` (default) ⇒ no `_api` interception at all; routing falls through unchanged. The
  whole B3 path is dark.
- `loader` mode requires the real `env.LOADER` Worker Loader binding **and** dependency bundling
  (#2845) **and** the egress proxy (B8) before any live traffic. B3 does not enable live traffic; it is
  built and tested against the **fake `env.LOADER` binding** with the flag off.

## Testing (fake binding, flag off)

- **Routing (both forms):** `routeDecision` returns `backend-api` for `/_api/x/y` on the app subdomain
  `{slug}--{owner}.{base}` **and** for `/vibe/{owner}/{slug}/_api/x/y` on the base host — each stripping
  to `/x/y` and resolving the same `(owner, slug)`; a non-`_api` path on each host is unchanged (the
  subdomain still goes to `cf-serve`, the viewer path still to `ssr`).
- **DO addressing:** `idFromName` is stable per `(owner, slug)` and collision-safe across the
  `("ab","c")` vs `("a","bc")` boundary.
- **Dispatch:** a `fetch`-exporting `backend.js` returns its `Response` verbatim — status, headers
  (`Set-Cookie`, `Location`, `content-type`), and body all pass through.
- **Release-scoped gate:** the gate parses the **selected release's** `/backend.js`; a release whose
  `/backend.js` has no `"fetch"` export → 404 even if a _later_ push's `active.backend` entry says
  otherwise (and vice-versa) — the regression guard for the Codex release-skew catch.
- **Fallback:** missing/empty/uncompilable source, absent `fetch` export, and isolate-throw each → 404,
  never 500.
- **ctx:** `ctx.db`/`ctx.secrets` access throws the documented "not until B6/B7" error.

## Codex review folded in (commit history)

Codex's spec pass caught two real gaps, both now reflected above:

- **App-subdomain routing.** The published host `{slug}--{owner}.{base}` (where webhooks and iframe
  `fetch('/_api/…')` actually land) routes to `cf-serve` before SSR, so a viewer-path-only matcher would
  miss it. The intercept is now a `routeDecision` `backend-api` route covering **both** hosts, decided
  before the `cf-serve` branch.
- **Release-skew on the gate.** `active.backend` is release-agnostic (latest push), but `_api` serves a
  specific release; gating on the entry could 404 a valid production backend (or spin up a dev-only
  handler against production source). The gate is now derived from the **selected release's**
  `/backend.js`, the same source we run.

## Open questions for review (Charlie)

1. **Selected-release resolver.** B3 needs "the `/backend.js` of the release this request should serve"
   (production for a published vibe, the dev row in dev). Is there an existing canonical "resolve the
   active release for (owner, slug) at serve time" helper the page/SSR path already uses that I should
   reuse, so backend and page render can never disagree about which release is live? (This is the lynchpin
   of the release-scoped gate above.)
2. **`userInfo` resolution on `_api`.** Reuse the same session-auth path the page/SSR uses (cookie/
   session → user), treating absent auth as `null`? Webhooks are unauthenticated by definition, so
   `null` must be a first-class, supported case (not an error) — confirm that's the intended contract
   before B6 hangs write-identity off it.
3. **DO migration shape.** `BackendDO` as a `new_classes` entry (like `AppSessions`/`UserNotify`).
   Since nothing deploys until the epic completes, the migration rides the final deploy — any concern
   with introducing the class now but not exercising it live until B8?
4. **B4 heads-up (not a B3 blocker).** Because the gate is now release-scoped, B4's alarm-arming must
   make the same "which release's `config.scheduled`" choice explicitly — the release-agnostic
   `active.backend` entry can't be the sole authority there either. Flagging so it's not a surprise.
