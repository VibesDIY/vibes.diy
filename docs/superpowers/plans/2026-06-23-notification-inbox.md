# Unified Notification Inbox (#2544) Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) tracking. TDD,
> DRY, YAGNI, frequent commits. Keep CI (`pnpm check`) green after each phase.

**Goal:** A durable, self-contained notification store with a single emit path, a
read API, an inbox UI, and remix-of-your-vibe as the first consumer.

**Architecture:** A bespoke `Notifications` table (dual sqlite/pg) holds
self-contained rows (each carries its own `body`); `emitNotification()` inserts
with an idempotent `(userId, dedupeKey)` then fans out the live bell via the
existing `UserNotify` DO. Existing emitters migrate onto it. Read handlers feed an
inbox page + bell. Spec: `docs/superpowers/specs/2026-06-23-notification-inbox-design.md`.

**Tech Stack:** TypeScript, drizzle-orm (sqlite + pg), arktype, Evento handlers,
Cloudflare Durable Objects, React (pkg/app), vitest.

---

## Phase 1 — Notifications table + emit + read API (backend backbone)

### Task 1.1: `Notifications` table (both dialects + aggregator)

**Files:**

- Modify: `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts`
- Modify: `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts`
- Modify: `vibes.diy/api/sql/tables.ts`

- [ ] **Step 1: Add the sqlite table** (after `sqlAccessFnOutputs`):

```typescript
export const sqlNotifications = sqliteTable(
  "Notifications",
  {
    id: text().notNull().primaryKey(), // ULID — sortable by creation
    userId: text().notNull(), // recipient (Clerk id)
    notificationType: text().notNull(),
    ownerHandle: text("userSlug").notNull(), // subject vibe owner
    appSlug: text().notNull(), // subject vibe
    body: text().notNull(), // self-contained rendered message
    actorHandle: text(), // who caused it (nullable)
    actorUserId: text(), // actor Clerk id (nullable)
    targetRef: text({ mode: "json" }), // optional link payload (nullable)
    dedupeKey: text().notNull(), // idempotency key
    created: text().notNull(), // ISO timestamp
    readAt: text(), // unread when null
  },
  (table) => [
    index("Notifications_userId_created").on(table.userId, table.created),
    index("Notifications_userId_readAt").on(table.userId, table.readAt),
    uniqueIndex("Notifications_userId_dedupeKey").on(table.userId, table.dedupeKey),
  ]
);
```

- [ ] **Step 2: Add the pg table** (mirror exactly, `pgTable`, `jsonb()` for
      `targetRef`): same columns/indexes, `targetRef: jsonb()`, others `text()`.

- [ ] **Step 3: Register in `tables.ts`** — add `notifications: sqlite.sqlNotifications`
      to `createSqliteVibesApiTables()` and `notifications: pg.sqlNotifications` to the
      pg branch of `createVibesApiTables()`.

- [ ] **Step 4: Verify build** — `cd vibes.diy && pnpm -F @vibes.diy/api-sql build`
      (or `pnpm check` scoped). Expected: typechecks.

- [ ] **Step 5: Commit** — `feat(api): add Notifications table (sqlite+pg)`.

### Task 1.2: Notification row + emit input types

**Files:**

- Create: `vibes.diy/api/types/notification-row.ts` (or extend
  `api/types/notifications.ts`)
- Modify: `vibes.diy/api/types/index.ts` (export)

- [ ] **Step 1: Define arktype shapes** — `NotificationRow` (matches table
      columns) and `EmitNotificationInput`:

```typescript
export const notificationRow = type({
  id: "string",
  userId: "string",
  notificationType: notificationTypeEnum, // reuse EvtUserNotification union + 'dm-received'
  ownerHandle: "string",
  appSlug: "string",
  body: "string",
  "actorHandle?": "string | null",
  "actorUserId?": "string | null",
  "targetRef?": "unknown",
  dedupeKey: "string",
  created: "string",
  "readAt?": "string | null",
});
```

