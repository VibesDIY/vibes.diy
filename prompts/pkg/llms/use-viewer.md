# useViewer Hook

`useViewer()` is a **read-only window** into runtime-managed access control. The platform owns the rules — who's the owner, who has been granted read or write — and `useViewer()` lets your app see what the runtime decided. You cannot grant or revoke access from code; you can only reflect the runtime's verdict in your UI.

The contract: **every write surface (form, submit button, edit input, delete button) must check `viewer`** (signed in?) and render a read-only fallback when null. For apps with access functions, gate further with `access.hasRole()` or `access.hasChannel()` from `useFireproof()`. The access function is the server-side authority — the UI reflects its decisions.

## Basic Usage

```jsx
import { useViewer } from "use-vibes";

function App() {
  const { viewer, isViewerPending, ViewerTag } = useViewer();

  // isViewerPending is true until the platform has resolved the viewer identity.
  // Gate on it to avoid flashing the anonymous state on first render.
  if (isViewerPending) return null;

  return (
    <header>
      {/* ViewerTag renders a "Sign in" button when logged out, a user pill when logged in */}
      <ViewerTag />
    </header>
  );
}
```

## What you get

- `viewer` — `{ userHandle, displayName?, avatarUrl }` or `null` for anonymous visitors. `avatarUrl` is a stable opaque URL — just use it in `<img src>`, don't construct it yourself.
- `isViewerPending` — `true` while the platform is still resolving the viewer identity (e.g. on first render before the parent shell has pushed the identity update). **Gate any auth-dependent UI on `!isViewerPending`** to avoid flashing the wrong state. Once it becomes `false`, `viewer` is either populated or definitively `null`.
- `isOwner` — `true` when the viewer owns this vibe. Use it for management UI (settings, role grants, moderation).
- `can(action, dbName?)` — `true`/`false` for `"read"`, `"write"`, `"delete"`. Checks app-level ACLs. In most apps `viewer` and `access.hasRole()`/`access.hasChannel()` are the right gates instead.
- `ViewerTag` — ready-made user pill; see the ViewerTag section below.

## Gating UI

```jsx
function CommentForm() {
  const { viewer, isViewerPending, ViewerTag } = useViewer();
  if (isViewerPending) return null;

  return (
    <div>
      {/* Always rendered: "Sign in" button when anonymous, identity pill when signed in.
          The label only appears once viewer is known so it doesn't flash. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {viewer && <span style={{ fontSize: 13, color: "var(--muted, #888)" }}>commenting as</span>}
        <ViewerTag />
      </div>

      {!viewer && <p>Sign in to post.</p>}
      {viewer && <form>...</form>}
    </div>
  );
}
```

## Tagging content with the viewer (write/render pattern)

When one user writes content others will see (comments, posts, messages), **stamp `authorHandle` on the doc at write time**. That's it — just the handle. Render with `<ViewerTag ownerHandle={doc.authorHandle} />` which resolves display name and avatar automatically. Do not stamp `displayName` or `avatarUrl` on docs — ViewerTag handles that from the handle alone.

```jsx
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function CommentThread() {
  const { viewer, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database, access } = useFireproof("comments");
  const { docs: comments } = useLiveQuery("createdAt");
  const [body, setBody] = useState("");

  async function post() {
    if (!viewer || !body.trim()) return;
    await database.put({
      body: body.trim(),
      createdAt: Date.now(),
      authorHandle: viewer.userHandle,
    });
    setBody("");
  }

  return (
    <div>
      <ul>
        {comments.map((c) => (
          <li key={c._id}>
            <ViewerTag ownerHandle={c.authorHandle} />
            <p>{c.body}</p>
          </li>
        ))}
      </ul>

      {!isViewerPending && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {viewer && <span style={{ fontSize: 13, color: "var(--muted, #888)" }}>commenting as</span>}
            <ViewerTag />
          </div>
          {!viewer && <p>Sign in to post.</p>}
          {viewer && (
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
      )}
    </div>
  );
}
```

Key points:

- **Stamp `authorHandle` at write time** — persist the author's handle on the doc. Render with `<ViewerTag ownerHandle={authorHandle} />` which resolves display name and avatar automatically.
- **`avatarUrl` is stable** — if the author changes their avatar, the URL stays the same and the bytes update. ViewerTag handles this for you.
- **One source of identity** — persist `authorHandle` on the doc. ViewerTag does the rest.

## Notes

- Never use Clerk user IDs. Only `userHandle` crosses into vibe code.
- Avatar URLs are stable indirection URLs — when a user changes their avatar, the URL stays the same and the bytes update. Treat them as opaque strings.
- For per-database permissions (roles and channels), use `access` from `useFireproof()`: `access.hasRole("moderator")`, `access.hasChannel("engineering")`. The access function (access.js) is the server-side authority; `access` in the UI reflects its decisions.

## ViewerTag

`ViewerTag` is a ready-made inline user pill returned alongside `viewer` from `useViewer()`. It is not a separate import — you get it from the hook.

```jsx
const { viewer, ViewerTag } = useViewer();

// Show the current viewer (edit ring appears — they can tap to change their avatar):
<ViewerTag />

// Show another user read-only (no edit affordance):
<ViewerTag ownerHandle={comment.authorHandle} />
```

**Self-detection is automatic.** When `ViewerTag` renders the current viewer it shows a dashed indigo ring and pencil overlay on the avatar. Clicking it opens a file picker; the upload and profile save happen internally.

**Undefined safety.** If `ownerHandle` is present in props but falsy (e.g. a missing field from a loop lookup), `ViewerTag` renders a dim italic placeholder instead of the edit ring. This prevents a broken data source from accidentally granting photo-edit access to an arbitrary pill.

**Anonymous safety.** `ViewerTag` is always safe to call regardless of login state — it never throws. When the viewer is anonymous and no `ownerHandle` prop is given, it renders a "Sign in" button that opens the platform login UI when clicked. Wrap it in a `{viewer && <ViewerTag />}` guard if you want to suppress it entirely for anonymous users.

**Theming.** `ViewerTag` reads `--accent`, `--accent-text`, `--card-bg`, `--border`, `--text`, and `--muted` from the app's CSS variables with sensible fallbacks. If your app defines these on `:root` (which most generated themes do), `ViewerTag` inherits the theme automatically with no extra props.

**Style override.** Pass a `style` prop to override the root element's appearance. Layout properties are preserved; your values win:

```jsx
<ViewerTag style={{ borderRadius: 8, fontSize: 12 }} />
```

Use `<ViewerTag />` (no props) for the current user and `<ViewerTag ownerHandle={...} />` for others. That's the whole API.
