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
HTTP  /vibe/{owner}/{slug}/_api/*
        │  (pkg worker: workers/app.ts, before the SSR/render path)
        ▼
  match + strip prefix → path rooted at "/"
        │
        ▼
  BackendDO.idFromName( lenc(owner) + lenc(slug) )      one instance per (owner, appSlug)
        │
        ▼
  DO.fetch(strippedRequest):
    1. read active.backend (AppSettings) by (owner, appSlug)
       └─ absent, or handlers∌"fetch"            → 404  (no isolate spin-up)
    2. load /backend.js source from CANONICAL Apps.fileSystem (current release)
       └─ missing / empty / uncompilable          → 404  (fallback, never 500)
    3. backendExecutor.invoke({ source, handler:"fetch", trigger })   (B1 seam)
       │   isolate id = hash( codeHash, policyVersion, owner, slug )  ← hard per-vibe partition
       └─ absent fetch export / isolate error      → 404  (fallback)
    4. return the isolate Response verbatim (status, headers, body)
```

## Components

### 1. Route match + prefix strip (`workers/app.ts`)

- Match `/vibe/{owner}/{slug}/_api/...` **before** the SSR/render branch so `_api` never falls through
  to page rendering.
- Strip `/vibe/{owner}/{slug}/_api` so the handler sees a path rooted at `/` (e.g.
  `/vibe/alice/todo/_api/webhooks/stripe` → handler sees `/webhooks/stripe`).
- **Reserved token is `_api`** (underscore), not `/api`, so it can never collide with an app's own
  `/api/...` client routes. Matches the author doc's "reserved `_api`."
- Forward the (owner, slug)-addressed request to `env.BACKEND_DO`.

### 2. BackendDO (new Durable Object class)

- **One instance per `(ownerHandle, appSlug)`** via `idFromName` of a **collision-safe** encoding:
  length-prefixed `owner` + `slug` (`lenc(s) = <len>":"<s>`), never bare concatenation (so
  `("ab","c")` and `("a","bc")` can't alias).
- B3 surface: `fetch(request) → Response` only. B4 adds `alarm()`; B5 adds `invokeOnChange()` — same
  class, no routing change.
- **Stateless in B3**: holds no durable state yet; the in-memory compiled-isolate cache (below) is its
  only state and is rebuildable on eviction.

### 3. Gate via `active.backend`, load source from canonical `Apps.fileSystem`

- **Cheap gate first:** read the `active.backend` AppSettings entry by `(owner, appSlug)` (resolve the
  owner's `userId` through `HandleBindings`, as other readers do). No entry, or `handlers` lacking
  `"fetch"`, → **404** without touching storage or the isolate.
- **Source is canonical, single source of truth:** B2b deliberately dropped `cid`/`assetUri` from the
  entry, so B3 resolves the `/backend.js` source from the **current release's `Apps.fileSystem`** (the
  selected row for this `(owner, slug)`), transforms it (Sucrase, Workers-safe), and runs it. The entry
  tells us _whether_ a fetch handler exists; the canonical row tells us _what code_ to run.
- **Compiled-isolate cache (SSR pattern):** the DO caches the built `WorkerCode`/isolate keyed by the
  content hash, recompiling on eviction. Identical to how SSR's executor caches.

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

- no `active.backend` entry / `handlers` lacks `"fetch"`,
- `/backend.js` missing, empty, or uncompilable,
- no `fetch` export after compile,
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

- **Routing:** `/vibe/{o}/{s}/_api/x/y` matches and strips to `/x/y`; non-`_api` vibe paths still route
  to render unchanged; `_api` on a vibe with no backend → 404.
- **DO addressing:** `idFromName` is stable per `(owner, slug)` and collision-safe across the
  `("ab","c")` vs `("a","bc")` boundary.
- **Dispatch:** a `fetch`-exporting `backend.js` returns its `Response` verbatim — status, headers
  (`Set-Cookie`, `Location`, `content-type`), and body all pass through.
- **Gate:** `active.backend` absent or `handlers` without `"fetch"` → 404 with no source load.
- **Fallback:** missing/empty/uncompilable source, absent `fetch` export, and isolate-throw each → 404,
  never 500.
- **ctx:** `ctx.db`/`ctx.secrets` access throws the documented "not until B6/B7" error.

## Open questions for review (Charlie)

1. **Intercept layer.** Match `_api` in `workers/app.ts` (the CF worker entry, alongside the existing
   `/vibe/*` and DO-dispatch branches) vs inside `cfServe`/render-vibe (`api-svc`). The worker entry
   keeps `_api` out of the render path entirely and mirrors how `SESSIONS` etc. are dispatched; is
   there a reason to prefer the `api-svc` layer (shared auth/ctx assembly) instead?
2. **Source resolution for the current release.** B3 needs "the `/backend.js` of the release this
   request should run." For a published vibe that's the production release; during dev it's the dev
   row. Is there an existing canonical "resolve the active release for (owner, slug) at serve time"
   helper I should reuse (the render path must already do this), so backend and page render always
   agree on _which_ release is live?
3. **`userInfo` resolution on `_api`.** Reuse the same session-auth path the page/SSR uses (cookie/
   session → user), treating absent auth as `null`? Webhooks are unauthenticated by definition, so
   `null` must be a first-class, supported case (not an error) — confirm that's the intended contract
   before B6 hangs write-identity off it.
4. **DO migration shape.** `BackendDO` as a `new_classes` entry (like `AppSessions`/`UserNotify`).
   Since nothing deploys until the epic completes, the migration rides the final deploy — any concern
   with introducing the class now but not exercising it live until B8?
