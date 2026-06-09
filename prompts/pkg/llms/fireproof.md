# Fireproof Database API Guide

Fireproof is a lightweight embedded document database with encrypted live sync, designed to make browser apps easy. Use it in any JavaScript environment with a unified API that works both in React (with hooks) and as a standalone core API.

## Key Features

- **Apps run anywhere:** Bundle UI, data, and logic together.
- **Real-Time & Offline-First:** Automatic persistence and live queries, runs in the browser - no loading or error states.
- **Unified API:** TypeScript works with Deno, Bun, Node.js, and the browser.
- **React Hooks:** Leverage `useLiveQuery` and `useDocument` for live collaboration. Note: these are NOT top-level exports — they are returned by the `useFireproof()` hook. Always destructure from `const { useLiveQuery, useDocument, database } = useFireproof("dbName")`.

**File structure:** A vibe's source is one or more files. `/App.jsx` is the entry point (React component). `/access.js` is optional — include it when the app needs per-document write validation or channel-based read isolation. Both files are pushed together and the server discovers `/access.js` automatically.

Fireproof enforces cryptographic causal consistency and ledger integrity using hash history, providing git-like versioning with lightweight blockchain-style verification. Data is stored and replicated as content-addressed encrypted blobs, making it safe and easy to sync via commodity object storage providers.

## Installation

The `use-fireproof` package provides both the core API and React hooks. React hooks are the recommended way to use Fireproof in LLM code generation contexts. Fireproof databases store data across sessions and can sync in real-time. Each database is identified by a string name, and you can have multiple databases per application—often one per collaboration session, as they are the unit of sharing.

Each document has an `_id`, which can be auto-generated or set explicitly. Auto-generation is recommended to ensure uniqueness and avoid conflicts. If multiple replicas update the same database, Fireproof merges them via CRDTs, deterministically choosing the winner for each `_id`.

Use granular documents, e.g. one document per user action, so saving a form or clicking a button should typically create or update a single document, or just a few documents. Avoid patterns that require a single document to grow without bound.

Fireproof is a local database, no loading states required, just empty data states.

### Basic Example

This complete app shows Fireproof's core: `useFireproof` gives you hooks, `useDocument` manages form state, and `useLiveQuery` sorts by `_id` for temporal ordering.

App.jsx

```jsx
import React from "react";
import { useFireproof } from "use-fireproof";

export default function App() {
  const { useDocument, useLiveQuery } = useFireproof("myLedger");

  const { doc, merge, submit } = useDocument({ text: "" });

  // _id is roughly temporal, this is most recent first
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
}
```

The access function lives in a separate file. Even simple apps include one — it's the server-side authority for who can write, and it routes each document to a channel so the author can read it back:

access.js

```js
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to save" };
  // Private to the author: one channel per user holds all of their documents.
  const mine = `user:${user.userHandle}`;
  return { channels: [mine], grant: { users: { [user.userHandle]: [mine] } } };
}
```

### Editing Documents

Address documents by a known `_id` if you want to force conflict resolution or work with a real world resource, like a schedule slot or a user profile. In a complex app this might come from a route parameter or correspond to an outside identifier. To add a profile editor to the app above:

App.jsx

```jsx
<<<<<<< SEARCH
  const { doc, merge, submit } = useDocument({ text: "" });
=======
  const { doc, merge, submit } = useDocument({ text: "" });

  const { doc: profile, merge: mergeProfile, save: saveProfile } = useDocument({ _id: "user-profile:abc@example.com" });
>>>>>>> REPLACE
```

The `useDocument` hook provides several methods: `merge(updates)` updates the document with new fields without saving (use this instead of keeping a `useState` for document data), `submit(e)` handles form submission by preventing default, saving, and resetting, `save()` saves the current document state, and `reset()` resets to initial state. When you call submit, the document is reset, so if you didn't provide an `_id` then you can use the form to create a stream of new documents as in the basic example above.

