# Fireproof Database API Guide

Fireproof is a lightweight embedded document database with encrypted live sync, designed to make browser apps easy. Use it in any JavaScript environment with a unified API that works both in React (with hooks) and as a standalone core API.

## Key Features

- **Apps run anywhere:** Bundle UI, data, and logic together.
- **Real-Time & Offline-First:** Automatic persistence and live queries, runs in the browser - no loading or error states.
- **Unified API:** TypeScript works with Deno, Bun, Node.js, and the browser.
- **React Hooks:** Leverage `useLiveQuery` and `useDocument` for live collaboration. Note: these are NOT top-level exports — they are returned by the `useFireproof()` hook. Always destructure from `const { useLiveQuery, useDocument, database } = useFireproof("db-name")`.

**File structure:** A vibe's source is one or more files. `/App.jsx` is the entry point (React component). `/access.js` is optional — include it when the app needs per-document write validation or channel-based read isolation. Both files are pushed together and the server discovers `/access.js` automatically.

Fireproof enforces cryptographic causal consistency and ledger integrity using hash history, providing git-like versioning with lightweight blockchain-style verification. Data is stored and replicated as content-addressed encrypted blobs, making it safe and easy to sync via commodity object storage providers.

## Installation

The `use-fireproof` package provides both the core API and React hooks.

```js
import { useFireproof } from "use-fireproof";
```

React hooks are the recommended way to use Fireproof in LLM code generation contexts.

#### Create or Load a Database

Fireproof databases store data across sessions and can sync in real-time. Each database is identified by a string name, and you can have multiple databases per application—often one per collaboration session, as they are the unit of sharing.

```js
import { useFireproof } from "use-fireproof";

const { database, useLiveQuery, useDocument } = useFireproof("my-ledger");
```

#### Put and Get Documents

Each document has an `_id`, which can be auto-generated or set explicitly. Auto-generation is recommended to ensure uniqueness and avoid conflicts. If multiple replicas update the same database, Fireproof merges them via CRDTs, deterministically choosing the winner for each `_id`.

Use granular documents, e.g. one document per user action, so saving a form or clicking a button should typically create or update a single document, or just a few documents. Avoid patterns that require a single document to grow without bound.

Fireproof is a local database, no loading states required, just empty data states.

### Basic Example

This example shows Fireproof's `_id` allows easy sorting with `useLiveQuery`.

```js
const App = () => {
  const { useDocument, useLiveQuery } = useFireproof("my-ledger");

  const { doc, merge, submit } = useDocument({ text: "" });

  // _id is roughly temporal, this is most recent
  const { docs } = useLiveQuery("_id", { descending: true, limit: 100 });

  return (
    <div>
      <form onSubmit={submit}>
        <input value={doc.text} onChange={(e) => merge({ text: e.target.value })} placeholder="New document" />
        <button type="submit">Submit</button>
      </form>

      <h3>Recent Documents</h3>
      <ul>
        {docs.map((doc) => (
          <li key={doc._id}>{doc.text}</li>
        ))}
      </ul>
    </div>
  );
};
```

### Editing Documents

Address documents by a known `_id` if you want to force conflict resolution or work with a real world resource, like a schedule slot or a user profile. In a complex app this might come from a route parameter or correspond to an outside identifier.

```js
const { useDocument } = useFireproof("my-ledger");

const { doc, merge, submit, save, reset } = useDocument({ _id: "user-profile:abc@example.com" });
```

The `useDocument` hook provides several methods:

- `merge(updates)`: Update the document with new fields, without saving. Use this instead of keeping a `useState` for document data.
- `submit(e)`: Handles form submission by preventing default, saving, and resetting
- `save()`: Save the current document state
- `reset()`: Reset to initial state

For form-based creation flows, use `submit`:

```js
<form onSubmit={submit}>
```

When you call submit, the document is reset, so if you didn't provide an `_id` then you can use the form to create a stream of new documents as in the basic example above.

### Updating Documents in Event Handlers

To update an existing document from a click handler or callback, use `database.put()` directly. Never call `useDocument` inside an event handler — that violates React's Rules of Hooks.

```js
// ✅ Correct — use database.put() in handlers
onClick={() => database.put({ ...doc, favorite: !doc.favorite })}

// ❌ Wrong — never call hooks inside handlers
function toggleFavorite(id) {
  const { doc, save } = useDocument({ _id: id }) // BREAKS Rules of Hooks
}
```

