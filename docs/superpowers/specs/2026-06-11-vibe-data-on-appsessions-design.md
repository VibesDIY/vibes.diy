# Vibe data always on AppSessions — close the silent ChatSession leak (#2306) — design

## Summary

On apps that use an access function, real-time cross-user updates silently stop working whenever the access function routes documents to a channel whose name differs from the Fireproof database name. One user's writes never appear live in another user's browser — everything looks fine on reload, so it's easy to miss. This is [#2306](https://github.com/VibesDIY/vibes.diy/issues/2306).

The original issue framed it as an envelope-field overload (`evt-doc-changed.dbName` carrying the channel). [#2301](https://github.com/VibesDIY/vibes.diy/issues/2301) already fixed that envelope, and the **emit and subscribe both compute the correct channel key**. The remaining, deeper cause is a **transport-routing** bug:

> **Vibe document data can silently ride a `ChatSessions` DO instead of the `AppSessions` DO. `ChatSessions` deliberately does not wire the doc-changed emit (`localBroadcast`), so any write routed there persists but emits nothing — live cross-user sync dies with no error.**

This is the browser/iframe-transport sibling of the already-shipped headless fix ([#2303](https://github.com/VibesDIY/vibes.diy/issues/2303) / [#2304](https://github.com/VibesDIY/vibes.diy/pull/2304)), which routed Node/CLI consumers onto the canonical `/api/app` (AppSessions) and **explicitly left the iframe transport untouched**. This spec covers the iframe/browser transport.

## Background: the three handlers and where the leak is

Two Durable Object classes serve Firefly/app traffic today, plus a de-facto third "static" usage:

| Handler                      | Route param                              | DO                           | Wires the emit?                                                | Used for                                             |
| ---------------------------- | ---------------------------------------- | ---------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| **AppSessions** (`vibeApi`)  | `/api/app?vibe=owner--app` (`skipShard`) | per-vibe, `idFromName(vibe)` | **yes** — `localBroadcastCallbacks`                            | vibe document data + all DB subscriptions            |
| **ChatSessions** (`chatApi`) | `/api?shard=<key>`                       | per-shard                    | **no** — `cfServeAppCtx(req, env, cctx)` with no broadcast cbs | chat/codegen, user-level requests                    |
| **static / shared**          | —                                        | —                            | n/a                                                            | basic API requests that need neither chat nor a vibe |

Key facts (validated on `main`, post-DocNotify-deletion #2265):

- **`ChatSessions` does not wire `notifyDocChanged`** — [`chat-sessions.ts:106`](../../../vibes.diy/pkg/workers/chat-sessions.ts) calls `cfServeAppCtx(request, this.env, cctx)` with no broadcast callbacks. So `putDoc` on a ChatSessions DO persists the doc (and stores the correct channel assignment) but **skips the emit entirely** — a deliberate no-op pending migration.
- **`AppSessions` wires the channel-aware emit** — [`app-sessions.ts`](../../../vibes.diy/pkg/workers/app-sessions.ts) passes `...localBroadcastCallbacks(this.connections, this.env)` into the ctx.
- **`AppSessions` (and `UserNotify`) are cross-script-bound cli → prod** ([`wrangler.toml` `[env.cli.durable_objects]`](../../../vibes.diy/pkg/wrangler.toml)): `{ name = "APP_SESSIONS", class_name = "AppSessions", script_name = "vibes-diy-v2-prod" }`. So the per-vibe AppSessions DO is **one shared instance across cli + prod**, and `localBroadcast` within it reaches every connection for that vibe regardless of environment. cli's D1 `DB` is also `prod-vibes-diy-v2`. **DocNotify is deleted** — there is no cross-shard coordinator; per-vibe `localBroadcast` is the entire fan-out.
- **The leak:** the browser provider only builds `vibeApi` for `^/vibe/…` routes ([`vibes-diy-provider.tsx`](../../../vibes.diy/pkg/app/vibes-diy-provider.tsx)). The **`/chat/` editor** renders the live vibe-data iframe via `srvVibeSandbox` ([`chat.$ownerHandle.$appSlug.tsx`](../../../vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx)) but has **no `vibeApi`**, and every Firefly handler in [`srv-sandbox.ts`](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts) uses `const api = vibeApi ?? chatApi` (9 sites). So in the editor, vibe data **silently falls back to `chatApi` → ChatSessions → no emit**. `chatApi.onDocChanged` is also registered unconditionally — dead, since ChatSessions never emits.

## Evidence (live diagnosis on cli `vibes-diy@c2.4.72` with diagnostic logging)

- Reproduced #2306 in two browsers, steady state, on the cli deploy: a channel app (`useFireproof("quicknotes")`, access.js → channel `notes`) shows writes only on reload, never live. A no-access control app (channel == dbName) delivers live in the same browser — confirming it's the **channel/access-fn path**, not cross-shard.
- `db:inspect` of `AccessFnOutputs`: recent writes store `{"channels":["notes"],"grant":{"public":["notes"]}}` under the current binding CID — the channel assignment is correct.
- Diagnostic logging showed the subscribe correctly building `channelKeys=["owner/app/notes"]`. Crucially, that log fired in a **cli-local DO** — i.e. the subscription was served by **ChatSessions**, not the prod-bound AppSessions — direct evidence vibe data rode `chatApi`. (And because AppSessions runs in the prod script, cli-side logging can't see its emit at all, which is why the emit appeared "missing.")

## Proposed design

**Rule: vibe document data and all DB subscriptions go through `AppSessions`, always. Never `ChatSessions`. A missing `vibeApi` on a vibe-data path is a hard error, not a silent fallback.**

### 1. `vibeApi` for every route that renders the vibe-data iframe

Build `vibeApi` (→ `/api/app?vibe=owner--app`, `skipShard:true`) not only on `^/vibe/` but also on the **`/chat/` editor** — **lazily**, gated on an `appSlug` existing (some chats have no `appSlug` yet; we must not attach before one is assigned). Trigger creation when the chat gains its `appSlug`.

### 2. `srv-sandbox` Firefly handlers use `vibeApi` only

Replace `const api = vibeApi ?? chatApi` (9 data handlers: putDoc/getDoc/queryDocs/subscribeDocs/listDbNames/putAsset/deleteDoc/…) with `vibeApi`, and **throw/return a typed error** if `vibeApi` is absent. Remove the dead `chatApi.onDocChanged` registration; keep only `vibeApi.onDocChanged`.

### 3. Move `imgGen` to `vibeApi`

`vibe.imgGen` ([`srv-sandbox.ts:273`](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts)) currently uses `chatApi`; move it to `vibeApi` (maintainer direction). It is vibe-scoped, so AppSessions is the correct home.

### 4. `ChatSession` connects only for chat

`chatApi` (ChatSessions) should be created/connected only when the user is actually chatting — `/chat/` only. Non-vibe, non-chat pages (home, settings) use the **static/shared** handler (an AppSessions instance addressed with a fixed `shard="shared"`) for basic API requests.

### 5. `ChatSessions` emit stays a no-op now, type-error later

`ChatSessions` keeps no broadcast callbacks wired (no-op today). After the transport migration is complete and nothing can route vibe data there, make calling the emit on a ChatSessions ctx a **type error**, so the leak can never reappear.

## Fallout / migration

- **Only the `/chat/` editor breaks** by removing the fallback (it's the sole route rendering the vibe-data iframe without `vibeApi`). Step 1 (build `vibeApi` for the editor) is what makes the fallback removal safe — this is the "stopped short" reason the fallback existed.
- `imgGen` moves transports (step 3).
- Dead `chatApi.onDocChanged` removed.
- The static/shared handler is new wiring for non-vibe non-chat pages (home/settings).
- The `/vibe/` viewer already has `vibeApi` → unaffected by the data-path change.

## Out of scope

- **Headless transport** — already on canonical `/api/app` via #2303/#2304.
- **DocNotify** — deleted (#2265); no coordinator exists or is needed.
- **The `evt-doc-changed` envelope** — already correct via #2301.

## Open questions

Tracked in the PR review thread (see PR description). High level:

1. **Static handler shape** — reuse `AppSessions` with `shard="shared"`, or a dedicated lightweight handler? Hot-DO contention concerns for unrelated basic requests on one shared instance? Should "shared" also be cross-script-bound to prod, or cli-local?
2. **Editor `vibeApi` lazy trigger** — what is the canonical signal that a chat has gained its `appSlug`, and where should `vibeApi` creation hook in?
3. **`callAI` / `updateAvatarCid`** — `imgGen` moves to `vibeApi`; should `callAI` (LLM proxy, user auth/billing) and `updateAvatarCid` (user settings) also move, or stay on the user/chat session?
4. **Missing-`vibeApi` UX** — thrown error + toast, or a typed `Result` error surfaced to the iframe? What should the running vibe see?
5. **Type-error timing** — what's the concrete "fully migrated" criterion that flips the ChatSessions emit from runtime no-op to compile-time error?
