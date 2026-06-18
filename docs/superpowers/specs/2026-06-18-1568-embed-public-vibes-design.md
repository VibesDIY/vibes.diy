# Embed snippet for public vibes (`/embed/:ownerHandle/:appSlug`)

**Issue:** [VibesDIY/vibes.diy#1568](https://github.com/VibesDIY/vibes.diy/issues/1568)
**Status:** Draft spec — for review (Charlie, then @jchris) before implementation
**Date:** 2026-06-18

## Summary

Public vibes have no first-class way to be embedded on a blog post, doc, or
external site — users have to hand-craft an `<iframe>` against an internal URL.
This spec adds (1) a dedicated, authless **`/embed/:ownerHandle/:appSlug`**
route that renders a published vibe stripped of vibes.diy chrome and safe to
frame cross-origin, and (2) a **copy-ready embed snippet** in the Share surface
that points at that route.

The headline insight from #1568 triage: the embed is *bigger than it looks*
because the iframe runner is non-trivial. The embed route is a **double
wrapper** — the third-party page frames our `/embed/` page, and that page in
turn frames the vibe runtime (`appSlug--ownerHandle.<host>`). That extra layer
buys us three things we can't get by pointing the snippet straight at the
runtime subdomain: a stable public URL contract, an explicit cross-origin
framing policy we control, and a graceful **owner-facing instruction card**
when a vibe is embedded but not (or no longer) published.

## Background: how the runner works today

Understanding the existing machinery is the point of this spec, so the design
below reuses rather than reinvents it.

- **Public viewer route** —
  [`pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`](../../../vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx).
  It is registered *outside* the auth layout in
  [`pkg/app/routes.ts`](../../../vibes.diy/pkg/app/routes.ts) (`vibe/:ownerHandle/:appSlug/:fsId?`),
  so it is reachable without sign-in. The component renders a single `<iframe>`
  whose `src` is computed by the loader and SSR'd into the first byte of HTML
  for fast paint, then layers chrome on top: the `ExpandedVibesPill`, the
  `ShareModal`, the `SessionSidebar`, and a landing card for
  request/invite/pending/revoked grant states.
- **Runtime entry-point URL** —
  [`api/pkg/entry-point-utils.ts`](../../../vibes.diy/api/pkg/entry-point-utils.ts)
  `calcEntryPointUrl()` builds the runtime origin as
  `${appSlug}--${ownerHandle}.${hostnameBase}` with an optional `~${fsId}~`
  path. This subdomain is the actual app; the `/vibe/` page is a shell around it.
- **Iframe sandbox/allow policy** — single source of truth in
  [`pkg/app/lib/iframe-policy.ts`](../../../vibes.diy/pkg/app/lib/iframe-policy.ts)
  (`RUNTIME_PREVIEW_IFRAME_SANDBOX` / `RUNTIME_PREVIEW_IFRAME_ALLOW`). Documented
  in [`agents/iframe-policy.md`](../../../agents/iframe-policy.md). The published
  viewer and the editor preview both consume these constants.
- **World-readable SSR hint** —
  [`api/svc/intern/get-vibe-route-hints.ts`](../../../vibes.diy/api/svc/intern/get-vibe-route-hints.ts).
  `deriveIsWorldReadable()` scans `AppSettings` and returns `true` when
  `publicAccess.enable === true` **or** `request.enable && autoAcceptRole` is
  set; `getVibeRouteHints()` additionally requires the app row to be in
  `mode: "production"`.
  [`pkg/workers/app.ts`](../../../vibes.diy/pkg/workers/app.ts) (≈L347-368) calls
  this for `/vibe/*` pathnames and passes `isWorldReadable` into the loader
  context so the iframe paints before the async grant check completes. Explicit
  `fsId` URLs suppress the optimisation (a draft fsId may not be public).
- **Grant resolution** — the viewer component calls
  `chatApi.getAppByFsId({ fsId, appSlug, ownerHandle, token })`. Relevant grants:
  `public-access` (authless render), `owner`, `granted-access.*`,
  `req-login.*`, `pending-request`, `revoked-access`, `not-found`, `not-grant`.
- **Viewer identity inside the runtime** — the parent posts
  `vibe.evt.viewerChanged` into the sandbox after `whoAmI`. For public/anon
  viewers `viewer` is `null`. (Relevant because an embed is always anonymous.)
- **Share surface** —
  [`ShareModal.tsx`](../../../vibes.diy/pkg/app/components/ResultPreview/ShareModal.tsx)
  driven by
  [`useShareModal.ts`](../../../vibes.diy/pkg/app/components/ResultPreview/useShareModal.ts).
  `useShareModal` already tracks `isPublished` (app `mode === "production"` with
  a production `fsId`), `publishedUrl` (`${origin}/vibe/${ownerHandle}/${appSlug}/`),
  `canPublish`, and a `handleCopyUrl` clipboard helper. There is also a
  full-page sharing tab at
  [`components/mine/sharing-tab/SharingTab.tsx`](../../../vibes.diy/pkg/app/components/mine/sharing-tab/SharingTab.tsx).

### The non-trivial part: cross-origin framing

There are **no** `X-Frame-Options` or `Content-Security-Policy: frame-ancestors`
headers set anywhere in the repo today (grep is clean). That means current
framing behavior is whatever the platform/Cloudflare default is, and it is
*unverified* for third-party embedding. Two distinct framing relationships must
both succeed for an embed to render on `example.com`:

1. `example.com` frames `vibes.diy/embed/owner/app` — our `/embed/` response
   must permit being framed by arbitrary origins.
2. `vibes.diy/embed/...` frames `app--owner.<host>` — the runtime subdomain must
   permit being framed by the vibes.diy origin (this already happens for
   `/vibe/`, but only same-site; confirm it holds when the outer frame is
   cross-origin).

This is the load-bearing risk in the whole feature and the main reason for the
dedicated route: we can scope a permissive `frame-ancestors` policy to `/embed/`
without loosening framing for the rest of the app.

## Goals

- A public vibe can be embedded on any external site with a copy-pasted snippet.
- The embed renders the live app with no vibes.diy chrome (no pill, no share
  modal, no sidebar, no landing card).
- The embed is authless: it never prompts for sign-in inside the frame.
- When the target vibe is not published (or access was turned off), the embed
  shows a clear, owner-oriented instruction card instead of a broken frame.
- The Share surface exposes a copy-ready snippet only for embeddable vibes.

## Non-goals

- Auth/personalization inside an embed (third-party-cookie territory; out of
  scope — embeds are anonymous).
- Embedding private, request-gated, or draft (`fsId`-pinned) vibes.
- An oEmbed endpoint / provider registration, or rich-embed unfurling on
  social platforms (possible follow-up; see Out of scope).
- Per-embed analytics/attribution beyond what `/vibe/` already logs.

## Approaches considered

### A. Dedicated `/embed/:ownerHandle/:appSlug` wrapper route — **recommended**

The snippet points at `https://vibes.diy/embed/<owner>/<app>`. That page is a
thin, chrome-free sibling of the `/vibe/` route: SSR computes `isWorldReadable`,
renders the runtime `<iframe>` via `calcEntryPointUrl` + the shared sandbox
policy, and — when the vibe is not world-readable — renders an instruction card
instead. We scope a cross-origin `frame-ancestors` policy to this route only.

- **Pros:** stable public contract (snippet URLs don't leak the `--` subdomain
  scheme and survive internal hostname changes); we own the framing policy on a
  single route; graceful not-published fallback; reuses the runner, SSR hint,
  and sandbox policy almost verbatim.
- **Cons:** double-framing (page-in-iframe-in-iframe) adds a layer; new route +
  worker wiring + framing headers to get right; small perf overhead vs. direct.

### B. Snippet points directly at the runtime subdomain (`app--owner.<host>`)

No new route — the snippet frames the runtime origin directly.

- **Pros:** zero new wrapper code; one fewer iframe layer.
- **Cons:** no not-published fallback (visitor sees a raw runtime error/404);
  couples every embed in the wild to the internal subdomain scheme; framing
  policy for the runtime origin would have to be opened to all third parties,
  which is a broader blast radius than a single `/embed/` route; no place to put
  minimal "made with vibes.diy" attribution. Rejected — it's the
  "hand-craft an iframe" status quo with nicer copy.

### C. Reuse `/vibe/:ownerHandle/:appSlug` with an `?embed=1` flag

Same route, conditionally hide chrome and relax framing when `embed=1`.

- **Pros:** no new route file; shares the loader.
- **Cons:** overloads an already-large component (719 lines) with a second
  rendering mode and a conditional security posture (framing rules that differ
  by query param are easy to get wrong and hard to reason about); the chrome,
  grant-card, and auth-intent logic all have to learn an embed mode. Rejected on
  isolation/clarity grounds — the embed deserves its own bounded unit.

**Recommendation: A.** It matches the triage direction (double wrapper, authless
`/embed/...`, owner instructions when unpublished), keeps the security posture
isolated to one route, and maximizes reuse of the proven runner path.

## Design (Approach A)

### Routing

Add to [`pkg/app/routes.ts`](../../../vibes.diy/pkg/app/routes.ts), **outside**
the auth layout (alongside the existing `vibe/...` line):

```
route("embed/:ownerHandle/:appSlug", "./routes/embed.$ownerHandle.$appSlug.tsx")
```

No `:fsId?` segment — embeds always serve the latest production build. (An
explicit fsId would defeat `isWorldReadable` and let drafts leak; omit it.)

### The `/embed/` component

A new, focused `routes/embed.$ownerHandle.$appSlug.tsx`. It is a deliberately
small subset of the `/vibe/` component:

- **Loader** mirrors the `/vibe/` loader: compute the runtime `iframeUrl` via
  `calcEntryPointUrl` (+ `npmUrl`), and surface `isWorldReadable`. Reuse, don't
  duplicate, by extracting the shared URL-building helper if the two loaders
  diverge only in chrome.
- **Render:**
  - If `isWorldReadable`: render a single full-bleed `<iframe>` using
    `RUNTIME_PREVIEW_IFRAME_SANDBOX` / `RUNTIME_PREVIEW_IFRAME_ALLOW` from the
    shared policy module. No pill, no ShareModal, no SessionSidebar, no landing
    card, no login overlay.
  - If **not** world-readable: render the **instruction card** (below) instead
    of the iframe.
  - Optional: a tiny, non-interactive "Made on vibes.diy" attribution corner
    (open question — see below).
- **No grant card / no auth-intent flow.** Because the embed is anonymous, we do
  *not* run the `getAppByFsId` → request/invite/login state machine. The single
  signal we need is "is this world-readable right now?" If we want a live
  (non-SSR) confirmation we can still call `getAppByFsId` and treat anything
  other than `public-access` as "show instruction card", but we must **never**
  open a Clerk `SignIn` inside the embed frame.

### Worker SSR wiring

[`pkg/workers/app.ts`](../../../vibes.diy/pkg/workers/app.ts) currently derives
`isWorldReadable` only for `/vibe/*` pathnames (via `parseVibePathname`).
Generalize so `/embed/*` gets the same hint:

- Add an `/embed/`-aware path parser (or generalize `parseVibePathname` to
  accept both prefixes) and feed `isWorldReadable` into the loader context for
  embed routes too.
- Embeds have no fsId, so the `vibePathnameHasFsId` suppression doesn't apply.

### Cross-origin framing policy (the critical bit)

On the `/embed/` **route response only**, set headers that permit third-party
framing:

- `Content-Security-Policy: frame-ancestors *;` (or a curated allowlist if we
  decide to gate which sites may embed — see open questions). Do **not** send
  `X-Frame-Options` on this route (it has no allow-all value and would block).
- Confirm the runtime subdomain (`app--owner.<host>`) returns no
  `X-Frame-Options: DENY/SAMEORIGIN` and a `frame-ancestors` that includes the
  vibes.diy origin, so the inner frame loads when the outer page is cross-origin.

Because there are no framing headers in the repo today, **step zero of
implementation is to measure the current headers** on both `/vibe/` and the
runtime subdomain (via stable-entry routing on cli, per
[`agents/iframe-policy.md`](../../../agents/iframe-policy.md)) and write the
findings into the implementation plan. The whole feature hinges on this.

### Not-published instruction card

When the embedded vibe is not world-readable, render a self-contained card
(styled to read well at small embed sizes) that explains the situation to the
**owner** who set up the embed, since we cannot reliably identify the viewer
inside a cross-origin frame:

- Headline: e.g. "This vibe isn't published yet."
- Body: brief explanation that embeds only work for public vibes, and that the
  owner needs to publish it (and enable public access) to make the embed live.
- A single CTA linking **out of the frame** (`target="_blank"`,
  `rel="noopener"`) to `https://vibes.diy/vibe/<owner>/<app>` where the owner can
  sign in, publish, and toggle public access. No sign-in attempt inside the
  frame.

This card is the reason the wrapper exists; it turns a broken/empty embed into
an actionable nudge to publish.

### Share-surface snippet UI

Add an **Embed** affordance to the Share surface, gated on the vibe being
embeddable (`isPublished` **and** public access enabled — i.e. the same
condition as `isWorldReadable`; reuse/extend `useShareModal` rather than
recomputing). Per #1568 acceptance criteria, when the vibe is *not* embeddable,
either omit the snippet or show short guidance ("Publish and enable public
access to get an embed code").

Snippet shape — a responsive wrapper plus the iframe, copy-ready:

```html
<iframe
  src="https://vibes.diy/embed/<owner>/<app>"
  style="width:100%;aspect-ratio:16/9;border:0"
  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
  allow="autoplay; camera; clipboard-write; encrypted-media; microphone"
  title="<app> — made on vibes.diy"
  loading="lazy"
></iframe>
```

- **Sizing:** default to a responsive `width:100%` + `aspect-ratio` so the embed
  fits the host column; the snippet is easy to hand-edit to fixed dimensions.
  (Sizing default is an open question below.)
- **Sandbox/allow in the snippet** must mirror the shared policy tokens. To
  avoid drift, generate the snippet string from the same
  `RUNTIME_PREVIEW_IFRAME_*` constants rather than hardcoding a second copy.
- **Copy-to-clipboard:** reuse the `handleCopyUrl` clipboard pattern from
  `useShareModal` (add a `handleCopyEmbed`), with the same "Copied!" feedback.

## Security considerations

- **Framing scope:** open `frame-ancestors` only on `/embed/` (and whatever the
  runtime subdomain minimally needs), never globally. The rest of the app stays
  frame-protected.
- **Clickjacking of vibes.diy auth:** because `/embed/` never renders auth UI and
  links sign-in *out* to a top-level tab, there's no in-frame Clerk surface to
  clickjack. Keep it that way.
- **Sandbox:** reuse the audited shared tokens; do not widen them for embeds.
- **Anonymous only:** the embed must behave exactly like an anonymous public
  visitor (`viewer: null`). No JWT, no third-party-cookie auth attempts.
- **Draft/private leakage:** no `fsId` segment and a strict world-readable gate
  prevent embedding unpublished builds.

## Testing

- **SSR/route tests** mirroring
  [`tests/app/vibe-route-ssr.test.tsx`](../../../vibes.diy/tests/app/ssr/vibe-route-ssr.test.tsx)
  and [`tests/app/vibe-fast-paint.test.tsx`](../../../vibes.diy/tests/app/vibe-fast-paint.test.tsx):
  `/embed/` SSR's the iframe `src` when world-readable, and renders the
  instruction card (no iframe) when not.
- **`deriveIsWorldReadable` / path-parser unit tests** extended to cover the
  `/embed/` prefix.
- **Snippet generation unit test:** the produced sandbox/allow attributes equal
  the shared policy tokens (guards against drift).
- **Manual/Chrome MCP cross-origin check:** serve a throwaway HTML page on a
  different origin that frames a published embed and confirm it renders; confirm
  a private vibe shows the instruction card; confirm the framing headers on both
  layers via stable-entry on cli.

## Open questions (for Charlie / @jchris)

1. **`frame-ancestors *` vs. allowlist.** Allow embedding anywhere (simplest,
   most viral) or gate to an allowlist / per-vibe opt-in? Recommendation: `*`
   for v1 — embeds are public content already.
2. **Owner detection in the instruction card.** We can't reliably auth inside a
   cross-origin frame. Is a generic "not published — open on vibes.diy to
   publish" card sufficient, or do we want best-effort owner detection (and
   accept that third-party-cookie blocking makes it unreliable)? Recommendation:
   generic card for v1.
3. **Default embed size.** Responsive `aspect-ratio:16/9` `width:100%` (chosen
   above) vs. fixed `width`/`height`? Should the Share UI offer a couple of
   presets?
4. **Attribution.** Include a small "Made on vibes.diy" corner badge on the
   embed (virality / backlink) or keep it fully clean? The issue is labeled
   *Vibe Virality*, so a subtle badge may be desirable.
5. **Live grant re-check.** SSR `isWorldReadable` is enough to paint, but do we
   also want a client `getAppByFsId` to catch "made private after SSR cache"
   cases, falling back to the instruction card? Recommendation: yes, cheap and
   correctness-preserving.

## Out of scope / possible follow-ups

- oEmbed endpoint + provider registration for auto-unfurling.
- Social-platform rich embeds (Twitter/X cards already exist via OG meta on
  `/vibe/`; embeds could reuse).
- Per-embed analytics dashboards.
- Allowlist/opt-in embed permissions per vibe (only if Q1 lands on "gate it").