### Query Data

Data is queried by sorted indexes defined by the application. Sort by strings, numbers, or booleans, as well as arrays for grouping. Use numbers when possible for sorting continuous data.

You can use the `_id` field for temporal sorting so you don't have to write code to get simple recent document lists, as in the basic example above.

Here are other common patterns:

#### Query by Key Range

Passing a string to `useLiveQuery` will index by that field. You can use the key argument to filter by a specific value:

```js
const { docs } = useLiveQuery("agentName", {
  key: "agent-1", // all docs where doc.agentName === "agent-1", sorted by _id
});
```

You can also query a range within a key:

```js
const { docs } = useLiveQuery("agentRating", {
  range: [3, 5],
});
```

#### Counter Pattern

Documents can be updated by multiple clients, and synced later. To create an event counter, don't increment a number on a single doc, instead write a small document per counted event, and query them with an index. Example:

```js
const App = () => {
  const { useLiveQuery, database } = useFireproof("my-ledger");

  const { docs } = useLiveQuery("counter", { key: "my-event-name" });
  const counterValue = docs.length;

  function countEvent() {
    database.put({
      counter: "my-event-name",
    });
  }

  // Call countEvent() to count each event, and render counterValue in the UI.
};
```

This pattern ensures the count is accurate even during sync.

### Custom Indexes

Use a custom index function to normalize and transform document data, for instance if you have both new and old document versions in your app.

```js
const { docs } = useLiveQuery(
  (doc) => {
    if (doc.type == "listing_v1") {
      return doc.sellerId;
    } else if (doc.type == "listing") {
      return doc.userId;
    }
  },
  { key: routeParams.sellerId }
);
```

#### Array Indexes and Prefix Queries

When you want to group rows easily, you can use an array index key. This is great for grouping records my year / month / day or other paths. In this example the prefix query is a shorthand for a key range, loading everything from November 2024:

```js
const queryResult = useLiveQuery(
  (doc) => {
    const date = new Date(doc.date);
    if (Number.isNaN(date.getTime())) return; // return nothing to skip docs without a valid date
    return [date.getFullYear(), date.getMonth(), date.getDate()];
  },
  { prefix: [2024, 11] }
);
```

#### Sortable Lists

Sortable lists are a common pattern. Here's how to implement them using Fireproof:

```js
function App() {
  const { database, useLiveQuery } = useFireproof("my-ledger");

  // Initialize list with evenly spaced positions
  async function initializeList() {
    await database.put({ list: "xyz", position: 1000 });
    await database.put({ list: "xyz", position: 2000 });
    await database.put({ list: "xyz", position: 3000 });
  }

  // Query items on list xyz, sorted by position. Note that useLiveQuery('list', { key:'xyz' }) would be the same docs, sorted chronologically by _id
  const queryResult = useLiveQuery((doc) => [doc.list, doc.position], { prefix: ["xyz"] });

  // Insert between existing items using midpoint calculation
  async function insertBetween(beforeDoc, afterDoc) {
    const newPosition = (beforeDoc.position + afterDoc.position) / 2;
    await database.put({
      list: "xyz",
      position: newPosition,
    });
  }

  return (
    <div>
      <h3>List xyz (Sorted)</h3>
      <ul>
        {queryResult.docs.map((doc) => (
          <li key={doc._id}>
            {doc._id}: position {doc.position}
          </li>
        ))}
      </ul>
      <button onClick={initializeList}>Initialize List</button>
      <button onClick={() => insertBetween(queryResult.docs[1], queryResult.docs[2])}>Insert new doc at 3rd position</button>
    </div>
  );
}
```

## Per-Database Access Control (`acl` option)

On vibes.diy, `useFireproof` accepts an optional `acl` argument that declares who can read, write, or delete documents in that database. The ACL is stored server-side and enforced on every operation — no separate API call needed.
Only use the `acl` option when the user explicitly asks for fine-grained access control (or equivalent permission constraints).

```jsx
import { useFireproof } from "use-vibes";

// Anyone with a grant can post; only editors can delete
const { useLiveQuery, database } = useFireproof("announcements", {
  acl: { write: ["members"], delete: ["editors"] },
});

// Editors-only space — viewers cannot read at all
const { useLiveQuery, database } = useFireproof("drafts", {
  acl: { read: ["editors"], write: ["editors"], delete: ["editors"] },
});

// No acl — falls back to app-level role gates (existing behavior, always safe)
const { useLiveQuery, database } = useFireproof("public-notes");
```

