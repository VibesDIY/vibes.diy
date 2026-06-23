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

## How remixing works today (context)

- `forkApp` (`vibes.diy/api/svc/public/fork-app.ts`) creates a new Apps row that
  shares the source's content-addressed filesystem and writes
  `meta: [..., { type: "remix-of", srcFsId: src.fsId }]`. The source's display
  slugs are **not** stored — only `srcFsId`, the immutable content anchor.
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

### Unit 1 — Notification type (`vibes.diy/api/types/notifications.ts`)

- Add `'vibe-remixed'` to the `EvtUserNotification.notificationType` union.
- Extend `EvtUserNotification` with two optional fields: `remixerHandle?` and
  `remixAppSlug?`.
- **Field semantics for `vibe-remixed`:** the recipient is the *source* owner, so
  `ownerHandle`/`appSlug` identify **which of the owner's vibes** was remixed,
  and `remixerHandle`/`remixAppSlug` identify the remixer and their published
  remix. This lets the UI render "@{remixerHandle} remixed your vibe {appSlug}"
  and deep-link to the remix.
- The new fields are optional so existing notification types are unaffected.

### Unit 2 — Notification trigger (`evt-new-fs-id` handler)

Extend the existing production-publish branch in
`vibes.diy/api/queue/handlers/evt-new-fs-id.ts`. After the existing
`vibe-published` logic, when `payload.mode === "production"`:

1. Load the just-published app's `meta` (the handler already queries this row for
   `releaseSeq`; extend the select to include `meta`). If `meta` has no
   `remix-of` entry, do nothing further.
2. Resolve the **source** vibe from `srcFsId`:
   `SELECT ownerHandle, appSlug, userId FROM apps WHERE fsId = srcFsId LIMIT 1`.
   Because `srcFsId` is content-addressed, this resolves the source even if it
   was later renamed. If no source row is found (e.g. source deleted), skip.
3. **Skip self-remix:** if the source owner's `userId` equals the remixer's
   `userId` (the publishing app's owner), do nothing.
4. **De-dupe to first publish:** only notify if this is the remix app's first
   production release. Determine this from the remix app's release history — if a
   production release with a lower `releaseSeq` already exists for
   `(remix ownerHandle, remix appSlug)`, skip. (Implementation detail to confirm
   in the plan: whether "first production publish" is best derived from
   `releaseSeq`/`mode` history or a persisted marker on the app.)
5. Notify the source owner across all three channels:
   - In-app: `qctx.notifyUser(sourceUserId, { type: "vibes.diy.evt-user-notification", notificationType: "vibe-remixed", ownerHandle: <source ownerHandle>, appSlug: <source appSlug>, remixerHandle: <remix ownerHandle>, remixAppSlug: <remix appSlug> })`.
   - Email: reuse `send-email` (new `vibe-remixed` template; requires the source
     owner to have an email on file, mirroring existing handlers).
   - Discord: reuse `post-to-discord` with a new "remixed" embed builder.

### Unit 3 — List API "remixes of my vibe" (`vibes.diy/api/svc/public/list-remixes.ts`)

New owner-only public service handler.

- **Request** (new type in `vibes.diy/api/types/app.ts`): `{ type:
  "vibes.diy.req-list-remixes", auth, ownerHandle, appSlug }`.
- **Auth/authorization:** caller must be the owner of `(ownerHandle, appSlug)`.
- **Query:**
  1. Gather every `fsId` the vibe has had:
     `SELECT DISTINCT fsId FROM apps WHERE ownerHandle = ? AND appSlug = ?`.
  2. Find published remixes whose `remix-of.srcFsId` is in that set and whose
     `mode = 'production'`. `meta` is JSON; match via the DB's JSON support
     (pg `jsonb` / sqlite `json`) where practical, or fetch production candidates
     and filter `meta` in code. (The plan picks the concrete approach; both SQL
     dialects must work, matching the dual schema in `vibes.diy/api/sql/`.)
  3. For each match, resolve the remixer's current display `ownerHandle`.
- **Response** (new type): `{ type: "vibes.diy.res-list-remixes", remixes:
  [{ remixerHandle, remixAppSlug, created }] }`, newest first.
- This is **query-derived**, so it is durable regardless of whether the owner was
  online when the notification fired.

### Unit 4 — Frontend per-vibe "Remixes" section

- New hook `useVibeRemixes(ownerHandle, appSlug)` calling the list API.
- A "Remixes ({N})" section on the My Vibes detail panel
  (`vibes.diy/pkg/app/components/MineDetailPanel.tsx`). Each row: remixer handle
  (+ avatar if available), a link to the published remix, relative created date.
  Empty state when there are none.
- Client handling of the `vibe-remixed` in-app notification: render
  "@{remixerHandle} remixed your vibe {appSlug}" and deep-link to the source
  vibe's detail panel (or the published remix).

## Edge cases

- **Privacy:** only `production` remixes are ever surfaced or notified; drafts and
  private forks stay invisible. (Matches decision 1.)
- **Self-remix:** never notify when remixer === source owner.
- **De-dupe:** notify once, on first production publish (decision 5).
- **Source renamed:** resolution via immutable `srcFsId` follows renames.
- **Source deleted:** if the source row is gone, skip the notification silently.
- **Cross-version:** the list matches against every `fsId` the source vibe has
  ever had, so remixes of any past release are included.
- **Durability gap:** the in-app bell is transient and can be missed if the owner
  is offline; the list API is durable and backfills the gap for the per-vibe
  view. A durable, aggregated inbox is tracked in #2544.

## Testing

Backend integration tests, following `vibes.diy/api/tests/fork-app.test.ts` and
the patterns in `agents/testing-access-fn.md`:

- Fork → publish remix → source owner notified exactly once (in-app), with the
  correct source vibe + remixer fields.
- Republish the remix → no second notification.
- Self-remix (owner remixes own vibe) → no notification.
- Private/dev remix (never published) → not surfaced, no notification.
- List API returns published remixes, including remixes of an earlier release
  (cross-version matching), newest first; rejects non-owner callers.
- Email and Discord side effects are dispatched on first publish (assert via the
  existing test seams used by the other queue handlers).

Frontend: hook + component tests for the Remixes section (populated + empty), per
the app package's existing test conventions.

## Out of scope

- Aggregated cross-vibe notification inbox and durable notification log — #2544.
- Notification preferences / opt-out controls.
- Surfacing unpublished/private forks.