### Updating Documents in Event Handlers

To update an existing document from a click handler or callback, use `database.put()` directly. Never call `useDocument` inside an event handler — that violates React's Rules of Hooks. Adding a toggle to list items:

App.jsx

```jsx
<<<<<<< SEARCH
  const { useDocument, useLiveQuery } = useFireproof("myLedger");
=======
  const { useDocument, useLiveQuery, database } = useFireproof("myLedger");
>>>>>>> REPLACE
```

App.jsx

```jsx
<<<<<<< SEARCH
          <li key={doc._id}>{doc.text}</li>
=======
          <li key={doc._id}>
            {doc.text}
            <button onClick={() => database.put({ ...doc, favorite: !doc.favorite })}>
              {doc.favorite ? "★" : "☆"}
            </button>
          </li>
>>>>>>> REPLACE
```

Never call hooks inside handlers — `const { doc, save } = useDocument({ _id: id })` inside an onClick BREAKS the Rules of Hooks.

### Query Data

Data is queried by sorted indexes defined by the application. Sort by strings, numbers, or booleans, as well as arrays for grouping. Use numbers when possible for sorting continuous data. You can use the `_id` field for temporal sorting so you don't have to write code to get simple recent document lists, as in the basic example above.

#### Query by Key Range

Passing a string to `useLiveQuery` will index by that field. Use the key argument to filter by a specific value, or range for bounded queries. Switching from temporal to filtered query:

App.jsx

```jsx
<<<<<<< SEARCH
  const { docs } = useLiveQuery("_id", { descending: true, limit: 100 });
=======
  // all docs where doc.agentName === "agent-1", sorted by _id
  const { docs } = useLiveQuery("agentName", { key: "agent-1" });
>>>>>>> REPLACE
```

Or query a numeric range:

App.jsx

```jsx
<<<<<<< SEARCH
  const { docs } = useLiveQuery("agentName", { key: "agent-1" });
=======
  // docs with agentRating between 3 and 5
  const { docs } = useLiveQuery("agentRating", { range: [3, 5] });
>>>>>>> REPLACE
```

#### Counter Pattern

Documents can be updated by multiple clients, and synced later. To create an event counter, don't increment a number on a single doc, instead write a small document per counted event, and query them with an index:

App.jsx

```jsx
<<<<<<< SEARCH
  const { docs } = useLiveQuery("agentRating", { range: [3, 5] });
=======
  const { docs } = useLiveQuery("counter", { key: "my-event-name" });
  const counterValue = docs.length;

  function countEvent() {
    database.put({ counter: "my-event-name" });
  }
>>>>>>> REPLACE
```

This pattern ensures the count is accurate even during sync — each event is its own document, so concurrent writes never conflict.

### Custom Indexes

Use a custom index function to normalize and transform document data, for instance if you have both new and old document versions in your app:

App.jsx

```jsx
<<<<<<< SEARCH
  const { docs } = useLiveQuery("counter", { key: "my-event-name" });
  const counterValue = docs.length;

  function countEvent() {
    database.put({ counter: "my-event-name" });
  }
=======
  const { docs } = useLiveQuery(
    (doc) => {
      if (doc.type == "listing_v1") return doc.sellerId;
      else if (doc.type == "listing") return doc.userId;
    },
    { key: routeParams.sellerId }
  );
>>>>>>> REPLACE
```

#### Array Indexes and Prefix Queries

When you want to group rows easily, you can use an array index key. This is great for grouping records by year/month/day or other paths. The prefix query is a shorthand for a key range:

App.jsx

```jsx
<<<<<<< SEARCH
  const { docs } = useLiveQuery(
    (doc) => {
      if (doc.type == "listing_v1") return doc.sellerId;
      else if (doc.type == "listing") return doc.userId;
    },
    { key: routeParams.sellerId }
  );
=======
  const { docs } = useLiveQuery(
    (doc) => {
      const date = new Date(doc.date);
      if (Number.isNaN(date.getTime())) return; // return nothing to skip docs without a valid date
      return [date.getFullYear(), date.getMonth(), date.getDate()];
    },
    { prefix: [2024, 11] } // everything from November 2024
  );
>>>>>>> REPLACE
```

