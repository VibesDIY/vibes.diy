# useViewer Hook

Get the current viewer's identity and capabilities. Use it to render avatars, names, and gate UI on what the viewer can do.

## Basic Usage

```jsx
import { useViewer } from "use-vibes";

function App() {
  const { viewer, can, avatarUrlFor } = useViewer();
  if (!viewer) return <p>Sign in to use this app.</p>;
  return (
    <header>
      <img src={avatarUrlFor(viewer.userSlug)} alt={viewer.userSlug} />
      <span>{viewer.displayName ?? viewer.userSlug}</span>
    </header>
  );
}
```

## What you get

- `viewer` — `{ userSlug, displayName? }` or `null` for anonymous visitors.
- `can(action, dbName?)` — `true`/`false` for `"read"`, `"write"`, `"delete"`. Pass a `dbName` for multi-db apps; omit for single-db apps. Use it to hide forms when the viewer can't post.
- `avatarUrlFor(userSlug)` — stable image URL for any user. Updates automatically when a user changes their avatar.

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

Store the author's `userSlug` on each doc, not their `userId`. Render by passing the slug to `avatarUrlFor`:

```jsx
{
  comments.map((c) => (
    <li key={c._id}>
      <img src={avatarUrlFor(c.authorUserSlug)} alt={c.authorUserSlug} />
      {c.body}
    </li>
  ));
}
```

## Notes

- Never use Clerk user IDs. Only `userSlug` crosses into vibe code.
- Avatar URLs are stable per userSlug — when a user changes their avatar, every reference updates automatically.
