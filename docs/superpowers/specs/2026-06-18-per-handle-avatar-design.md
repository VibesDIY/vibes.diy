# Per-handle Avatar Design

**Date:** 2026-06-18
**Predecessor:** [#2418](https://github.com/VibesDIY/vibes.diy/pull/2418) (merged) — host-side avatar preview/confirm gate, and the fix that derives the confirm preview from the host-recorded `getURL` rather than a bare CID.
**Related issue:** [#1968](https://github.com/VibesDIY/vibes.diy/issues/1968) (avatar consent gate).
**Status:** Design decisions resolved with `@CharlieHelps` (2026-06-18) — see the decisions section below. **No code in this PR.** Ready to become a `writing-plans` implementation plan.

## Summary

Today a user has **one** avatar, stored per-user, shown for **every** handle they own. We want avatars to be **per-handle**: a user with `alice` and `alice-dev` can present a different face on each — and, critically, the two must be **visually unlinkable** so a shared image can't correlate the personas to one person (see Privacy invariant). We keep the ergonomic serve path `/u/<handle>/avatar` unchanged (apps reference the image by URL without ever seeing a CID), and we model the new per-handle store on the **`appSettings` shape** (versioned `ActiveEntry`), not the `userSettings` shape — because an avatar is, structurally, a handle's icon, and the app-icon machinery already solves the content-addressed-image problem cleanly.

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

|               | `userSettings`                                             | `appSettings`                                                                    |
| ------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Row key       | `userId`                                                   | `(ownerHandle, appSlug)`                                                         |
| Payload       | `UserSettingItem[]` discriminated union (`settings.ts:73`) | structured `entry.settings` **+** `entries: ActiveEntry[]` (`settings.ts:306`)   |
| Merge         | singleton **by `type`** (`ensure-user-settings.ts:46`)     | per-entry upsert with version history                                            |
| Image support | bare CID string, resolved later via `assetUploads` + 302   | `active.icon` entry, `versions[] + currentCid`, getURL-in-`cid`, served directly |
| Versioning    | none                                                       | yes (`versions[]`)                                                               |

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
3. **Miss** → **`404`** (client renders initials/placeholder). **No fallback to the user's account avatar** — see Decision 3 and the Privacy invariant below.

### 3. Write path + consent gate

The per-handle avatar write goes through a new **`ensureHandleSettings`** handler (Decision 4) carrying the **viewer-selected** target `handle`, gated on the authenticated viewer owning that handle (the `handleBinding` `(handle, userId)` row proves it). The host-side preview/confirm gate from #2418 stays; it becomes keyed on `(viewer, handle)` and the modal copy names the handle being changed.

> ⚠️ **The target handle must be passed explicitly by the viewer and must NOT be inferred from `vibeApp.ownerHandle`.** In the sandbox flow `vibeApp.ownerHandle` is the _app owner's_ handle — both published and preview iframe URLs are built from the route's `ownerHandle` — not the viewer's, and `VibeSandboxApi.updateAvatarCid` currently just spreads `...this.svc.vibeApp` into the request (`vibes.diy/vibe/runtime/register-dependencies.ts:361`) while the host handler ignores it and writes the signed-in user's profile. If a viewer edits their avatar from _someone else's_ vibe, gating a handle-scoped write on `vibeApp.ownerHandle` would target the app owner's handle or fail the ownership check. So the protocol needs a **new viewer-supplied handle field** (distinct from `vibeApp`, defaulting to the viewer's default handle), validated by the host against the authenticated viewer's bindings — the plumbing does **not** already exist; adding it is part of this work (Decision 4). Settings, by contrast, already runs as the viewer and knows the selected handle.

## Privacy invariant

**`/u/<handle>/avatar` must never serve bytes that are shared across a user's handles.** Handles are independent public personas; two handles owned by the same user must be visually unlinkable. Serving the same account-default avatar for `alice` and `alice-dev` would render byte-identical images (same CID, same `ETag`) and let any observer correlate the two handles to one person — a deanonymization breach.

Note this is a bug in the **current** per-user model too: today every handle a user owns serves the same avatar. The per-handle design must **fix** this, not preserve it via a fallback. Hence: a handle's avatar is either its own `active.avatar` or nothing (`404`). The account-scoped `userSettings.profile.avatarCid` is never a public fallback.

## Non-goals

- No change to the `/u/<handle>/avatar` URL contract or its consumers.
- No crop/scale UI (still deferred, as in #2418).

## Design decisions (resolved 2026-06-18 with `@CharlieHelps`)

1. **Storage home → new `handleSettings` table keyed by `handle`** (and linked to `userId`), modeled on the `appSettings` entry pattern. Rejected: `userSettings` (singleton-by-`type` merge fights per-handle entries) and `handleBinding` (identity plumbing — coupling presentation there blocks future handle-level settings).
2. **Entry type → a parallel `active.avatar`** sharing `active.icon`'s `{ versions[], currentCid }` mechanics, **not** `active.icon` verbatim — `active.icon` carries icon-generation semantics (e.g. `descriptionAt`) that don't fit person avatars.
3. **No cross-handle fallback → handle's own `active.avatar`, else `404`** (client renders initials/placeholder). **Superseded the earlier "fall back to account default" call** ([@jchris](https://github.com/jchris)): a shared fallback serves byte-identical avatars for two handles of the same user, correlating the personas — a deanonymization breach (see Privacy invariant). The account-scoped `userSettings.profile.avatarCid` is never served at a handle URL.
4. **Write surface → new `ensureHandleSettings` handler.** `displayName` **stays in `userSettings.profile` for this phase** (smaller blast radius); only the avatar moves per-handle now. The `vibe.req.updateAvatarCid` protocol gains a **viewer-supplied target-handle field** (distinct from `vibeApp.ownerHandle` — see the ⚠️ in §3), defaulting to the viewer's default handle and validated against the viewer's `handleBinding` rows.
5. **Migration → one-time seed of the default handle, then retire `avatarCid`** (@jchris + @CharlieHelps). There is no runtime fallback (Decision 3); instead, a one-time migration copies each user's legacy `userSettings.profile.avatarCid` into **only their default handle's** `active.avatar` — exactly one handle, so no cross-handle correlation — while every other handle starts blank (`404` → initials until its owner uploads). After migration, **`userSettings.profile.avatarCid` is retired** (removed from the `profile` type and writers): in a per-handle model a single per-user avatar has no role and could only re-introduce the correlation Decision 3 removes. Going forward `handleSettings` is the sole home for avatars; new per-handle avatars are written lazily on upload. Seed guardrails (must all hold):
   1. seed only when legacy `userSettings.profile.avatarCid` exists;
   2. verify the `defaultHandle` (`userSettingDefaultHandle`) is currently owned by the user (`handleBinding` `(handle, userId)`) before seeding;
   3. idempotent — seed only when the target handle has no `active.avatar` yet;
   4. if there is no valid default handle, **skip seeding** (stay blank) — never pick another handle implicitly.
6. **getURL-in-`cid` convention → adopt it**, dropping the `assetUploads` lookup from avatar resolution (avatar resolution only needs `assetUploads` today because profile storage is a bare CID; the app-icon flow already proves getURL-backed `cidAssetUrl`). Keep `/u/<handle>/avatar` as the stable URL indirection for compatibility/caching; **redirect-vs-stream is a separable optimization**, decided at implementation time.
7. **Caching → split model.** `must-revalidate` + `ETag` on the stable `/u/<handle>/avatar` URL; immutable long-cache on the underlying `/assets/cid` bytes. The ETag is keyed on the handle's resolved `active.avatar` identity (its `currentCid`); a `404` (no avatar) carries no `ETag`. With the cross-handle fallback removed (Decision 3) there is no "source" axis left to encode — the handle either has its own avatar or none.

> **Clarification — no Clerk login-image import.** Clerk hands us the OAuth profile photo as `params.image_url` (`vibes.diy/api/types/common.ts:11`), but **no production code reads it to set an avatar today** — every avatar renders through `avatarRouteForHandle(handle)` → `/u/<handle>/avatar` → `userSettings.profile.avatarCid`, and the only `avatarCid` writers are the explicit upload flows (`srv-sandbox.ts` self-edit, `settings.tsx`). Auto-seeding from the login image is **out of scope** here (it's user-scoped, so using it for more than a single handle would re-create the correlation problem). The migration above seeds from our _own_ stored avatar, not from Clerk.

## Edge cases to lock in (before/within planning)

- **Ownership on handle-scoped writes.** Every `ensureHandleSettings` write must verify the target `handle` belongs to the caller's `userId` (the `handleBinding` `(handle, userId)` row). This is the §3 ⚠️ made concrete — the host validates the viewer-supplied handle, never trusts `vibeApp.ownerHandle`.
- **Handle lifecycle.** Define cleanup for `handleSettings` rows when a handle is **deleted or renamed**. Deletion should remove (or orphan-collect) the handle's settings row; rename needs to carry the row (or re-key it) so the avatar follows the handle. `deleteHandleBinding` / handle-rename paths are the hooks.

## Next step

Design is decision-complete. This becomes a `writing-plans` implementation plan under `docs/superpowers/plans/`, roughly: types (`active.avatar`, `handleSettings`) → store + `ensureHandleSettings` handler with ownership check → retargeted `get-user-avatar` resolver (own avatar or `404`, no cross-handle fallback) + handle-identity ETag → `updateAvatarCid` protocol field + host validation + consent wiring → one-time default-handle seed migration (Decision 5 guardrails) + retire `userSettings.profile.avatarCid` → handle delete/rename lifecycle → Settings + ViewerTag UI to choose the handle being edited.
