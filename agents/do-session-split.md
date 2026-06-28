# DO Session Split — Architecture

## Current state

Three Durable Object types back the realtime layer. **AppSessions** and
**ChatSessions** accept WebSocket connections; **UserNotify** does not — it's a
POST fan-out target (other DOs `fetch()` it to deliver notifications).

| DO               | Sharded by              | Opens when                                 | Handles                                                                                                                                                                                             |
| ---------------- | ----------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AppSessions**  | `ownerHandle--appSlug`  | Any page with a vibe (`/api/app?vibe=...`) | Vibe doc ops (putDoc, getDoc, queryDocs, deleteDoc, subscribeDocs, subscribeViewerGrants, listDbNames, markDmRead), local broadcast, local QuickJS access-fn eval                                   |
| **ChatSessions** | Random UUID or vibe key | Page load (`/api?shard=...`)               | Chat streaming (openChat, promptChatSection) + `sharedHandlers` (stateless D1 reads/grants/membership/whoAmI/listDmThreads/assetUploadGrant) + local QuickJS for app-create access-binding backfill |
| **UserNotify**   | userId                  | On subscription                            | Cross-vibe user notifications, fan-out via `resolveShardDO` prefix routing                                                                                                                          |

**Client connections** (`vibes-diy-provider.tsx`):

- **`chatApi`** → ChatSessions (`/api`). Chat streaming + the shared stateless queries the parent app still calls on the chat connection.
- **`vibeApi`** → AppSessions (`/api/app?vibe=owner--slug`). All vibe-scoped doc ops. Built on routes with a vibe in context (`vibeApiTarget`). `appApiFor(vibeKey)` builds an AppSessions connection for an arbitrary key — used for DM threads keyed `<channelUserSlug>--dm`.
- **`notifyApi`** → a lightweight ChatSessions connection on non-vibe pages (stable per-user shard) so the notifier doesn't open the heavy codegen `chatApi`.

**No DocNotify, no AccessFnDO.** Both DO classes have been **deleted** (see "What shipped" below). Doc-changed fan-out is local `this.connections` iteration on AppSessions; access-fn evaluation is local QuickJS on whichever DO runs the handler.

## What shipped (the #2253 → #2265 split)

Resolved the original transitional state — doc ops are off the chat plane, both legacy DOs are gone:

