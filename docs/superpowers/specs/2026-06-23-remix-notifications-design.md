# Remix visibility & notifications for vibe owners

**Date:** 2026-06-23
**Status:** Approved (design)
**Related:** [#2544 — Unified notification inbox for all vibe activity](https://github.com/VibesDIY/vibes.diy/issues/2544) (follow-up)

## Problem

When someone remixes a vibe, the source vibe's owner has no way to know. Remix
metadata is stored on the new app but never surfaced to the original owner and
never triggers any notification. Owners want to (a) see a list of who has
remixed each of their vibes and (b) get notified when a remix happens.

## Decisions

These were settled during brainstorming and are fixed for this work:

1. **Trigger — when the remix is published.** A remix only "counts" (appears in
   the list and fires a notification) once the remixer publishes their remix to
   production. Forks that stay in `dev`/private/abandoned are never surfaced.
   This respects the remixer's privacy and avoids leaking drafts.
2. **Channels — in-app, email, and Discord.** All three fire when a remix is
   first published, reusing the existing notification plumbing.
3. **View — per-vibe panel.** The owner sees remixers in a "Remixes" section on
   that specific vibe's detail panel in My Vibes. An aggregated, cross-vibe
   inbox is explicitly out of scope here and tracked in #2544.
4. **Identity — remixer is named.** The owner sees the remixer's handle and a
   link to the remixer's published remix. (The remix is already public, since
   only published remixes are surfaced.)
5. **De-dupe — first publish only.** The owner is notified once, on the remix's
   first production publish — not on every subsequent re-ship.
6. **No DB schema changes for this stream.** A single notification stream does not
   justify a new table / index. Dedupe reuses the existing `AppSettings` JSON and
   the list is derived live from existing `meta`. Denormalized indexing and any
   schema work are reserved for the unified inbox (#2544).

## How remixing works today (context)

- `forkApp` (`vibes.diy/api/svc/public/fork-app.ts`) creates a new Apps row that
  shares the source's content-addressed filesystem and writes
  `meta: [..., { type: "remix-of", srcFsId: src.fsId }]`. The source's display
  slugs are **not** stored — only `srcFsId`, the immutable content anchor.
- **Critical: a remix row's own `fsId` is set to `src.fsId`** (`fork-app.ts:168`
  inserts `fsId: src.fsId`), and `Apps.fsId` is **indexed but not unique**. So the
  source row, every remix of it, and every clone all share the same `fsId` value.
  This means `srcFsId` **cannot** identify "the source row" by itself —
  `WHERE fsId = srcFsId LIMIT 1` may return a fork instead of the source (or
  nothing, if the source was deleted). The source owner's identity must therefore
  be captured at fork time, not reverse-resolved from `fsId` later.
- A classic remix lands in `mode: "dev"`; a clone (`skipChat`) lands in
  `mode: "production"`.
- Publishing to production flows through the `evt-new-fs-id` queue handler
  (`vibes.diy/api/queue/handlers/evt-new-fs-id.ts`), which already runs on every
  production publish, computes `releaseSeq`, posts a Discord publish embed, and
  resolves `ownerHandle → userId` to send a `vibe-published` in-app notification.
- In-app notifications fan out over WebSocket to a stable per-user shard
  (`notify-user-{userId}`); see `vibes.diy/api/types/notifications.ts` and
  `vibes.diy/api/svc/public/subscribe-user-notifications.ts`. They are
  **transient** — an offline user misses them.
- Email is sent via `vibes.diy/api/queue/intern/send-email.ts`; Discord embeds
  via `vibes.diy/api/queue/intern/post-to-discord.ts`.
- The Apps table holds one row per release `(ownerHandle, appSlug, releaseSeq,
fsId, meta, mode, ...)`, so a single vibe accrues multiple `fsId`s over its
  release history.

## Architecture

### Unit 0 — Capture source identity in `remix-of` meta (`vibes.diy/api/types/types.ts`, `fork-app.ts`)

