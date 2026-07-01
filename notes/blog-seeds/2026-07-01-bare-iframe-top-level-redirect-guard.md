# A client-side belt for the bare-iframe → viewer redirect

- **Branch / PR:** `claude/iframe-bare-url-redirect-63jpxx`
- **Hook:** Open a vibe's *bare* iframe-host URL (`app--owner.vibes.diy/`)
  as a top-level tab and you should land on the real viewer
  (`vibes.diy/vibe/owner/app`) with sign-in + chrome — not a naked, chrome-less
  sandbox you can't log into. We already 302 that navigation server-side… except
  when we don't.

## The trade-off / why

The existing redirect (#2354) keys on the request header `Sec-Fetch-Dest:
document` — a real top-level navigation gets a 302, an `iframe` embed and asset
subresources get served untouched. Clean and cheap, but it's a **request-time**
decision, and two things route around it:

- **HTTP cache.** A *versioned* entry-point document ships
  `Cache-Control: public, max-age=86400`. Once the viewer's `<iframe>` has
  loaded (and cached) that 200, a later top-level navigation to the same URL is
  a browser cache hit — no server round-trip, so no 302. (The response doesn't
  `Vary` on `Sec-Fetch-Dest`, and we don't want it to — that would shatter the
  cache.)
- **Header-less browsers.** Anything that omits `Sec-Fetch-Dest` falls through
  to the page on purpose (so crawlers still resolve og-card meta) — which also
  means an old browser opening the bare URL top-level never bounces.

So the server redirect stays as the fast path, and the served shell now also
carries a tiny inline guard in `<head>`, before the runtime module graph loads:

```js
if (window.top === window.self) { window.location.replace(<canonical viewer>) }
```

Embedded in the viewer's iframe, `window.top !== window.self`, so it no-ops.
Loaded top-level — from cache, from a header-less browser, from bfcache — it
redirects. The target is computed by the *same* `bareHostRedirectTarget` the 302
uses (share/invite params preserved, infra params stripped), so both paths land
byte-identically.

## Gotcha worth a post

A redirect that depends on a request header is only as reliable as the requests
that actually reach your origin. Caching is the whole point of the entry-point
document, and caching is exactly what lets a "top-level vs embedded" decision
you made once get replayed for the wrong context later. The durable fix wasn't a
better header — it was moving the final say to the one place that always knows
the truth at *load* time: the frame itself (`window.top === window.self`). Belt
(server 302, no app bytes on the fast path) **and** suspenders (client guard,
covers the cache/no-header tail).
