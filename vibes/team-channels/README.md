# team-channels

> ## Channels (multi-group / Slack-style apps)

A Slack-style team workspace in a **single Fireproof database**, gated by an [`access.js`](access.js) function. Channels are documents (`type: "channel"`); messages carry a `channelId` and are routed to that channel. App.jsx never sets access policy — it asks the access function via `useVibe()`.

The access function is the **one authority**: the server enforces it on every write, and `useVibe(dbName).can.*` previews the same verdict on the client so the UI matches what the server will allow.

```jsx
import { useFireproof } from "use-fireproof";
import { useViewer, useVibe } from "use-vibes";

const DB = "teamChannels";

function App() {
  const { useLiveQuery } = useFireproof(DB);
  const { docs: channels } = useLiveQuery("type", { key: "channel" });
  const [activeId, setActiveId] = React.useState(null);
  // ...render the channel list and the active channel
}

function Composer({ channelId }) {
  const { database } = useFireproof(DB);
  const { can, ready, me } = useVibe(DB);
  if (!ready) return null;
  // Build the candidate from the doc you'll actually write.
  const v = can.create({ type: "message", channelId, authorHandle: me?.userHandle });
  if (!v.ok) return <p>{v.reason}</p>; // e.g. "sign in to participate"
  return <form onSubmit={/* database.put({ type: "message", channelId, authorHandle: me.userHandle, ... }) */}>…</form>;
}
```

The access function (see [access.js](access.js)):

```js
export function teamChannels(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to participate" };
  if (doc.type === "channel") {
    if (!user.isOwner) throw { forbidden: "only the owner can create channels" };
    return { channels: [doc._id], grant: { public: [doc._id] } }; // public channel list
  }
  if (doc.type === "message") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: [doc.channelId] }; // route the message to its channel
  }
  throw { forbidden: "unknown document type" };
}
```

Key rules:

- **One database, channels are docs.** A channel is a `type: "channel"` document; its `_id` is the channel id. Messages are `type: "message"` docs carrying `channelId`. No per-channel database, no owner-configured ACL settings.
- **Gate writes with `useVibe(DB).can.*`, not `useViewer().can()`.** `useViewer().can(action)` is now a plain membership check (are you through the door?). Fine-grained, per-document rules — who may create a channel, who may edit a message — live in `access.js` and are previewed with `can.create/edit/delete`, which return `{ ok, reason }`.
- **Build the candidate from the doc you'll write.** `can.create({ type: "message", channelId, authorHandle: me?.userHandle })` runs the access function against that draft, so stamp the same fields you `put`.
- **The export name matches the database name** (`teamChannels`) — that's how the runtime selects the function.
- **Owner-only channel creation** is enforced by `user.isOwner` in `access.js`; the "+ add channel" form is gated on `can.create({ type: "channel" }).ok`.

---

Build a team workspace app with a Slack-style layout. Left sidebar lists channels (the owner adds them); clicking a channel loads its messages. Members post messages with an optional image; authors can delete their own. Show the logged-in user's display name above the compose form. Dark sidebar, light message area, clean minimal style.

Live at [https://vibes.diy/vibe/og/team-channels](https://vibes.diy/vibe/og/team-channels)

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx + access.js, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory
- `npx vibes-diy push --instant-join` — deploy with auto-accept sharing
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
