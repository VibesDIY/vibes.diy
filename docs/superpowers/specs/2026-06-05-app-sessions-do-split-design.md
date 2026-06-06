# AppSessions DO — merged DocNotify + inlined AccessFn

**Issues:** [#2231](https://github.com/VibesDIY/vibes.diy/issues/2231), [#2248](https://github.com/VibesDIY/vibes.diy/issues/2248), [#2249](https://github.com/VibesDIY/vibes.diy/issues/2249)

## Problem

ChatSessions DO uses the standard WebSocket API. All WebSocket message handlers share the subrequest budget of the original `fetch()` that accepted the connection. Each putDoc makes 2-3 DO-to-DO subrequests (ACCESS_FN_DO + DocNotify + conditional grants notifications). After ~12 edits the cumulative budget is exhausted and putDoc fails with "Subrequest depth limit exceeded." Page refresh fixes it (new connection = fresh budget).

Secondary: DocNotify and UserNotify DOs accumulate stale shard registrations (observed: 36 stale subscribers) because WebSocket close handlers skip deregistration to avoid a race condition.

## Design

New **AppSessions** Durable Object that handles all app document operations. Sharded by `(ownerHandle/appSlug)` so all connections to the same vibe land on the same DO. This eliminates DocNotify (notifications are local broadcasts) and inlines ACCESS_FN_DO (QuickJS runs locally with cached WASM module). ChatSessions stays untouched.

### Per-putDoc DO-to-DO subrequests: zero

| Operation                        | Before (ChatSessions) | After (AppSessions)    |
| -------------------------------- | --------------------- | ---------------------- |
| ACCESS_FN_DO.fetch()             | 1 subrequest          | 0 — local QuickJS eval |
| DocNotify.fetch()                | 1 subrequest          | 0 — local broadcast    |
| DocNotify → ChatSessions fan-out | 1+ subrequests        | 0 — no coordinator     |
| subscribeDocs registration       | 1 subrequest          | 0 — local state        |
| **Total DO-to-DO**               | **3+**                | **0**                  |

### Why split instead of migrating ChatSessions

Chat is moving inline to the vibe route. The natural connection lifecycle is:

- **AppSessions WS** — opens on page load, handles putDoc/getDocs/subscribeDocs/grants. Always on.
- **ChatSessions WS** — opens on first prompt focus. Handles openChat/promptChatSection/streaming. On-demand.

The chat connection's setup cost (new shard DO, appCtx creation, auth) happens while the user is focused on the prompt UI — pure free time.

### Sharding

AppSessions is sharded by `(ownerHandle/appSlug)` — all connections to the same vibe share one DO instance. The client connects to `/api/app?vibe=ownerHandle--appSlug`.

This eliminates the need for DocNotify as a cross-shard coordinator. Notifications are just local broadcasts: iterate connections, match subscription keys, `ws.send()`.

Tradeoff: all viewers of a popular vibe share one DO. CPU contention risk under high concurrency, mitigated by Cloudflare DO connection limits (~32K) and most vibes having <10 concurrent viewers. The `--` separator is safe — double-hyphen is not allowed inside normalized slug tokens.

Escape hatch: if a vibe hits contention, partition the key (e.g. `ownerHandle--appSlug:partition`) in a future PR.

### Notification flow

putDoc handler in AppSessions:

1. Evaluate access function locally (cached QuickJS WASM module, fresh VM context per eval)
2. D1 INSERT
3. Iterate `this.connections` — for each connection subscribed to this `(ownerHandle/appSlug/dbName)`, `ws.send()` the doc-changed event (skip sender by `connId`)

Zero subrequests. Zero external coordination. Same flow for `evt-request-grant`.

Exception: `evt-viewer-grants-changed` delivers TO the sender (do NOT skip by connId) so the writer's iframe refreshes whoAmI after its own grant-changing write.

### Inlined access function evaluation

AccessFnDO runs QuickJS in a WASM sandbox. It makes no I/O of its own — the isolation boundary is QuickJS, not the DO. AppSessions caches the compiled QuickJS WASM module on the DO instance and evaluates access functions directly.

Each evaluation gets a fresh `vm = QuickJS.newContext()` — no state leaks between evaluations. The access function source is cached by CID (content-addressed, immutable).

### Memoized lookups

Cache repeated queries in memory on the DO instance. Populated on first access, reused across subsequent messages.

| Lookup                               | Cache key                                      | Invalidation                                            |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------------------- |
| QuickJS WASM module                  | singleton                                      | Never (reuse across evals)                              |
| `accessFunctionBindings` row         | `${ownerHandle}/${appSlug}/${dbName}`          | Access fn redeployed (rare; cache miss is fine)         |
| `handleBinding` (writer's handle)    | `userId`                                       | Never within a session                                  |
| Access fn source via `storage.fetch` | CID (content-addressed)                        | Never for same CID                                      |
| `accessFnOutputs` grant state        | `${ownerHandle}/${appSlug}/${dbName}/${fnCid}` | Grant change; invalidate on putDoc that modifies grants |

### Message type split

**Rubric:** Operations scoped to a vibe instance (ownerHandle/appSlug) — its data, ACLs, membership, identity — belong on AppSessions. Operations that depend on chat streaming state (chatIds) stay on ChatSessions.

**AppSessions** (vibe-scoped):

- Data: `putDoc`, `getDoc`, `queryDocs`, `deleteDoc`, `listDbNames`
- Subscriptions: `subscribeDocs`, `subscribeViewerGrants`, `subscribeRequestGrants`, `subscribeUserNotifications`
- Access control: `requestAccess`, `approveRequest`, `requestSetRole`, `revokeRequest`, `hasAccessRequest`, `createInvite`, `revokeInvite`, `redeemInvite`, `hasAccessInvite`, `inviteSetRole`, `listInviteGrants`
- Membership: `listMembers`, `listMemberships`, `whoAmI`
- Assets: `assetUploadGrant`
- DMs: `listDmThreads`, `markDmRead`

**ChatSessions** (chat streaming state):

- `openChat`, `promptChatSection` (depend on chatIds)
- `ensureAppSlugItem` (app creation, starts a chat)
- `getChatDetails`, `listApplicationChats` (chat queries)
- `forkApp` (creates a new chat session)

**Registered on both DOs** (stateless D1 queries needed before a vibe or chat context exists, or by callers on either connection — just import the same handler into both Evento instances):

- `ensureAppSettings`, `ensureUserSettings`
- `listUserSlugAppSlug`, `listRecentVibes`, `pinRecentVibe` — sidebar needs these on any page, regardless of which connection is open
- `getAppByFsId`, `listModels`

**Registered on both DOs** (continued — settings/identity flows, not chat-stateful):

- `listHandleBindings`, `createHandleBinding`, `deleteHandleBinding`
- `getCertFromCsr`

**Default to ChatSessions** (only needed during prompt flow):

- `setModeFsId`
- Report endpoints

### UserNotify

Stays separate — keyed by userId (cross-vibe), different namespace. AppSessions registers with UserNotify on `subscribeUserNotifications` and deregisters on WebSocket close (100ms delay to avoid race with reconnect).

UserNotify currently hardcodes `env.CHAT_SESSIONS.get(shardId)` for fan-out delivery. With AppSessions subscriptions, UserNotify needs an `APP_SESSIONS` binding and must resolve the correct DO namespace per subscriber. Registration includes `{ shardId, doType: "app" | "chat" }` so fan-out calls `env.APP_SESSIONS.get(shardId)` or `env.CHAT_SESSIONS.get(shardId)` accordingly. This changes `user-notify.ts` (subscriber storage schema + fan-out logic) and `wrangler.toml` (add APP_SESSIONS binding to UserNotify).

### Edge worker routing

```
// Existing — chat/prompt WebSocket
if (route === "chat-api") {          // /api?shard=...
  const shard = url.getParam("shard") ?? crypto.randomUUID();
  return env.CHAT_SESSIONS.get(env.CHAT_SESSIONS.idFromName(shard)).fetch(request);
}

// New — vibe-scoped WebSocket
if (route === "app-api") {           // /api/app?vibe=ownerHandle--appSlug
  const vibe = url.getParam("vibe"); // required
  return env.APP_SESSIONS.get(env.APP_SESSIONS.idFromName(vibe)).fetch(request);
}
```

`route-decision.ts` adds `"app-api"` for `pathname === "/api/app"` with WebSocket upgrade. Must match before the generic `/api` route. The existing `/api` route stays unchanged. Client must not append `shard=` on `/api/app` requests — `vibe=` is the only shard key.

### Impact on callers

- **CLI**: Today it only does chat operations (`ensureAppSlug`, `openChat`, `promptChatSection`) and points at `/api`. For `whoAmI`, grants, invites, and other AppSessions handlers, the CLI opens a second `VibesDiyApi` instance pointing at `/api/app?vibe=ownerHandle--appSlug`. Same pattern as the web app — two connections, shared auth. This is additive; the existing chat connection doesn't change.
- **vibe-runtime** (iframe): Changes URL to `/api/app?vibe=ownerHandle--appSlug`.
- **Web app**: Creates two `VibesDiyApi` instances with different URLs. Routes methods to the right instance. Shared auth.

A misrouted message gets "Not Implemented" from the wildcard handler — same as any unknown message type today.

### wrangler.toml

```toml
[durable_objects]
bindings = [
  { name = "CHAT_SESSIONS", class_name = "ChatSessions" },
  { name = "APP_SESSIONS", class_name = "AppSessions" },
  { name = "DOC_NOTIFY", class_name = "DocNotify" },
  { name = "USER_NOTIFY", class_name = "UserNotify" },
  { name = "ACCESS_FN_DO", class_name = "AccessFnDO" },
]

[[migrations]]
tag = "v5"
new_classes = ["AppSessions"]
```

DocNotify and ACCESS_FN_DO bindings stay in wrangler.toml — can't delete DO classes without a migration step. They receive no new traffic after this change.

### Files changed

| File                                 | Change                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `pkg/workers/app-sessions.ts`        | New DO class — WebSocket handling, local broadcast, local QuickJS eval, memoized caches           |
| `pkg/workers/app.ts`                 | Add routing for `app-api` → APP_SESSIONS, export AppSessions                                      |
| `pkg/workers/route-decision.ts`      | Add `"app-api"` route decision                                                                    |
| `pkg/wrangler.toml` (+ env variants) | Add APP_SESSIONS binding + v5 migration                                                           |
| `pkg/workers/user-notify.ts`         | Add `doType` to subscriber storage; fan-out resolves APP_SESSIONS or CHAT_SESSIONS per subscriber |
| `api/svc/cf-serve.ts`                | Extract reusable appCtx creation; add local broadcast + local access fn eval to vctx              |
| Client: vibe-runtime connection URL  | Point at `/api/app?vibe=ownerHandle--appSlug`                                                     |

### Files NOT changed

- `pkg/workers/chat-sessions.ts`
- `pkg/workers/doc-notify.ts`
- `pkg/workers/access-fn.ts`
- All Evento handler files (same WSSendProvider interface)
- All chat files (open-chat.ts, prompt-chat-section.ts, etc.)
- `api/svc/svc-ws-send-provider.ts`

### Module startup

Be mindful of top-level module startup tasks. QuickJS WASM compilation (`getQuickJSWASMModule()`) is expensive and must NOT run at module load or in the constructor — initialize lazily on first access function evaluation. Same for Drizzle DB setup: cache on the DO instance but create lazily, not in the constructor. The WebSocket accept path should be fast — heavy initialization happens on first message that needs it.

### Risk areas

1. **Client routing** — new client code to manage two connections. The web app must route messages to the correct connection by type. Reconnection and auth refresh need to work independently.
2. **QuickJS memory** — WASM module stays in memory on the DO instance. Keep cache opportunistic (DO memory is ephemeral). Cloudflare isolate limit is 128MB — monitor usage.
3. **Memoization staleness** — cached accessFnBindings or grant state could be stale if another user deploys a new access function or grants change. Acceptable: cache miss on DO eviction provides natural refresh; grant state invalidated on putDoc that modifies grants.
4. **Popular vibes** — all viewers share one DO. CPU contention under high concurrency. Monitor and add Hibernation API if needed.

### Later (separate PRs)

- Remove DocNotify DO class via wrangler migration (after traffic drains)
- Remove ACCESS_FN_DO class via wrangler migration (after traffic drains)
- Delete `doc-notify.ts` and `access-fn.ts` source files
- Remove `docNotifyCallbacks` and `invokeAccessFn` wiring from `cf-serve.ts`
- Add Hibernation API to AppSessions if CPU contention warrants it
- ChatSessions Hibernation (if chat operations ever hit subrequest limits)
