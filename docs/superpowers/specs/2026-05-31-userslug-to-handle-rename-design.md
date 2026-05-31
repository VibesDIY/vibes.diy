# Design: `userSlug` → Semantic Handle Rename (#1946)

## Goal

Replace the generic `userSlug` identifier throughout the TypeScript codebase with semantically precise names that communicate what kind of handle is meant at each callsite. No behavior change. DB column names are preserved via Drizzle column aliases; a follow-up issue will track the DB rename.

---

## Semantic Naming Rules

| Term | Meaning | When to use |
|---|---|---|
| `ownerHandle` | The handle of whoever owns an app/vibe | App/DB record fields that identify the app owner |
| `userHandle` | The handle of the currently authenticated viewer | Session/viewer context: `ViewerPayload`, who-am-i response, session-local state |
| `defaultHandle` | Which of the user's handles is their current default | User settings (supports future multiple-handles feature) |
| `handle` | The handle value itself (in the handle↔userId binding registry) | `sqlHandleBinding` table fields that represent the raw string |
| `memberHandle`, `writerHandle`, etc. | Role-specific handle in functions where that's the local meaning | Local variables/parameters where a more specific role name is clearer |

---

## Approach: Type-Driven (A) with sed Assists

1. Rename shared type definitions first — this produces TypeScript compiler errors at every callsite.
2. For callsites where **all** occurrences in a file map to the same target name, use `sed -i` (or equivalent) for the mechanical substitution rather than hand-editing.
3. For files with mixed semantics (some `userSlug` → `ownerHandle`, some → `userHandle`), fall back to per-occurrence edits guided by the compiler error list.
4. Drizzle schema fields that are renamed get a `.column('user_slug')` alias to keep live DB columns stable.
5. No DB migration in this PR.

---

## Type Changes (Anchor Layer)

These are renamed first to drive compiler errors:

### `vibe/types/index.ts`

| Field | Old | New |
|---|---|---|
| `ViewerPayload.userSlug` | `userSlug: string` | `userHandle: string` |
| `ReqVibeRegisterFPDb.userSlug` | `userSlug: string` | `ownerHandle: string` |
| `FPDbData.userSlug` | `userSlug: string` | `ownerHandle: string` |

### `api/types/asset.ts`

| Field | Old | New |
|---|---|---|
| `ReqAssetUploadGrant.userSlug` | `userSlug: string` | `ownerHandle: string` |
| `AssetGrantClaims.userSlug` | `userSlug: string` | `ownerHandle: string` |

### `api/types/vibes-diy-api.ts`

| Field | Old | New |
|---|---|---|
| `AppSlugUserSlug.userSlug` (and related pair types) | `userSlug: string` | `ownerHandle: string` |

---

## Drizzle Schema Changes (`api/sql/vibes-diy-api-schema-pg.ts`)

All renamed Drizzle fields add `.column('user_slug')` to preserve the live Postgres column name.

| Table variable | Field | Old | New |
|---|---|---|---|
| `sqlHandleBinding` (was `sqlUserSlugBinding`) | `userSlug` | `text().notNull()` | `handle: text('user_slug').notNull()` |
| `sqlAppSlugBinding` | `userSlug` | `text().notNull()` | `ownerHandle: text('user_slug').notNull()` |
| `sqlApps` | `userSlug` | `text().notNull()` | `ownerHandle: text('user_slug').notNull()` |
| `sqlChatContexts` | `userSlug` | `text().notNull()` | `ownerHandle: text('user_slug').notNull()` |
| `sqlAppSettings` | `userSlug` | `text().notNull()` | `ownerHandle: text('user_slug').notNull()` |
| `sqlAssetUploads` | `userSlug` | `text().notNull()` | `ownerHandle: text('user_slug').notNull()` |
| `sqlFollows` / `sqlFollowing` | `userSlug` / `channelUserSlug` | `text().notNull()` | `handle` / `channelHandle` + `.column('user_slug')` / `.column('channel_user_slug')` |
| Other tables with `userSlug` | varies | `text().notNull()` | context-appropriate name + `.column('user_slug')` — determined per-table during implementation |

> The JS variable `sqlUserSlugBinding` → `sqlHandleBinding`. The DB table name string passed to `pgTable()` does not change.

---

## Application Layer Changes (Compiler-Guided)

After the type changes compile-error, fix callsites file by file. Key files expected to change:

- `vibe/runtime/use-viewer.ts` — `viewer.userSlug` → `viewer.userHandle`
- `api/svc/public/who-am-i.ts` — response field `userSlug` → `userHandle`
- `api/svc/public/asset-upload-grant.ts` — `req.userSlug` → `req.ownerHandle`, JWT mint
- `api/svc/intern/render-vibe.ts` — `ownerUserSlug` parameter already well-named; update field accesses
- `pkg/app/routes/settings.tsx` — `defaultUserSlug` → `defaultHandle`
- `pkg/app/utils/avatarUrl.ts` — `avatarRouteForUserSlug` → `avatarRouteForHandle` (takes any user's handle, not specifically an owner)
- `api/impl/firefly-api-adapter.ts` — internal `userSlug` field → `userHandle`
- All test fixtures and mocks

Local variables and parameters: pick the name that matches the role at that callsite (`ownerHandle`, `memberHandle`, `writerHandle`, etc.).

---

## Settings: `defaultUserSlug`

`UserSettings.defaultUserSlug` → `defaultHandle`. This is the user's chosen default among potentially multiple handles — `defaultHandle` is more direct and anticipates the multiple-handles feature.

---

## Vibe Route URL Segment

The URL pattern `/vibe/{userSlug}/{appSlug}` — the segment value doesn't change, only what we call the variable that holds it in route handlers: → `ownerHandle`.

---

## CLI Commands (Backwards-Compatible)

Two commands expose `--user-slug` as a user-facing flag:

| Command | Current flag | New flag | Kept as deprecated |
|---|---|---|---|
| `vibes-diy push` | `--user-slug` | `--handle` | `--user-slug` (hidden, undocumented) |
| `vibes-diy pull` | `--user-slug` | `--handle` | `--user-slug` (hidden, undocumented) |

Implementation:
- Add `--handle` as the primary documented option with description "Handle to publish under (uses default if omitted)".
- Keep `--user-slug` as a second option with `hidden: true` (or equivalent in the CLI parser) — no description, no docs, but still accepted so existing scripts don't break.
- Both options feed the same internal variable, renamed `handle` (the user's own handle, used as `ownerHandle` of the published app).
- `resolve-user-slug.ts` → `resolve-handle.ts`; internal function `resolveUserSlug` → `resolveHandle`.

---

## Out of Scope (This PR)

- DB column renames (tracked in follow-up issue: "DB migration: rename `user_slug` columns → `owner_handle` / `handle`")
- Evaluate grep-based batch rename tooling (tracked in follow-up issue)
- No behavior change of any kind

---

## Follow-Up Issues to File After This PR

1. **DB migration**: rename `user_slug` → `owner_handle` (or `handle`) across Postgres schema + Drizzle without `.column()` shims. Requires coordinated migration.
2. **Evaluate batch rename approach (C)**: assess whether a mechanical find-replace + semantic fixup pass is viable for future renames of this type, given the scale (~17k occurrences counted by grep).