Because the source row cannot be reliably found from `srcFsId` alone (shared,
non-unique `fsId` — see context above), record the source's **stable** identity
at fork time, when `forkApp` still holds the full `src` row:

- Extend `MetaRemixOf` from `{ type: "remix-of", srcFsId }` to also carry
  `srcUserId` (the source owner's Clerk user id — stable across renames) and,
  for display/back-reference, `srcOwnerHandle` and `srcAppSlug` (resolved live on
  read when shown, but stored as a snapshot so we always know which vibe was the
  source). `srcFsId` stays as the immutable content anchor used by the list query.
- `forkApp` already reads `src.userId`, `src.ownerHandle`, `src.appSlug` — write
  them into the new `remix-of` entry (`fork-app.ts:158`).
- **All three new fields are optional** so legacy `remix-of` entries (with only
  `srcFsId`) still parse and behave.
- **Notifications are forward-only; the list is not.** The notification trigger
  (Unit 2) requires `srcUserId`, so legacy remixes (lacking it) are never
  retro-notified — which is correct (we don't want a backlog of notifications on
  ship). The list (Unit 3) is derived live from `srcFsId`, so **existing remixes
  appear immediately with no migration or backfill** — satisfying "show historical
  remixes" without any schema change.

### Unit 1 — Notification type + preference (`vibes.diy/api/types/notifications.ts` and all duplicates)

- Add `'vibe-remixed'` to the `EvtUserNotification.notificationType` union.
- Extend `EvtUserNotification` with two optional fields: `remixerHandle?` and
  `remixAppSlug?`.
- **Field semantics for `vibe-remixed`:** the recipient is the _source_ owner, so
  `ownerHandle`/`appSlug` identify **which of the owner's vibes** was remixed,
  and `remixerHandle`/`remixAppSlug` identify the remixer and their published
  remix. This lets the UI render "@{remixerHandle} remixed your vibe {appSlug}"
  and deep-link to the remix.
- The new fields are optional so existing notification types are unaffected.
- **Update every duplicate of the type.** The notificationType union / guards /
  render maps are mirrored in more than one place — at minimum the backend type
  (`api/types/notifications.ts`) and the frontend render map
  (`pkg/app/hooks/useBuildCompletionNotifications.ts` `TYPE_MAP`). The plan greps
  for all occurrences (backend + frontend + any worker path) and adds the new
  case to each; a missed copy is a silent no-op for that surface.
- **Preference:** add a **new** preference key `vibeRemixed` (do not overload an
  existing toggle) alongside the existing keys (`vibePublished`, `commentPosted`,
  …) in the `NotificationType` preference enum and its default-on map, so owners
  can mute remix notifications independently. Default: on.

### Unit 2 — Notification trigger (shared helper + two call sites)

**No new tables.** Per project direction, this single notification stream does not
justify schema changes; durable, atomic dedupe via a dedicated table is deferred
to the unified inbox (#2544).

Add a shared helper
`notifyRemixSourceOwner(qctx, remixApp)` in
`vibes.diy/api/queue/intern/notify-remix.ts`. `remixApp` is the just-published
Apps row (its `meta`, `ownerHandle`, `appSlug`, `userId`). The helper:

1. Find the `remix-of` entry in `remixApp.meta`. If none, return.
2. Read the **source owner directly from that entry** (`srcUserId`, captured at
   fork time in Unit 0) plus `srcOwnerHandle`/`srcAppSlug`. **No reverse `fsId`
   lookup** — `srcFsId` is shared across the source and all its forks, so a row
   lookup is ambiguous (could resolve to a fork → wrong owner / false self-remix).
   If the entry lacks `srcUserId` (legacy remix predating Unit 0), return.
3. **Skip self-remix:** if `srcUserId === remixApp.userId`, return.
4. **De-dupe via existing per-app `AppSettings.settings` JSON (no new table, not
   `Apps.meta`).** `Apps.meta` is rejected because screenshot writes mutate it by
   shared `fsId` and cross-release carry-forward is selective, making a marker
   there fragile. Instead, on the **remix app's** AppSettings row, read
   `settings.remixNotifiedAt`; if set, return. Otherwise set it (read-modify-write
   through `ensureAppSettings`, which already owns the settings JSON), then send.
   The classic-remix publish path can fire `evt-new-fs-id` on every republish, so
   this flag is what makes it once-only; `setModeFsId`'s prod→dev row demotion is
   irrelevant because the flag lives on the app, not on a release row.
5. Notify the source owner across all three channels, each gated by the source
   owner's `vibeRemixed` preference where the existing channels check prefs:
   - In-app: `qctx.notifyUser(srcUserId, { type: "vibes.diy.evt-user-notification", notificationType: "vibe-remixed", ownerHandle: srcOwnerHandle, appSlug: srcAppSlug, remixerHandle: remixApp.ownerHandle, remixAppSlug: remixApp.appSlug })`.
   - Email: reuse `send-email` (new `vibe-remixed` action; needs the source owner's
     email, mirroring existing handlers).
   - Discord: reuse `post-to-discord` with a new "remixed" embed builder.

**Call sites (Charlie point 1 — cover clones too):**

- `vibes.diy/api/queue/handlers/evt-new-fs-id.ts`: in the existing
  `mode === "production"` branch (which already selects the app row), call the
  helper with that row. This covers **classic remixes** (forked in `dev`, later
  published). The `AppSettings` flag makes it once-only.
- `vibes.diy/api/svc/public/fork-app.ts`: a **clone** (`skipChat`) is inserted
  straight into `mode: "production"` and never emits `evt-new-fs-id`, so call the
  helper inline right after the clone insert. A clone's first (and only) publish is
  its creation, and `forkApp` runs once per clone, so no flag is needed there — but
  the helper's self-remix and `srcUserId` checks still apply.

### Unit 3 — List API "remixes of my vibe" (`vibes.diy/api/svc/public/list-remixes.ts`)

New owner-only public service handler. **No new tables / no backfill needed** —
the list is derived live from existing `meta`, so historical remixes appear for
free (they already carry `remix-of.srcFsId`).

- **Request** (new type in `vibes.diy/api/types/app.ts`): `{ type:
"vibes.diy.req-list-remixes", auth, ownerHandle, appSlug }`.
- **Auth/authorization:** caller must be the owner of `(ownerHandle, appSlug)`
  (check `req._auth.verifiedAuth.claims.userId` against the app's `userId`).
- **Query:**
  1. Gather every `fsId` the vibe has had:
     `SELECT DISTINCT fsId FROM apps WHERE ownerHandle = ? AND appSlug = ?`
     (confirms ownership en route).
  2. Find production apps whose `meta` contains a `remix-of` entry whose `srcFsId`
     is in that set, using a JSON predicate on `meta` filtered by
     `mode = 'production'` — `json_each` on sqlite, `jsonb` path/containment on pg.
     The plan provides both dialect expressions (matching the dual schema in
     `vibes.diy/api/sql/`). Exclude the owner's own rows (self) by
     `ownerHandle != caller` where applicable.
  3. **Deterministic dedupe:** collapse to **one row per remix app**
     `(ownerHandle, appSlug)`, keeping the **newest published** row (max
     `releaseSeq`, tie-break newest `created`). Resolve each remixer's current
     display `ownerHandle`.
- **Response** (new type): `{ type: "vibes.diy.res-list-remixes", remixes:
[{ remixerHandle, remixAppSlug, created }] }`, newest first.
- **Transitive derivatives count.** Because a remix copies its source's `fsId`
  verbatim, a remix-of-a-remix still carries an `srcFsId` in the original's
  `fsId` set, so the list includes the full content lineage. (Notifications, by
  contrast, target the **direct** parent only, via the `srcUserId` captured at
  fork time.) This split is intentional and is the documented semantics.
- **Performance:** the `meta` predicate is an unindexed scan over production apps.
  This is accepted for a single stream; proper indexing / a denormalized index is
  deferred to the unified-inbox work (#2544).

### Unit 4 — Frontend per-vibe "Remixes" section

- New hook `useVibeRemixes(ownerHandle, appSlug)` calling the list API.
- A "Remixes ({N})" section/tab on the My Vibes detail panel
  (`vibes.diy/pkg/app/components/mine/MineDetailPanel.tsx`). Each row: remixer handle
  (+ avatar if available), a link to the published remix, relative created date.
  Empty state when there are none.
- Client handling of the `vibe-remixed` in-app notification: render
  "@{remixerHandle} remixed your vibe {appSlug}" and deep-link to the source
  vibe's detail panel (or the published remix).

## Edge cases

- **Privacy:** only `production` remixes are ever surfaced or notified; drafts and
  private forks stay invisible. (Matches decision 1.)
- **Self-remix:** never notify when `srcUserId` === remixer's `userId`.
- **De-dupe:** notify once, enforced by a `settings.remixNotifiedAt` flag on the
  remix app's existing `AppSettings` row — stable across the prod→dev row demotion
  `setModeFsId` does, and not subject to the `Apps.meta` screenshot-write churn
  (decision 5). No new table.
- **Clone path:** a `skipChat` clone is born in production and emits no
  `evt-new-fs-id`; `forkApp` calls the shared helper inline so clones still notify
  (once, since `forkApp` runs once per clone).
- **Shared/non-unique `fsId`:** the source owner is read from the remix's
  `remix-of.srcUserId` (captured at fork time), never by an ambiguous
  `WHERE fsId = srcFsId` lookup.
- **Source renamed:** `srcUserId` is stable across renames; `srcOwnerHandle`
  /`srcAppSlug` display fields are re-resolved live when shown.
- **Source deleted / legacy remix without `srcUserId`:** skip the notification
  silently (no target). Legacy remixes still appear in the list via `srcFsId`.
- **Cross-version:** the list matches against every `fsId` the source vibe has
  ever had, so remixes of any past release are included.
- **Durability gap:** the in-app bell is transient and can be missed if the owner
  is offline; the list API is durable and backfills the gap for the per-vibe
  view. A durable, aggregated inbox is tracked in #2544.

## Testing

Backend integration tests, following `vibes.diy/api/tests/fork-app.test.ts` and
the patterns in `agents/testing-access-fn.md`:

- Fork → publish remix → source owner notified exactly once (in-app), with the
  correct source vibe + remixer fields, resolved from `remix-of.srcUserId`.
- Republish the remix **through the real `setModeFsId` flow** (which demotes the
  prior prod row to `dev`) → still no second notification (persisted-marker
  de-dupe, the P2 regression).
- Source vibe has other remixes/clones sharing the same `fsId` → notification
  still targets the true source owner, not a fork (the P1 regression).
- Self-remix (owner remixes own vibe) → no notification.
- Legacy remix whose `remix-of` lacks `srcUserId` → no notification, but still
  appears in the list API.
- Private/dev remix (never published) → not surfaced, no notification.
- Clone (`skipChat=true`) → source owner notified once from the `forkApp` path
  (no `evt-new-fs-id` involved).
- Owner has muted `vibeRemixed` preference → no notification sent.
- List API returns published remixes, including remixes of an earlier release
  (cross-version matching) and transitive derivatives sharing the content lineage;
  one row per remix app (newest); newest-first; rejects non-owner callers.
- Email and Discord side effects are dispatched on first publish (assert via the
  existing test seams used by the other queue handlers).

Frontend: hook + component tests for the Remixes section (populated + empty), per
the app package's existing test conventions.

## Out of scope

- Aggregated cross-vibe notification inbox and durable notification log — #2544.
- A denormalized remix index / DB schema changes for fast queries — deferred to
  #2544; this stream queries existing `meta` live.
- Surfacing unpublished/private forks.

Note: a single `vibeRemixed` notification preference **is** in scope (Unit 1); the
broader preferences surface is unchanged.
