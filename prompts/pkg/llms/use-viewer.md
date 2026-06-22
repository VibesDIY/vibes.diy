# useViewer Hook

`useViewer()` is a **read-only window** into viewer identity. The platform owns the rules — who's the owner, who has been granted read or write — and `useViewer()` lets your app see who's signed in and render their identity. You cannot grant or revoke access from code; you can only reflect the runtime's verdict in your UI.

Use `useViewer()` for identity and display only — `ViewerTag`, avatars, and showing who's signed in. **Write surfaces are gated with `useVibe(dbName).can`** (see use-vibe docs), not with `viewer`/`isOwner`/`access.*`.

## Basic Usage

Start with a minimal component that shows the viewer identity:

App.jsx

```jsx
import React from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

export default function App() {
  const { viewer, isViewerPending, ViewerTag } = useViewer();

  if (isViewerPending) return null;

  return (
    <div>
      <header>
        <ViewerTag />
      </header>
      {!viewer && <p>Sign in.</p>}
      {viewer && <p>Welcome back!</p>}
    </div>
  );
}
```

## What you get

- `viewer` — `{ userHandle, displayName? }` or `null` for anonymous visitors. Avatars are not on the payload — render them with `<ViewerTag userHandle={...} />`, which resolves the avatar from the handle. Don't build avatar URLs yourself.
- `isViewerPending` — `true` while the platform is still resolving the viewer identity (e.g. on first render before the parent shell has pushed the identity update). **Gate any auth-dependent UI on `!isViewerPending`** to avoid flashing the wrong state. Once it becomes `false`, `viewer` is either populated or definitively `null`.
- `isOwner` — `true` when the viewer owns this vibe. Use it for management UI (settings, role grants, moderation).
- `can(action, dbName?)` — legacy ACL boolean for `"read"`/`"write"`/`"delete"`. Prefer `useVibe(dbName).can.create/edit/delete` for write gating; it runs the app's access function and returns a `reason`.
- `ViewerTag` — ready-made user pill; see the ViewerTag section below.

## Gating UI

Add a "commenting as" label and a write-gated form. Use `useVibe("comments").can` to gate the form; `ViewerTag` handles sign-in/identity display:

App.jsx

```jsx
<<<<<<< SEARCH
import { useViewer } from "use-vibes";
=======
import { useViewer, useVibe } from "use-vibes";
>>>>>>> REPLACE
```

App.jsx

```jsx
<<<<<<< SEARCH
  const { viewer, isViewerPending, ViewerTag } = useViewer();
=======
  const { viewer, isViewerPending, ViewerTag } = useViewer();
  const { can, ready, me } = useVibe("comments");
>>>>>>> REPLACE
```

App.jsx

```jsx
<<<<<<< SEARCH
      {!viewer && <p>Sign in.</p>}
      {viewer && <p>Welcome back!</p>}
=======
      {/* identity display */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {viewer && <span style={{ fontSize: 13, color: "var(--muted, #888)" }}>commenting as</span>}
        <ViewerTag />
      </div>

      {/* write gate: useVibe().can, not viewer */}
      {!ready ? null : (() => {
        const v = can.create({ type: "comment", authorHandle: me?.userHandle });
        return v.ok ? (
          <form>
            <input placeholder="Add a comment..." />
            <button type="submit">Post</button>
          </form>
        ) : (
          <p>{v.reason}</p>
        );
      })()}
>>>>>>> REPLACE
```

## Tagging content with the viewer (write/render pattern)

When one user writes content others will see (comments, posts, messages), **stamp `authorHandle` on the doc at write time**. That's it — just the handle. Render with `<ViewerTag userHandle={doc.authorHandle} />` which resolves display name and avatar automatically. Do not stamp `displayName` or `avatarUrl` on docs — ViewerTag handles that from the handle alone.

Wire up a full comment thread with Fireproof and viewer attribution:

App.jsx

```jsx
<<<<<<< SEARCH
import { useViewer, useVibe } from "use-vibes";
=======
import { useViewer, useVibe } from "use-vibes";
import { useFireproof } from "use-fireproof";
>>>>>>> REPLACE
```

```jsx
<<<<<<< SEARCH
  const { viewer, isViewerPending, ViewerTag } = useViewer();
  const { can, ready, me } = useVibe("comments");
=======
  const { viewer, isViewerPending, ViewerTag } = useViewer();
  const { can, ready, me } = useVibe("comments");
  const { useLiveQuery, database } = useFireproof("comments");
  const { docs: comments } = useLiveQuery("createdAt");
  const [body, setBody] = React.useState("");
>>>>>>> REPLACE
```

