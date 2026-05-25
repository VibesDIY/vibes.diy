# Meta CAPI v1 Design

**Issue:** VibesDIY/vibes.diy#1897  
**Date:** 2026-05-25  
**Status:** Approved

## Problem

Meta ads pointing to `good.vibes.diy` landing pages forward `fbclid` to `vibes.diy` CTA links. Without a server-side conversion signal, Meta only sees the top-of-funnel click — never whether the user arrived at vibes.diy. The Conversions API (CAPI) closes this loop so Meta's algorithm can optimize for users who actually land on the product.

## Scope (v1)

Fire a single CAPI `PageView` event from the Cloudflare Worker whenever a request arrives at `vibes.diy` with `fbclid` in the query string. Non-blocking. No cookies, no KV, no session tracking.

Out of scope for v1: conversion events (app creation, sign-up), deduplication (`event_id`), browser pixel on `vibes.diy`.

## Architecture

### Entry point

The main vibes.diy Cloudflare Worker is `vibes.diy/pkg/workers/app.ts`. Its `fetch` handler already parses the URL with `URI.from(request.url)` at the top, and has access to `ctx: ExecutionContext` for `waitUntil`. The CAPI hook slots in immediately after URL parsing, before all routing logic.

### New module: `pkg/workers/meta-capi.ts`

Exports one function:

```ts
sendCapiPageView(request: Request, capiToken: string): Promise<void>
```

Behaviour:
1. Read `fbclid` from URL via `URI.from(request.url).getParam("fbclid")`.
2. Return early if `fbclid === undefined` (no event to fire).
3. Build `fbc = "fb.1." + Date.now() + "." + fbclid` — the format Meta uses to match server-side events back to browser clicks.
4. POST to `https://graph.facebook.com/v19.0/1027305316625975/events`.
5. Wrap the `fetch` in `exception2Result()` (rules-bag: no `try/catch`).
6. Log errors but do not throw — fire-and-forget semantics are intentional.

CAPI payload:

```json
{
  "data": [{
    "event_name": "PageView",
    "event_time": 1234567890,
    "event_source_url": "https://vibes.diy/",
    "user_data": {
      "fbc": "fb.1.<timestamp>.<fbclid>",
      "client_ip_address": "<CF-Connecting-IP header>",
      "client_user_agent": "<User-Agent header>"
    }
  }],
  "access_token": "<META_CAPI_TOKEN>"
}
```

`event_source_url` is constructed from the request URL's protocol and hostname + `"/"` — stripping `fbclid` so Meta sees `https://vibes.diy/` rather than the raw query string.

IP is read from the `CF-Connecting-IP` header — Cloudflare sets this to the real client IP even behind a proxy. Falls back to empty string if absent.

### Hook in `app.ts`

```ts
const fbclid = url.getParam("fbclid");
if (fbclid !== undefined && env.META_CAPI_TOKEN !== undefined) {
  ctx.waitUntil(sendCapiPageView(request, env.META_CAPI_TOKEN));
}
```

Placed immediately after `const url = URI.from(request.url)`, before all routing branches (api-do, vibe-pkg, cf-serve, static-asset, React Router SSR). This ensures the event fires for any route that receives `fbclid`, including the homepage redirect from good.vibes.diy.

### `CFEnv` addition

```ts
META_CAPI_TOKEN?: string
```

Optional so existing dev/test environments that don't have the secret set continue to work unchanged. The `!== undefined` guard in `app.ts` makes the CAPI call a no-op when the token is absent.

### Credential

`META_CAPI_TOKEN` is a Meta Business Manager System User access token (long-lived, not a short-lived user token). It must be stored as a Cloudflare Worker secret:

```
wrangler secret put META_CAPI_TOKEN --env production
wrangler secret put META_CAPI_TOKEN --env cli
```

And added as a GitHub Actions environment variable (`META_CAPI_TOKEN`) in both `prodv2` and `cli` environments so CI wires it through on deploy.

## Rules-bag compliance

- No `try/catch` — uses `exception2Result()` from `@adviser/cement`
- No `new URL()` — uses `URI` from `@adviser/cement`
- No `any` — fully typed
- `undefined` checks with `=== undefined`, not falsy `!`
- No singleton, no mocking

## Files changed

| File | Change |
|------|--------|
| `vibes.diy/pkg/workers/meta-capi.ts` | New: CAPI sender |
| `vibes.diy/pkg/workers/app.ts` | Add fbclid check + `waitUntil` call |
| `vibes.diy/api/types/cf-env.ts` | Add `META_CAPI_TOKEN?: string` |