#### Sortable Lists

Sortable lists are a common pattern. Use evenly spaced positions and insert between items using midpoint calculation:

App.jsx

```jsx
<<<<<<< SEARCH
  const { docs } = useLiveQuery(
    (doc) => {
      const date = new Date(doc.date);
      if (Number.isNaN(date.getTime())) return;
      return [date.getFullYear(), date.getMonth(), date.getDate()];
    },
    { prefix: [2024, 11] }
  );
=======
  // Query items on list xyz, sorted by position
  // Note: useLiveQuery('list', { key:'xyz' }) would be the same docs, sorted chronologically by _id
  const { docs } = useLiveQuery((doc) => [doc.list, doc.position], { prefix: ["xyz"] });

  async function initializeList() {
    await database.put({ list: "xyz", position: 1000 });
    await database.put({ list: "xyz", position: 2000 });
    await database.put({ list: "xyz", position: 3000 });
  }

  async function insertBetween(beforeDoc, afterDoc) {
    const newPosition = (beforeDoc.position + afterDoc.position) / 2;
    await database.put({ list: "xyz", position: newPosition });
  }
>>>>>>> REPLACE
```

## Per-Database Access Control (`acl` option)

On vibes.diy, `useFireproof` accepts an optional `acl` argument that declares who can read, write, or delete documents in that database. The ACL is stored server-side and enforced on every operation — no separate API call needed.
Only use the `acl` option when the user explicitly asks for fine-grained access control (or equivalent permission constraints).

App.jsx

```jsx
<<<<<<< SEARCH
  const { useDocument, useLiveQuery, database } = useFireproof("myLedger");
=======
  // Anyone with a grant can post; only editors can delete
  const { useLiveQuery, database } = useFireproof("announcements", {
    acl: { write: ["members"], delete: ["editors"] },
  });
>>>>>>> REPLACE
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

Other `acl` variants: `useFireproof("drafts", { acl: { read: ["editors"], write: ["editors"], delete: ["editors"] } })` for editors-only space, or omit `acl` entirely to fall back to app-level role gates (existing behavior, always safe).

## Reading Resolved Grants (`access`)

`useFireproof()` returns an `access` property — the viewer's resolved roles and channels for that database, computed server-side from the access function's `members` and `grant` declarations. Use `access.roles` (ReadonlySet), `access.channels` (ReadonlySet), `access.hasRole(name)`, and `access.hasChannel(name)`.

For databases without an access function export, `access` has empty roles and channels. No separate pending flag — grants arrive alongside the viewer identity, so `useViewer().isViewerPending` covers both.

App.jsx

```jsx
<<<<<<< SEARCH
  const { useLiveQuery, database } = useFireproof("announcements", {
    acl: { write: ["members"], delete: ["editors"] },
  });
=======
  const { database, useLiveQuery, access } = useFireproof("comments");
>>>>>>> REPLACE
```

App.jsx

```jsx
<<<<<<< SEARCH
      <h3>Recent Documents</h3>
      <ul>
        {docs.map((doc) => (
          <li key={doc._id}>
            {doc.text}
            <button onClick={() => database.put({ ...doc, favorite: !doc.favorite })}>
              {doc.favorite ? "★" : "☆"}
            </button>
          </li>
        ))}
      </ul>
=======
      {access.hasRole("poster") && <CommentForm database={database} />}
      {access.hasRole("moderator") && <ModTools database={database} />}
      {access.hasChannel("announcements") && <Announcements />}
