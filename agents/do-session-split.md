# DO Session Split — Target Architecture

## Current state (PR #2253)

Three Durable Object types handle WebSocket connections:

| DO | Sharded by | Opens when | Handles |
|----|-----------|------------|---------|
| **AppSessions** | `ownerHandle--appSlug` | Vibe page load (`/api/app?vibe=...`) | Doc ops (putDoc, subscribeDocs, etc.), local broadcast, local QuickJS access fn eval |
| **ChatSessions** | Random UUID or vibe key | Page load (`/api?shard=...`) | Chat streaming (openChat, promptChatSection) |
| **UserNotify** | userId | On subscription | Cross-vibe user notifications, fan-out via `resolveShardDO` prefix routing |

**Transitional state:** all handlers registered on both AppSessions and ChatSessions (`appHandlers` in `chatMsgEvento`). Parent app React components still call everything on `vibeDiyApi` (chat connection). Doc notification callbacks are guarded — they broadcast on AppSessions, no-op on ChatSessions.

**DocNotify** and **AccessFnDO** receive no new traffic. Bindings stay in wrangler.toml (can't delete DO classes without a migration step). Source files stay for reference.

## Target architecture

Three connections per session, each with a clear scope:

| Connection | DO | Sharded by | Opens when | Handles |
|-----------|-----|-----------|------------|---------|
| **vibeApi** | AppSessions | `ownerHandle--appSlug` | Any page with a vibe in context | Doc ops, grants, invites, membership, access control, local broadcast, local QuickJS |
| **chatApi** | ChatSessions | Random UUID | First prompt focus (lazy) | openChat, promptChatSection, streaming only |
| **sharedApi** | SharedSessions | `"global"` (singleton) | Page load (always) | Sidebar queries, settings, models — stateless D1 reads |

### Migration path (tracked in #2263)

1. Rename `vibeDiyApi` → `chatApi`, `appDiyApi` → `vibeApi` across all consumers
2. Create `vibeApi` connection on ALL vibe-scoped pages (chat routes, settings, share — not just `/vibe/`)
3. Route grant/invite/membership calls through `vibeApi` in React components
4. Move those handlers from `sharedHandlers` back to `appHandlers` in `evento-handler-manifest.ts`
5. Remove `appHandlers` from `chatMsgEvento` — ChatSessions goes chat-only
6. Make ChatSessions lazy (open on first prompt focus)

### SharedSessions (separate PR)

Singleton DO (`idFromName("global")`) — always warm because all users hit the same instance. Handles stateless D1 queries needed on every page (sidebar, settings, models). Enables lazy ChatSessions by removing the need to open a chat connection for sidebar data.

### `/chat/` route deprecation (longer term)

Chat moves inline to the `/vibe/` route. No separate chat page — just a vibe page with a lazy chat connection. Simplifies routing: `vibeApi` is the primary connection, `chatApi` is lazy and scoped to the prompt UI.

## Key design decisions

- **Local broadcast replaces DocNotify.** All connections to the same vibe share one AppSessions DO instance. Notifications are `this.connections` iteration, zero subrequests.
- **Local QuickJS replaces AccessFnDO.** Cached WASM module on the DO instance, fresh VM context per eval. Lazy init — not in constructor.
- **CLI cross-script binds APP_SESSIONS to prod.** Same DO instances, shared data plane. Deploy prod before CLI.
- **`resolveShardDO` prefix routing** in UserNotify: `app:vibeKey` → APP_SESSIONS, plain shardId → CHAT_SESSIONS. Extensible via `SHARD_PREFIX_BINDINGS`.
- **Handler manifest** (`evento-handler-manifest.ts`) is single source of truth for which handlers go where. Parity test enforces no overlap.