- [ ] **Step 2:** Add `'dm-received'` to the notification-type union shared with
      `EvtUserNotification.notificationType` (single source of truth).

- [ ] **Step 3: Commit** — `feat(api): notification row + emit input types`.

### Task 1.3: `emitNotification()` helper (TDD)

**Files:**

- Create: `vibes.diy/api/queue/intern/emit-notification.ts`
- Test: `vibes.diy/api/tests/emit-notification.test.ts` (model on
  `vibes.diy/api/tests/fork-app.test.ts` + `vibe-diy-test-ctx.ts`)

- [ ] **Step 1: Failing test** — using the test ctx, call `emitNotification` twice
      with the same `(userId, dedupeKey)`; assert exactly one `Notifications` row, and
      that `notifyUser` fan-out fired once (spy/seam on `qctx.notifyUser`).

- [ ] **Step 2: Run, expect fail** (function undefined).

- [ ] **Step 3: Implement.** Signature:

```typescript
export async function emitNotification(
  qctx: QueueCtx,
  input: {
    userId: string;
    notificationType: string;
    ownerHandle: string;
    appSlug: string;
    body: string;
    actorHandle?: string;
    actorUserId?: string;
    targetRef?: unknown;
    dedupeKey: string;
  }
): Promise<{ inserted: boolean; id: string }>;
```

Behavior: build a ULID `id` + `created` (from `qctx.sthis`); `insert(...).values({...})`
with `.onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })`
(sqlite) / pg equivalent; detect whether a row was inserted (use `.returning()` where
supported, else re-select); if inserted, call the existing `qctx.notifyUser(userId,
{ type, notificationType, ownerHandle, appSlug })` for the live bell. Return
`{ inserted, id }`.

- [ ] **Step 4: Run, expect pass.** `cd vibes.diy/tests && pnpm test emit-notification`.

- [ ] **Step 5: Commit** — `feat(api): emitNotification with idempotent dedupeKey + fan-out`.

### Task 1.4: Read API — `listNotifications`, `markNotificationsRead`, unread count (TDD)

**Files:**

- Create: `vibes.diy/api/svc/public/list-notifications.ts` (+ mark-read handler)
- Modify: `vibes.diy/api/types/app.ts` (req/res types) and
  `vibes.diy/api/types/vibes-diy-api.ts` (interface methods)
- Modify: `vibes.diy/api/svc/evento-handler-manifest.ts` (register)
- Test: `vibes.diy/api/tests/list-notifications.test.ts`

- [ ] **Step 1: Types** — `reqListNotifications { type, auth, "appSlug?", "type?",
"cursor?", "limit?" }`, `resListNotifications { type, items: NotificationRow[],
"nextCursor?", unreadCount }`; `reqMarkNotificationsRead { type, auth, "ids?" }`
      (omit ids = mark all), `resMarkNotificationsRead { type, ok }`.

- [ ] **Step 2: Failing test** — emit 2 rows for userA + 1 for userB; assert
      `listNotifications` as userA returns 2 newest-first with `unreadCount = 2`;
      `markNotificationsRead` flips `readAt`; re-list shows `unreadCount = 0`. Assert a
      row renders from `body` with no second query (just check the field is populated).

- [ ] **Step 3: Implement handlers** — model on
      `vibes.diy/api/svc/public/get-app-by-fsid.ts` (validate via `unwrapMsgBase`,
      `checkAuth`, `vctx.sql.db.select()...where(eq(userId, callerId))
.orderBy(desc(created)).limit(limit)`, `ctx.send.send`). Register both in
      `evento-handler-manifest.ts` `chatHandlers`.

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit** — `feat(api): listNotifications + markNotificationsRead handlers`.

---

## Phase 2 — Remix as first consumer

### Task 2.1: Extend `remix-of` meta with source identity

**Files:**

