# For the owner, a cache hit shouldn't be a one-way trip to a permalink

Source: `claude/cached-adopt-in-place-vslbzn` (#2929 item 4) — the first of the
four deferred cached-suggestion read-lane enhancements. When the **owner** clicks
a chip whose result is already cached (blessed), they no longer get navigated to
`/vibe/<owner>/<slug>/<stagedFsId>` like a visitor. They **adopt** that staged
version in place as their working draft.

The whole feature is ~15 lines of route wiring plus one pure helper, but the
interesting part is *why* the visitor behavior was actively wrong for the owner.

- **The same URL means two different things to two different viewers.** A staged
  cached result lives under the source vibe's OWN `(ownerHandle, appSlug)` — so for
  a visitor, navigating to it is a real read-lane page-view. But for the *owner*,
  that versioned permalink is a trap: the route gates editing on `canEdit =
  isOwner && !fsId` and the Publish control on the unversioned `isDraft` path, so a
  versioned URL is a read-only dead end on your *own* app. "Adopt in place" just
  pins the staged `fsId` as the owner's draft (`setDraftFsId` + `setIsDraft`) on the
  canonical URL — reusing the exact re-pin plumbing a manual code-save already uses
  (`onSavedFsId → setDraftFsId`). Skip codegen, keep the slug + data namespace, land
  on an editable/publishable surface.

- **Keep the read/write decision identity-free; route only the *outcome* by
  identity.** `resolveCachedRead` is deliberately identity-free ("does the result
  exist?", never "who clicks?"). Adopt-vs-navigate IS identity-dependent, so it
  doesn't belong inside that function — it's a second, *identity-aware* helper
  (`resolveCachedHit({ hit, isOwner })`) applied AFTER the hit resolves. The
  boundary stays clean and both halves stay unit-testable without mounting the
  route.

- **Content-addressing means you can't "re-date" an existing version.** The
  tempting durable version of adopt is "make this staged `fsId` my newest draft so
  it survives reload and Publish ships it." But there's no primitive for it:
  `setModeFsId` mutates `mode` without bumping `created` (so `ownerLatest`, ordered
  by `created DESC`, won't pick it), a content-addressed `promptFS` re-save of
  identical bytes resolves to the *same* `fsId` (no new row), and `publishApp` is
  the wrong verb (it advances production HEAD, not a draft). So adopt is a
  **client-side pin** with the same durability model the draft-pin feature already
  ships: durable when the staged version is the latest dev draft (the common case,
  right after producing it), and on reload the `ownerLatest` resolver re-pins it.
  Scoped to the canonical (no route-`fsId`) view so the draft resolver — which
  re-runs only on mount/persist/publish — can't race the pin. Lowest-risk warm-up:
  pure client UX, no anonymous-serve surface touched.