**Subject groups** — who each name covers:

| Group        | Who is included                                             |
| ------------ | ----------------------------------------------------------- |
| `members`    | owner + editor + viewer + submitter (anyone with any grant) |
| `editors`    | owner + editor                                              |
| `submitters` | owner + submitter                                           |
| `readers`    | owner + editor + viewer                                     |

Owner is always implicitly included — never list `owner` explicitly in an ACL.

Each capability (`read`, `write`, `delete`) is independent. Omitting one falls back to the app-level role gate for that operation. The `acl` is sent once on first database open and persists across sessions (last-write-wins). Only the **app owner** can set ACLs; non-owner apps opening a database with an `acl` option have it silently ignored — the database still opens and works normally.

---

## Access Function (`/access.js`)

The `acl` option above is a coarse per-database gate. Access functions are a finer gate: functions the server runs on every write (including deletes) before storing the document. They validate writes, route documents to channels, and declare grants that control who can read what. Only create an `/access.js` file when the user asks for per-document routing, channel-based isolation, or document-level write validation.

Access functions live in `/access.js`, a separate file in the vibe's filesystem alongside `/App.jsx`. Each **named export** maps to a database name — `export function chat(...)` gates `useFireproof("chat")`. An `export default` function acts as a catch-all: it gates any database that doesn't have its own named export. Named exports always take precedence over the default.

```js
// /access.js — each export name = the database it gates
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  if (doc.type === "message") {
    if (doc.userHandle !== user.userHandle) throw { forbidden: "not author" };
    ctx.requireAccess(doc.channelId);
    return { channels: [doc.channelId] };
  }
  return {};
}
```

```js
// /App.jsx — no access option needed; the server matches by database name
const { useLiveQuery, database } = useFireproof("chat");
```

### Function signature

```ts
(doc, oldDoc, user: UserContext | null, ctx: Helpers) => AccessDescriptor;
```

- `doc` — the document being written
- `oldDoc` — the previous version (null for new documents)
- `user` — the authenticated user, or `null` for anonymous requests
- `ctx` — server-provided helpers for checking materialized state

**UserContext:**

```ts
{
  userHandle: string    // stable unique id — use for all auth checks
  displayName?: string  // display only — never use for identity checks
}
```

**Helpers (`ctx`):** Opaque closures over the materialized grant state. They throw or pass — you cannot enumerate channels, list members, or iterate grants. Both helpers also throw when `user` is null.

- `ctx.requireAccess(channelId)` — throws if user is not in the channel
- `ctx.requireRole(roleName)` — throws if user is not in the role

### AccessDescriptor return type

All fields are optional. `{}` is a valid return. `throw { forbidden: "reason" }` rejects the write.

```ts
type AccessDescriptor = {
  channels?: string[]; // route this doc to channels
  members?: Record<roleName, userHandle[]>; // role membership (reduced by union)
  grant?: {
    users?: Record<userHandle, string[]>; // direct user → channel grants (reduced by union)
    roles?: Record<roleName, string[]>; // role → channel grants (reduced by union)
    public?: string[]; // public read — no auth required
  };
  expiry?: string | number | null; // ISO date or unix seconds
  allowAnonymous?: boolean; // opt-in for null-user writes
};
```

### Key concepts

**Channels** route documents. A document with `channels: ["general"]` is only visible to users who have been granted access to `"general"`. Channels are the unit of read isolation.

**Grants are additive.** The effective access state is the union of every current document's `AccessDescriptor` output. There is no "remove grant" operation — deleting a document drops its contribution from the union automatically. This makes revocation trivial: delete the document that granted access, and the grant disappears on next sync.

**Grant resolution order:** The server resolves per-user channel access in two passes — first expand `grant.roles` through `members`, then union with `grant.users` direct grants.

**`allowAnonymous` prevents a footgun.** If `user` is `null` and the function returns without throwing, the runtime checks `allowAnonymous`. If absent or `false`, the write is rejected. This prevents a function that never inspects `user` from silently opening anonymous writes. When `user` is not null, `allowAnonymous` has no effect. `grant.public` grants public _read_; anonymous _write_ requires `allowAnonymous: true` separately.

**Access functions are server-enforced policy code.** Checks should be deterministic over `(doc, oldDoc, user, ctx)` and deny with `throw { forbidden: "reason" }` when violated.

