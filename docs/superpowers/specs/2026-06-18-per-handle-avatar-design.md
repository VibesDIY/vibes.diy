# Per-handle Avatar Design

**Date:** 2026-06-18
**Predecessor:** [#2418](https://github.com/VibesDIY/vibes.diy/pull/2418) (merged) — host-side avatar preview/confirm gate, and the fix that derives the confirm preview from the host-recorded `getURL` rather than a bare CID.
**Related issue:** [#1968](https://github.com/VibesDIY/vibes.diy/issues/1968) (avatar consent gate).
**Status:** Spec for review — **no code in this PR.** Open questions below are tagged for `@CharlieHelps`.

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

A new settings store keyed by `handle` (parallel to `appSettings` keyed by `(ownerHandle, appSlug)`), reusing the `appSettings` entry/entries shape. The avatar is an `active.icon`-style versioned entry (see Q2 on whether to reuse `active.icon` or add `active.avatar`):

```ts
// conceptual shape — keyed by handle
handleSettings(handle) = {
  entries: ActiveEntry[],            // includes the avatar entry: versions[] + currentCid (cid holds getURL)
  entry: { settings: { displayName?: string /* future: bio, links */ } },
}
```

Ownership for writes is already encoded: a `handleBinding` row `(handle, userId)` proves the authenticated user owns the handle (`UserSlugBindings`, PK `(handle, userId)` — `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts:11-25`).

### 2. Keep `/u/<handle>/avatar`, retarget its resolution

The path stays — it is the ergonomic contract (Cool URIs don't change; apps `<img src="/u/alice/avatar">`). Its internals change to:

1. Look up the handle's own avatar entry in `handleSettings`.
2. **Hit** → serve/redirect using the entry's getURL (`cidAssetUrl`), same as app icons.
3. **Miss** → fall back to the user's account-default avatar (today's `userSettings.profile.avatarCid` path) — see Q3.

### 3. Write path + consent gate

The per-handle avatar write goes through a handle-scoped ensure (modeled on `ensureAppSettings`; see Q4) carrying the **viewer-selected** target `handle`, gated on the authenticated viewer owning that handle (the `handleBinding` `(handle, userId)` row proves it). The host-side preview/confirm gate from #2418 stays; it becomes keyed on `(viewer, handle)` and the modal copy names the handle being changed.

> ⚠️ **The target handle must be passed explicitly by the viewer and must NOT be inferred from `vibeApp.ownerHandle`.** In the sandbox flow `vibeApp.ownerHandle` is the *app owner's* handle — both published and preview iframe URLs are built from the route's `ownerHandle` — not the viewer's, and `VibeSandboxApi.updateAvatarCid` currently just spreads `...this.svc.vibeApp` into the request (`vibes.diy/vibe/runtime/register-dependencies.ts:361`) while the host handler ignores it and writes the signed-in user's profile. If a viewer edits their avatar from *someone else's* vibe, gating a handle-scoped write on `vibeApp.ownerHandle` would target the app owner's handle or fail the ownership check. So the protocol needs a **new viewer-supplied handle field** (distinct from `vibeApp`, defaulting to the viewer's default handle), validated by the host against the authenticated viewer's bindings — the plumbing does **not** already exist; adding it is part of this work (see Q4). Settings, by contrast, already runs as the viewer and knows the selected handle.

## Non-goals

- No change to the `/u/<handle>/avatar` URL contract or its consumers.
- No removal of the account-default avatar (it becomes the fallback).
- No crop/scale UI (still deferred, as in #2418).

## Open questions for `@CharlieHelps`

1. **Storage home.** Confirm a **new `handleSettings` table keyed by `handle`, modeled on `appSettings`** is the right call — vs. (a) adding an `avatarCid` column to `handleBinding`/`UserSlugBindings` (saves the second query since the serve path already loads that row by handle, but it's a migration and splits profile data across stores and conflates an identity table with presentation), or (b) a handle-scoped entry inside `userSettings` (blocked by the by-`type` singleton merge — would need a composite merge key). Our lean: new table.
2. **Entry type.** Reuse `active.icon` verbatim for avatars (maximal reuse of `store-icon` + serving), or add a parallel `active.avatar` `ActiveEntry` (avoids semantic conflation of "app icon" vs "person avatar")? Our lean: a distinct `active.avatar` sharing the same `{ versions[], currentCid }` structure.
3. **Fallback semantics.** Handle with no own avatar → **fall back to the user's account-default** avatar (our lean), or `404` and let the app render initials? Fallback keeps existing handles visually unchanged on day one.
4. **Write surface + displayName + target handle.** New `ensureHandleSettings` handler, or extend the `ensureAppSettings`-style machinery to a handle key? The `vibe.req.updateAvatarCid` protocol gains a **viewer-supplied target-handle field** (distinct from `vibeApp.ownerHandle`, which is the app owner — see the ⚠️ in §3), defaulting to the viewer's default handle and validated against the viewer's `handleBinding` rows. And does per-handle **`displayName`** move into `handleSettings` too (deprecating `userSettings.profile.displayName`), or stay per-user for now? Avatar-only is a smaller first step.
5. **Migration / backfill.** Keep `userSettings.profile.avatarCid` as the account default with **no data migration** and populate `handleSettings` **lazily** (only when a user sets a per-handle avatar) — our lean — or eagerly backfill a handle entry per existing default handle?
6. **getURL-in-`cid` convention.** Adopt the app-icon convention (store `getURL` in the entry's `cid` field) so the avatar serves via a direct `cidAssetUrl` and we **drop the `assetUploads` resolution + 302**? Or keep bare-CID + the existing redirect for the avatar? Our lean: adopt the convention; it's the main simplification dividend.
7. **Caching posture.** App icons serve `Cache-Control: public, max-age=31536000, immutable`. `/u/<handle>/avatar` currently serves `max-age=0, must-revalidate` with `ETag: "<avatarCid>"` (`get-user-avatar.ts:53-88`). With per-handle resolution + fallback, the ETag should key on the **resolved** entry (cid + which source). Keep `must-revalidate` on the stable handle URL (so a new upload shows up), while the underlying `/assets/cid` bytes stay immutable? Confirm.

## Next step

On answers to the above (especially Q1, Q2, Q6), this becomes a `writing-plans` implementation plan under `docs/superpowers/plans/`: types → `handleSettings` store + ensure handler → retargeted `get-user-avatar` with fallback → write/consent wiring → Settings + ViewerTag UI to choose the handle being edited.