```jsx
<<<<<<< SEARCH
      {/* write gate: useVibe().can, not viewer */}
      {!ready ? null : (() => {
        const v = can.create({ type: "comment", authorHandle: me?.userHandle });
        return v.ok ? (
          <form>
            <input placeholder="Add a comment..." />
            <button type="submit">Post</button>
          </form>
        ) : (
          <p>{v.reason}</p>
        );
      })()}
=======
      <ul>
        {comments.map((c) => (
          <li key={c._id}>
            <ViewerTag userHandle={c.authorHandle} />
            <p>{c.body}</p>
          </li>
        ))}
      </ul>

      {/* identity display */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {viewer && <span style={{ fontSize: 13, color: "var(--muted, #888)" }}>commenting as</span>}
        <ViewerTag />
      </div>

      {/* write gate: useVibe().can, not viewer */}
      {!ready ? null : (() => {
        const v = can.create({ type: "comment", authorHandle: me?.userHandle });
        return v.ok ? (
          <form onSubmit={(e) => { e.preventDefault(); post(); }}>
            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment..." />
            <button type="submit">Post</button>
          </form>
        ) : (
          <p>{v.reason}</p>
        );
      })()}
>>>>>>> REPLACE
```

Also add the `post` handler before `if (isViewerPending)`:

```jsx
<<<<<<< SEARCH
  if (isViewerPending) return null;
=======
  async function post() {
    if (!body.trim()) return;
    await database.put({
      body: body.trim(),
      createdAt: Date.now(),
      authorHandle: me?.userHandle,
    });
    setBody("");
  }

  if (isViewerPending) return null;
>>>>>>> REPLACE
```

Key points:

- **Stamp `authorHandle` at write time** — persist the author's handle on the doc. Render with `<ViewerTag userHandle={authorHandle} />` which resolves display name and avatar automatically.
- **Avatars are stable** — ViewerTag resolves the avatar from the handle; if the author changes their avatar, the URL stays the same and the bytes update. ViewerTag handles this for you.
- **One source of identity** — persist `authorHandle` on the doc. ViewerTag does the rest.

## Notes

- Never use Clerk user IDs. Only `userHandle` crosses into vibe code.
- Avatar URLs are stable indirection URLs — when a user changes their avatar, the URL stays the same and the bytes update. Treat them as opaque strings.
- To reflect a viewer's roles/channels for display, use `access` from `useFireproof()`: `access.hasRole("moderator")`, `access.hasChannel("engineering")`. To gate a write surface, use `useVibe(dbName).can` (it runs the same access.js). The access function is the server-side authority either way.

## ViewerTag

`ViewerTag` is a ready-made inline user pill returned alongside `viewer` from `useViewer()`. It is not a separate import — you get it from the hook.

Show the current viewer (edit ring appears — they can tap to change their avatar):

App.jsx

```jsx
<<<<<<< SEARCH
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {viewer && <span style={{ fontSize: 13, color: "var(--muted, #888)" }}>commenting as</span>}
        <ViewerTag />
      </div>
=======
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {viewer && <span style={{ fontSize: 13, color: "var(--muted, #888)" }}>commenting as</span>}
        <ViewerTag />
        {/* Show another user read-only (no edit affordance): */}
        <ViewerTag userHandle={comments[0]?.authorHandle} />
        {/* Style override: */}
        <ViewerTag style={{ borderRadius: 8, fontSize: 12 }} />
      </div>
>>>>>>> REPLACE
```

**Self-detection is automatic.** When `ViewerTag` renders the current viewer it shows a dashed indigo ring and pencil overlay on the avatar. Clicking it opens a file picker; the upload and profile save happen internally.

**Undefined safety.** If `userHandle` is present in props but falsy (e.g. a missing field from a loop lookup), `ViewerTag` renders a dim italic placeholder instead of the edit ring. This prevents a broken data source from accidentally granting photo-edit access to an arbitrary pill.

**Anonymous safety.** `ViewerTag` is always safe to call regardless of login state — it never throws. When the viewer is anonymous and no `userHandle` prop is given, it renders a "Sign in" button that opens the platform login UI when clicked. Wrap it in a `{viewer && <ViewerTag />}` guard if you want to suppress it entirely for anonymous users.

**Theming.** `ViewerTag` reads `--accent`, `--accent-text`, `--card-bg`, `--border`, `--text`, and `--muted` from the app's CSS variables with sensible fallbacks. If your app defines these on `:root` (which most generated themes do), `ViewerTag` inherits the theme automatically with no extra props.

Use `<ViewerTag />` (no props) for the current user and `<ViewerTag userHandle={...} />` for others. That's the whole API.
