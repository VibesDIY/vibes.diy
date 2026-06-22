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
- **Handler manifest** (`evento-handler-manifest.ts`) is the single source of truth for which handlers go where; `chatMsgEvento` composes from the exported `chatPlaneHandlers` (`sharedHandlers + chatHandlers`, no `appHandlers`). The parity test enforces no overlap and that doc ops never re-enter the chat plane.
