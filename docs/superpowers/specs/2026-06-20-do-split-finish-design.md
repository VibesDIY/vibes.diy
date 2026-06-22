# Finish the AppSessions DO split — design

**Date:** 2026-06-20
**Tracking:** #2264 (cleanup remainder), #2265 (deferred items 1–3)
**Parent:** #2253 (AppSessions DO split, merged), #2263 (rename, merged), #2297/#2298 (DocNotify retired)
**Status:** Track A shipped (A1 #2494, A2 #2502, A2b #2504, A3 #2511 — `AccessFnDO` retired). Tracks B (SharedSessions) + C (`/chat/` deprecation) pending. Living architecture doc: [`agents/do-session-split.md`](../../../agents/do-session-split.md). This spec is kept as the original design record.

## Plain-language summary

The AppSessions DO split (#2253) is most of the way done, but three pieces of
follow-up are still open across #2264 and #2265. This spec accounts for what
already shipped and lays out the remaining work as three dependency-ordered
tracks: (A) retire the now-dead `AccessFnDO`, (B) add a `SharedSessions`
singleton DO for page-load queries, and (C) deprecate the standalone `/chat/`
route. Track A is unblocked and well understood; B and C are larger and get
design-level plans here, to be expanded into full TDD plans of their own before
execution.

## What already shipped (close these out)

Most of #2264 and the DocNotify half of #2265 landed but the checkboxes were
never ticked. Verified in `origin/main`:

| Item                                 | Status  | Evidence                                                                                |
| ------------------------------------ | ------- | --------------------------------------------------------------------------------------- |
| #2264 §1 stale `?shard=` param       | ✅ done | `skipShard` in `api/impl/index.ts`; passed for app conn in `vibes-diy-provider.tsx:259` |
| #2264 §2 `resolveShardDO` edge tests | ✅ done | `api/tests/resolve-shard-do.test.ts` (5 cases)                                          |
| #2264 §3 dead `docNotifyCallbacks`   | ✅ done | removed in #2253 (`86ba7c32c`); no refs in `cf-serve.ts`                                |
| #2264 §4 / #2265 §1 — DocNotify      | ✅ done | #2297 (cli unbind) + #2298 (class deletion, `v6 deleted_classes`)                       |
| #2263 rename `vibeDiyApi`→`chatApi`  | ✅ done | issue closed; no source refs to old names                                               |

Remaining open work, this spec:

- #2264 §4 / #2265 §1 — **AccessFnDO** class deletion (Track A).
- #2265 §2 — **SharedSessions** singleton DO (Track B).
- #2265 §3 — **`/chat/` route deprecation** (Track C).

## Current architecture (post-#2253)

Two WebSocket connections from the client (`vibes-diy-provider.tsx`):

- **`chatApi`** → `ChatSessions` DO (`/api`, sharded by random UUID, or pinned
  per-vibe on `/vibe/` routes). Serves `chatMsgEvento` =
  `sharedHandlers + appHandlers + chatHandlers`.
- **`vibeApi`** → `AppSessions` DO (`/api/app?vibe=owner--slug`, sharded by vibe
  key). Serves `appMsgEvento` = `sharedHandlers + appHandlers +
imgGenAppSessionStopgapHandlers`. Built only on routes where
  `vibeApiTarget(pathname)` matches (`/vibe/…` and `/chat/…` with a real
  appSlug). Otherwise `undefined`; a lightweight `notifyApi` is used instead.

Two more eventos exist:

- **`vibesMsgEvento`** = `sharedHandlers + appHandlers + chatHandlers`. This is
  `cfServe`'s **default** when no `eventoFactory` is passed (`cf-serve.ts:530`).
  The two DOs pass an explicit evento, **but the default is a live production
  path**, not test-only: the top-level worker handles the `cf-serve` route (app
  subdomain `*--*.host` + asset host, `route-decision.ts:62`) by calling
  `cfServe(request, cctx)` with **no** `eventoFactory` and `cfServeAppCtx(...)`
  with **no** override (`app.ts:305,309`). Deployed-vibe doc writes (the iframe
  runtime → its own app subdomain) therefore run **in the worker** under
  `vibesMsgEvento` + the default `invokeAccessFn`. (Caught in review — thanks
  @chatgpt-codex-connector.)

Handler manifest (`api/svc/evento-handler-manifest.ts`) is the single source of
truth; a parity test pins no-overlap.

### How `AccessFnDO` is still reached

`env.ACCESS_FN_DO` is invoked in one place: the **default** `invokeAccessFn` in
`cf-serve.ts:445`. It runs when a doc-write handler (`putDocEvento`) executes in
an `appCtx` with **no** `invokeAccessFn` override. There are **two** live
consumers of that default (the second was missed in the first draft and caught
in review):

- **ChatSessions** does **not** override → its doc-write handlers (from
  `appHandlers` in `chatMsgEvento`) fall through to `env.ACCESS_FN_DO`.
- **The worker `cf-serve` route** (app subdomain + asset host, `app.ts:308`)
  calls `cfServeAppCtx`/`cfServe` with no overrides → deployed-vibe doc writes
  run under the default `invokeAccessFn` → `env.ACCESS_FN_DO`. This path runs in
  the worker (no DO instance, no cached QuickJS), so it cannot simply reuse
  AppSessions' `localInvokeAccessFn`.

By contrast **AppSessions** overrides it with `localInvokeAccessFn` (local
QuickJS, `app-sessions.ts:156`) → never touches `env.ACCESS_FN_DO`.

> **Fail-open hazard (review P1).** Removing the default invoker is **not** safe
> on its own. `putDocEvento` gates access enforcement on
> `if (afbRow?.accessFnCid && vctx.invokeAccessFn)`
> (`app-documents-write-eventos.ts:217`): when `invokeAccessFn` is `undefined`
> the whole block — including the `forbidden` rejection — is **skipped and the
> write proceeds**. So a missing invoker fails **open**, not loud. Any context
> that still serves a doc-write handler must either keep a real invoker or gain
> an explicit fail-closed guard (reject when `accessFnCid` is set but no invoker
> is available).

So retiring `AccessFnDO` requires **both**: (1) get all doc writes off
ChatSessions (remove `appHandlers` from the chat plane), **and** (2) give the
worker `cf-serve` path a local access-fn evaluator (or route its doc-ops
WebSocket to AppSessions) so deployed vibes stop reaching `env.ACCESS_FN_DO` —
with a fail-closed guard in `putDocEvento` as the backstop. Only then is the
default invoker (and the class) safe to delete.

### What still routes doc ops through `chatApi`

From a full client audit (`pkg/app/`):

| Call site                                                        | Ops on `chatApi`                                                           | Has `vibeApi` on its route? |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------- |
| `components/ResultPreview/CommentsSection.tsx`                   | `queryDocs`, `subscribeDocs`, `onDocChanged`, `putDoc`, `whoAmI`           | yes (`/vibe/`, `/chat/`)    |
| `routes/vibe.$ownerHandle.$appSlug.tsx`                          | `subscribeViewerGrants`, `onViewerGrantsChanged`, `listDmThreads`, doc ops | yes                         |
| `components/DmThread.tsx`, `DmInbox.tsx`, `routes/messages*.tsx` | `queryDocs`, `putDoc`, `markDmRead`, `listDmThreads` (db `…--dm`)          | **no** — non-vibe pages     |

DMs are the load-bearing edge case: they are doc ops with no vibe page in
context, so they have no `vibeApi`. They need a home before `appHandlers` can
leave the chat plane (Track A §2).

## Track A — Retire AccessFnDO

**Goal:** delete the `AccessFnDO` DO class from all environments, its bindings,
source (`pkg/workers/access-fn.ts`), and env type. Unblocks the last open
#2265 §1 / #2264 §4 item.

Four dependency-ordered PRs (the worker `cf-serve` path, A2b, was added after
review surfaced it as a second live `env.ACCESS_FN_DO` consumer):

### A1 — Route vibe-scoped doc ops through `vibeApi`

In the components that already have a `vibeApi` on their route
(`CommentsSection`, `vibe.$ownerHandle.$appSlug` doc/grant ops), switch the
connection used for **vibe-scoped doc ops** from `chatApi` to
`vibeApi ?? chatApi`. The fallback keeps behavior identical when `vibeApi` is
absent (defensive; on these routes it is present). Chat-streaming calls
(`openChat`, `promptChatSection`, `getChatDetails`, settings, recents,
memberships, `forkApp`) stay on `chatApi`.

Net effect after A1: AppSessions (which has the local QuickJS access fn and
local broadcast) serves the doc ops, so doc-changed actually fans out and
access fns evaluate locally. No `chatApi` doc-write triggers `env.ACCESS_FN_DO`
**except DMs** (handled in A2).

### A2 — Give DMs a home, then remove `appHandlers` from the chat plane

DMs (`owner = channelUserSlug`, `appSlug = "dm"`) are vibe-style doc ops with
no vibe page. Open an AppSessions connection keyed by the DM pseudo-vibe
(`/api/app?vibe=<channelUserSlug>--dm`) and pass it to `DmThread`/`DmInbox`
instead of `chatApi`. This reuses the existing AppSessions data plane — no new
DO — and gives DMs local broadcast + local access fn for free.

Then move `appHandlers` **out of** `chatMsgEvento` so ChatSessions becomes
chat-only (`sharedHandlers + chatHandlers`), and update the
`evento-handler-parity` test and the now-resolved
`// until client routing is fully split (#2263)` manifest comments.

> **Do not** remove the default `invokeAccessFn` in this PR — `vibesMsgEvento`
> (which still has `appHandlers`) is live on the worker `cf-serve` path, and a
> missing invoker fails **open** (see the fail-open hazard above). The default
> stays until A2b moves that path; A2b adds the fail-closed guard.

**Gate:** parity test green; `pnpm check` green; preview smoke that doc ops,
comments, DMs, and access-fn gating still work.

### A2b — Migrate the worker `cf-serve` path off `env.ACCESS_FN_DO`

The app-subdomain / asset-host `cf-serve` route (`app.ts:308`) is the second
live consumer. Resolve it by **either**:

- **(preferred) route its doc-ops WebSocket to AppSessions** — have deployed
  vibes' iframe runtime connect through `/api/app?vibe=…` (AppSessions, with
  `localInvokeAccessFn`) like the editor does, leaving the worker `cf-serve`
  route for non-doc traffic (assets) only; **or**
- **give the worker path a local invoker** — pass an `invokeAccessFn` override
  into `cfServeAppCtx` at `app.ts:305` that evaluates access fns in-worker
  (cold QuickJS per request — simpler but less efficient than the DO's cached
  module).

Whichever path: also add a **fail-closed guard** in `putDocEvento` — when
`afbRow?.accessFnCid` is set but no `invokeAccessFn` is available, **reject**
the write instead of falling through. Then remove the default `invokeAccessFn`
from `cf-serve.ts`.

**Gate:** grep proves zero `env.ACCESS_FN_DO` references in non-test code; a test
asserting a doc-write with an access binding but no invoker is **rejected** (not
written); preview smoke of a **deployed** vibe's gated writes on its app
subdomain.

### A3 — Delete the AccessFnDO class (wrangler migration)

Unlike DocNotify, **cli's `AccessFnDO` is a local binding** (`wrangler.toml:343`,
no `script_name`) — every env owns its own class (each has
`v4 new_classes = ["AccessFnDO"]`). There is **no cross-script reference**, so
the 10061 ordering trap that forced DocNotify's two-deploy cli-first sequence
**does not apply**. AccessFnDO can be one PR:

