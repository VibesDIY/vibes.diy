# Vibe Viewer Identity & Capabilities — Design

**Date:** 2026-05-09
**Scope:** Surface viewer identity (userSlug, displayName, avatarUrl) and per-app/per-db access information to the running vibe sandbox over the existing iframe postMessage bridge, so generated app code can render avatars and gate UI on whether the viewer can read/write/delete a given database.
**Status:** Drafted, awaiting user review

## Problem

A running vibe (the user-facing iframe sandbox) currently has no way to know who is viewing it. Generated `App.tsx` code cannot:

- Render the viewer's name or avatar.
- Hide a comment composer when the viewer lacks write access.
- Show "editors only" copy on a form a visitor can't submit.
- Tag a comment as "by the owner" without re-deriving identity.

The host (vibes.diy platform code) already knows everything needed: the Clerk session, the viewer's userSlug bindings, the per-app `DocAccessLevel`, and the per-`(userSlug, appSlug, dbName)` ACL overrides. None of it crosses the postMessage boundary today.

The result: prompt-generated apps either ignore identity entirely or invent ad-hoc patterns (the existing `CommentsSection` component is host-side React, not sandbox code, and stamps `authorUserId`/`authorImageUrl` directly from `useAuth`/`useUser` — a path the iframe can't take).

The complete feature paves the way for blogs, forums, surveys, and any vibe with multiple readers/writers, by giving the prompt a single canonical place to read identity and capabilities from.

## Goals

- Sandbox can render the viewer's avatar and display name on first paint, with no async roundtrip.
- Sandbox can synchronously decide whether to render a write/delete UI for any database it touches.
- Sandbox sees only the viewer's `userSlug` — never the underlying Clerk `userId`. One Clerk user "playing as" multiple userSlugs gets the same grants regardless of which slug is active.
- Vocabulary and resolution rules match the host's existing `DocAccessLevel` + `DbAcl` + `aclAllows` model exactly. No new authz concepts.
- Identity surface is delivered via the same iframe postMessage bridge already used for put-doc / put-asset / firefly.
- Avatars are first-class, stored as asset CIDs (existing put-asset pipeline), uploadable from the user settings view; default falls back to Clerk's `imageUrl` so existing accounts work zero-migration.

## Non-goals

- Anonymous-write capability (e.g. survey submissions from unauthenticated visitors). Today's authz returns `"none"` for anon and only `isPublicReadable` opens reads. Adding a `publicSubmit` setting or a `"public"` `DbAclSubject` is a follow-up; the wire shape carries whatever the host computes, so v2 lands without a protocol change.
- In-iframe persona switching (one Clerk user toggling between their own userSlugs from inside the sandbox). v1 ships single active userSlug; the host picks it. Persona switching can be added later by emitting `vibe.evt.viewerChanged` and (optionally) extending whoAmI with `alternateSlugs[]`.
- Arbitrary userSlug → avatar lookup from the sandbox. Avatars for _other_ users (e.g. each comment author) continue to be stamped on the doc at write time, which is what `CommentsSection` already does today.
- Live ACL/grant change push. If an owner edits an ACL while a viewer has the iframe open, the viewer's cached `dbAcls` go stale until the next mount or until they re-call `vibe.req.whoAmI`. The next put-doc still authorizes server-side, so staleness is a UX issue (button shows enabled, write 403s), not a security one.

## Design

### 1. User settings: avatar storage

Add an optional `avatarCid` field to user settings (the existing `ensureUserSettings` flow). The CID points to an asset uploaded via the existing put-asset pipeline (same one comments/img-gen use).

```ts
// vibes.diy/api/types/user-settings.ts (or wherever UserSettings lives)
export const userSettings = type({
  // ...existing fields
  "avatarCid?": "string",
  "displayName?": "string", // override for Clerk-derived display
});
```

Display name: settings.displayName → Clerk `nick`/`name`/`first+last`/`email` (same precedence as `deriveAuthorDisplay` in [list-members.ts:22-29](../../../vibes.diy/api/svc/public/list-members.ts#L22-L29)).

### 1a. Avatar URL: stable indirection by userSlug

`whoAmI` does **not** return the CID's content-addressed URL. Content-addressed URLs are too stable — once embedded in an app (e.g. stamped on a comment doc) they freeze the avatar at the moment of embed. Instead the host serves a stable per-userSlug indirection route:

```
GET /u/:userSlug/avatar
```

Resolution order (server-side, at request time):

1. If user-settings has `avatarCid`, redirect (302) to the cid-asset URL for that CID.
2. Else if the viewer's Clerk profile has an `imageUrl`, redirect to that.
3. Else 404 (the sandbox treats undefined as "no avatar"; up to the prompt/template to render initials or an identicon fallback in markup).

`whoAmI` returns this stable URL as `viewer.avatarUrl`. The CID itself never crosses the bridge.

**Caching:** `Cache-Control: max-age=0, must-revalidate` plus `ETag: "<cid-or-clerk-image-hash>"` on the redirect response. Browsers and CDN edges revalidate on every use but get a cheap `304 Not Modified` when nothing changed; new uploads land instantly. The CID-asset URL itself can carry a long TTL — it's content-addressed.

**Why this matters for embedded use:** the existing `CommentsSection` stamps `authorImageUrl` into the comment doc at write time. With the stable indirection URL, when alice changes her avatar tomorrow, every comment alice ever wrote shows her new avatar — matching modern social UX. (Vibes that explicitly want a frozen-at-write-time avatar can opt in by stamping the CID URL instead, fetched separately; not the default.)

### 2. Settings view: avatar upload

The host's user-settings page gains an "Avatar" section: file picker → put-asset → store returned CID into `avatarCid`. Same UX shell as any other asset upload in the app. After save, the user's stable `/u/:userSlug/avatar` URL serves the new image immediately (next request revalidates and gets the new ETag). Out-of-scope details (cropping, validation): match whatever the existing image-uploading widgets do.

### 3. Wire format: iframe message types

Defined in [vibes.diy/vibe/types/index.ts](../../../vibes.diy/vibe/types/index.ts), alongside the existing put-asset / firefly types.

```ts
// viewer payload — avatarUrl is a stable opaque URL computed by the server
export const viewerPayload = type({
  userSlug: "string",
  "displayName?": "string",
  avatarUrl: "string", // absolute URL, e.g. "https://vibes.diy/u/alice/avatar"
});

// Request: sandbox → host
export const ReqVibeWhoAmI = type({
  type: "'vibe.req.whoAmI'",
}).and(Base);

// Response: host → sandbox
export const ResVibeWhoAmI = type({
  type: "'vibe.res.whoAmI'",
  // null = anonymous (not signed in). Sandbox guards with `if (viewer)`.
  // avatarUrl is included on viewer (not a separate helper) — apps treat it
  // as an opaque string and never internalize the /u/:userSlug/avatar pattern.
  viewer: viewerPayload.or("null"),
  // App-scoped role for this viewer on this app.
  access: "'owner' | 'editor' | 'viewer' | 'submitter' | 'none'",
  // Per-dbName ACL overrides; missing entries fall back to canRead/canWrite(access).
  // Same shape as DbAcl in @vibes.diy/api-types.
  "dbAcls?": "Record<string, DbAcl>",
}).and(Base);

// Event: identity changed (login/logout, persona swap)
// Same payload as ResVibeWhoAmI minus `tid` semantics — see implementation note.
export const EvtVibeViewerChanged = ResVibeWhoAmI; // structurally identical
```

The arktype types end up looking similar to the existing `Base`-derived types; concrete encoding (with arktype's `or`/`null` syntax) follows the existing put-asset patterns at [vibes.diy/vibe/types/index.ts:434-455](../../../vibes.diy/vibe/types/index.ts#L434-L455).

### 4. Initial delivery: bundled into mountParams

The current `VibeMountParams` ([vibes.diy/vibe/runtime/vibe.ts](../../../vibes.diy/vibe/runtime/vibe.ts)) is a near-empty `{ usrEnv: {} }`. Extend it with a `viewer` field carrying the same payload as a `ResVibeWhoAmI`:

```ts
export const vibeMountParams = type({
  usrEnv: vibeEnv,
  "viewer?": viewerPayload, // see Wire format §3
});
```

Host-side `mount-vibes.ts` ([line 46](../../../vibes.diy/vibe/runtime/mount-vibes.ts#L46)) is updated by the caller (the host React component that mounts the iframe) to compute and pass `viewer` before mount. The sandbox's `VibeContext` ([VibeContext.tsx](../../../vibes.diy/vibe/runtime/VibeContext.tsx)) populates from `mountParams.viewer` so the very first React render already has identity — no flash of "unknown viewer".

### 5. Refresh path: vibe.req.whoAmI

The sandbox can call `vibeDiyApi.whoAmI()` (returns `Promise<ResVibeWhoAmI>`) on demand. Use cases:

- After an action where the viewer expects state to have changed (e.g. user just got promoted to editor via a separate flow).
- As a recovery path when the prompt-generated code wants to optimistically retry after a permission error.

Same tid-based request pattern as put-asset; same `register-dependencies.ts` handler shape as the firefly handlers.

### 6. Change events: vibe.evt.viewerChanged

The host emits `vibe.evt.viewerChanged` (broadcast event, no tid) when:

- The viewer signs in or out while the iframe is mounted.
- The viewer switches active persona (future feature, but the event is allocated now so we don't need a protocol revision later).

Sandbox consumers subscribe via a hook (see §7). Out of scope for v1: emitting on grant/ACL changes — these happen on the host side and would require a server-push channel into the iframe; the existing reply-to-tid pattern doesn't help here.

### 7. Sandbox API: useViewer + can()

Generated apps consume identity through a single hook **imported from the public `use-vibes` package** — same import path as `ImgGen`/`useFireproof`/`useVibes`:

```ts
import { useViewer } from "use-vibes";
```

Implementation lives in the workspace package `@vibes.diy/use-vibes-base` (`use-vibes/base/hooks/use-viewer.ts`) and is re-exported through `use-vibes/pkg/index.ts`. The hook reads `mountParams.viewerEnv` from the runtime's `VibeContext` (`@vibes.diy/vibe-runtime`), so the data flows: server → mountParams → runtime context → use-vibes hook → generated app.

```ts
// use-vibes/base/hooks/use-viewer.ts
export interface Viewer {
  userSlug: string;
  displayName?: string;
  avatarUrl: string; // opaque stable URL — use in <img src>, never construct it
}

export interface UseViewerResult {
  viewer: Viewer | null;
  access: DocAccessLevel;
  dbAcls: Record<string, DbAcl>;
  can: (action: "read" | "write" | "delete", dbName?: string) => boolean;
  // avatarUrlFor removed — use viewer.avatarUrl directly.
  // For other users' avatars, store viewer.avatarUrl as authorAvatarUrl on the
  // doc at write time; render from the doc at display time.
}

export function useViewer(): UseViewerResult;
```

`viewer.avatarUrl` is an absolute URL computed server-side (e.g. `https://vibes.diy/u/alice/avatar`). Apps treat it as an opaque string — they don't construct it from `userSlug` and never need to know the indirection pattern.

**Other users' avatars:** store the URL on the doc at write time. This works because the stable indirection URL keeps pointing to the latest avatar even after the user changes it:

```tsx
// On post:
const { viewer } = useViewer();
await db.put({ body, authorUserSlug: viewer.userSlug, authorAvatarUrl: viewer.avatarUrl });

// On render:
{
  comments.map((c) => (
    <li key={c._id}>
      <img src={c.authorAvatarUrl} alt={c.authorUserSlug} />
      {c.body}
    </li>
  ));
}
```

Behaviour:

- Reads from `VibeContext` (seeded by mountParams §4).
- Re-renders when `vibe.evt.viewerChanged` fires.
- `can(action, dbName)` — calls a client port of `aclAllows` ([db-acl-resolver.ts:61-71](../../../vibes.diy/api/svc/public/db-acl-resolver.ts#L61-L71)) against the resolved ACL for that dbName, falling back to `canRead`/`canWrite`(access) when the dbName has no override.
- `can(action)` (no dbName) — returns true iff the action is allowed for **every** dbName the app could have. Concretely: the app-scoped fallback (`canRead`/`canWrite` against `access`) must allow the action AND every configured override in `dbAcls` must also allow it. For a 1-db vibe with no custom ACL — the 99% case — this collapses to a plain role check.

Example sandbox use:

```tsx
function CommentForm() {
  const { viewer, can } = useViewer();
  if (!viewer) return <p>Sign in to comment.</p>;
  if (!can("write", "comments")) return <p>Only editors can comment.</p>;
  return (
    <form>
      <img src={viewer.avatarUrl} alt={viewer.userSlug} />
      <textarea name="body" />
      <button>Post</button>
    </form>
  );
}
```

### 8. Host-side handler

A new `whoAmI` handler in [vibes.diy/api/svc/public/](../../../vibes.diy/api/svc/public/) (or wherever the iframe-bridge handlers register; this design assumes the existing `register-dependencies.ts` host stub forwards the relevant requests through to api/svc/public the way put-doc does, but the implementation plan should pin down the exact wiring point).

The handler:

1. Reads the viewer's Clerk session from the request context (same pattern as `optAuth` in [list-members.ts:48](../../../vibes.diy/api/svc/public/list-members.ts#L48)). For anonymous, `viewer = null` and `userId` is absent.
2. If signed in: looks up the viewer's active userSlug (binding) and ensures user-settings to source the optional `displayName` override.
3. Computes `access = checkDocAccess(viewerUserId, appSlug, ownerUserSlug)` ([access-helpers.ts:13-44](../../../vibes.diy/api/svc/public/access-helpers.ts#L13-L44)). For anonymous, `access = "none"`.
4. Loads all configured `dbAcls` for `(ownerUserSlug, appSlug)` from app settings — same source `resolveDbAcl` reads ([db-acl-resolver.ts:39-56](../../../vibes.diy/api/svc/public/db-acl-resolver.ts#L39-L56)) but returns the whole map rather than per-db.
5. Returns the assembled `ResVibeWhoAmI`. (Avatar resolution is **not** part of this handler — see §1a; it lives on the separate `/u/:userSlug/avatar` HTTP route.)

The same logic runs at iframe-mount time (to populate `mountParams.viewer`) and at request time (for `vibe.req.whoAmI`).

### 9. Boundary: capability hints, not enforcement

Capabilities sent to the sandbox are a **UX hint**. Every put-doc / put-asset / delete-doc continues to authorize against the host's session-derived `DocAccessLevel` at the existing boundary in [app-documents.ts](../../../vibes.diy/api/svc/public/app-documents.ts). A sandbox that lies about `can("write")` and submits anyway gets a server-side 403. This is the same trust model as the put-asset boundary note at [vibe/types/index.ts:426-431](../../../vibes.diy/vibe/types/index.ts#L426-L431) ("the grant is host-side, hidden from sandbox code").

### 10. Prompt instructions

The system prompt (or vibe template) gains a short stanza:

> Use `useViewer()` from `"use-vibes"` (same package as `ImgGen` and `useFireproof`). `viewer` is the signed-in user (or null) — `viewer.avatarUrl` is the opaque avatar URL, use it directly in `<img src>`. Render names with `viewer.displayName ?? viewer.userSlug`. For other users' avatars (e.g. comment authors), store `viewer.avatarUrl` as `authorAvatarUrl` on the doc at write time and render from the doc. Gate write/delete UI on `can("write")` / `can("delete")`. For multi-db apps, pass the dbName: `can("write", "comments")`.

## Components Summary

| Layer                                                | Change                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@vibes.diy/api-types` user settings                 | Add `avatarCid?`, `displayName?`                                                              |
| `@vibes.diy/api-types` iframe types                  | Add `ReqVibeWhoAmI`, `ResVibeWhoAmI`, `EvtVibeViewerChanged`, viewer payload schema           |
| `vibes.diy/vibe/runtime/vibe.ts`                     | Extend `vibeMountParams` with optional `viewer`                                               |
| `vibes.diy/vibe/runtime/VibeContext.tsx`             | Plumb `viewer` into context, subscribe to `viewerChanged`                                     |
| `vibes.diy/vibe/runtime/db-acl-allows.ts` (new)      | Client port of `aclAllows` — pure function, used by `useViewer`'s `can()`                     |
| `use-vibes/base/hooks/use-viewer.ts` (new)           | `useViewer()` hook + `can()` — reads runtime VibeContext; `viewer.avatarUrl` is opaque string |
| `use-vibes/base/index.ts` + `use-vibes/pkg/index.ts` | Re-export `useViewer` so vibes can `import { useViewer } from "use-vibes"`                    |
| `vibes.diy/vibe/runtime/register-dependencies.ts`    | Wire up whoAmI request and viewerChanged event on the bridge                                  |
| `vibes.diy/api/svc/public/who-am-i.ts` (new)         | Host handler — auth, access, dbAcls (no avatar work here)                                     |
| `vibes.diy/api/...` HTTP route (new)                 | `GET /u/:userSlug/avatar` — 302 to current CID URL or Clerk `imageUrl`, ETag-cached           |
| `vibes.diy/pkg/app/components/...` settings page     | Avatar upload widget storing `avatarCid`                                                      |
| Host iframe mount caller                             | Compute initial viewer payload, pass into `VibeMountParams`                                   |
| Prompt template                                      | Document `useViewer()`                                                                        |

## Testing

- Unit: `aclAllows` client port matches host port (shared test fixtures).
- Unit: `can(action)` (no dbName) returns expected booleans for {empty dbAcls, one allowing override, one denying override, mixed}.
- Integration: iframe mount with signed-in owner sees `access: "override"`, anon sees `viewer: null` + `access: "none"`.
- Integration: `vibe.req.whoAmI` after sign-in fires the event and returns the new viewer.
- Integration: avatar upload flow — settings widget puts asset, `/u/:userSlug/avatar` 302s to the new CID URL, ETag changes; old ETag responses 304.
- Integration: `viewer.avatarUrl` for a userSlug with no upload returns a URL that 302s to Clerk `imageUrl`; for an unknown slug returns one that 404s.
- Server: write attempt with `can("write")` lying still 403s at put-doc.

## Open Questions for Implementation Plan

- Exact wiring of the new whoAmI handler into the existing iframe bridge — does it follow the firefly handlers' pattern, or the put-asset host-shim pattern? (Both flow through `register-dependencies.ts` but have different shapes.)
- Whether `dbAcls` in the response should include only configured entries (saving bytes) or also the comments-default fallback explicitly. Recommend "configured only" — sandbox `can()` knows the comments default via the same constant `COMMENTS_DEFAULT_ACL` exported from api-types.
- Cache-headers / TTL on the cid-asset URL the `/u/:userSlug/avatar` endpoint redirects to — content-addressed so safe with a long TTL.
- `avatarUrl` is computed server-side (render-vibe uses the request origin; WS handler uses `VIBES_DIY_PUBLIC_BASE_URL`). Apps see it as an opaque string on `viewer` — no client-side URL construction.
