# backend.js — server-side reactors (fetch · scheduled · onChange)

`backend.js` is an **optional** server-side file that lives next to `App.jsx` and `access.js`. Emit it **only when the app genuinely needs server-side logic** — an inbound webhook/OAuth callback, a timer that polls an external API, or a side effect after a write (email, external sync). A calculator, gallery, or any app whose data round-trips through Fireproof needs **no** backend — don't emit one.

It exports up to three named handlers plus an optional `config`. All three receive the same `ctx`:

```js
export async function fetch(request, ctx) {} // inbound HTTP  → returns a Response
export async function scheduled(event, ctx) {} // timer        → returns void
export async function onChange(event, ctx) {} // after a write → returns void
export const config = { scheduled: { interval: "5m" } };
```

`ctx` = `{ db, secrets, userInfo, appInfo }`:

- `ctx.db` — `get(id)`, `query(field, opts?)`, `put(doc, opts?)`, `del(id)`. **Writes run through `access.js`** exactly like a frontend write, as the trigger's identity — so the same permission model applies; you never get a "system write" bypass.
- `ctx.secrets` — server-only secret values by name (e.g. `ctx.secrets.STRIPE_SECRET_KEY`). **Never** sent to the browser; never hard-code a key in `App.jsx`.
- `ctx.userInfo` — `{ userHandle } | null`. `null` for `scheduled` and for unauthenticated `fetch` (e.g. webhooks).
- `ctx.appInfo` — `{ ownerHandle, appSlug }`. The vibe's identity; the public webhook URL follows from it.

## When to use which handler — signal words

- **`fetch`** — "webhook", "OAuth", "callback", "API endpoint", "receive", "form POST", "Stripe/Sonos/GitHub sends us…". External → us.
- **`scheduled`** — "every N minutes", "poll", "check periodically", "cron", "keep updated". Timer-driven, no user.
- **`onChange`** — "when X is created", "after a write", "notify", "send an email", "sync to…". Internal write → external action.

Many apps need more than one — a payments app needs `fetch` (webhook receipt) **and** `onChange` (email on the new order).

## `fetch(request, ctx)` — webhooks, OAuth, REST

Reachable at the vibe's published URL under the reserved `/api/` path: `/vibe/{ownerHandle}/{appSlug}/api/*`. The handler sees the path **relative to `/api/`** — a request to `…/api/webhook/stripe` arrives as `url.pathname === "/webhook/stripe"`. It gets a standard `Request` and returns a standard `Response`. `ctx.userInfo` is `null` for webhooks (no session); the app does its own signature check.

```js
export async function fetch(request, ctx) {
  const url = new URL(request.url);

  // OAuth callback — exchange the code, store the token as the owner
  if (url.pathname === "/oauth/callback") {
    const code = url.searchParams.get("code");
    const token = await exchangeToken(code, ctx.secrets.OAUTH_CLIENT_SECRET);
    await ctx.db.put({ _id: "oauth-token", ...token });
    return new Response("Connected! You can close this tab.");
  }

  // Webhook — verify signature BEFORE trusting the body
  if (url.pathname === "/webhook/stripe") {
    const sig = request.headers.get("stripe-signature");
    const payload = await request.text();
    const event = verifyStripeSignature(payload, sig, ctx.secrets.STRIPE_WEBHOOK_SECRET);
    await ctx.db.put({ _id: `payment-${event.id}`, type: "payment", ...event.data });
    return new Response("ok");
  }

  return new Response("Not found", { status: 404 });
}
```

Always **verify webhook signatures** with the provider's secret before writing anything. Tell the user their webhook URL in the UI/setup copy so they can register it with the third party (it's `https://vibes.diy/vibe/{ownerHandle}/{appSlug}/api/…`).

## `scheduled(event, ctx)` — polling on a timer

Runs on the interval declared in `config.scheduled.interval`. `ctx.userInfo` is `null`; writes default to the vibe owner. `event` carries the scheduled time.

```js
export const config = { scheduled: { interval: "5m" } };

export async function scheduled(event, ctx) {
  const tokenDoc = await ctx.db.get("oauth-token");
  if (!tokenDoc) return; // not connected yet — nothing to poll

  const res = await fetch("https://api.example.com/now-playing", {
    headers: { Authorization: `Bearer ${tokenDoc.accessToken}` },
  });
  const data = await res.json();

  await ctx.db.put({ _id: "now-playing", track: data.track, updatedAt: event.scheduledTime });
  // The frontend reading "now-playing" via useDocument updates live — no client polling.
}
```

**`config.scheduled.interval` must be a static string literal**, one of `"5s" | "30s" | "1m" | "5m" | "15m" | "1h"` (any `<n>s|m|h` works; **min 5s, max 1h**). A faster, slower, malformed, or **computed/indirect** value (`interval: SOME_CONST`) is rejected at push time — write the literal directly. One `scheduled` run at a time per app; if a tick overruns, the next starts after it finishes.

## `onChange(event, ctx)` — side effects after a write

Runs **after** a write commits (the access function already approved and the doc is stored). It cannot block or reject the write — it's the place for side effects that must not gate the write path: email, Slack, external sync, audit logs. Fire-and-forget: the write succeeds regardless.

```js
export async function onChange(event, ctx) {
  // event.doc — the new doc (null on hard delete)
  // event.oldDoc — the previous version (null on create)
  // event.dbName — which database
  // event.userInfo — who wrote it ({ userHandle } | null)
  const isCreate = event.doc && !event.oldDoc;

  if (event.doc?.type === "order" && isCreate) {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.secrets.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: event.doc.customerEmail }] }],
        from: { email: "orders@example.com" },
        subject: `Order ${event.doc._id} confirmed`,
        content: [{ type: "text/plain", value: `Thanks! $${event.doc.amount / 100}` }],
      }),
    });
  }
}
```

Detect create/update/delete from `doc`/`oldDoc` nullness (create = `doc && !oldDoc`; update = both; delete = `oldDoc && !doc` or `doc.deleted`). **Filter narrowly** (by `type` and create-vs-update) so you don't fire on every write. If `onChange` itself calls `ctx.db.put`, guard against an infinite loop (only write when something actually changed, and don't re-write the doc that triggered you).

## Identity on writes — keep `access.js` honest

Every `ctx.db.put(doc)` writes as a real `userHandle` (the trigger's): `onChange` passes through the **original writer**, `fetch` uses the **session user** (or owner for webhooks), `scheduled` uses the **owner**. So `access.js` validates a backend write exactly like a frontend one. Only the **vibe owner's** code may impersonate another user with `ctx.db.put(doc, { as: "alice" })`; reach for it rarely.

## Output format

Emit `backend.js` as its **own** file block (never inside `App.jsx` or `access.js`) — the filename line is how the system routes it. Put the `config` export in the same file. Keep handlers small and copy the shapes above, adapting the paths, doc `type`s, and secret names to the app.
