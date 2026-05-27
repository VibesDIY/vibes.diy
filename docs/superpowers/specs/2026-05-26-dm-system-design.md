# DM System Design

**Date:** 2026-05-26  
**Issue:** https://github.com/VibesDIY/vibes.diy/issues/1947  
**Status:** Draft

## Overview

A direct message system between user handles. Each thread is a 1:1 relationship between two handles. Threads are global — not owned by any vibe — but a message can carry a `vibeRef` when initiated from inside a vibe. Multiple handles per user means multiple independent threads; there is no cross-handle linking.

## Core Insight: DM Thread as a Fake Vibe

AppDocuments, DocNotify, putDoc, queryDocs, subscribeDocs, and deleteDoc all work on `(userSlug, appSlug, dbName)` triples. Rather than a new storage path, a DM thread IS a vibe — a system-namespace vibe:

```
userSlug = "_d.alice.bob"   ← _d prefix (direct), alpha-sorted handles
appSlug  = "dm"             ← the text DM app within the 1:1 channel
dbName   = <vibe-chosen>    ← whatever the app wants: "messages", "chat", etc.
```

`_d.alice.bob` is the **1:1 direct channel** between alice and bob. It is a shared namespace that can host multiple apps: `appSlug = "dm"` for text messages, but also `appSlug = "notes"`, `appSlug = "project"`, or any future shared vibe between the pair. Within each app, `dbName` is whatever the vibe uses — the channel doesn't prescribe it.

`_d` is a reserved prefix meaning "direct channel." No real handle can start with `_`. Dots separate components; real handles are `[a-z0-9-]+` so dots are unambiguous as separators. The `_` namespace is extensible for other system-level fake vibes in the future.

The entire existing write path, subscription fan-out, and DocNotify infrastructure serves DMs for free.

**Channel address derivation:**
```typescript
function directChannelHandle(a: string, b: string): string {
  const [p, q] = [a, b].sort();
  return `_d.${p}.${q}`;
}
// directChannelHandle("bob", "alice") === directChannelHandle("alice", "bob") === "_d.alice.bob"
```

## Schema

Two new tables (both SQLite and Postgres — no dev/prod divergence):

### DirectChannelIndex

Fast lookup: "all DM threads this handle participates in."

```typescript
(handle TEXT, threadHandle TEXT)
PK (handle, threadHandle)
```

Two rows written per thread creation: one for each participant. Enables `listDmThreads` as a single indexed scan on `handle`.

### DirectChannelReads

Per-thread read watermark for unread counts.

```typescript
(threadHandle TEXT, handle TEXT, lastSeenSeq INT)
PK (threadHandle, handle)
```

`unreadCount = latestSeq - lastSeenSeq` (or 0 if no read record yet).

Messages themselves live in **AppDocuments** at `(channelHandle="_d.alice.bob", appSlug="dm", dbName="messages")`. The `dbName` is chosen by the vibe; `"messages"` is the convention for the text DM app.

### Message doc shape

```typescript
{
  body: string          // max 2000 chars, enforced server-side
  vibeRef?: {           // present when thread was initiated from a vibe
    userSlug: string
    appSlug: string
  }
  createdAt: string     // ISO timestamp
}
```

`authorHandle` is not stored in the doc — derived from the authenticated user on write, stored in the AppDocuments `userId` column.

## ACL

New branch in `db-acl-resolver.ts`, checked before any vibe-membership lookup:

```typescript
if (userSlug.startsWith("_d.")) {
  const [, handleA, handleB] = userSlug.split(".");
  const authedHandle = ctx.authedHandle;
  if (authedHandle !== handleA && authedHandle !== handleB) {
    return Result.Err("not a participant");
  }
  return Result.Ok({ write: ["participants"], delete: ["participants"] });
}
```

No app settings lookup, no vibe membership check. Participant check is the only gate.

## New API Endpoints

Three new WebSocket message types. Everything else reuses existing types with the `_d.*` handle as `userSlug`.

### `listDmThreads`

```typescript
ReqListDmThreads: {
  type: "vibes.diy.req-list-dm-threads"
  pager?: { limit: number; cursor?: string }
}
ResListDmThreads: {
  type: "vibes.diy.res-list-dm-threads"
  items: Array<{
    threadHandle: string     // "_d.alice.bob"
    otherHandle: string      // the other participant
    latestMessage: { body: string; createdAt: string; authorHandle: string }
    latestSeq: number
    unreadCount: number
  }>
}
```

Server joins `DirectChannelIndex → AppDocuments (latest seq per thread) → DirectChannelReads`.

### `markDmRead`

