# useViewer Hook

`useViewer()` is a **read-only window** into runtime-managed access control. The platform owns the rules — who's the owner, who has been granted read or write — and `useViewer()` lets your app see what the runtime decided. You cannot grant or revoke access from code; you can only reflect the runtime's verdict in your UI.

The contract: **every write surface (form, submit button, edit input, delete button) must consult `can("write")`** and render a read-only fallback when it returns false. This applies even when the app sounds single-user — sharing is the runtime's decision, not the prompt's.

## Basic Usage

```jsx
import { useViewer } from "use-vibes";

function App() {
  const { viewer, can } = useViewer();
  if (!viewer) return <p>Sign in to use this app.</p>;
  return (
    <header>
      <img src={viewer.avatarUrl} alt={viewer.userSlug} />
      <span>{viewer.displayName ?? viewer.userSlug}</span>
    </header>
  );
}
```

## What you get

- `viewer` — `{ userSlug, displayName?, avatarUrl }` or `null` for anonymous visitors. `avatarUrl` is a stable opaque URL — just use it in `<img src>`, don't construct it yourself.
- `can(action, dbName?)` — `true`/`false` for `"read"`, `"write"`, `"delete"`. Pass a `dbName` for multi-db apps; omit for single-db apps. Use it to hide forms when the viewer can't post.

## Gating UI

```jsx
function CommentForm() {
  const { viewer, can } = useViewer();
  if (!viewer) return <p>Sign in to comment.</p>;
  if (!can("write", "comments")) return <p>Contact the owner to request write access so you can post.</p>;
  return <form>...</form>;
}
```

## Tagging content with the viewer (write/render pattern)

When one user writes content others will see (comments, posts, messages), **stamp the viewer's identity onto the doc at write time**. Then any user can render the author info from the doc itself — no extra lookup. The `avatarUrl` is a stable indirection URL so it keeps working when the author later changes their avatar.

```jsx
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function CommentThread() {
  const { viewer, can } = useViewer();
  const { useLiveQuery, database } = useFireproof("comments");
  const { docs: comments } = useLiveQuery("createdAt");
  const [body, setBody] = useState("");

  async function post() {
    if (!viewer || !body.trim()) return;
    await database.put({
      body: body.trim(),
      createdAt: Date.now(),
      // Stamp the viewer's identity at write time. Other users will
      // render from these fields — no need to look anything up later.
      authorUserSlug: viewer.userSlug,
      authorDisplayName: viewer.displayName ?? viewer.userSlug,
      authorAvatarUrl: viewer.avatarUrl,
    });
    setBody("");
  }

  return (
    <div>
      <ul>
        {comments.map((c) => (
          <li key={c._id}>
            <img src={c.authorAvatarUrl} alt={c.authorUserSlug} className="avatar" />
            <strong>{c.authorDisplayName}</strong>
            <p>{c.body}</p>
          </li>
        ))}
      </ul>

      {!viewer ? (
        <p>Sign in to comment.</p>
      ) : !can("write", "comments") ? (
        <p>Contact the owner to request write access so you can post.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            post();
          }}
        >
          <input value={body} onChange={(e) => setBody(e.target.value)} />
          <button type="submit">Post</button>
        </form>
      )}
    </div>
  );
}
```

Key points:

- **Write-time stamping** — the doc carries the author info, not a foreign-key lookup. Old comments keep working even if the author later deletes their account.
- **`avatarUrl` is stable** — if the author changes their avatar tomorrow, every historical comment shows the new image because the URL stays the same, the bytes change.
- **One source of identity** — never store the viewer's user ID, only `userSlug` + `displayName` + `avatarUrl`. The trio is everything a renderer needs.

## Notes

- Never use Clerk user IDs. Only `userSlug` crosses into vibe code.
- Avatar URLs are stable indirection URLs — when a user changes their avatar, the URL stays the same and the bytes update. Treat them as opaque strings.

## ViewerTag

`ViewerTag` is a ready-made inline user pill returned alongside `viewer` from `useViewer()`. It is not a separate import — you get it from the hook.

```jsx
const { viewer, ViewerTag } = useViewer();

// Show the current viewer (edit ring appears — they can tap to change their avatar):
<ViewerTag />

// Show another user read-only (no edit affordance):
<ViewerTag userSlug={comment.authorUserSlug} />
```

**Self-detection is automatic.** When `ViewerTag` renders the current viewer it shows a dashed indigo ring and pencil overlay on the avatar. Clicking it opens a file picker; the upload and profile save happen internally.

**Undefined safety.** If `userSlug` is present in props but falsy (e.g. a missing field from a loop lookup), `ViewerTag` renders a dim italic placeholder instead of the edit ring. This prevents a broken data source from accidentally granting photo-edit access to an arbitrary pill.

**Anonymous safety.** `ViewerTag` is always safe to call regardless of login state — it never throws. When the viewer is anonymous and no `userSlug` prop is given, it renders a "Sign in" button that opens the platform login UI when clicked. Wrap it in a `{viewer && <ViewerTag />}` guard if you want to suppress it entirely for anonymous users.

Use `<ViewerTag />` (no props) for the current user and `<ViewerTag userSlug={...} />` for others. That's the whole API.
