# useViewer Hook

Get the current viewer's identity and capabilities. Use it to render avatars, names, and gate UI on what the viewer can do.

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
  if (!can("write", "comments")) return <p>Only collaborators can post comments.</p>;
  return <form>...</form>;
}
```

## Other users' avatars

Store the author's `userSlug` and `avatarUrl` on each doc at write time. Render directly from the doc:

```jsx
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

## Notes

- Never use Clerk user IDs. Only `userSlug` crosses into vibe code.
- Avatar URLs are stable indirection URLs — when a user changes their avatar, the URL stays the same and the bytes update. Treat them as opaque strings.
