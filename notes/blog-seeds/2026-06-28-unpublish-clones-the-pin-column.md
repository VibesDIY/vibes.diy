# Shipping "unpublish" by cloning the pin/unpin column end-to-end

Source: `claude/build-2688-4m3hud`

The v1 implementation of soft-unpublish (#2688) is almost entirely a clone of an
existing feature: `pinnedAt`. Both are a single `text().default("")` column on
`AppSlugBindings` where empty = off and an ISO timestamp = on, flipped by a
read-only-owner-checked mutation. Tracing pin/unpin once gave the whole skeleton
— schema (×2 dialects), arktype req/res, the `VibesDiyApi` client method, the
service handler, manifest + shard-policy registration, and the test harness —
so unpublish dropped into the same slots. The lesson worth a post: when a
codebase already has a reversible soft-state toggle, the cheapest way to add
another is to find it and clone the seam, not invent a new mechanism.

The one part that *wasn't* a clone — and is the actual gotcha — is the gate. A
slug becomes content through more than the obvious serve path: `fork-app`'s
no-`srcFsId` remix and `list-versions` for non-owners both resolve a bare
`ownerHandle/appSlug` straight from `Apps`, and `selectLatestAppPerSlug` falls
back to a *dev* row when no production row exists. So the tombstone check has to
live in a shared helper keyed on the binding (not the resolved row's mode) and
be called at all three non-owner entry points — otherwise "unpublish" only hides
the front door while the side doors stay open. Reviewer-found (Codex), and the
reason the design doc enumerates resolvers instead of just saying "block serve."
