# Slug-scoped curated cross-slug links (no re-bless on update)

**Hook:** A curated "starter → starter" edge should follow the *vibe*, not a frozen
code version. Make updating the source a content edit, not an admin chore.

**Source:** `vibes.diy/api/types/cached-suggestion.ts` (`cachedSuggestionVibeLinkKey`,
`resolveCachedRead`), `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`
(affordance shield/jump split), `vibes.diy/tests/app/cached-suggestion.test.ts`.

**The trade-off / why / gotcha:** When cross-slug routing moved into the
cached-suggestion **bless map** (#2941), the bless inherited the read lane's
content-address key — which folds in the source vibe's *resolved deployed `fsId`*.
Great for an *emergent* cached "stay" (it's a specific version's precomputed
result; it *should* invalidate when the code changes). Wrong for a *curated*
vibe→vibe link: editing the source Bloom mints a new `fsId`, the client computes a
new key, the bless is orphaned, and the operator has to re-run an admin bless just
to keep the edge alive.

The fix splits the two by keying them differently:
- **stay** (same-slug, version-specific) → `cachedSuggestionKey({ source incl. fsId })` — still `fsId`-pinned.
- **curated link** (cross-slug) → `cachedSuggestionVibeLinkKey({ ownerHandle, appSlug, transform })` — slug-scoped, **no `fsId`**, model-agnostic.

`resolveCachedRead` tries the version-pinned stay first (more specific), then falls
back to the durable slug-scoped link. The destination was *already* a vibe handle
(`{ targetOwnerHandle, targetAppSlug }`, resolved to latest at read time), so the
link is now `fsId`-free on **both** ends — pure vibe→vibe.

Gotcha that made this subtle to spot: the *write* path (`applyCachedSuggestionBless`)
is agnostic — it stores whatever key string it's handed — so the coupling lived
entirely in *which key the client computes*. The bug wasn't in the server; it was
in the address. Two `getCachedSuggestion` lookups per chip now (stay key + link
key); both are best-effort affordance reads, already fanned out per chip.
