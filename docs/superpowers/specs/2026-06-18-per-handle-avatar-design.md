# Per-handle Avatar Design

**Date:** 2026-06-18
**Predecessor:** [#2418](https://github.com/VibesDIY/vibes.diy/pull/2418) (merged) — host-side avatar preview/confirm gate, and the fix that derives the confirm preview from the host-recorded `getURL` rather than a bare CID.
**Related issue:** [#1968](https://github.com/VibesDIY/vibes.diy/issues/1968) (avatar consent gate).
**Status:** Design decisions resolved with `@CharlieHelps` (2026-06-18) — see the decisions section below. **No code in this PR.** Ready to become a `writing-plans` implementation plan.

## Summary

Today a user has **one** avatar, stored per-user, shown for **every** handle they own. We want avatars to be **per-handle**: a user with `alice` and `alice-dev` can present a different face on each. We keep the ergonomic serve path `/u/<handle>/avatar` unchanged (apps reference the image by URL without ever seeing a CID), and we model the new per-handle store on the **`appSettings` shape** (versioned `ActiveEntry`), not the `userSettings` shape — because an avatar is, structurally, a handle's icon, and the app-icon machinery already solves the content-addressed-image problem cleanly.

## Current state (what we're changing)

**Storage — per user.** The avatar is a bare `avatarCid` string on the `profile` entry inside `userSettings`, a JSON array keyed by `userId`:

- `userSettingProfile = { type: "profile", avatarCid?, displayName? }` — `vibes.diy/api/types/settings.ts:43`.
- `ensureUserSettings` merges entries **by `type`** — `new Map([...existing, ...incoming].map(i => [i.type, i]))` — so there is exactly **one** `profile` per user row (`vibes.diy/api/svc/public/ensure-user-settings.ts:46`). This by-`type` singleton merge is the structural reason per-handle avatars cannot live in the existing user row.

**Serve — per handle URL, per user data.** `/u/<handle>/avatar` (`vibes.diy/api/svc/public/get-user-avatar.ts`):

1. `handle → userId` via `handleBinding` (`:29-34`).
2. read that user's `userSettings`, pull the first `profile.avatarCid` (`:37-50`).
3. resolve the **bare CID → `assetURI`** via the `assetUploads` audit table (`:68-74`) — the only way to recover a storage URI from a content CID.
4. `302` to `/assets/cid?url=<assetURI>&mime=...` (`:79-88`).

So two different handles owned by the same user resolve to the same `userId` → the same `avatarCid` → the same image.

**Contrast — app icons already do this well.** An app icon lives in `appSettings` as a versioned `ActiveEntry`:

- `active.icon = { type: "active.icon", versions: IconVersion[], currentCid }` (`vibes.diy/api/queue/intern/store-icon.ts:53-77`).
- Crucially the entry's `cid` field stores the **`getURL`**, not a bare content hash (`store-icon.ts:45`: `const cid = storageResult.getURL`). So serving is a direct `cidAssetUrl(icon.cid, icon.mime)` (`vibes.diy/pkg/app/components/ChatHeaderContent.tsx:19`, `MyAppsSection.tsx:172`, …) — **no `assetUploads` resolution, no redirect.**

## The two extensibility shapes

| | `userSettings` | `appSettings` |
|---|---|---|
| Row key | `userId` | `(ownerHandle, appSlug)` |
| Payload | `UserSettingItem[]` discriminated union (`settings.ts:73`) | structured `entry.settings` **+** `entries: ActiveEntry[]` (`settings.ts:306`) |
| Merge | singleton **by `type`** (`ensure-user-settings.ts:46`) | per-entry upsert with version history |
| Image support | bare CID string, resolved later via `assetUploads` + 302 | `active.icon` entry, `versions[] + currentCid`, getURL-in-`cid`, served directly |
| Versioning | none | yes (`versions[]`) |

**Decision:** model `handleSettings` on **`appSettings`**. An avatar is an image attached to an entity (a handle), exactly like an icon is an image attached to an app. Reusing the `ActiveEntry`/versions pattern gives version history for free, inherits the getURL-in-`cid` convention, and **collapses the serve path onto the icon path** — eliminating the bare-CID→`assetURI` resolution and (optionally) the 302 indirection that made avatars awkward and that #2418 had to work around host-side.

## Proposed design

### 1. New `handleSettings` store, keyed by `handle`

A new settings store keyed by `handle` (parallel to `appSettings` keyed by `(ownerHandle, appSlug)`), reusing the `appSettings` entry/entries shape. The avatar is a new **`active.avatar`** versioned entry — parallel to `active.icon` and sharing its `{ versions[], currentCid }` mechanics, but a distinct type (Decision 2): `active.icon` carries icon-generation semantics like `descriptionAt` that don't fit a person avatar.

```ts
// conceptual shape — keyed by handle
handleSettings(handle) = {
  entries: ActiveEntry[],            // includes an active.avatar entry: versions[] + currentCid (cid holds getURL)
  entry: { settings: { /* future: bio, links — NOT displayName this phase, Decision 4 */ } },
}
```

Ownership for writes is already encoded: a `handleBinding` row `(handle, userId)` proves the authenticated user owns the handle (`UserSlugBindings`, PK `(handle, userId)` — `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts:11-25`).

### 2. Keep `/u/<handle>/avatar`, retarget its resolution

The path stays — it is the ergonomic contract (Cool URIs don't change; apps `<img src="/u/alice/avatar">`). Its internals change to:

1. Look up the handle's own avatar entry in `handleSettings`.
2. **Hit** → serve/redirect using the entry's getURL (`cidAssetUrl`), same as app icons.
3. **Miss** → fall back to the user's account-default avatar (today's `userSettings.profile.avatarCid` path). `404` only when neither exists (Decision 3).

### 3. Write path + consent gate

The per-handle avatar write goes through a new **`ensureHandleSettings`** handler (Decision 4) carrying the **viewer-selected** target `handle`, gated on the authenticated viewer owning that handle (the `handleBinding` `(handle, userId)` row proves it). The host-side preview/confirm gate from #2418 stays; it becomes keyed on `(viewer, handle)` and the modal copy names the handle being changed.

> ⚠️ **The target handle must be passed explicitly by the viewer and must NOT be inferred from `vibeApp.ownerHandle`.** In the sandbox flow `vibeApp.ownerHandle` is the *app owner's* handle — both published and preview iframe URLs are built from the route's `ownerHandle` — not the viewer's, and `VibeSandboxApi.updateAvatarCid` currently just spreads `...this.svc.vibeApp` into the request (`vibes.diy/vibe/runtime/register-dependencies.ts:361`) while the host handler ignores it and writes the signed-in user's profile. If a viewer edits their avatar from *someone else's* vibe, gating a handle-scoped write on `vibeApp.ownerHandle` would target the app owner's handle or fail the ownership check. So the protocol needs a **new viewer-supplied handle field** (distinct from `vibeApp`, defaulting to the viewer's default handle), validated by the host against the authenticated viewer's bindings — the plumbing does **not** already exist; adding it is part of this work (see Q4). Settings, by contrast, already runs as the viewer and knows the selected handle.

## Non-goals

- No change to the `/u/<handle>/avatar` URL contract or its consumers.
- No removal of the account-default avatar (it becomes the fallback).
- No crop/scale UI (still deferred, as in #2418).

## Design decisions (resolved 2026-06-18 with `@CharlieHelps`)

1. **Storage home → new `handleSettings` table keyed by `handle`** (and linked to `userId`), modeled on the `appSettings` entry pattern. Rejected: `userSettings` (singleton-by-`type` merge fights per-handle entries) and `handleBinding` (identity plumbing — coupling presentation there blocks future handle-level settings).
2. **Entry type → a parallel `active.avatar`** sharing `active.icon`'s `{ versions[], currentCid }` mechanics, **not** `active.icon` verbatim — `active.icon` carries icon-generation semantics (e.g. `descriptionAt`) that don't fit person avatars.
3. **Fallback → handle avatar first, then the user's account-default avatar; `404` only when neither exists.**
4. **Write surface → new `ensureHandleSettings` handler.** `displayName` **stays in `userSettings.profile` for this phase** (smaller blast radius); only the avatar moves per-handle now. The `vibe.req.updateAvatarCid` protocol gains a **viewer-supplied target-handle field** (distinct from `vibeApp.ownerHandle` — see the ⚠️ in §3), defaulting to the viewer's default handle and validated against the viewer's `handleBinding` rows.
5. **Migration → lazy population** of `handleSettings` (only when a user sets a per-handle avatar). No eager backfill; `userSettings.profile.avatarCid` remains the account default and fallback.
6. **getURL-in-`cid` convention → adopt it**, dropping the `assetUploads` lookup from avatar resolution (avatar resolution only needs `assetUploads` today because profile storage is a bare CID; the app-icon flow already proves getURL-backed `cidAssetUrl`). Keep `/u/<handle>/avatar` as the stable URL indirection for compatibility/caching; **redirect-vs-stream is a separable optimization**, decided at implementation time.
7. **Caching → split model.** `must-revalidate` + `ETag` on the stable `/u/<handle>/avatar` URL; immutable long-cache on the underlying `/assets/cid` bytes. The ETag includes **both the source (`handle` vs `fallback`) and the resolved asset identity**, so a fallback→own-avatar transition (or vice versa) busts the cache.

## Edge cases to lock in (before/within planning)

- **Ownership on handle-scoped writes.** Every `ensureHandleSettings` write must verify the target `handle` belongs to the caller's `userId` (the `handleBinding` `(handle, userId)` row). This is the §3 ⚠️ made concrete — the host validates the viewer-supplied handle, never trusts `vibeApp.ownerHandle`.
- **Handle lifecycle.** Define cleanup for `handleSettings` rows when a handle is **deleted or renamed**. Deletion should remove (or orphan-collect) the handle's settings row; rename needs to carry the row (or re-key it) so the avatar follows the handle. `deleteHandleBinding` / handle-rename paths are the hooks.

## Next step

Design is decision-complete. This becomes a `writing-plans` implementation plan under `docs/superpowers/plans/`, roughly: types (`active.avatar`, `handleSettings`) → store + `ensureHandleSettings` handler with ownership check → retargeted `get-user-avatar` resolver with fallback + source-aware ETag → `updateAvatarCid` protocol field + host validation + consent wiring → handle delete/rename lifecycle → Settings + ViewerTag UI to choose the handle being edited.
