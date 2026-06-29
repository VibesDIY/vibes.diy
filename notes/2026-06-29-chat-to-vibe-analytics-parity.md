# Analytics parity: `/chat/:o/:s` → `/vibe/:o/:s` (pre-Phase-3 groundwork)

Part of retiring `/chat` (#2518). **Phase 1 changes no analytics or redirect
behavior** — this note records what must hold before the Phase 3 301 so the
redirect doesn't silently drop a funnel step. No code in this PR touches the
capture path.

## Capture mechanism (what was found)

Pageviews flow through **two independent, path-based channels**. Neither
normalizes the path, so `/chat/...` and `/vibe/...` are distinct rows in both:

1. **GTM / GA4 `dataLayer`** — the explicit pageview push.
   - `vibes.diy/pkg/app/utils/analytics.ts:21` — `pageview(path)` pushes
     `{ event: "page_view", page_path: path, page_location: window.location.href, page_title }`.
   - `vibes.diy/pkg/app/components/CookieBanner.tsx:47-51` — on every
     react-router `location` change (with consent) calls
     `pageview(location.pathname + location.search)`. **The path is passed
     through verbatim** — `page_path` is literally `/chat/o/s` vs `/vibe/o/s`.

2. **PostHog autocapture** — `$pageview` events.
   - `vibes.diy/pkg/app/vibes-diy-provider.tsx:420-432` (`ConditionalPostHog`)
     mounts `<PostHogProvider>` with **default options** (only `api_host` and
     `opt_out_capturing_by_default: false` are set). Default config means
     SPA `$pageview` autocapture keyed on `$current_url` / `$pathname` — again
     **the raw path**, no rewrite.

### Is it path-based? Yes — on both channels.

There is **no pure `path → funnel-prop` derivation function** anywhere in the
app: `pageview()` forwards the path unchanged, and PostHog reads the URL
directly. So there is no clean unit-testable seam to assert "`/vibe` yields the
same funnel prop as `/chat`" — the two paths are, by construction, *different*
props today. That is exactly the gap Phase 3 must close. (Hence: note only, no
parity vitest added — there is nothing pure to assert against. If Phase 3
introduces a normalizer, add the test alongside it.)

## The mapping that must hold before the Phase 3 301

A `301 /chat/:ownerHandle/:appSlug → /vibe/:ownerHandle/:appSlug` will make GTM
and PostHog record `page_path` / `$pathname` = `/vibe/...` where they previously
recorded `/chat/...`. Any dashboard, funnel, or saved insight that filters or
groups on the `/chat/` path prefix will **silently lose those events** unless one
of these is done first:

| Surface | Current key | Required action before the 301 |
| --- | --- | --- |
| GA4 / GTM funnels & reports | `page_path` starts with `/chat/` | Update every funnel/segment/exploration that matches `^/chat/` to ALSO match `^/vibe/` (or a shared regex `^/(chat\|vibe)/`), **or** add a GTM rewrite that maps `/chat/:o/:s` → a canonical `/vibe/:o/:s` `page_path` before the GA4 tag fires. |
| PostHog insights & funnels | `$pathname` / `$current_url` `/chat/` | Update saved insights/funnels to match `/vibe/` too, **or** add a `before_send` / property sanitizer that canonicalizes `/chat/:o/:s` → `/vibe/:o/:s` so historical and post-redirect events share one path. |

The canonical mapping is a straight prefix swap, segment-for-segment:

```
/chat/:ownerHandle/:appSlug            → /vibe/:ownerHandle/:appSlug
/chat/:ownerHandle/:appSlug/:fsId      → /vibe/:ownerHandle/:appSlug/:fsId
```

(Route files confirm the shapes line up:
`vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx` and
`vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`.)

## Go / No-Go criterion for shipping the Phase 3 301

**GO** when, on a staging/preview build with the redirect active:

1. **Volume continuity** — the count of editor-surface pageviews
   (`page_path` / `$pathname` matching `^/(chat|vibe)/[^/]+/[^/]+`) is flat
   across the cutover; the `/chat/`-only count drops to ~0 while the combined
   `/(chat|vibe)/` count is unchanged (no net loss).
2. **Funnel step preserved** — every funnel that previously had a `/chat/:o/:s`
   step still fires that step on a `/vibe/:o/:s` pageview (verified by walking
   the funnel once on the preview and seeing the step register).
3. **No orphaned `/chat/` filters** — a grep of saved GTM triggers and PostHog
   insights for a `/chat/` literal returns only entries that ALSO accept
   `/vibe/` (or a rewrite is in place upstream of them).

**NO-GO** if any saved funnel/insight still keys solely on `/chat/` with no
`/vibe/` acceptance and no upstream rewrite — shipping the 301 then drops that
step.