>>>>>>> REPLACE
```

The AI agent writes the access function (so it knows the role names) and writes the UI (so it knows which roles gate which components). The `access` object is the bridge — it lets the UI reflect server-enforced permissions without duplicating the logic.

The access function is the single source of truth for permissions. The UI reads its verdict from `access` — gate with `access.hasChannel(name)` and `access.hasRole(name)`. Grants may reflect logic the UI can't see (other documents, role memberships, owner state), so `access` is always the right check.

`access.hasChannel()` covers every grant path — public channels, restricted channels, role-expanded channels. The access function decides who gets access and how; the UI just asks `access.hasChannel(name)`.

### Complete example: Team announcements with channels

This example shows the full round-trip — access.js declares channels and grants; App.jsx reads them back via `access`. Key details:

- **Owner bootstrap:** `user.isOwner` gates management operations (channel setup, role grants, moderation). No bootstrap problem — the owner can always manage without needing a role granted first.
- **Channel identity:** Channel docs use `_id: "ch:" + name` so names are unique. The `_id` is the channel identifier everywhere — in `channels`, `grant`, and `ctx.requireAccess()`.
- **Channel grant:** A channel document grants the creator (`grant.users`), adds `grant.public` so all members can read, and `grant.roles` so posters can write.
- **Write surfaces** are gated with `viewer` (signed in?), `access.hasChannel()` (channel access), or `isOwner` (management).
- **`ViewerTag`** takes `userHandle` when rendering another user.

access.js

```js
export function announcements(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "channel") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {
      channels: [doc._id],
      grant: {
        users: { [user.userHandle]: [doc._id] },
        public: [doc._id],
        roles: { poster: [doc._id] },
      },
    };
  }

  if (doc.type === "roleGrant") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { members: { [doc.role]: [doc.userHandle] } };
  }

  if (doc.type === "post") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    ctx.requireAccess(doc.channel);
    return { channels: [doc.channel] };
  }

  throw { forbidden: "unknown document type" };
}
```

App.jsx — `isOwner` and `access.hasChannel()` gate the UI based on what the access function declared:

```jsx
import React from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery, access } = useFireproof("announcements");

  const { docs: posts } = useLiveQuery("type", { key: "post" });
  const [draft, setDraft] = React.useState("");
  const [channel, setChannel] = React.useState("general");

  if (isViewerPending) return null;

  async function submitPost() {
    if (!draft.trim() || !viewer) return;
    await database.put({
      type: "post",
      channel,
      body: draft.trim(),
      authorHandle: viewer.userHandle,
      createdAt: Date.now(),
    });
    setDraft("");
  }

  return (
    <div>
      <ViewerTag />

      {/* access.hasChannel covers public + restricted — the access function handles the distinction */}
      {viewer && access.hasChannel(channel) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitPost();
          }}
        >
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit">Post</button>
        </form>
      )}

      {/* owner-only management */}
      {isOwner && (
        <button onClick={() => database.put({ type: "roleGrant", role: "poster", userHandle: "newUser" })}>
          Grant poster role
        </button>
      )}

      {posts.map((p) => (
        <div key={p._id}>
          <ViewerTag userHandle={p.authorHandle} />
          <p>{p.body}</p>
          {isOwner && <button onClick={() => database.del(p._id)}>Delete</button>}
        </div>
      ))}
    </div>
  );
}
```

The pattern: `viewer` checks sign-in, `access.hasChannel()` checks what the access function granted, `isOwner` gates management. The access function is the server-side authority — the UI just reflects its decisions. Real apps can graduate to `access.hasRole("moderator")` when they need to delegate management to non-owners.

### Example: Channel board with restricted channels

Some channels are open to all members, others are restricted. The access function decides — the UI just asks `access.hasChannel()`.

access.js

```js
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "channel") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {
      channels: [doc._id],
      grant: {
        users: { [user.userHandle]: [doc._id] },
        public: [doc._id],
      },
    };
  }

  if (doc.type === "post") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    ctx.requireAccess(doc.channel);
    return { channels: [doc.channel] };
  }

  throw { forbidden: "unknown document type" };
}
```

App.jsx — the UI uses `access.hasChannel()` for everything. It has no idea which channels are restricted — that's the access function's job:

```jsx
<<<<<<< SEARCH
  const { database, useLiveQuery, access } = useFireproof("announcements");
