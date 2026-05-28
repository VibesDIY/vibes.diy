# ViewerTag Component Design

**Date:** 2026-05-26
**Issue:** [#1946](https://github.com/VibesDIY/vibes.diy/issues/1946) tracks renaming `userSlug` → `userHandle` globally; this spec uses `userSlug` until that lands.

## Summary

Add a `ViewerTag` React component to the `useViewer` vibe runtime hook. The component renders an inline user pill — avatar + slug — and, when the current viewer is looking at themselves, shows a dashed edit ring on the avatar that opens a file picker to change their profile photo.

## API

`ViewerTag` is returned from `useViewer()` and is not exported at the top level.

```tsx
const { viewer, ViewerTag } = useViewer()

// Render current viewer (self, editable):
<ViewerTag />

// Render another user by slug (read-only):
<ViewerTag userSlug="mabelsmith" />
```

### Undocumented sugar (not in LLM preamble)

The component also accepts a user object for callers that already have one:

```tsx
<ViewerTag user={post.author} />
// where author: { userSlug: string; displayName?: string; avatarUrl?: string }
```

Prop resolution order: `user.userSlug` → `userSlug` prop → absent (treat as self).

### Type signature

```ts
type ViewerTagProps =
  | { userSlug?: never; user?: never } // self
  | { userSlug: string; user?: never } // slug string
  | {
      user: { userSlug: string; displayName?: string; avatarUrl?: string }; // object sugar
      userSlug?: never;
    };
```

`UseViewerResult` gains:

```ts
ViewerTag: React.FC<ViewerTagProps>;
```

## Self-detection

Edit mode activates when:

- No `userSlug` or `user` prop is passed (`!('userSlug' in props) && !('user' in props)`), **or**
- The resolved slug matches `viewer?.userSlug`

`'userSlug' in props` distinguishes "prop explicitly omitted" from "prop passed as `undefined`", preventing a `undefined` value from a loop lookup from silently triggering edit mode.

## Undefined guard

When `userSlug` is present in props but resolves to a falsy value (e.g. `userSlug={undefined}` from a broken data lookup), the component renders a dim, non-interactive fallback instead of crashing or showing the edit ring:

```tsx
<span style={{ opacity: 0.4, fontStyle: "italic", fontSize: 13 }}>no user handle provided</span>
```

## Visual design

**Read-only pill** (other user):

- Inline flex: 30px avatar circle + slug text
- Avatar: `user.avatarUrl` if provided, else `avatarRouteForUserSlug(userSlug)`; initials fallback
- Pill background: `rgba(255,255,255,0.07)`, 1px subtle border, 999px border-radius

**Self pill** (current viewer):

- Same pill shape
- Avatar gains dashed indigo outline ring (`outline: 2px dashed #818cf8`) and a semi-transparent pencil overlay (`✎`) — always visible, not hover-only, so it's discoverable on touch devices
- Cursor: pointer

Clicking the avatar (self mode only) triggers a hidden `<input type="file" accept="image/*">`.

## Upload flow

`ViewerTag` runs inside the vibe iframe sandbox — it cannot call `vibeDiyApi` directly. The upload uses two postMessage round-trips via `VibeSandboxApi`:

**Step 1 — upload bytes (existing RPC)**

```ts
const r = await vibeApi.putAsset(file, file.type);
// → { cid, getURL, size, uploadId }
```

`putAsset` sends `vibe.req.putAsset`; the host mints a grant, POSTs the bytes, returns the CID.

**Step 2 — save CID to user profile (new RPC)**

```ts
await vibeApi.updateAvatarCid(cid);
// sends vibe.req.updateAvatarCid { cid }
// host calls vibeDiyApi.ensureUserSettings({ settings: [{ type: "profile", avatarCid: cid }] })
```

The host only honours this request when the requesting sandbox's `userSlug` matches the authenticated viewer — same ownership check already applied to `putAsset`.

`GET /u/{userSlug}/avatar` reads `avatarCid` from SQL settings (unchanged); the new CID is live as soon as the host round-trip completes.

During upload the avatar circle shows 50% opacity. Silent failure on error — no error UI.

## Files

| File                                              | Change                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `vibes.diy/vibe/runtime/use-viewer-tag.tsx`       | New — component implementation                                                                                                             |
| `vibes.diy/vibe/runtime/use-viewer.ts`            | Add `ViewerTag` to return value                                                                                                            |
| `vibes.diy/vibe/types/index.ts`                   | New `ReqVibeUpdateAvatarCid` / `ResVibeUpdateAvatarCid` message types; add `ViewerTag` to `UseViewerResult` interface                      |
| `vibes.diy/vibe/runtime/register-dependencies.ts` | Add `updateAvatarCid(cid)` method to `VibeSandboxApi`                                                                                      |
| `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`       | Handle `vibe.req.updateAvatarCid` → call `vibeDiyApi.ensureUserSettings`                                                                   |
| `prompts/pkg/llms/use-viewer.md`                  | New `## ViewerTag` section documenting `<ViewerTag />` and `<ViewerTag userSlug="..." />` (string prop only — object sugar not documented) |

## Out of scope

- Renaming `userSlug` → `userHandle` (tracked in [#1946](https://github.com/VibesDIY/vibes.diy/issues/1946))
- Showing upload progress beyond opacity dimming
- Explicit error states or retry UI
- Theming / CSS custom property hooks