- Modify: `vibes.diy/api/types/types.ts` (`MetaRemixOf`)
- Modify: `vibes.diy/api/svc/public/fork-app.ts:158`
- Test: extend `vibes.diy/api/tests/fork-app.test.ts`

- [ ] **Step 1: Failing test** — fork an app; assert the new row's `remix-of` meta
      carries `srcUserId`, `srcOwnerHandle`, `srcAppSlug` from the source.

- [ ] **Step 2: Extend `MetaRemixOf`** — add optional `"srcUserId?": "string"`,
      `"srcOwnerHandle?": "string"`, `"srcAppSlug?": "string"` (keep `srcFsId`; all new
      fields optional → legacy rows still parse).

- [ ] **Step 3: Write them in `forkApp`** — the `destMeta` `remix-of` entry becomes
      `{ type: "remix-of", srcFsId: src.fsId, srcUserId: src.userId, srcOwnerHandle:
src.ownerHandle, srcAppSlug: src.appSlug }`.

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit.**

### Task 2.2: `vibe-remixed` type + `notifyRemixSourceOwner` helper + two call sites (TDD)

**Files:**

- Modify: `vibes.diy/api/types/notifications.ts` (add `'vibe-remixed'`; optional
  `remixerHandle?`/`remixAppSlug?` on `EvtUserNotification`)
- Create: `vibes.diy/api/queue/intern/notify-remix.ts`
- Modify: `vibes.diy/api/queue/handlers/evt-new-fs-id.ts` (call in the
  `mode === "production"` branch)
- Modify: `vibes.diy/api/svc/public/fork-app.ts` (call inline after a `skipChat`
  clone insert)
- Test: `vibes.diy/api/tests/notify-remix.test.ts`

- [ ] **Step 1: Failing tests** — (a) publish a remix → exactly one `vibe-remixed`
      Notifications row for the source owner, `body = "@<remixer> remixed your vibe
<srcAppSlug>"`, `dedupeKey = "vibe-remixed:<remixOwner>/<remixSlug>"`,
      `targetRef = { remixOwnerHandle, remixAppSlug }`; (b) republish → no second row;
      (c) self-remix → no row; (d) legacy remix lacking `srcUserId` → no row; (e) clone
      path → row emitted from `forkApp`.

- [ ] **Step 2: Implement `notifyRemixSourceOwner(qctx, remixApp)`** — find the
      `remix-of` entry; bail if no `srcUserId`; bail if `srcUserId === remixApp.userId`;
      build input and call `emitNotification(qctx, { userId: srcUserId,
notificationType: "vibe-remixed", ownerHandle: srcOwnerHandle, appSlug:
srcAppSlug, actorHandle: remixApp.ownerHandle, body, targetRef:
{ remixOwnerHandle: remixApp.ownerHandle, remixAppSlug: remixApp.appSlug },
dedupeKey })`. Dedupe is handled entirely by `emitNotification` (unique
      `(userId, dedupeKey)`), so republish is naturally once-only — no flag.

- [ ] **Step 3: Wire call sites** — in `evt-new-fs-id` production branch, fetch the
      published app's `meta` (extend existing select) and call the helper; in `forkApp`,
      after the `skipChat` clone insert, call it with the clone row.

- [ ] **Step 4: Run, expect pass.** **Step 5: Commit.**

### Task 2.3: Per-vibe "who remixed my vibe" via `listNotifications`

**Files:**

- (Backend already covers it: `listNotifications` with `type='vibe-remixed' AND
appSlug=X`.) Confirm the `appSlug` + `type` filters exist from Task 1.4; add if not.
- Test: assert filtering returns only that vibe's remix rows.

- [ ] **Step 1–2: Test + (if needed) filter impl. Step 3: Commit.**

---

## Phase 3 — Migrate existing emitters onto `emitNotification`

For each, replace the direct `qctx.notifyUser(...)` with `emitNotification(...)`,
supplying a self-contained `body`, a stable `dedupeKey`, and an optional `targetRef`.