=======
  const { database, useLiveQuery, access } = useFireproof("chat");
  const { docs: channels } = useLiveQuery("type", { key: "channel" });
>>>>>>> REPLACE
```

```jsx
<<<<<<< SEARCH
      {viewer && access.hasChannel(channel) && (
=======
      {/* filter to channels the viewer can see — use _id as channel identifier */}
      {channels.filter((ch) => isOwner || access.hasChannel(ch._id)).map((ch) => (
        <button key={ch._id} onClick={() => setChannel(ch._id)}>{ch.name}</button>
      ))}

      {/* can post? just check channel access */}
      {viewer && (isOwner || access.hasChannel(channel)) && (
>>>>>>> REPLACE
```

Channel `_id` is the channel identifier everywhere. The access function uses `doc._id` for routing and grants. A deterministic `_id` like `"ch:" + name` enforces uniqueness — two users can't create duplicate channels.

---

## Access Function (`/access.js`)

Access functions are **the room** — they govern what members can do with data once inside the app. The per-vibe membership system is **the door** — it decides who can see the app at all. Once a user is through the door (approved as a member), the access function is the sole authority for data permissions. Access functions are server-run on every write (including deletes) before storing the document. They validate writes, route documents to channels, and declare grants that control who can read what. Only create an `/access.js` file when the user asks for per-document routing, channel-based isolation, or document-level write validation.

Access functions live in `/access.js`, a separate file in the vibe's filesystem alongside `/App.jsx`. **Always emit the access function as a block preceded by the filename `access.js` on its own line — never inside an `App.jsx` block.** Each **named export** maps to a database name — `export function chat(...)` gates `useFireproof("chat")`. An `export default` function acts as a catch-all: it gates any database that doesn't have its own named export. Named exports always take precedence over the default.

### Function signature

`(doc, oldDoc, user: UserContext | null, ctx: Helpers) => AccessDescriptor` where `doc` is the document being written, `oldDoc` is the previous version (null for new documents), `user` is the authenticated user or `null` for anonymous requests, and `ctx` provides server helpers for checking materialized state.

**UserContext:** `{ userHandle: string, displayName?: string }` — `userHandle` is stable unique id (use for all auth checks), `displayName` is display only (never use for identity checks).

**Helpers (`ctx`):** Opaque closures over the materialized grant state. They throw or pass — you cannot enumerate channels, list members, or iterate grants. Both helpers also throw when `user` is null: `ctx.requireAccess(channelId)` throws if user is not in the channel, `ctx.requireRole(roleName)` throws if user is not in the role.

### AccessDescriptor return type

All fields are optional, but a stored document must be routed to at least one channel (`channels`) to be readable — a result with no channels is refused at write time. To reject a write outright, `throw { forbidden: "reason" }`.

```ts
type AccessDescriptor = {
  channels?: string[]; // route this doc to channels
  members?: Record<roleName, userHandle[]>; // role membership (reduced by union)
  grant?: {
    users?: Record<userHandle, string[]>; // direct user → channel grants (reduced by union)
    roles?: Record<roleName, string[]>; // role → channel grants (reduced by union)
    public?: string[]; // member-public read — any member, no channel grant needed
  };
  expiry?: string | number | null; // ISO date or unix seconds
  allowAnonymous?: boolean; // opt-in for null-user writes
};
```

### Key concepts

**Channels** route documents. A document with `channels: ["general"]` is only visible to users who have been granted access to `"general"`. Channels are the unit of read isolation.

**`_id` strategy matters.** Documents that represent a unique named resource (channels, user profiles, config singletons) should use a deterministic `_id` with a short prefix — `"ch:" + name`, `"profile:" + handle`, `"config"`. This enforces uniqueness: two users creating "general" get the same doc, not two. Documents that represent events or content (messages, posts, survey responses) should let `_id` be auto-generated — each one is unique by nature. Use `doc._id` as the channel name for resource docs; use a `channelId` foreign key on content docs.

**Grants are additive.** The effective access state is the union of every current document's `AccessDescriptor` output. There is no "remove grant" operation — deleting a document drops its contribution from the union automatically. This makes revocation trivial: delete the document that granted access, and the grant disappears on next sync.

**Grant resolution order:** The server resolves per-user channel access in two passes — first expand `grant.roles` through `members`, then union with `grant.users` direct grants.

**`allowAnonymous` prevents a footgun.** If `user` is `null` and the function returns without throwing, the runtime checks `allowAnonymous`. If absent or `false`, the write is rejected. This prevents a function that never inspects `user` from silently opening anonymous writes. When `user` is not null, `allowAnonymous` has no effect. `grant.public` makes channels readable by any member (anyone through the door) without a specific channel grant — whether non-members can also read depends on the app-level public toggle. Anonymous _write_ requires `allowAnonymous: true` separately.

**Access functions are server-enforced policy code.** Checks should be deterministic over `(doc, oldDoc, user, ctx)` and deny with `throw { forbidden: "reason" }` when violated.

### Choosing channels — keep the count low

A channel is a _reusable_ unit of read access: grant a user into a channel once and they can read every document routed there. Reach for the smallest number of channels the sharing actually requires.

- **A reusable group reads many docs** (a team, a board, a project): route to one channel the _collaboration_ owns — `return { channels: [doc.channelId] }` — and grant membership once via a meta or invite doc. Many documents share the one channel.
- **Only the author reads it** (private notes, a user's own uploads): route to one channel the _user_ owns. `const mine = \`user:${user.userHandle}\`; return { channels: [mine], grant: { users: { [user.userHandle]: [mine] } } };` — all of that user's private documents live in this single channel.
- **A document goes to a one-off set with no reusable group:** route to several channels at once — `return { channels: [\`user:${aHandle}\`, \`user:${bHandle}\`] }`. Mint a per-document channel (`channels: [doc._id]`) only when each document genuinely has its own disjoint audience.
- **Refusing a write:** `throw { forbidden: "reason" }`. Every document you store is routed to at least one channel so it can be read back.

### Example: Workspace chat with channels

access.js

```js
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

  throw { forbidden: "unknown document type" };
}
```

This single access function handles three document types: **channel-meta** — owner creates a channel and grants access to listed members, **message** — only the author can post, must already have channel access, **channel-invite** — any channel member can invite others; deleting the invite revokes the grant.

### Example: Anonymous survey with role-gated results

access.js

```js
export function survey(doc, oldDoc, user, ctx) {
  if (doc.type === "survey-response") {
    if (oldDoc) throw { forbidden: "responses are write-once" };
    return { channels: ["inbound-responses"], allowAnonymous: true };
  }

  if (doc.type === "survey-config") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {
      grant: {
        roles: {
          "feedback-team": ["inbound-responses"],
        },
      },
    };
  }

  if (doc.type === "final-results") {
    ctx.requireRole("feedback-team");
    return { channels: [doc._id], grant: { public: [doc._id] } };
  }

  throw { forbidden: "unknown document type" };
}
```

Key patterns: `allowAnonymous: true` on survey-response lets unauthenticated visitors submit, `grant.public` on final-results makes them readable by any member without a specific channel grant, and the **singleton grant doc** pattern (survey-config) wires role-to-channel access in one place.

### Multiple databases in one file

Each named export gates its own database. A single `/access.js` can gate all databases the app uses:

access.js

```js
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  ctx.requireAccess(doc.channelId);
  return { channels: [doc.channelId] };
}

export function notes(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  // Private to the author — one channel per user.
  const mine = `user:${user.userHandle}`;
  return { channels: [mine], grant: { users: { [user.userHandle]: [mine] } } };
}
```

Databases without a matching named export fall through to `export default` if one exists. If there is no default export either, the database uses the default app-level permissions (no access function).

**Hyphenated database names** are rare — prefer camelCase (`useFireproof("crewChat")`). If you inherit a hyphenated name, use `export { localName as "db-name" }` to map a local function:

access.js

```js
function crewChat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  ctx.requireAccess(doc.channelId);
  return { channels: [doc.channelId] };
}
export { crewChat as "crew-chat" }
```

### Catch-all with `export default`

Use `export default` to gate every database without writing a named export for each one. Named exports (including `as` exports) still take precedence for databases that need custom logic:

access.js

```js
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  ctx.requireAccess(doc.channelId);
  return { channels: [doc.channelId] };
}

// Everything else: authenticated users get a private per-user channel
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  const mine = `user:${user.userHandle}`;
  return { channels: [mine], grant: { users: { [user.userHandle]: [mine] } } };
}
```

This is especially useful when an app has many databases.

### Roles via `members` reduce

Roles are not a fixed registry. They are materialized from document contributions. A team-meta doc contributes members to a role:

access.js

```js
<<<<<<< SEARCH
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };
  ctx.requireAccess(doc.channelId);
  return { channels: [doc.channelId] };
}
=======
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };

  if (doc.type === "team-meta") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {
      members: { [doc.teamId]: doc.memberHandles },
      grant: { roles: { [doc.teamId]: doc.channels } },
    };
  }

  if (doc.type === "membership") {
    return { members: { [doc.role]: [doc.userHandle] } };
  }

  ctx.requireAccess(doc.channelId);
  return { channels: [doc.channelId] };
}
>>>>>>> REPLACE
```

Both patterns produce identical reduced state. Deleting a membership doc removes the user from the role automatically.

### Common `oldDoc` patterns

Use `oldDoc` (the previous version of the document) to enforce invariants across updates. Adding update guards to an access function:

access.js

```js
<<<<<<< SEARCH
  if (doc.type === "team-meta") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {
=======
  if (doc.type === "team-meta") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    // Immutable-after-create fields
    if (oldDoc && doc.createdBy !== oldDoc.createdBy) {
      throw { forbidden: "createdBy is immutable" };
    }
    // Prevent unauthorized ownership transfer
    if (oldDoc && oldDoc.ownerHandle !== user.userHandle) {
      throw { forbidden: "not owner" };
    }
    return {
>>>>>>> REPLACE
```

Other common `oldDoc` patterns: `if (oldDoc === null) { /* create-only logic */ }` for new documents, and `if (oldDoc && doc.version <= oldDoc.version) { throw { forbidden: "version must increase" } }` for monotonic versions.

---

## Architecture: Where's My Data?

Data is stored in the browser, and is automatically synced with all invited users.

## Using Fireproof in JavaScript

You can use the core API in HTML or on the backend. Instead of hooks, import the core API directly:

App.jsx

```jsx
<<<<<<< SEARCH
import React from "react";
import { useFireproof } from "use-fireproof";

export default function App() {
  const { useDocument, useLiveQuery, database } = useFireproof("myLedger");
=======
import { fireproof } from "use-fireproof";

const database = fireproof("myLedger");

// The document API is async, but doesn't require loading states or error handling.
async function main() {
  const ok = await database.put({ text: "Sample Data" });
  const doc = await database.get(ok.id);
  const latest = await database.query("_id", { limit: 10, descending: true });
  console.log("Latest documents:", latest.docs);
}
>>>>>>> REPLACE
```

To subscribe to real-time updates, use the `subscribe` method. This is useful for building backend event handlers or other server-side logic — for instance to send an email when the user completes a todo:

```js
database.subscribe((changes) => {
  changes.forEach((change) => {
    if (change.completed) {
      sendEmail(change.email, "Todo completed", "You have completed a todo.");
    }
  });
}, true);
```

### Working with Files

Fireproof documents carry attachments under `_files`. Save a `File` (or `Blob`) by assigning it to a key on `_files`, and Fireproof handles upload, durable storage, and URL minting for you. After a doc round-trips through the database, each `_files.<key>` entry carries a stable `url` you can drop straight into `<img>`, `<video>`, `<audio>`, CSS `background-image`, etc.

Each `_files.<key>` entry shape after save + round-trip: `{ url: string, type: string, size: number, lastModified?: number, file: () => Promise<File> }`. The platform-minted `url` is stable for the lifetime of that file, so the browser cache works normally. For plain `<img>` rendering, prefer `meta.url` — it skips one fetch and lets the browser handle cache and decoding. Use `meta.file()` only when you need the bytes themselves (transcoding, hashing, ML features).

Building an image uploader with `_files`:

App.jsx

```jsx
import React from "react";
import { useFireproof } from "use-fireproof";

export default function App() {
  const { useDocument, useLiveQuery } = useFireproof("imageUploads");

  const { doc, merge, submit } = useDocument({
    _files: {},
    caption: "",
    type: "upload",
    createdAt: Date.now(),
  });

  const { docs } = useLiveQuery("type", { key: "upload", descending: true, limit: 12 });

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) merge({ _files: { photo: f } });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!doc._files?.photo) return;
    submit();
  };

  const c = {
    bg: "bg-white",
    card: "bg-gray-50",
    border: "border-gray-200",
    accent: "bg-blue-500 hover:bg-blue-600",
    text: "text-gray-700",
  };

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

For multi-file uploads (e.g. `<input multiple>`), build the `_files` map keyed by filename and iterate with `Object.entries(doc._files)` to render each entry.

Adding multi-file support:

App.jsx

```jsx
<<<<<<< SEARCH
  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) merge({ _files: { photo: f } });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!doc._files?.photo) return;
    submit();
  };
=======
  const onPickFile = (e) => {
    const next = {};
    for (const f of e.target.files) next[f.name] = f;
    merge({ _files: next });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!Object.keys(doc._files || {}).length) return;
    submit();
  };
