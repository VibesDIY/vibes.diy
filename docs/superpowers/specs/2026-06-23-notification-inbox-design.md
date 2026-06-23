# Unified notification inbox (#2544)

**Date:** 2026-06-23
**Status:** Draft (design)
**Issue:** [#2544](https://github.com/VibesDIY/vibes.diy/issues/2544)
**First consumer:** remix notifications —
`docs/superpowers/specs/2026-06-23-remix-notifications-design.md`

## Problem

Vibe activity notifications are **ephemeral and fragmented**. There is no place a
user can see what happened across their vibes, and an event that fires while they
are offline is lost forever.

### What exists today (verified)

- `qctx.notifyUser(userId, evt)` (`api/queue/queue-ctx.ts:132`) POSTs to the
  `UserNotify` Durable Object (`pkg/workers/user-notify.ts`).
- `UserNotify` persists **only the set of subscriber shards** (live connections),
  and on `notify` **fans the event out to connected shards, dropping it if none
  are connected**. The event itself is never stored.
- There is **no notifications table** (`api/sql/*` has no notification schema) and
  **no read/unread state** for the bell.
- Notification types today (`EvtUserNotification.notificationType`): `build-complete`,
  `build-failed`, `vibe-published`, `comment-posted`, `request-approved`,
  `request-revoked`. Emitters: `evt-new-fs-id`, `evt-comment-posted`,
  `evt-request-grant`. `evt-dm-received` exists and posts Discord/email but is not
  a `notifyUser` type.
- Email/Discord are fire-and-forget side effects, also unstored.
- The only persisted "unread"-like state is **DM unread counts**
  (`DirectChannelReads` watermark) — derived from DM _content_ in Firefly, not from
  the notification system.

## Core principle: a notification is self-contained

Each notification row carries **everything the basic inbox list needs to render
itself** — a human-readable message captured at emit time — so the default list
view reads straight from the `Notifications` table with **no joins and no second
query**. The notification content lives on the table.

**Linking to another persisted object is the special case.** Some types also
reference a separate persisted object — a DM thread, a remixed app, a vibe — via an
optional `targetRef`. The **type-specific renderer MAY do a second query** to
hydrate richer or live detail (current vibe title, a screenshot, a thread
preview), but the base list never depends on it; if the linked object is gone or
inaccessible, the row still renders from its own stored content.

Consequences:

- The row stores its own rendered `body` (e.g. "@alice remixed your vibe Foo", or a
  short DM snippet) — that is the source of truth for the list view.
- It does **not** become the source of truth for the linked object's full content:
  DM message bodies, comment docs, and app source still live in their vibe / Firefly
  db, gated by that db's access rules (see #2290). The notification holds a snapshot
  message + an optional pointer, not the canonical record. A "new DM" notification
  is still not the DM thread itself.
- So the inbox is self-contained and fast by default, and progressive-enhancement
  hydration is opt-in per type — without overlapping the "content is vibes + Firefly"
  direction.

## Substrate decision

**A new bespoke `Notifications` table in D1/SQL** (dual sqlite + pg schema), per
project direction. This is the one place we accept schema work — it is the durable
backbone the whole product leans on, unlike a single stream (cf. the remix spec,
which deliberately avoided schema for one stream).

## Architecture

### Unit 1 — `Notifications` table (`api/sql/vibes-diy-api-schema-{sqlite,pg}.ts`)

| Column             | Type        | Notes                                                                                                                                                      |
| ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | text PK     | ULID — sortable by creation                                                                                                                                |
| `userId`           | text        | recipient (Clerk id)                                                                                                                                       |
| `notificationType` | text        | `vibe-remixed` \| `comment-posted` \| `vibe-published` \| `dm-received` \| `request-approved` \| `request-revoked` \| `build-complete` \| `build-failed`   |
| `ownerHandle`      | text        | subject vibe owner (usually the recipient)                                                                                                                 |
| `appSlug`          | text        | subject vibe                                                                                                                                               |
| `body`             | text        | **self-contained rendered message** for the list view (e.g. "@alice remixed your vibe Foo"); captured at emit time so the row renders with no second query |
| `actorHandle`      | text (null) | who caused it (remixer, commenter, sender) — for icon/structured rendering                                                                                 |
| `actorUserId`      | text (null) | actor Clerk id                                                                                                                                             |
| `targetRef`        | JSON (null) | **optional** link to a separate persisted object a renderer may hydrate, e.g. `{ remixOwnerHandle, remixAppSlug }` or `{ threadHandle, docId }`            |
| `created`          | text        | ISO timestamp                                                                                                                                              |
| `readAt`           | text (null) | unread when empty                                                                                                                                          |
| `dedupeKey`        | text        | idempotency key, e.g. `vibe-remixed:{remixOwner}/{remixSlug}`                                                                                              |

`body` makes each row renderable standalone; `targetRef` is only for the
special-case second-query hydration. Indexes: `(userId, created)` for the inbox
feed; `(userId, readAt)` for unread count; **unique `(userId, dedupeKey)`** for
idempotent emit.

### Unit 2 — `emitNotification()` (`api/queue/intern/emit-notification.ts`)

Single entry point replacing scattered `notifyUser` calls:

1. Insert the row with **on-conflict-(userId, dedupeKey)-do-nothing**. The
   `dedupeKey` is the once-only guarantee (no `AppSettings`/`meta` markers, no
   release-history inference).
2. If a row was actually inserted, fan out the live bell via the existing
   `UserNotify` DO path (reuse current `notifyUser` as the fan-out half), carrying
   the new row's `id`/fields.
3. If no row was inserted (duplicate), do nothing — neither persist nor re-ping.

Channel side effects (email/Discord) stay where they are but are triggered through
the same emit so they are consistent and pref-gated.

### Unit 3 — Migrate existing emitters

Move `evt-new-fs-id` (`vibe-published`), `evt-comment-posted`,
`evt-request-grant` (`request-approved`/`-revoked`), and `evt-dm-received`
(`dm-received`) onto `emitNotification`, so all notification types persist and
appear in the inbox — not only new ones. Each supplies a self-contained `body`, a
stable `dedupeKey`, and (where it links to a persisted object) an optional
`targetRef` (e.g. comment → `{docId}`, dm → `{threadHandle, docId}`).

### Unit 4 — Read API (`api/svc/public/`)

- `listNotifications` — owner-only, paginated by `created` desc, returns rows for
  `req._auth…userId`; optional `type`/`appSlug` filters.
- `markNotificationsRead` — set `readAt` for given ids (or all).
- `unreadCount` — `COUNT(*) WHERE userId=? AND readAt IS NULL` (or fold into
  `listNotifications`).
- Register handlers in `api/svc/evento-handler-manifest.ts`; add request/response
  types in `api/types/`.

### Unit 5 — Preferences

Per-type mute, reusing the existing notification-preference enum (one key per
type, default on). Emit checks the recipient's pref before the live/email/Discord
fan-out (the persisted row may still be written for the inbox, or skipped — TBD in
plan; default: skip entirely when muted).

### Unit 6 — Inbox UI (`pkg/app/`)

- A notifications/inbox page listing rows newest-first with read/unread styling.
  The base list renders directly from each row's stored `body` — **no per-row
  second query**. A row deep-links via `targetRef` when present.
- A global bell + unread counter, live-updated by the existing WebSocket fan-out.
- Per-type renderers may optionally hydrate richer/live detail from `targetRef`
  (e.g. the remix's current screenshot, a DM thread preview) as progressive
  enhancement — never required for the base list. The per-type map extends today's
  `TYPE_MAP` (`pkg/app/hooks/useBuildCompletionNotifications.ts`), kept in sync with
  the backend union (all duplicated guards/maps updated together).

## First consumer: remix (folds in the remix spec)

The remix spec's units map directly onto this store, dropping its interim hacks:

- **Notify**: `emitNotification({ userId: srcUserId, notificationType: "vibe-remixed",
ownerHandle: srcOwnerHandle, appSlug: srcAppSlug, actorHandle: remixOwnerHandle,
body: "@" + remixOwnerHandle + " remixed your vibe " + srcAppSlug,
targetRef: { remixOwnerHandle, remixAppSlug }, dedupeKey:
"vibe-remixed:" + remixOwnerHandle + "/" + remixAppSlug })`. The self-contained
  `body` renders the list row with no second query; the unique `dedupeKey` replaces
  the `AppSettings.remixNotifiedAt` flag.
- **Source identity**: still captured at fork time in `remix-of` meta
  (`srcUserId`/`srcOwnerHandle`/`srcAppSlug`, optional) — the shared/non-unique
  `fsId` problem is unchanged. Shared trigger helper still covers the clone path.
- **"Who remixed my vibe" list**: `listNotifications` filtered to
  `type='vibe-remixed' AND appSlug=X` — durable, indexed, one row per remix
  (dedupeKey), no `meta` scan.
- **Backfill history** (the earlier "show existing remixes" decision): a one-time
  migration scans existing `remix-of` meta and inserts `vibe-remixed` rows
  (best-effort attribution, no live notifications).

## Out of scope

- Changing how content (DMs, comments) is stored or gated — that's #2290 / Firefly.
- Cross-device notification _delivery_ semantics beyond the existing fan-out.
- Aggregations/digests/email batching.

## Testing

- `emitNotification` persists once under duplicate `dedupeKey`; second call is a
  no-op (no row, no fan-out).
- Offline recipient: event persists; appears in `listNotifications` on next load
  (the durability gap that exists today).
- Each migrated emitter writes a self-contained `body` (+ optional `targetRef`);
  live bell still fires.
- Base list renders from `body` alone — a row whose `targetRef` object is
  deleted/inaccessible still renders correctly (no second query required).
- `markNotificationsRead` flips `readAt`; unread count reflects it.
- Pref-muted type → no row / no fan-out (per Unit 5 decision).
- Remix first-consumer: publish remix → one `vibe-remixed` row; republish → no
  second row; clone path → row from `forkApp`; list filter returns it; backfill
  migration populates historical remixes.
- Dual-dialect: identical behavior on sqlite + pg.
