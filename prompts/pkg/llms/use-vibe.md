# useVibe Hook — write gating

`useVibe(dbName)` is how you gate write surfaces. It runs the app's own `access.js` — the **same function the server enforces** — against a candidate document, so the UI's enabled/disabled state matches what the server will actually allow. You never re-implement permissions; you ask the access function.

```jsx
const { me, can, ready } = useVibe("comments");
```

Pass the Fireproof database name you are writing to. You get:

- `can.create(draft)` / `can.edit(doc)` / `can.delete(doc)` → `{ ok: boolean, reason?: string }`. Gate the write surface on `.ok`; when `!ok`, render `.reason` as the fallback copy (e.g. "authentication required", "not in channel: team").
- `ready` — `false` until identity and the access function have resolved. While `false`, show a neutral skeleton or disabled control; gating on it avoids a flash of the wrong state.
- `me` — `{ userHandle, displayName? } | null` (null = anonymous). For display only.

**Build the candidate from the doc you'll actually write.** `can.create(draft)` runs the access function against `draft`, so `draft` must carry the fields the function checks — `authorHandle`, `channelId`, etc. A bare `can.create({ type: "post" })` gets denied (e.g. `"not author"`) and hides the form even from users who could post. Stamp the same fields you'll `put`: `can.create({ type: "post", channelId, authorHandle: me?.userHandle })`. And gate the **same database** you write to — `useVibe(dbName)` selects the access function and grants by `dbName`, so a gate on a different db won't reflect server enforcement.

## The rule

Gate every write affordance on `can.*`. Render `reason` when denied. Never branch write permission on `viewer`, `access.hasRole()`/`access.hasChannel()`, or document fields — those drift from what `access.js` actually does. Rendering **other** users (authors, rosters) is `useViewer()`'s `<ViewerTag userHandle={...} />`, not `useVibe`. The current viewer's own pill and the "signed in as" / sign-in button are system chrome in the Vibes Switch (the logo) — don't build them into the app.

```jsx
import { useVibe } from "use-vibes";

function PromptBar({ database }) {
  const { can, ready, me } = useVibe("aestheticBoard");
  if (!ready) return <div className="skeleton" />;
  const v = can.create({ type: "tile", authorHandle: me?.userHandle });
  if (!v.ok) return <p className="muted">{v.reason}</p>; // e.g. "authentication required"
  return (
    <form onSubmit={/* … */}>
      {/* no current-user pill — identity + sign-in live in the Vibes Switch (the logo) */}
      <input placeholder="Add a tile…" />
      <button type="submit">Post</button>
    </form>
  );
}
```

## Owner-only and role-gated surfaces

Don't gate management UI on a display flag directly. Encode the rule in `access.js` (e.g. `ctx.requireRole("owner")` — the owner is auto-seeded into the reserved `owner` role) and gate the UI on `can.*` for that database — the verdict reflects the same rule. Per-row edit/delete affordances: `{can.edit(doc).ok && <EditButton doc={doc} />}`. By default every signed-in visitor is a first-class participant who creates and edits their own data; reserve `requireRole("owner")` for genuinely owner-published apps and per-object channels for peer-to-peer sharing. Public-vs-private and the allowed-user list are the owner's runtime sharing settings, not `access.js`.

## The server is still the authority

`can.*` is a fast, faithful preview, not the final word. A write can still be rejected server-side (the source may be stale, async, or unevaluable — in which case `can.*` optimistically returns `ok` and defers to the server). Keep the optimistic-write + rollback pattern: apply the change immediately, revert and surface an error if the `put` rejects.
