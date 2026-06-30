# Vibes DIY App JSX Guide

## Overview

Vibes DIY apps are React components that combine Fireproof database, CallAI for LLM interactions, and use-vibes for UI components. They follow a neobrutalist design aesthetic with bright colors and bold borders.

## Core Imports

```javascript
import React from "react"
import { callAI, useFireproof } from "use-vibes"
```

## Database Setup

### Basic Setup
```javascript
const { useDocument, useLiveQuery, database } = useFireproof("myDatabase")
```

Cloud sync is automatic — each named database is a per-(user, app) cloud peer on
the vibes.diy runtime, so there is no `toCloud()`/`attach` step. Just call
`useFireproof("name")` and writes sync for everyone with access.

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

const { viewer, isOwner, ViewerTag } = useViewer();
```

- `viewer` — `{ userHandle, displayName?, avatarUrl }` or `null` for anonymous visitors. `avatarUrl` is a stable opaque URL — use it directly in `<img src>`, don't construct it yourself.
- Use `useViewer()` for identity and display: `ViewerTag`, showing who's signed in, `isOwner` for management UI. **Do not use `viewer`/`isOwner`/`access.*` as write gates.**
- **Write surfaces** are gated with `useVibe(dbName).can.create/edit/delete` — it runs the app's access function and returns `{ ok, reason }`. Render `.reason` when denied.

Stamp `authorHandle: viewer.userHandle` on docs at write time. Render with `<ViewerTag userHandle={doc.authorHandle} />` — it resolves display name and avatar automatically. Only persist the handle, not displayName or avatarUrl.

## Meta-vibes (`createVibe` — a vibe that builds another vibe)

```javascript
import { createVibe } from "use-vibes";
```

`createVibe(prompt)` hands off to the builder to generate a **new, personalized
vibe** from a prompt you construct at runtime. The canonical use is an
**interviewer vibe**: it runs an adaptive conversation (often with `callAI`),
then — when it has enough — calls `createVibe(richPrompt)` so the user lands in a
second vibe that is already filled in with their content (a pitch deck that knows
their company, a course outline already on their topic).

```jsx
// Always call createVibe() from a click — it opens the builder in a NEW TAB, and
// browsers only allow opening a tab from inside a user gesture. Build a rich,
// opinionated prompt; don't call it inside an await chain (the gesture expires).
<button onClick={() => createVibe(spec)}>Create my pitch deck</button>
```

- `createVibe(prompt)` → `Window | null` (null if the popup was blocked). The builder origin is chosen automatically.
- `buildCreateVibeUrl(prompt)` → the hand-off URL, for a fallback `<a href>`.

See the `create-vibe` skill doc (`prompts/pkg/llms/create-vibe.md`) for the full
interviewer pattern.

## Channels (multi-group / Slack-style apps)

Each named Fireproof database is a **channel** — an isolated data space with its own access policy. App.jsx reads display-only permissions via `access` from `useFireproof()`; write surfaces are gated with `useVibe(dbName).can`.

Store available channels in a registry database, then filter by `access.hasChannel(name)` so each user only sees channels they have access to:

```jsx
function App() {
  const { useLiveQuery, access } = useFireproof('channelRegistry')
  const { docs: channels } = useLiveQuery('name')
  const [active, setActive] = useState(null)
  const visible = channels.filter(ch => access.hasChannel(ch.name))  // display filter only

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
  const { viewer } = useViewer()
  const { useLiveQuery, useDocument, database } = useFireproof(name)
  const { docs: messages } = useLiveQuery('timestamp', { descending: true, limit: 50 })
  const { doc, merge } = useDocument({ text: '' })
  const canPost = useVibe(name).can.create({ type: 'message' })  // write gate

  async function handleSubmit(e) {
    e.preventDefault()
    const text = doc.text.trim()
    if (!text || !viewer) return
    merge({ text: '' })          // clear input immediately
    await database.put({         // use database.put — submit() ignores extra fields
      text,
      timestamp: Date.now(),
      authorHandle: viewer.userHandle,
    })
  }

  return (
    <div>
      <ul>
        {messages.map(m => (
          <li key={m._id}>
            <ViewerTag userHandle={m.authorHandle} />
            <span>{m.text}</span>
          </li>
        ))}
      </ul>
      {canPost.ok ? (
        <form onSubmit={handleSubmit}>
          <input value={doc.text} onChange={e => merge({ text: e.target.value })} />
          <button type="submit">Send</button>
        </form>
      ) : (
        viewer && <p style={{ color: 'var(--muted, #888)' }}>{canPost.reason}</p>
      )}
    </div>
  )
}
```

Key rules:
- Channel name = database name. Use descriptive names (`general`, `dev`, `announcements`).
- `access.hasChannel(channelName)` — hide channels the user cannot access (display reflection, not write gate).
- **Write surfaces** are gated with `useVibe(dbName).can.create/edit/delete` — it runs the access function and returns `{ ok, reason }`.
- `isOwner` from `useViewer()` — gate the owner's "add channel" form.
- Channel access policies are set in app settings, not in App.jsx.
- For private channels (where members shouldn't know they exist), only add them to the registry after the owner grants access.

Owner "add channel" form (always include in sidebar):

```jsx
function AddChannelForm() {
  const { useDocument, database } = useFireproof('channelRegistry')
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
{isOwner && <AddChannelForm />}
```
