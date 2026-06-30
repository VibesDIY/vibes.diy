# A shield you're not allowed to draw yourself

Source: `claude/cached-suggestion-owner-bless-ui-mth0zg` (#2917) — the owner-facing
**bless / unbless** control plus the per-chip **shield** that finally makes the
cached-suggestion read lane validatable in a PR preview. The whole security backend
(produce → bless → serve, fork-by-default) was already merged (#2890, #2915); this
slice is the UI that drives it.

The interesting constraint is the shield. A shield on a chip means *one specific
thing*: "click this and you stay here — same namespace, same data, no fork." That's
the one surprising-if-unannounced behavior in the product, so the announcement has
to be honest. Which means the client is **not allowed to decide** when to draw it.

- **Render the shield only from a real server answer.** The badge appears iff
  `getCachedSuggestion(key)` returns a stay-`fsId` — which the server returns only
  when the result is *blessed AND its source is public AND the app is visible*. A
  client-asserted shield would be a phishing vector ("trust me, this stays"), so
  there is no client heuristic, even for the owner's own vibe. The owner's
  bless/unbless *affordance* reads the produce/bless maps; the shield itself is
  always the server's word.

- **Key the shield on the production HEAD, never the draft pin.** The producer keys
  a cached result on `(source-version, transform)` where source-version is the
  *public* HEAD it was generated from — never the owner's unpublished `draftFsId`
  (which it skips). So the shield/bless lookups must use the same `fsId ?? resolvedFsId`,
  *excluding* `draftFsId` — even though the running iframe is pinned to the draft.
  Get this wrong and the owner-who-just-produced sees no shield, because their key
  (draft) doesn't match the produced key (HEAD). The visitor never has a draft pin,
  so for them `effectiveFsId == cacheSourceFsId` and the click-path key and the
  prefetch key are identical by construction — which is exactly why a shielded chip
  is guaranteed to resolve to a stay on click.

- **A button can't nest a button.** The shield is a non-interactive badge *inside*
  the chip button; the bless/unbless toggle is an interactive control, so it has to
  be a **sibling**, not a child (invalid HTML otherwise). `OptionButtons` grew one
  generic seam for this — a `decorate(option) → { badge, aside }` — so the chip
  stays the primary click and the owner control rides alongside without forking the
  component or leaking bless semantics into the shared chat widget.

- **Revoke matches the full tuple.** Unbless carries `{key, fsId, sourceFsId}` from
  the *bless* map, not just the key — a re-produced/re-blessed key points at a new
  `fsId`, and a stale revoke holding the old tuple must no-op rather than unpublish
  the current blessed result.

Everything fails to **fork**: cold, unblessed, revoked, source went private, lookup
error — none of them degrade to an unsafe stay. The lane stays preview-flag-only
(`VIBES_CACHED_SUGGESTIONS="on"`) until prod enablement is separately decided.
