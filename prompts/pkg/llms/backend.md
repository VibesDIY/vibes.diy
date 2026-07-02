# backend.js — the app's server-side backend

`backend.js` is an optional **server-side** file, a sibling of `access.js`. It
runs on the platform's servers — never in the browser — and gives the app three
server superpowers, each an exported function:

- **`fetch(request, ctx)`** — answer HTTP requests at the app's `/_api/...` URL
  (webhooks from outside, or `fetch("/_api/…")` from the app itself).
- **`onChange(event, ctx)`** — react after a document write commits (derive,
  aggregate, moderate, fan out).
- **`scheduled(event, ctx)`** — run periodically (cleanup, digests, timers).

Export only the handlers the app needs. Most apps need **no** `backend.js` at
all — normal CRUD flows through Fireproof directly. Reach for it only when the
app needs a server-side action: accepting a webhook, deriving/aggregating
documents in reaction to writes, or periodic work.

## Output format

`backend.js` is a separate file, exactly like `access.js`: one prose line, the
filename `backend.js` on its own line, then one **complete** fenced block (the
whole file — don't use SEARCH/REPLACE for it; re-emit the full file to change
it). **Never put backend code inside an `App.jsx` block**, and never import
`backend.js` from `App.jsx` — the browser can't run it.

## Writes go through the access function

Every `ctx.db.put`/`ctx.db.delete` is enforced by the app's own `access.js` —
the exact gate user writes pass through — acting as the **trigger's identity**:

| Handler     | Writes act as…                                                    |
| ----------- | ----------------------------------------------------------------- |
| `onChange`  | the user whose write triggered the event                          |
| `fetch`     | the signed-in caller when verifiable — treat as possibly anonymous |
| `scheduled` | the app owner                                                     |

So the permission model stays in `access.js`, and `backend.js` writes must be
allowed by it for the acting identity. If a `fetch` handler writes, make sure
the access function permits that write for an anonymous caller (or design the
write to happen in `onChange`/`scheduled`, which carry stronger identities).

The flip side: the access function **cannot tell** a backend write from a user
write — that's the invariant. An `onChange` write acts as the triggering user,
so anything it may write, that user's own client could write too. `onChange` is
for **derivation and convenience**, never privilege escalation. For documents
only the server should control, use `scheduled` — it acts as the **owner**, an
identity `access.js` can genuinely restrict a database to.

## ctx — what a handler gets

```js
ctx.appInfo; // { ownerHandle, appSlug } — this app's identity
ctx.userInfo; // { userHandle } or null — who the handler is acting as
await ctx.db.put(doc, { db: "notes", id: "optional-id" }); // resolves to the doc id AFTER commit
await ctx.db.delete(docId, { db: "notes" });
const docs = await ctx.db.query({ db: "notes" }); // latest non-deleted docs (each with _id)
```

- `{ db }` names the Fireproof database (same names `App.jsx` uses with
  `useFireproof`). It is **required** — except inside `onChange`, where the
  database that triggered the event is the default.
- Always `await` db calls; they resolve only after the write commits (or throw
  when the access function denies it).
- `ctx.db.query({ db })` returns the whole database's latest docs (capped at
  2000) — filter and sort in the handler. It is read-ACL-gated as the acting
  identity, anonymous `fetch` callers are denied, and databases bound to an
  access function cannot be queried from the backend (keep backend-read
  databases on plain ACLs). Made for `scheduled` sweeps: read, decide, then
  `put`/`delete`.
- **No outside network access**: `fetch()` to external URLs is refused inside
  `backend.js`, and there are no secrets/API keys yet. Don't call third-party
  APIs from the backend; AI calls stay in `App.jsx` via `callAI`.

## fetch — the app's HTTP endpoint

Runs for requests to the app's `/_api` route. The request path is rooted after
`/_api`: a call to `https://slug--owner.host/_api/webhooks/pay` arrives with
pathname `/webhooks/pay`. Return a standard `Response`.

```js
export async function fetch(request, ctx) {
  const url = new URL(request.url);
  if (url.pathname === "/rsvp" && request.method === "POST") {
    const body = await request.json();
    const id = await ctx.db.put({ kind: "rsvp", name: body.name, at: Date.now() }, { db: "rsvps" });
    return new Response(JSON.stringify({ ok: true, id }), {
      headers: { "content-type": "application/json" },
    });
  }
  return new Response("not found", { status: 404 });
}
```

From `App.jsx`, call it with a relative fetch — no host needed:

```js
const res = await fetch("/_api/rsvp", { method: "POST", body: JSON.stringify({ name }) });
```

## onChange — react to committed writes

Runs after any document write to the app's databases commits (user writes and
backend writes alike). The event:

```js
export async function onChange(event, ctx) {
  // event: { dbName, docId, doc, oldDoc, seq, deleted }
  if (event.dbName !== "votes" || event.deleted) return;
  // Maintain a server-authoritative tally the UI reads but users can't forge.
  await ctx.db.put({ _id: "tally-" + event.doc.pollId, kind: "tally", bump: event.seq }, { db: "tallies" });
}
```

Two rules keep change-reactions sane:

1. **Guard on `event.dbName` first.** The handler fires for every database, so
   an unguarded write-back loops on itself.
2. **Write derived docs to a different database** than the one that triggered
   the event. A backend write triggers `onChange` again (one generation deeper);
   the platform caps runaway chains after a few generations, but a tight
   same-database ping-pong is still wasted work. Different db + dbName guard
   makes loops structurally impossible.

## scheduled — periodic work

Requires a `config` export with a **static string-literal** interval between
`"5s"` and `"1h"` (e.g. `"30s"`, `"5m"`, `"1h"` — computed values are rejected):

```js
export const config = { scheduled: { interval: "15m" } };

export async function scheduled(event, ctx) {
  // event: { scheduledTime } — ISO timestamp of this tick
  await ctx.db.put({ kind: "heartbeat", at: event.scheduledTime }, { db: "status" });
}
```

Runs as the app owner. Use it for cleanup, digests, and time-based state — not
for anything that needs a user in the loop.

## A complete example — activity feed + owner-only digest

Users write `note` docs from `App.jsx`. The backend does two jobs: `onChange`
mirrors each note into a per-author `activity` entry (acting as that author —
same privilege, just automated), and a `scheduled` sweep maintains one `digest`
doc that `access.js` restricts to the **owner**, so no user can forge it.

```js
export const config = { scheduled: { interval: "15m" } };

export async function onChange(event, ctx) {
  if (event.dbName !== "notes" || event.deleted) return;
  await ctx.db.put(
    { _id: "act-" + event.docId, kind: "activity", srcId: event.docId, by: ctx.userInfo, at: event.seq },
    { db: "activity" }
  );
}

export async function scheduled(event, ctx) {
  // Acts as the app owner — access.js allows `digest` docs for the owner only,
  // making this document genuinely server-controlled.
  await ctx.db.put({ _id: "digest", kind: "digest", updatedAt: event.scheduledTime }, { db: "digest" });
}
```
