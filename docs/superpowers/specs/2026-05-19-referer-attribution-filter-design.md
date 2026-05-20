# Referer Attribution Filter — Design

**Issue:** #1829  
**Branch:** `jchris/fix-1829-referer-noise`

## Problem

`cfServe` logs `[referer]` on every cross-hostname request. In production the
dominant signal is noise: `vibes.diy → assets.prod-v2.vibesdiy.net/_auth/session`
— the main frontend making CORS auth calls to the asset service. These swamp
the attribution data before it even reaches the ETL pipeline.

## Goal

Retain `[referer]` logs only for **external sources navigating users to a
vibes.diy property** — landing pages (`good.vibes.diy`), social links, search
engines. Suppress internal service-to-service traffic.

## Decision

Filter by **referer hostname**, not by request target. By the time a request
reaches `cfServe`, stable-entry has already rewritten the URL to the backend
hostname (`prod-v2.vibesdiy.net`), so the request hostname is not a reliable
discriminator. The `Referer` header is set by the browser to the page the user
was on and is preserved through the proxy.

## Suppression rules

Suppress when the referer's hostname is any of:

| Pattern | Rationale |
|---|---|
| `vibes.diy` (exact) | Main app making CORS auth/API calls |
| `*.vibesdiy.net` | All worker subdomains: prod-v2, cli-v2, dev-v2, assets.*, sandbox iframes |
| `*.workers.dev` | PR preview environments |

Keep everything else: `good.vibes.diy`, `links.vibes.diy`, external sites,
and any future landing domains.

## Implementation

One predicate function in `vibes.diy/api/svc/cf-serve.ts`, replacing the
existing `new URL()` block (rules-bag: use `URI.fromResult` instead):

```ts
const INTERNAL_REFERER_SUFFIXES = [".vibesdiy.net", ".workers.dev"];
const INTERNAL_REFERER_EXACT = new Set(["vibes.diy"]);

function isInternalReferer(hostname: string): boolean {
  return (
    INTERNAL_REFERER_EXACT.has(hostname) ||
    INTERNAL_REFERER_SUFFIXES.some((s) => hostname.endsWith(s))
  );
}
```

Condition: log when `!isInternalReferer(refHostname) && refHostname !== reqHostname`.

## Out of scope

- Writing referer events to Neon (that's the ETL pipeline's job once R2 data arrives)
- Tracking same-hostname navigation (already filtered by `refHostname !== reqHostname`)
