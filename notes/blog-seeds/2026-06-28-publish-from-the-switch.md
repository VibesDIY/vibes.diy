# Publish without demoting: minting a new top-of-stack production

Source: #2772 PR-D2 (publish from the Vibes switch), branch `claude/vibe-publish-control`.
Spec: `docs/superpowers/specs/2026-06-28-vibe-draft-publish-design.md` §3c. Follows D1 (owner
draft read), which made the draft *legible*; D2 makes it *shippable*.

Goal: an owner viewing their unpublished draft on `/vibe` gets an in-card "unpublished changes ·
Publish" banner. One tap promotes the draft to the public production everyone sees.

Findings worth a full post:

- **"Publish" is not "flip the row to production."** The obvious implementation — set the chosen
  `fsId`'s row `mode = 'production'` — is what the *existing* `setModeFsId` does, and it's subtly
  wrong for the feature we want. The entry point + `selectLatestAppPerSlug` pick the **highest
  `releaseSeq`** production row, so flipping an *older* version in place keeps its old low seq and
  a newer production still out-ranks it. The version you "published" wouldn't actually serve.

- **Mint MAX+1, don't demote.** D2's `publishApp` instead appends a NEW production row at
  `releaseSeq = MAX+1` carrying the chosen content. Old production rows stay as history; the new
  top-of-stack simply wins. This is *one uniform rule* that's correct for both the common case
  (publish the latest dev — which already had the highest seq, so it'd have worked either way)
  and the older-version case (publish an explicit `fsId` — which only works because we re-release
  it on top). The alternative, demoting the old production, throws away history for no benefit.

- **The fsId-dedup in the release allocator is exactly what publish must NOT do.**
  `allocateAndInsertApp` deduplicates on `fsId` (re-publishing the same content would no-op or
  upgrade-in-place). Publish *wants* to insert a second row with the same `fsId` and a fresh seq —
  so it gets its own `buildInsertProductionRelease` (no dedup guard) but reuses the same
  per-(user,app) advisory lock, so a concurrent codegen write or double-tap can't race the
  `MAX+1` allocation. Idempotency is a separate, explicit check: if the chosen content is already
  the top production, it's a no-op success ("up to date"), never a duplicate row.

- **The badge clears itself — no client bookkeeping.** D1's draft signal is `ownerLatest`
  returning a `dev` row. After publish mints a newer-created production row, `ownerLatest`
  resolves *that* (newest created) → `mode: "production"` → the badge and banner vanish and the
  iframe re-pins to the published URL. The publish handler doesn't tell the client "you're up to
  date"; the client just re-runs the same resolver and the truth falls out. One source of truth,
  two consumers.

- **Testing the async re-pin without mounting the route.** Charlie's D2 ask was a guard for the
  owner re-pin including query-param preservation. The route is too provider-coupled to mount, so
  the iframe-URL build (pin the resolved fsId + *merge* the current `?token`/etc.) is extracted to
  a pure `buildPinnedIframeUrl` — same move as PR-B's `forkDestination` and D1's `pinnedIframeFsId`.
  The async path's *output* is what matters, and a pure function makes it assertable: right fsId
  pinned, params intact, versioned URL never overridden.