### Example: Workspace chat with channels

```js
// /access.js
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };

  if (doc.type === "channel-meta") {
    if (doc.ownerHandle !== user.userHandle) throw { forbidden: "not owner" };
    if (oldDoc && oldDoc.ownerHandle !== user.userHandle) throw { forbidden: "not owner" };
    return {
      channels: [doc._id],
      grant: {
        users: Object.fromEntries([[doc.ownerHandle, [doc._id]], ...doc.memberHandles.map((h) => [h, [doc._id]])]),
      },
    };
  }

  if (doc.type === "message") {
    if (doc.userHandle !== user.userHandle) throw { forbidden: "not author" };
    ctx.requireAccess(doc.channelId);
    return { channels: [doc.channelId] };
  }

  if (doc.type === "channel-invite") {
    if (doc.senderHandle !== user.userHandle) throw { forbidden: "not sender" };
    ctx.requireAccess(doc.channelId);
    return {
      channels: [doc.channelId],
      grant: { users: { [doc.inviteeHandle]: [doc.channelId] } },
    };
  }

  return {};
}
```

This single access function handles three document types:

- **channel-meta** — owner creates a channel and grants access to listed members
- **message** — only the author can post, must already have channel access
- **channel-invite** — any channel member can invite others; deleting the invite revokes the grant

### Example: Anonymous survey with role-gated results

```js
// /access.js
export function survey(doc, oldDoc, user, ctx) {
  if (doc.type === "survey-response") {
    if (oldDoc) throw { forbidden: "responses are write-once" };
    return { channels: ["inbound-responses"], allowAnonymous: true };
  }

  if (doc.type === "survey-config") {
    ctx.requireRole("survey-admin");
    return {
      grant: {
        roles: {
          "survey-admin": ["inbound-responses"],
          "feedback-team": ["inbound-responses"],
        },
      },
    };
  }

  if (doc.type === "final-results") {
    ctx.requireRole("feedback-team");
    return { channels: [doc._id], grant: { public: [doc._id] } };
  }

  if (!user) throw { forbidden: "authentication required" };
  return {};
}
```

Key patterns:

- `allowAnonymous: true` on survey-response lets unauthenticated visitors submit
- Requiring `doc._id` to be falsy prevents clients from choosing or overwriting response IDs
- `grant.public` on final-results makes them readable without authentication
- The **singleton grant doc** pattern (survey-config) wires role-to-channel access in one place

### Multiple databases in one file

Each named export gates its own database. A single `/access.js` can gate all databases the app uses:

```js
// /access.js
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  ctx.requireAccess(doc.channelId);
  return { channels: [doc.channelId] };
}

export function notes(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  return {};
}
```

Databases without a matching named export fall through to `export default` if one exists. If there is no default export either, the database uses the default app-level permissions (no access function).

### Catch-all with `export default`

Use `export default` to gate every database without writing a named export for each one. Named exports still take precedence for databases that need custom logic:

```js
// /access.js
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  ctx.requireAccess(doc.channelId);
  return { channels: [doc.channelId] };
}

// Everything else: require authentication, no channel routing
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  return {};
}
```

This is especially useful when an app has many databases or uses hyphenated names (`error-log`, `user-prefs`) that can't be JavaScript identifiers.

### Roles via `members` reduce

Roles are not a fixed registry. They are materialized from document contributions:

```js
// A team-meta doc contributes members to a role
if (doc.type === "team-meta") {
  ctx.requireRole("admin");
  return {
    members: { [doc.teamId]: doc.memberHandles },
    grant: { roles: { [doc.teamId]: doc.channels } },
  };
}

// A per-employee membership doc contributes one handle
if (doc.type === "membership") {
  return { members: { [doc.role]: [doc.userHandle] } };
}
```

Both patterns produce identical reduced state. Deleting a membership doc removes the user from the role automatically.

### Common `oldDoc` patterns

Use `oldDoc` (the previous version of the document) to enforce invariants across updates:

```js
// New document (create)
if (oldDoc === null) {
  // create-only logic
}

// Immutable-after-create fields
if (oldDoc && doc.createdBy !== oldDoc.createdBy) {
  throw { forbidden: "createdBy is immutable" };
}

// Prevent unauthorized ownership transfer
if (oldDoc && oldDoc.ownerHandle !== user.userHandle) {
  throw { forbidden: "not owner" };
}

// Monotonic version — can only increase
if (oldDoc && doc.version <= oldDoc.version) {
  throw { forbidden: "version must increase" };
}
```

