# Vibes DIY App JSX Guide

## Overview

Vibes DIY apps are React components that combine Fireproof database, CallAI for LLM interactions, and use-vibes for UI components. They follow a neobrutalist design aesthetic with bright colors and bold borders.

## Core Imports

```javascript
import React from "react"
import { callAI, useFireproof, toCloud } from "use-vibes"
```

## Fireproof Setup

### Basic Setup
```javascript
const { useDocument, useLiveQuery, database } = useFireproof("database-name")
```

### With Cloud Sync (No Tenant/Ledger)
```javascript
const { useDocument, useLiveQuery, database, attach } = useFireproof("database-name", { 
  attach: toCloud() 
})
```

### With Cloud Sync (Specific Tenant/Ledger)
```javascript
const { useDocument, useLiveQuery, database, attach } = useFireproof("database-name", { 
  attach: toCloud({
    tenant: "tenant-id",
    ledger: "ledger-id"
  })
})
```

## Document Management

### Creating/Editing Documents

`submit` is a form event handler — it saves the current internal doc state and resets. **Do not pass a custom object to `submit()`** — extra fields are ignored. When you need to save fields beyond what's in `doc` (e.g. author info, timestamps), use `database.put()` directly and call `merge({...})` to clear the input.

```javascript
const { doc, merge, submit } = useDocument({ text: "" })

// In JSX:
<form onSubmit={submit}>
  <input
    value={doc.text}
    onChange={(e) => merge({ text: e.target.value })}
    placeholder="Enter text..."
  />
  <button type="submit">Save</button>
</form>
```

### Querying Documents
```javascript
// Basic query by field
const { docs } = useLiveQuery("fieldName", { key: "value" })

// Custom query function
const { docs } = useLiveQuery((doc) => doc.text && doc._id, { 
  descending: true, 
  limit: 10 
})

// Query by type
const { docs } = useLiveQuery("type", { key: "note" })
```

## CallAI Integration

### Basic Usage
```javascript
const response = await callAI("Your prompt here")
```

### Streaming
```javascript
const generator = await callAI("Your prompt", { stream: true })

let result = ""
for await (const chunk of generator) {
  result = chunk
}
```

### With Schema
```javascript
const response = await callAI("Generate data", {
  schema: {
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: { type: "number" }
          }
        }
      }
    }
  }
})
```

## Identity & capabilities (`useViewer`)

```jsx
import { useViewer } from "use-vibes";

const { viewer, can } = useViewer();
```

- `viewer` — `{ userSlug, displayName?, avatarUrl }` or `null` for anonymous visitors. `avatarUrl` is a stable opaque URL — use it directly in `<img src>`, don't construct it yourself.
- `can(action, dbName?)` — `"read" | "write" | "delete"`. With a `dbName`, checks that db; without, allowed-everywhere.

Render names with `viewer.displayName ?? viewer.userSlug`. Never look up user IDs — only userSlugs cross into vibe code.

For other users' avatars, store `viewer.avatarUrl` as `authorAvatarUrl` on the doc at write time and render from the doc.

## Channels (multi-group / Slack-style apps)

Each named Fireproof database is a **channel** — an isolated data space with its own access policy configured by the app owner via settings. App.jsx never sets access policy; it only reads it via `can()`.

Store available channels in a registry database, then filter by `can('read', channelName)` so each user only sees channels they can access:

```jsx
function App() {
  const { can } = useViewer()
  const { useLiveQuery } = useFireproof('channel-registry')
  const { docs: channels } = useLiveQuery('name')
  const [active, setActive] = useState(null)
  const visible = channels.filter(ch => can('read', ch.name))

  return (
    <div style={{ display: 'flex' }}>
      <nav>
        {visible.map(ch => (
          <button key={ch._id} onClick={() => setActive(ch.name)}>
            # {ch.name}
          </button>
        ))}
      </nav>
      {active && <ChannelView name={active} />}
    </div>
  )
}

function ChannelView({ name }) {
  const { viewer, can } = useViewer()
  const { useLiveQuery, useDocument, database } = useFireproof(name)
  const { docs: messages } = useLiveQuery('timestamp', { descending: true, limit: 50 })
  const { doc, merge } = useDocument({ text: '' })

  async function handleSubmit(e) {
    e.preventDefault()
    const text = doc.text.trim()
    if (!text || !viewer) return
    merge({ text: '' })          // clear input immediately
    await database.put({         // use database.put — submit() ignores extra fields
      text,
      timestamp: Date.now(),
      authorUserSlug: viewer.userSlug,
      authorDisplayName: viewer.displayName || viewer.userSlug,
      authorAvatarUrl: viewer.avatarUrl,
    })
  }

  return (
    <div>
      <ul>
        {messages.map(m => (
          <li key={m._id}>
            <strong>{m.authorDisplayName || m.authorUserSlug || 'anonymous'}</strong>
            <span>{m.text}</span>
          </li>
        ))}
      </ul>
      {can('write', name) && (
        <form onSubmit={handleSubmit}>
          <input value={doc.text} onChange={e => merge({ text: e.target.value })} />
          <button type="submit">Send</button>
        </form>
      )}
    </div>
  )
}
```

Key rules:
- Channel name = database name. Use descriptive names (`general`, `dev`, `announcements`).
- `can('read', channelName)` — hide channels the user cannot see.
- `can('write', channelName)` — hide compose UI for read-only channels.
- `can('write', 'channel-registry')` — gate the owner's "add channel" form. Always include this form so the owner can seed the channel list.
- Channel access policies are set in app settings, not in App.jsx.
- For private channels (where members shouldn't know they exist), only add them to the registry after the owner grants access.

Owner "add channel" form (always include in sidebar):

```jsx
function AddChannelForm() {
  const { useDocument, database } = useFireproof('channel-registry')
  const { doc, merge } = useDocument({ name: '' })
  async function handleSubmit(e) {
    e.preventDefault()
    const name = doc.name.trim().toLowerCase().replace(/\s+/g, '-')
    if (!name) return
    merge({ name: '' })
    await database.put({ name })  // database.put, not submit()
  }
  return (
    <form onSubmit={handleSubmit}>
      <input value={doc.name} onChange={e => merge({ name: e.target.value })} placeholder="new-channel" />
      <button type="submit">+</button>
    </form>
  )
}

// In sidebar, below channel list:
{can('write', 'channel-registry') && <AddChannelForm />}
```