1. **Rename** `vibeDiyApi`→`chatApi`, `appDiyApi`→`vibeApi` (#2263).
2. **A1** — vibe-scoped doc ops (comments, viewer-grants) route through `vibeApi`/AppSessions (#2494).
3. **A2** — DM message docs ride a channel-keyed AppSessions connection; `appHandlers` removed from `chatMsgEvento` (ChatSessions is chat-only for doc ops). `listDmThreads`/`assetUploadGrant` reclassified to `sharedHandlers` (user-scoped, not vibe doc ops) (#2502).
4. **A2b** — ChatSessions got a local QuickJS `invokeAccessFn` (for app-create backfill); the default `env.ACCESS_FN_DO` invoker was removed from `cf-serve.ts`; `putDocEvento` fails closed when an access-bound write has no invoker (#2504).
5. **A3** — `AccessFnDO` class deleted from all envs (`v7 deleted_classes`), source/export/type removed (#2511). DocNotify was deleted earlier (#2297/#2298).

## Remaining (target architecture — not yet built)

A third connection, plus making the chat plane lazy:

| Connection    | DO             | Sharded by             | Opens when         | Handles                                             |
| ------------- | -------------- | ---------------------- | ------------------ | --------------------------------------------------- |
| **sharedApi** | SharedSessions | `"global"` (singleton) | Page load (always) | Sidebar queries, settings, models — stateless reads |

- **SharedSessions singleton DO** (#2265 §2) — host the `sharedHandlers` set so a page doesn't open a heavy `chatApi` just for sidebar/settings/models data. The top-level worker must route `/api/shared` → `SHARED_SESSIONS` (a dedicated route in `route-decision.ts`, not `resolveShardDO`).
- **Lazy ChatSessions** — once SharedSessions covers page-load reads, `chatApi` opens only on first prompt focus.
- **`/chat/` route deprecation** (#2265 §3) — chat inline on `/vibe/`; `vibeApi` primary, `chatApi` lazy and scoped to the prompt UI. Depends on lazy ChatSessions; also retires `imgGenAppSessionStopgapHandlers` (#2350) once img streaming moves to the lazy chat session.

## Key design decisions

- **Local broadcast replaced DocNotify** (now deleted). All connections to the same vibe share one AppSessions instance; notifications are `this.connections` iteration, zero subrequests.
- **Local QuickJS replaced AccessFnDO** (now deleted). Cached WASM module per DO instance, fresh VM context per eval, lazy init. Both AppSessions and ChatSessions supply a `localInvokeAccessFn` override; there is no default cross-DO invoker. A doc bound to an access fn with no invoker available **fails closed** (`app-documents-write-eventos.ts`).
- **CLI cross-script binds APP_SESSIONS + USER_NOTIFY to prod.** Same DO instances, shared data plane. Deploy prod before CLI. (AccessFnDO was a _local_ class in every env — no cross-script binding — which is why its deletion had no 10061 ordering trap; see `do-migrations.md`.)
- **`resolveShardDO` prefix routing** in UserNotify: `app:vibeKey` → APP_SESSIONS, plain shardId → CHAT_SESSIONS. Extensible via `SHARD_PREFIX_BINDINGS`.
- **Handler manifest** (`evento-handler-manifest.ts`) is the single source of truth for which handlers go where. As of #2714 it is **one declarative list** — each handler carries `allowed: ShardKind[]` (`"stream" | "vibe" | "shared"`), and every plane's evento is `handlersForShard(kind)`, a filter over that list. There are no longer three separate `sharedHandlers` / `appHandlers` / `chatHandlers` arrays to shuffle handlers between, and the `imgGenAppSessionStopgapHandlers` array is gone (`open-chat` / `prompt` just carry `allowed: ["stream","vibe"]`). The parity test asserts over `allowed` directly (doc ops are `["vibe"]` only; streaming is stream-bound). Re-homing a capability between planes is now a one-line `allowed` edit — no DO migration.

## #2714 — collapse three "APIs" into one shard-keyed surface

The three client connections (`chatApi`/`vibeApi`/`sharedApi`) and three DO classes (ChatSessions/AppSessions/SharedSessions) are the **same handler surface opened against a different shard key**. The shard key is the only thing that matters, so handlers should **declare** the shard kind(s) they support instead of being **quarantined** into per-plane arrays (decision: declare, one API — see issue #2714).

**Shipped (step 2 of the build shape): the declarative manifest.** `ShardKind`, the single `handlerManifest` (each entry `{ allowed, handler }`), and `handlersForShard(kind)`. Behavior-preserving: each plane's served set is byte-for-byte what it was, but the placement metadata now lives in one place that both composition and tests read.

**Why it's safe to unify (two reasons a handler was shard-bound):**

- **(a) code/capability presence** — dissolved by loading the capability on the allowed planes behind a lazy `import()`. Not a security boundary; the access control _is_ the access-fn running, which travels with the code.
- **(b) stateful rendezvous / topology** — irreducible. A doc write does **local broadcast** on the vibe shard; `subscribeDocs`/`subscribeViewerGrants` fan out to co-tenant sockets that only exist there; chat streaming has per-shard backpressure. These stay `VIBE_ONLY` / `STREAM_*`. **The monolith unifies code; it never unifies topology.**

**Remaining (TDD plan, not yet built):**

1. **Source-of-truth module in a shared package** so browser `pkg` and worker `api/svc` both import `ShardKind` + the `allowed` metadata and can't drift. (Today the manifest lives in `api/svc`; the browser side doesn't yet consume it.)
2. **Branded client connections + a `call(conn, handler)` constraint** — the connection's `kind` must be a member of the handler's `allowed` set → **kind mismatch is a compile error** in the browser. Branded shard-key constructors (`openVibe`/`openShared`/`openStream`) pick the right key.
3. **Single dispatch gate in the DO** — at runtime, mirror the kind check **and** add a **fail-loud identity assertion** for category-(b) handlers: the connection's shard identity must match the request's target (`owner--appSlug`), else **throw** — a write that can't reach its vibe's broadcast shard must never persist-and-go-quiet. Types enforce _kind_; runtime enforces _identity_.
4. **Lazy-load the heavy capability modules** (QuickJS access-fn, streaming) via `find_additional_modules` + `rules` so a cheap shared/read instance never parses them (1 s startup budget; DO hibernation re-runs global scope on wake — verify).
5. **Wrangler / migration sequencing** from 3 DO classes → 1 (open question: keep streaming isolated for blast-radius, or go fully monolithic).

Open questions carried from the issue: singleton hot-shard contention (`global:0..k`?); DO-hibernation startup cost; one-plane-isolated vs fully monolithic.