>>>>>>> REPLACE
```

access.js

```js
export function imageUploads(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to upload" };
  // Each uploader reads their own images — one private channel per user.
  const mine = `user:${user.userHandle}`;
  return { channels: [mine], grant: { users: { [user.userHandle]: [mine] } } };
}
```

### Form Validation

You can use React's `useState` to manage validation states and error messages. Validate inputs at the UI level before allowing submission. Adding validation to the uploader:

App.jsx

```jsx
<<<<<<< SEARCH
  const onSubmit = (e) => {
    e.preventDefault();
    if (!Object.keys(doc._files || {}).length) return;
    submit();
  };
=======
  const [errors, setErrors] = React.useState({});

  function validateForm() {
    const newErrors = {};
    if (!doc.caption.trim()) newErrors.caption = "Caption is required.";
    if (!Object.keys(doc._files || {}).length) newErrors.file = "Pick a file.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const onSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) submit();
  };
>>>>>>> REPLACE
```

## Example React Application

Code listing for todo tracker App.jsx. Note the code ordering: hooks, then handlers, then classNames right before JSX.

```js
import React from "react";
import { useFireproof } from "use-fireproof";

export default function App() {
  // 1. Hooks and document shapes
  const { useLiveQuery, useDocument, database } = useFireproof("todoList");

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

The todo app's access function validates authorship:

access.js

```js
export function todoList(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "todo" && doc.createdBy !== user.userHandle) {
    throw { forbidden: "only the author can edit" };
  }
  // Private to the author — one channel per user.
  const mine = `user:${user.userHandle}`;
  return { channels: [mine], grant: { users: { [user.userHandle]: [mine] } } };
}
```