- In **all six** env blocks (top-level/test, local, dev, preview, prod, cli):
  remove the `ACCESS_FN_DO` binding and append `v7 deleted_classes =
["AccessFnDO"]`. Keep every historical `v1..v6`.
- Remove `export { AccessFnDO }` from `pkg/workers/app.ts`; delete
  `pkg/workers/access-fn.ts`; remove `ACCESS_FN_DO: DurableObjectNamespace`
  from `api/types/cf-env.ts`; delete the default `invokeAccessFn` remnant if any
  remains; fix stale comments.

**Authoritative gate:** `wrangler deploy --dry-run` per env. If cli's
`v4 new_classes` after source removal trips a registry error, apply the same
contingency DocNotify used (the `deleted_classes` migration in the same config
clears it). `deleted_classes` is irreversible but safe — `AccessFnDO` stored
only transient eval state, never user data.

**Deploy order:** standard prod-before-cli is fine here (no cross-script
binding). Confirm with dry-run regardless.

## Track B — SharedSessions singleton DO

**Goal:** a singleton DO (`idFromName("global")`) that serves the stateless,
read-mostly D1 queries every page needs (sidebar/recent vibes, settings,
models, memberships, `whoAmI`) — the `sharedHandlers` set. Always warm because
all users hit one instance. This removes the reason a page must open a
`chatApi` (heavy codegen) or a `vibeApi` connection just to populate the
sidebar, and is the prerequisite for lazy ChatSessions and Track C.

