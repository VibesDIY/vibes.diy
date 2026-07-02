---
title: "Every vibe just got a backend"
date: 2026-07-02
summary: "One new file — backend.js — runs on our servers for your app: answer webhooks at your own /_api URL, react to every saved document, and run work on a timer. Server writes go through the exact same access rules as user writes, so your permission model stays in one place."
description: "Introducing backend.js for Vibes DIY apps: fetch, onChange, and scheduled handlers with database writes that pass through your app's own access.js."
thumb: "/images/blog/backend-js-server-side-vibes/scheduled-heartbeat.png"
---

Until now, a vibe was a front end with a synced database: your `App.jsx` runs in
the browser, Fireproof keeps everyone's data live, and `access.js` decides who
may write what. That covers a huge range of apps — but there was always a
category just out of reach: the app that needs something to happen **when
nobody has the page open**. Accepting a webhook. Reacting to a write after it
commits. Ticking once a minute.

That category just opened up. A vibe can now ship one more file — **`backend.js`**
— and it runs on our servers, at the edge, with a real database handle.

<figure>
  <img src="/images/blog/backend-js-server-side-vibes/scheduled-heartbeat.png" alt="A live vibe showing a heartbeat card: 5 seconds since last tick, written by the server as the owner.">
  <figcaption>A <a href="https://vibes.diy/vibe/jchris/backend-scheduled">live vibe</a> whose server writes a heartbeat every minute — as the app owner, into a database only the owner may write. The page just watches.</figcaption>
</figure>

## One file, three superpowers

`backend.js` sits next to `App.jsx` and `access.js`. Export only what your app
needs:

```js
// Answer HTTP at your app's own /_api URL — webhooks, form posts, JSON APIs.
export async function fetch(request, ctx) { ... }

// React after any document write commits — derive, mirror, aggregate.
export async function onChange(event, ctx) { ... }

// Run on a timer, from every 5 seconds to every hour.
export const config = { scheduled: { interval: "1m" } };
export async function scheduled(event, ctx) { ... }
```

Every handler gets a `ctx` with `ctx.appInfo` (which app this is),
`ctx.userInfo` (who the handler is acting as), and the important one —
`ctx.db`:

```js
const id = await ctx.db.put({ kind: "rsvp", name }, { db: "rsvps" });
await ctx.db.delete(id, { db: "rsvps" });
```

Those writes are real Fireproof writes. Everyone with the app open sees them
sync in, the same as any user's write.

## The security model is the whole point

Here's the design decision everything else hangs on: **a backend write goes
through your app's own `access.js` — the exact same gate as a user write —
acting as the identity of whatever triggered it.**

<div class="table-scroll"><table>
<thead><tr><th>Handler</th><th>Its writes act as…</th></tr></thead>
<tbody>
<tr><td><code>onChange</code></td><td>the user whose write triggered the event</td></tr>
<tr><td><code>fetch</code></td><td>the signed-in caller when verifiable — treat as possibly anonymous today</td></tr>
<tr><td><code>scheduled</code></td><td>the app owner</td></tr>
</tbody>
</table></div>

There is no service key, no bypass, no second permission system. If your
access function wouldn't let the triggering user write a document, the backend
can't write it either. That cuts both ways, and it's worth internalizing:

- An `onChange` write is exactly as privileged as the user who caused it —
  it's for **derivation**, never escalation. Anything the backend can write on
  a user's behalf, that user's own client could have written too.
- For documents **only the server should control** — a tally, a digest, a
  heartbeat — use `scheduled`. It acts as the owner, and *owner* is an identity
  your `access.js` can genuinely restrict a database to. That's what the
  heartbeat vibe above does: `if (!user || !user.isOwner) throw { forbidden: … }`,
  and no client can forge that document.
- A `fetch` handler runs for whoever hits your URL — including nobody in
  particular. Anonymous writes are **fail-closed**: the access rule must
  explicitly opt in with `allowAnonymous: true`, or the write is denied. (We
  rediscovered this ourselves an hour after launch, when our own demo forgot
  the flag and the gate correctly refused it.)

## Try it live

This embedded vibe is running its backend right now. Press the button: the
page calls `fetch("/_api/hit?note=…")`, the server handler writes a `hit`
document through the access gate, and the list updates from the live query —
server write to synced UI, end to end.