### Task 3.1: `evt-new-fs-id` → `vibe-published`

- **File:** `vibes.diy/api/queue/handlers/evt-new-fs-id.ts`
- `dedupeKey = "vibe-published:<ownerHandle>/<appSlug>:<fsId>"` (per release);
  `body = "<ownerHandle>/<appSlug> was published."`
- [ ] Test (one row per publish; no dup on requeue), implement, commit.

### Task 3.2: `evt-comment-posted` → `comment-posted`

- **File:** `vibes.diy/api/queue/handlers/evt-comment-posted.ts`
- `dedupeKey = "comment-posted:<docId>"`; `targetRef = { docId }`;
  `body = "New comment on <ownerHandle>/<appSlug>."`
- [ ] Test, implement, commit.

### Task 3.3: `evt-request-grant` → `request-approved` / `request-revoked`

- **File:** `vibes.diy/api/queue/handlers/evt-request-grant.ts`
- `dedupeKey = "<type>:<appSlug>:<foreignUserId>:<tick>"`;
  `body` mirrors today's copy.
- [ ] Test, implement, commit.

### Task 3.4: `evt-dm-received` → `dm-received`

- **File:** `vibes.diy/api/queue/handlers/evt-dm-received.ts` (+ ensure it calls
  `emitNotification`; it currently only does Discord/email)
- `dedupeKey = "dm-received:<channelHandle>:<docId>"`; `targetRef =
{ threadHandle: channelHandle, docId }`; `body = "New message from <sender>."`
- [ ] Test, implement, commit.

---

## Phase 4 — Preferences + inbox UI (frontend)

### Task 4.1: `vibeRemixed` preference key

**Files:**

- Modify: the `UserSettingNotifications` type (search: `buildComplete` /
  `UserSettingNotifications`) — add `vibeRemixed: boolean` (default true).
- Modify: `vibes.diy/pkg/app/routes/settings.tsx` (toggle row).
- Modify: emit gating — `emitNotification` (or the per-type callers) skip the
  **live/email/Discord** ping when the recipient's pref is off, but still persist
  the row (per spec Unit 5).
- [ ] Test, implement, commit.

### Task 4.2: Render map + client API + inbox hook

**Files:**

- Modify: `vibes.diy/pkg/app/hooks/useBuildCompletionNotifications.ts` `TYPE_MAP`
  — add `vibe-remixed` (and `dm-received`) cases (prefKey, title, body, path).
- Modify: client API surface (`vibes-diy-api.ts` impl in `pkg/`) — add
  `listNotifications` / `markNotificationsRead` methods (model on `forkApp` /
  `listRecentVibes`).
- Create: `vibes.diy/pkg/app/hooks/useNotifications.ts` (model on
  `useRecentVibes.ts`).
- [ ] Test, implement, commit.

### Task 4.3: Inbox page + bell counter + per-vibe Remixes section

**Files:**

- Create: an inbox route/page rendering rows from `body` (newest-first, read/unread).
- Modify: a global bell/counter component fed by `unreadCount`, live-updated via the
  existing notification WebSocket.
- Modify: `vibes.diy/pkg/app/components/mine/MineDetailPanel.tsx` — add a "Remixes"
  section/tab using `useNotifications({ type: "vibe-remixed", appSlug })`.
- [ ] Component tests (populated + empty), implement, commit.

---

## Self-review notes

- **Spec coverage:** Units 1–6 + remix consumer all mapped (Phase 1 = Units 1,2,4;
  Phase 2 = remix; Phase 3 = Unit 3; Phase 4 = Units 5,6).
- **Forward-only:** no backfill task — matches the spec.
- **Dual-dialect:** Task 1.1 covers both schemas; tests run on sqlite, pg mirrors by
  construction (same column/index names).
- **Type consistency:** the notification-type union has ONE source (extend
  `EvtUserNotification.notificationType`), reused by the table type, emit input,
  read types, and the frontend `TYPE_MAP`.