Design-level (full TDD plan to follow its own brainstorm):

- New `pkg/workers/shared-sessions.ts` DO; bind `SHARED_SESSIONS` + a
  `v8 new_classes = ["SharedSessions"]` migration in all envs; cross-script
  bind cli → prod (same pattern as APP_SESSIONS/USER_NOTIFY).
- Serve a `sharedMsgEvento = sharedHandlers + WildCard/Error`. No doc ops, no
  streaming.
- Client: add `sharedApi` to `VibesDiyCtx`, opened on every page to
  `/api/shared`. Migrate `sharedHandlers` call sites
  (`useRecentVibes`, `useMemberships`, `listModels`, settings, `whoAmI` on
  non-vibe pages, `notifyApi`'s `subscribeUserNotifications`) from `chatApi`
  onto `sharedApi`.
- Then move `sharedHandlers` out of `chatMsgEvento` so ChatSessions is purely
  `chatHandlers`, and make ChatSessions **lazy** (constructed only on first
  prompt focus, not at page load).

**Open decisions for the brainstorm:** singleton hot-shard contention (one DO
for all read traffic — measure, consider N-way `global:0..k` sharding);
subscription fan-out for `subscribeUserNotifications` from a singleton vs.
keeping that on `UserNotify`; SSR/first-paint impact of an extra connection.

## Track C — `/chat/` route deprecation

**Goal:** fold chat into the `/vibe/` route — no standalone chat page. `vibeApi`
becomes the primary connection; `chatApi` is lazy and scoped to the prompt UI.
Depends on Track B (lazy ChatSessions) and Track A (clean connection roles).

Design-level (full TDD plan to follow its own brainstorm):

- Render the chat/prompt UI inside `routes/vibe.$ownerHandle.$appSlug.tsx`
  behind an "edit" affordance; lazy-open `chatApi` on first prompt focus.
- Redirect `/chat/:owner/:slug` → `/vibe/:owner/:slug` (preserve deep links;
  keep `routes/chat/prompt.tsx`'s new-vibe entry until replaced).
- Remove `imgGenAppSessionStopgapHandlers` once img streaming moves to the
  lazy chat session (the `#2350` stopgap's documented exit).
- Retire `vibesMsgEvento`/`chat.$ownerHandle.$appSlug.tsx` once nothing serves
  or routes to them.

**Open decisions for the brainstorm:** URL/SEO for editor vs viewer; preserving
existing `/chat/` deep links and analytics; the img-gen heavy/light session
split (the referenced `heavy-light-session-design.md` does not yet exist —
write it as part of C's brainstorm).

## Sequencing & dependencies

```
A1 (route doc ops → vibeApi)
   └─> A2 (DM home + remove appHandlers from chat plane)
          └─> A2b (migrate worker cf-serve path off env.ACCESS_FN_DO
                    + fail-closed guard in putDocEvento)
                 └─> A3 (delete AccessFnDO class)  ← closes #2265 §1 / #2264 §4

B (SharedSessions + lazy ChatSessions)             ← closes #2265 §2
   └─> C (/chat/ deprecation)                      ← closes #2265 §3
```

Both ChatSessions (A2) **and** the worker `cf-serve` path (A2b) must stop
reaching `env.ACCESS_FN_DO` before A3 can delete the class.

A and B are independent and can run in parallel. C requires B. A3 should land
before B starts touching `sharedHandlers`/ChatSessions to keep each connection
role change isolated, but it is not a hard dependency.

## Verification (all tracks)

- `pnpm check` (format + build + test + lint) per PR.
- Per-env `wrangler deploy --dry-run` is the authoritative gate for any
  wrangler.toml / DO-class change (Tracks A3, B).
- Post-change greps: Track A → zero `env.ACCESS_FN_DO` / `AccessFnDO` in
  non-comment source; Track B → `sharedHandlers` only referenced by
  `sharedMsgEvento`.
- Preview-deploy smoke per the `qa-pr` SOP for the client-routing PRs (A1, A2,
  B client migration, C).

## Out of scope

- Reworking `UserNotify` (live; untouched).
- The img-gen heavy/light session split beyond what Track C requires (its own
  spec).