```typescript
ReqMarkDmRead: {
  type: "vibes.diy.req-mark-dm-read"
  otherHandle: string
  lastSeenSeq: number
}
ResMarkDmRead: {
  type: "vibes.diy.res-mark-dm-read"
}
```

Upserts `DirectChannelReads` for `(threadHandle, authedHandle)`.

### `req-open-dm-thread` (iframe bridge only)

Sent by a vibe iframe to initiate a DM with the vibe owner:

```typescript
ReqOpenDmThread: {
  type: "vibes.diy.req-open-dm-thread"
  recipientHandle: string
}
```

The bridge host responds by navigating the top-level frame to `/messages/{myHandle}/{recipientHandle}`. The `vibeRef` is injected from the current vibe context and pre-populated in the thread composer. No actual message is sent until the user types and submits.

## Queue / Notifications

`evt-dm-received` fires on every new message delivered to the recipient. Follows `evt-comment-posted` exactly:

- Registered in `queue-evento.ts`
- Handler in `api/queue/handlers/evt-dm-received.ts`
- `buildDmEmbed()` in `post-to-discord.ts` — shows sender handle, snippet, optional vibe link

## Routes

**`/messages`** — inbox. Lists all threads from `listDmThreads` for the current handle, sorted by latest activity. Total unread badge = sum of all thread unread counts.

**`/messages/:handleA/:handleB`** — thread view. Normalized on load (alpha sort). Renders message list + composer. Calls `markDmRead` on mount and when new messages arrive. Unsubscribes on unmount.

Both routes require authentication. Redirect to sign-in if unauthed.

## UI Surfaces

### ExpandedVibesPill

New `dmUnreadCount` prop alongside existing `communityBadgeCount`. Distinct color badge. Tapping navigates to `/messages/{viewerHandle}/{ownerHandle}`. Fetched on vibe load alongside the existing `listRequestGrants` call (same pattern, lines 171–184 of `vibe.$userSlug.$appSlug.tsx`).

### Sidebar

"Messages" nav entry with total unread badge. Navigates to `/messages`.

### Forward path: multi-thread and groups (see #1949)

The `_d.alice.bob/dm` app controls its own `dbAcls` like any vibe. Future extensions require no new namespaces:

- **Multiple threads** — new `dbName` per thread (ULID). `listDmThreads` enumerates all dbNames under `_d.*/dm`.
- **Group threads** — override a specific `dbName`'s ACL via `ensureAppSettings`, then invite via the existing access request system. One codebase.

### Comment on scoping evolution

Currently comments are vibe-scoped: `(ownerHandle, appSlug, "comments")` lives under the vibe owner's handle. DMs establish the `_d.*` reserved-namespace pattern. In future, comments could migrate to a similar system namespace — decoupling thread storage from vibe ownership. Not this PR.

## Open Questions

1. **Body limit:** 2000 chars is the proposal. Adjust before implementation if needed.
2. **Unread on inbox load vs push:** Current plan is load-time `listDmThreads` + subscription update. Validate this is fast enough at scale.
3. **Handle validation:** Confirm `[a-z0-9-]+` is the enforced pattern so dots are safe as separators.

## Files to Touch

| File | Change |
|------|--------|
| `api/sql/vibes-diy-api-schema-sqlite.ts` | Add DirectChannelIndex, DirectChannelReads tables |
| `api/sql/vibes-diy-api-schema-postgres.ts` | Same |
| `api/types/db-acls.ts` | `DM_THREAD_PREFIX = "_d."` constant |
| `api/types/app-documents.ts` | `evtDmReceived` type; `listDmThreads`/`markDmRead` req/res types |
| `api/svc/public/db-acl-resolver.ts` | Participant check branch for `_d.*` handles |
| `api/svc/public/app-documents.ts` | `listDmThreadsEvento`, `markDmReadEvento` handlers |
| `api/queue/handlers/evt-dm-received.ts` | New queue handler |
| `api/queue/queue-evento.ts` | Register evt-dm-received |
| `api/queue/intern/post-to-discord.ts` | `buildDmEmbed()` |
| `base/components/ExpandedVibesPill.tsx` | `dmUnreadCount` prop + badge |
| `pkg/app/routes/vibe.$userSlug.$appSlug.tsx` | Fetch dmUnreadCount on load |
| `pkg/app/routes/messages.tsx` | New inbox route |
| `pkg/app/routes/messages.$handleA.$handleB.tsx` | New thread route |
| `pkg/app/components/DmThread/` | Thread view + composer components |
| `pkg/app/components/DmInbox/` | Inbox list component |
| `vibes.diy/api/types/iframe-bridge.ts` | `req-open-dm-thread` message type |
| `api/tests/dm-acl.test.ts` | New ACL + behavior tests |
