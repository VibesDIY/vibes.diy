# useViewer Hook

`useViewer()` is a **read-only window** into viewer identity. The platform owns the rules — who's the owner, who has been granted read or write — and `useViewer()` lets your app see who's signed in and render identity. You cannot grant or revoke access from code; you can only reflect the runtime's verdict in your UI.

**The signed-in viewer's own pill and the Sign in button are system chrome — you don't build them.** The platform shows the current user (and a "Sign in" button when anonymous) inside the **Vibes Switch**, the panel that opens when you click the logo. A visitor always has a way to see who they are and sign in from there, so your app does **not** need to add a header pill or a login button for the current viewer — don't render a no-prop `<ViewerTag />` just to show "who's signed in" or to offer sign-in. To find the login button, click the logo.

Use `useViewer()` to render **other** people's identity — comment authors, rosters, "added by" labels — with `<ViewerTag userHandle={...} />`, and to read `viewer`/`can` when your UI needs to branch on who's looking. **Write surfaces are gated with `useVibe(dbName).can`** (see use-vibe docs), not with `viewer`/`access.*`.

## Basic Usage

Start with a minimal component that reads the viewer identity. You don't render a sign-in button or a current-user pill — those live in the Vibes Switch (click the logo). Just branch on `viewer` for any welcome/empty copy your app needs:

App.jsx

```jsx
import React from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

export default function App() {
  const { viewer, isViewerPending } = useViewer();

  if (isViewerPending) return null;

  return (
    <div>
      {/* No sign-in button here — the logo opens the Vibes Switch, which shows
          the current user and a "Sign in" button as system chrome. */}
      {viewer ? <p>Welcome back, {viewer.displayName ?? viewer.userHandle}!</p> : <p>Sign in from the logo menu to get started.</p>}
    </div>
  );
}
```

## What you get

- `viewer` — `{ userHandle, displayName? }` or `null` for anonymous visitors. Avatars are not on the payload — render them with `<ViewerTag userHandle={...} />`, which resolves the avatar from the handle. Don't build avatar URLs yourself.
- `isViewerPending` — `true` while the platform is still resolving the viewer identity (e.g. on first render before the parent shell has pushed the identity update). **Gate any auth-dependent UI on `!isViewerPending`** to avoid flashing the wrong state. Once it becomes `false`, `viewer` is either populated or definitively `null`.
- `can(action)` — membership boolean for `"read"`/`"write"`/`"delete"`: is the viewer through the door? Access functions enforce per-document and per-database rules server-side. Prefer `useVibe(dbName).can.create/edit/delete` for write gating; it runs the app's access function and returns a `reason`.
- `ViewerTag` — ready-made user pill; see the ViewerTag section below.

## Gating UI

Gate the comment form on `useVibe("comments").can` — not on `viewer`. The current viewer never needs a pill here (that's in the Vibes Switch); just render the gated form and its `reason` when denied:

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
  const { viewer, isViewerPending } = useViewer();
=======
  const { viewer, isViewerPending } = useViewer();
  const { can, ready, me } = useVibe("comments");
>>>>>>> REPLACE
```

App.jsx

```jsx
<<<<<<< SEARCH
      {viewer ? <p>Welcome back, {viewer.displayName ?? viewer.userHandle}!</p> : <p>Sign in from the logo menu to get started.</p>}
=======
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
  const { viewer, isViewerPending } = useViewer();
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
      {/* render OTHER users with userHandle — that's what ViewerTag is for here */}
      <ul>
        {comments.map((c) => (
          <li key={c._id}>
            <ViewerTag userHandle={c.authorHandle} />
            <p>{c.body}</p>
          </li>
        ))}
      </ul>

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

`ViewerTag` is a ready-made inline user pill returned alongside `viewer` from `useViewer()`. It is not a separate import — you get it from the hook. **Use it to render _other_ people** — comment authors, roster rows, "added by" labels — by passing `userHandle`:

```jsx
{/* Show another user read-only: */}
<ViewerTag userHandle={comment.authorHandle} />
{/* Style override: */}
<ViewerTag userHandle={member.userHandle} style={{ borderRadius: 8, fontSize: 12 }} />
```

**The current viewer is system chrome, not app UI.** A no-prop `<ViewerTag />` renders the current viewer (with a sign-in button when anonymous and a dashed edit ring when signed in), but you almost never need it: the platform already shows the current user — and lets them sign in and change their avatar — inside the Vibes Switch that opens from the logo. Don't add a no-prop `<ViewerTag />` as a header pill or login button; reach for `userHandle` to render someone else instead.

**Undefined safety.** If `userHandle` is present in props but falsy (e.g. a missing field from a loop lookup), `ViewerTag` renders a dim italic placeholder instead of the edit ring. This prevents a broken data source from accidentally granting photo-edit access to an arbitrary pill.

**Anonymous & always-safe.** `ViewerTag` never throws regardless of login state. A no-prop `<ViewerTag />` would render a "Sign in" button for anonymous viewers, but you don't need to place one for sign-in — the logo's Vibes Switch already offers it.

**Theming.** `ViewerTag` reads `--accent`, `--accent-text`, `--card-bg`, `--border`, `--text`, and `--muted` from the app's CSS variables with sensible fallbacks. If your app defines these on `:root` (which most generated themes do), `ViewerTag` inherits the theme automatically with no extra props.

Pass `<ViewerTag userHandle={...} />` to render other people. The no-prop `<ViewerTag />` (current user) exists, but the logo's Vibes Switch already covers identity and sign-in.