<!-- At publish time this embed's sandbox/allow values match the runtime policy
     in vibes.diy/pkg/app/lib/iframe-policy.ts; if the policy tokens change,
     regenerate this snippet from the Share modal's embed copy. -->
<iframe
  src="https://vibes.diy/embed/jchris/backend-fetch"
  style="width:100%;aspect-ratio:16/9;border:0"
  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
  allow="autoplay; camera; clipboard-write; encrypted-media; microphone"
  title="backend.js fetch-lane live demo"
  loading="lazy"
></iframe>

The handler behind it is the whole file:

```js
export async function fetch(request, ctx) {
  const url = new URL(request.url);
  if (url.pathname !== "/hit") {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }
  const note = url.searchParams.get("note") || "ping";
  const id = await ctx.db.put({ kind: "hit", note, at: new Date().toISOString() }, { db: "hits" });
  return new Response(JSON.stringify({ ok: true, id }), {
    headers: { "content-type": "application/json" },
  });
}
```

Two details worth knowing. Your endpoint's public address is your published
app's URL plus `/_api/…` — that's what you hand to a webhook provider. And the
path arrives pre-stripped: a request to `…/_api/webhooks/pay` reaches your
handler with pathname `/webhooks/pay`.

## Reacting to writes

`onChange` runs after any document write commits — user writes and backend
writes alike. The event carries `{ dbName, docId, doc, oldDoc, seq, deleted }`.

<figure>
  <img src="/images/blog/backend-js-server-side-vibes/onchange-audit.png" alt="A vibe with two columns: user-written notes on the left, and an audit column on the right written by the backend, attributed to the same user.">
  <figcaption>The <a href="https://vibes.diy/vibe/jchris/backend-onchange">onChange demo</a>: write a note, and the server mirrors it into a second database — attributed to <em>you</em>, because the backend acts as the writer who triggered it.</figcaption>
</figure>

```js
export async function onChange(event, ctx) {
  if (event.dbName !== "notes" || event.deleted) return;
  await ctx.db.put(
    { _id: "act-" + event.docId, kind: "activity", srcId: event.docId, by: ctx.userInfo },
    { db: "activity" }
  );
}
```

Two rules keep change-reactions sane, and they're the same two that make loops
structurally impossible: **guard on `event.dbName` first** (the handler fires
for every database), and **write derived documents into a different database**
than the one that triggered you. Backend writes do trigger `onChange` again —
one generation deeper — and the platform caps runaway chains, but a guard plus
a separate target database means you never lean on the cap. Inside `onChange`,
the triggering database is the default for `ctx.db`, so cross-database writes
take an explicit `{ db }`.

## How to get one

You don't scaffold anything. Two paths:

- **Ask the builder.** The app generator knows this skill — prompt for an app
  that "accepts a webhook," "keeps an activity feed as notes are added," or
  "cleans up expired entries every 15 minutes," and it will emit a `backend.js`
  (and the matching `access.js` rules) alongside your app.
- **Write it by hand.** Pull any vibe with the CLI, drop a `backend.js` at the
  root next to `App.jsx`, and push:

```sh
npx vibes-diy pull you/your-app --dir ./your-app
cd your-app && $EDITOR backend.js
npx vibes-diy push --vibe you/your-app
```

The push registers your handlers and validates your schedule up front — a
`scheduled` export requires `config.scheduled.interval` as a plain string
between `"5s"` and `"1h"`, and a bad interval is rejected at push time, not
silently at 3am.

## The honest edges

`backend.js` currently has **no external network egress**, and `ctx.secrets`
is not available yet — third-party API calls and API keys are out of scope for
now, and AI calls stay in `App.jsx` via `callAI`. Verified signed-in identity
on the `fetch` lane is landing next; until then, treat `fetch` writes as
anonymous and gate them accordingly. Each of those doors opens in a later
release — deliberately, with the same access-gate discipline as the database
channel.

All three demo apps in this post are live, and their complete source —
`App.jsx`, `access.js`, `backend.js` — is pullable with the CLI:
[backend-fetch](https://vibes.diy/vibe/jchris/backend-fetch),
[backend-onchange](https://vibes.diy/vibe/jchris/backend-onchange),
[backend-scheduled](https://vibes.diy/vibe/jchris/backend-scheduled).

<div class="post-cta">
  <h3>Give your app a server side</h3>
  <p>Prompt an app that reacts, schedules, and answers webhooks — the backend comes with it.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
