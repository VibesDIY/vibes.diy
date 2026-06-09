# team-channels

> ## Channels (multi-group / Slack-style apps)

Each named Fireproof database is a **channel** — an isolated data space with its own access policy configured by the app owner via settings. App.jsx never sets access policy; it only reads it via `can()`.

Store available channels in a registry database, then filter by `can('read', channelName)` so each user only sees channels they can access:

```jsx
function App() {
  const { can } = useViewer();
  const { useLiveQuery } = useFireproof("channel-registry");
  const { docs: channels } = useLiveQuery("name");
  const [active, setActive] = useState(null);
  const visible = channels.filter((ch) => can("read", ch.name));

  return (
    <div style={{ display: "flex" }}>
      <nav>
        {visible.map((ch) => (
          <button key={ch._id} onClick={() => setActive(ch.name)}>
            # {ch.name}
          </button>
        ))}
      </nav>
      {active && <ChannelView name={active} />}
    </div>
  );
}

function ChannelView({ name }) {
  const { can } = useViewer();
  const { useLiveQuery, useDocument } = useFireproof(name);
  const { docs: messages } = useLiveQuery("timestamp", { descending: true, limit: 50 });
  const { doc, merge, submit } = useDocument({ text: "", timestamp: 0 });

  return (
    <div>
      <ul>
        {messages.map((m) => (
          <li key={m._id}>{m.text}</li>
        ))}
      </ul>
      {can("write", name) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit({ ...doc, timestamp: Date.now() });
          }}
        >
          <input value={doc.text} onChange={(e) => merge({ text: e.target.value })} />
          <button type="submit">Send</button>
        </form>
      )}
    </div>
  );
}
```

Key rules:

- Channel name = database name. Use descriptive names (`general`, `dev`, `announcements`).
- `can('read', channelName)` — hide channels the user cannot see.
- `can('write', channelName)` — hide compose UI for read-only channels.
- The app owner adds channels by writing docs to `channel-registry`. Channel access policies are set in app settings, not in App.jsx.
- For private channels (where members shouldn't know they exist), only add them to the registry after the owner grants access.

---

Build a team workspace app with a Slack-style layout. Left sidebar lists channels from a `channel-registry` database — the owner adds channels by writing docs with a `name` field. Clicking a channel loads its messages from a per-channel Fireproof database named after the channel. Users who can write to the channel see a compose form; read-only users just see messages. Show the logged-in user's display name above the compose form. Dark sidebar, light message area, clean minimal style.

Live at [https://vibes.diy/vibe/og/team-channels](https://vibes.diy/vibe/og/team-channels)

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory
- `npx vibes-diy push --instant-join` — deploy with auto-accept sharing
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
