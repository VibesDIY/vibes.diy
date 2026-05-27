# Campaign Health Debug Handoff (2026-05-27 evening)

## Current state

`/reports?report=campaign-health` still times out after 30s idle on cli (`vibes-diy@c2.4.8`).
Growth report works fine on the same `?shard=reports` DO.
All server-side checkpoints pass in one observed run — the hang is now suspected to be in `ctx.send.send()` or in the client not receiving/handling the WS response.

## What we proved today

### Meta API is NOT the bottleneck

Direct curl from local machine:

- `/{account}/insights` → **1.0s**, 31 campaigns, single page (no pagination)
- `/{pixel_id}?fields=name,last_fired_time,stats` → **0.5s**

Total Meta API time: ~1.5s. The 30s idle timeout has nothing to do with Meta being slow.

### Server-side execution completes (observed once in c2.4.7)

In one successful tail capture, all checkpoints passed in order:

```
campaign-health: handler entered
campaign-health: auth ok
campaign-health: creds ok, calling cachedReport
report-cache: match start campaign-health:days:7
report-cache: match done, hit: false
report-cache: computing
fetch-campaign-health: start
fetch-campaign-health: campaigns done, count: 31
fetch-campaign-health: pixel done
report-cache: compute done
report-cache: put queued
campaign-health: cachedReport returned ok
WebSocket connection closed 5     ← connection 5 (growth), not 6 (campaign-health)
```

The handler runs to completion in ~1.5s. The connection that closed (`5`) is NOT the campaign-health connection (`6`). After `cachedReport returned ok`, `ctx.send.send()` is called — but we never see `campaign-health: calling send` (added in c2.4.8) because the tail captured nothing in c2.4.8 runs.

### c2.4.8 runs: no campaign-health logs at all

In c2.4.8, even `handler entered` is absent. Two possible explanations:

1. **The DO hadn't upgraded** — named DOs persist across deploys. If the `?shard=reports` DO was still on c2.4.7 code, the c2.4.8 logs would never appear. Growth report logs appear but growth code didn't change — can't confirm DO version from growth logs alone.
2. **The campaign-health WS message arrived on a pre-existing connection** — if the client reuses the WS connection opened for growth reports (same `?shard=reports`), there's no `New WebSocket connection accepted N` log, and the message handler fires silently in the existing event listener. The tail may have missed it.

### The client idle timer

The client shows "Fetching from Meta Ads API… (Ns)" counting up — this is a **client-side** timer, not a server progress message. After 30s with no WS message from the server, it fires `request-timeout`. This means: even if the server sends the response, if it arrives after 30s the client has already given up.

## Hypotheses ranked by current probability

1. **`ctx.send.send()` hangs for ~27s then client disconnects** — server computes ok in ~1.5s, then `await ctx.send.send()` blocks. After 30s the client cancels. We never see `campaign-health: calling send` because the tail died/reconnected at that moment, OR because the DO was still on c2.4.7 code. Next log to look for: `calling send` vs `send complete`.

2. **DO version confusion** — when campaign-health is hit, the `?shard=reports` named DO may still be on old code that lacks some of the c2.4.8 logs. Hard to confirm without a version stamp in the logs.

3. **WS message lands on existing growth connection** — client reuses the WS and the campaign-health message handler fires but doesn't appear with a new connection log. Tail may have missed the burst.

4. **Client drops the response** — server sends successfully (`send complete` would appear), but the client's schema validation or message routing fails silently. The response arrives but nothing is rendered.

## Next steps

### 1. Open in Chrome DevTools MCP (highest value)

Use the Chrome MCP browser tools to inspect the WebSocket traffic directly:

```
mcp__chrome-devtools__navigate_page → https://cli-v2.vibesdiy.net/reports?report=campaign-health
mcp__chrome-devtools__get_network_request (filter: shard=reports)
mcp__chrome-devtools__get_console_message
```

Look for:
- What WS messages the client SENDS (confirms the message type/payload are correct)
- What WS messages the client RECEIVES (confirms whether the server response is delivered)
- Any client-side errors (schema parse fail, unhandled rejection, etc.)

If the server sends `campaign-health: calling send` + `send complete` but the client shows nothing in WS received — the bug is client-side (message routing/schema).
If no response arrives at all — the bug is server-side (send hangs or message is dropped).

### 2. Add a version stamp to the first log

To confirm which DO code version is running, add to handler entry:

```typescript
console.log("campaign-health: handler entered c2.4.9");
```

This makes DO version visible in the tail without guessing.

### 3. Send a server-side progress message before `cachedReport`

The 30s idle timer resets on any WS message. If we send one progress ping before calling `cachedReport`, we buy another 30s and confirm the WS send path works early:

```typescript
await ctx.send.send(ctx, { type: "vibes.diy.res-progress", message: "fetching..." });
console.log("campaign-health: progress sent");
// then cachedReport...
```

This also tells us if the WS send itself is the hang point.

### 4. Bypass `ctx.send.send()` — call `ws.send()` directly

In the handler, grab the raw WS from the send provider and call `ws.send()` directly with a simple string to rule out any middleware in the evento send layer:

```typescript
const raw = (ctx.send as unknown as { ws: WebSocket }).ws;
raw.send(JSON.stringify({ type: "vibes.diy.res-progress", test: true }));
```

## Files

- [report-campaign-health.ts](vibes.diy/api/svc/public/report-campaign-health.ts)
- [report-cache.ts](vibes.diy/api/svc/public/report-cache.ts)
- [svc-ws-send-provider.ts](vibes.diy/api/svc/svc-ws-send-provider.ts)

## Credentials (in landing-pages/.env)

```
META_ACCESS_TOKEN=EAAQwZCEjFHe8BRtY...
META_AD_ACCOUNT_ID=act_972300412395350
META_PIXEL_ID=1310410873948425
```

Token expires 2026-07-24.

Also added to worktree `.dev.vars` at:
`vibes.diy/api/svc/.dev.vars`

## Worktree

`/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+ws-close-fail-fast`
Branch: `worktree-jchris+ws-close-fail-fast`

## Tag history

| Tag    | What changed                                                                                |
| ------ | ------------------------------------------------------------------------------------------- |
| c2.4.4 | WS fail-fast on close + server .catch() on trigger rejections                               |
| c2.4.5 | AbortSignal.timeout(15s) on metaGet + progress indicator + typed errors                     |
| c2.4.6 | fire-and-forget cache.put + rules-bag cleanup (exception2Result, explicit undefined checks) |
| c2.4.7 | server logging at every checkpoint in handler + cachedReport + fetchCampaignHealth          |
| c2.4.8 | log before and after ctx.send.send() — `calling send` / `send complete`                    |
| c2.4.9 | (next) version stamp + progress ping before cachedReport, or Chrome MCP inspection         |