---

## Architecture: Where's My Data?

Data is stored in the browser, and is automatically synced with all invited users.

## Using Fireproof in JavaScript

You can use the core API in HTML or on the backend. Instead of hooks, import the core API directly:

```js
import { fireproof } from "use-fireproof";

const database = fireproof("my-ledger");
```

The document API is async, but doesn't require loading states or error handling.

```js
const ok = await database.put({ text: "Sample Data" });
const doc = await database.get(ok.id);
const latest = await database.query("_id", { limit: 10, descending: true });
console.log("Latest documents:", latest.docs);
```

To subscribe to real-time updates, use the `subscribe` method. This is useful for building backend event handlers or other server-side logic. For instance to send an email when the user completes a todo:

```js
import { fireproof } from "use-firproof";

const database = fireproof("todo-list-db");

database.subscribe((changes) => {
  console.log("Recent changes:", changes);
  changes.forEach((change) => {
    if (change.completed) {
      sendEmail(change.email, "Todo completed", "You have completed a todo.");
    }
  });
}, true);
```

### Working with Files

Fireproof documents carry attachments under `_files`. Save a `File` (or `Blob`) by assigning it to a key on `_files`, and Fireproof handles upload, durable storage, and URL minting for you.

#### Attaching files on save

```jsx
const { useDocument } = useFireproof("photo-album");
const { doc, merge, submit } = useDocument({ _files: {}, caption: "" });

// In a file input change handler:
const onPick = (e) => merge({ _files: { photo: e.target.files[0] } });
```

`File` and `Blob` are both accepted. Submit the document the normal way (`submit()` from `useDocument`, or `database.put(doc)`).

For multi-file uploads (e.g. `<input multiple>`), build the `_files` map keyed by filename:

```jsx
const onPickMany = (e) => {
  const next = {};
  for (const f of e.target.files) next[f.name] = f;
  merge({ _files: next });
};
```

Iterate the map with `Object.entries(doc._files)` to render or process each entry (see "Displaying files" below).

#### Displaying files

After a doc round-trips through the database, each `_files.<key>` entry carries a stable `url` you can drop straight into any browser-native subresource — `<img>`, `<video>`, `<audio>`, CSS `background-image`, `@font-face`, `<a download>`, etc.

```jsx
{
  doc._files.photo && <img src={doc._files.photo.url} alt={doc.caption} />;
}
```

For galleries with arbitrary keys, iterate the map:

```jsx
{
  Object.entries(doc._files ?? {}).map(([key, meta]) => <img key={key} src={meta.url} alt={key} />);
}
```

The platform-minted `url` is stable for the lifetime of that file, so the browser cache works normally.

#### Reading raw bytes

When you need the bytes themselves (transcoding, hashing, ML features, custom downloads), call `meta.file()` on the entry — it returns a `Promise<File>`:

```jsx
const f = await doc._files.photo.file();
const buf = await f.arrayBuffer();
const hash = await crypto.subtle.digest("SHA-256", buf);
```

For plain `<img>` rendering, prefer `meta.url` — it skips one fetch and lets the browser handle cache and decoding.

#### Each `_files.<key>` entry shape

After save + round-trip, an entry has:

```ts
{
  url: string;           // ready-to-use URL for <img>/<video>/etc.
  type: string;          // MIME type
  size: number;          // bytes
  lastModified?: number; // epoch ms (for File only)
  file: () => Promise<File>; // bytes on demand
}
```

### Form Validation

You can use React's `useState` to manage validation states and error messages. Validate inputs at the UI level before allowing submission.

```javascript
const [errors, setErrors] = useState({});

function validateForm() {
  const newErrors = {};
  if (!doc.name.trim()) newErrors.name = "Name is required.";
  if (!doc.email) newErrors.email = "Email is required.";
  if (!doc.message.trim()) newErrors.message = "Message is required.";
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}

function handleSubmit(e) {
  e.preventDefault();
  if (validateForm()) submit();
}
```

## Example React Application

Code listing for todo tracker App.jsx. Note the code ordering: hooks, then handlers, then classNames right before JSX.

