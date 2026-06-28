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

**Shipped — step 2, the declarative manifest (#2715).** `ShardKind`, the single `handlerManifest`, and `handlersForShard(kind)`. Behavior-preserving: each plane's served set is byte-for-byte what it was, but the placement metadata now lives in one place that both composition and tests read.

**Shipped — Spec A, the enforcement layer (#2722).** Built on the current 3-DO topology with **no migration**:

- **Source-of-truth module in `api-types`** (`shard-policy.ts`): `ShardKind` (now `"codegen" | "vibe" | "shared"` — renamed from `"stream"`, since streaming isn't exclusive to ChatSessions; the vibe shard streams too for img-gen), `SHARD_POLICY` keyed by request `type` (static `ShardKind[]` or a `(req)=>ShardKind[]` **mode predicate** for `open-chat`/`prompt`), branded shard-key constructors (`openVibe`/`openShared`/`openCodegen`), and `ShardIdentity`. The worker manifest derives `allowed` from `SHARD_POLICY`; a parity test pins manifest⇄policy 1:1. Both planes import it → can't drift.
- **Browser compile-time kind gate** — `Conn<K extends ShardKind>` derives method availability from `SHARD_POLICY` (a method exists only if `K` is allowed; `openChat` narrows to `mode:"img"` on `Conn<"vibe">`). The three connections are branded `Conn<"codegen">`/`Conn<"vibe">`/`Conn<"shared">`. `putDoc` on `sharedApi` is a compile error.
- **Worker runtime gate** — each DO injects `{ kind, shardId }` into `appCtx`; `gated()` (in `api/svc/shard-gate.ts`) does the kind+mode check at dispatch and a **fail-loud identity assert** for vibe-keyed ops (`${owner}--${appSlug} === shardId`, doc ops inline, chat ops post-resolution). On mismatch it **sends a coded `ResError`** (`wrong-shard` / `wrong-shard-kind`) and stops dispatch — never persist-and-go-quiet. (A bare throw would be rewritten to `internal-error` by the WS catch, so it sends, not throws.) Types enforce _kind_; runtime enforces _identity_.

**Why it's safe to unify (two reasons a handler was shard-bound):**

- **(a) code/capability presence** — dissolvable by loading the capability on the allowed planes behind a lazy `import()` (Spec B). Not a security boundary; the access control _is_ the access-fn running, which travels with the code.
- **(b) stateful rendezvous / topology** — irreducible. A doc write does **local broadcast** on the vibe shard; `subscribeDocs`/`subscribeViewerGrants` fan out to co-tenant sockets that only exist there; chat streaming has per-shard backpressure. These stay vibe-only / codegen-only. **The monolith unifies code; it never unifies topology** — which is why the runtime identity gate is the part you can never delete.

**Remaining — Spec B, the physical collapse (not yet built):**

1. **Lazy-load the heavy capability modules** (QuickJS access-fn, streaming) via `find_additional_modules` + `rules` so a cheap shared/read instance never parses them (1 s startup budget; **verify whether DO hibernation re-runs global scope on wake** — this measurement gates the collapse). Today QuickJS is a static top-level import in `cf-serve.ts` (parsed by every DO incl. the lean shared one); the WASM instantiation is already lazy, the module import is not.
2. **Wrangler / migration sequencing** from 3 DO classes → 1 (or 2 — open question: keep codegen isolated for blast-radius, or go fully monolithic).

Spec A makes Spec B a pure infra/migration job: by the time a handler can run on a different shard, the identity gate already guarantees it can't quietly serve the wrong one.

Open questions carried from the issue: singleton hot-shard contention (`global:0..k`?); DO-hibernation startup cost; one-plane-isolated vs fully monolithic.

Spec A deploy note: ordinary worker deploy (no wrangler/DO change), trivial rollback. The one runtime change is the fail-loud gate; its false-positive surface is effectively nil for active features (normal + srv-sandbox writes have `target == shardId`; admin/fork don't hit the identity branch; DM channel-keyed writes are the only theoretical mismatch and the feature is gated/invisible).