```js
import React from "react";
import { useFireproof } from "use-fireproof";

export default function App() {
  // 1. Hooks and document shapes
  const { useLiveQuery, useDocument, database } = useFireproof("todo-list-db");

  const {
    doc: newTodo,
    merge: mergeNewTodo,
    submit: submitNewTodo,
  } = useDocument({
    todo: "",
    type: "todo",
    completed: false,
    createdAt: Date.now(),
  });

  const { docs: todos } = useLiveQuery("type", {
    key: "todo",
    descending: true,
  });

  // 2. Event handlers
  const handleInputChange = (e) => {
    mergeNewTodo({ todo: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitNewTodo();
  };

  // 3. ClassNames — right before JSX so colors stay consistent
  const c = {
    bg: "bg-white",
    card: "bg-gray-50",
    border: "border-gray-200",
    accent: "bg-[#e63946]",
    text: "text-gray-500",
  };

  // 4. JSX return
  return (
    <div className={`max-w-md mx-auto p-4 ${c.bg} shadow rounded`}>
      <h2 className="text-2xl font-bold mb-4">Todo List</h2>
      <form onSubmit={handleSubmit} className="mb-4">
        <label htmlFor="todo" className="block mb-2 font-semibold">
          Todo
        </label>
        <input
          className={`w-full ${c.border} border rounded px-2 py-1`}
          id="todo"
          type="text"
          onChange={handleInputChange}
          value={newTodo.todo}
        />
      </form>
      <ul className="space-y-3">
        {todos.map((doc) => (
          <li className={`flex flex-col items-start p-2 ${c.border} border rounded ${c.card}`} key={doc._id}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <input
                  className="mr-2"
                  type="checkbox"
                  checked={doc.completed}
                  onChange={() => database.put({ ...doc, completed: !doc.completed })}
                />
                <span className="font-medium">{doc.todo}</span>
              </div>
              <button className={`text-sm ${c.accent} text-white px-2 py-1 rounded`} onClick={() => database.del(doc._id)}>
                Delete
              </button>
            </div>
            <div className={`text-xs ${c.text} mt-1`}>{new Date(doc.createdAt).toISOString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

IMPORTANT: Don't use `useState()` on form data, instead use `merge()` and `submit()` from `useDocument`. Only use `useState` for ephemeral UI state (active tabs, open/closed panels, cursor positions). Keep your data model in Fireproof.

## Example Image Uploader

This pattern uses `_files` end-to-end: save a `File` directly, render thumbnails with `<img src={meta.url}>`.

```jsx
import React from "react";
import { useFireproof } from "use-fireproof";

export default function App() {
  // 1. Hooks and document shapes
  const { useDocument, useLiveQuery } = useFireproof("image-uploads");

  const { doc, merge, submit } = useDocument({
    _files: {},
    caption: "",
    type: "upload",
    createdAt: Date.now(),
  });

  const { docs } = useLiveQuery("type", { key: "upload", descending: true, limit: 12 });

  // 2. Event handlers
  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) merge({ _files: { photo: f } });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!doc._files?.photo) return;
    submit();
  };

  // 3. ClassNames
  const c = {
    bg: "bg-white",
    card: "bg-gray-50",
    border: "border-gray-200",
    accent: "bg-blue-500 hover:bg-blue-600",
    text: "text-gray-700",
  };

  // 4. JSX return
  return (
    <div className={`p-6 max-w-lg mx-auto ${c.bg} shadow-lg rounded-lg`}>
      <h2 className="text-2xl font-bold mb-4">Image Uploader</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="file" accept="image/*" onChange={onPickFile} className={`w-full ${c.border} border rounded p-2`} />
        <input
          type="text"
          placeholder="Caption"
          value={doc.caption}
          onChange={(e) => merge({ caption: e.target.value })}
          className={`w-full ${c.border} border rounded p-2`}
        />
        <button type="submit" className={`px-4 py-2 ${c.accent} text-white rounded`}>
          Upload
        </button>
      </form>

      <h3 className="text-lg font-semibold mt-6">Recent Uploads</h3>
      <div className="grid grid-cols-2 gap-4 mt-2">
        {docs.map((d) => (
          <div key={d._id} className={`${c.border} border p-2 rounded shadow-sm ${c.card}`}>
            {d._files?.photo?.url && <img src={d._files.photo.url} alt={d.caption || "upload"} className="w-full h-auto rounded" />}
            <p className={`text-sm ${c.text} mt-2`}>{d.caption || "No caption"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```
