# Making the in-card share toggle real: persist publicAccess without opening the modal it replaces

Source: #2679 (verb-collapse, first slice), #2680 (share panel), #2718 (handle-picker precedent)

The agent-in-vibe Share view shipped with a working-looking Public / "people you
approve" toggle — but `onChangeAccess={() => shareModal.open()}` just popped the
*legacy* modal it's meant to replace, and the displayed state came from the
loader's read-only `isWorldReadable` hint, not the real setting. So neither the
read nor the write was wired. This slice made it real.

Decisions worth a full post:

- **Slice the epic issue, don't swallow it.** #2679 ("verb collapse") bundles four
  workstreams (chrome deletion, access-setting persistence, the #1856 inline
  message, viewer-mode indicators). The smallest, highest-leverage first cut is
  *just* the access-toggle write — it's self-contained, removes a live stub, and
  unblocks #2680's panel. The broad/risky chrome-deletion slice keeps its design
  gate. "Mostly deletion" issues still deserve to be cut into reviewable pieces.
- **Centralize the write in the hook that already owns app-settings, not the route.**
  The canonical `publicAccess.enable` write already lived in
  `useSharingPanel.togglePublicAccess`; rather than add a *third* code path in the
  route, the toggle goes through `useShareModal` (the hook the route already uses)
  via a new `handleSetPublicAccess` + exposed `publicAccessEnabled`. One axis only —
  `request`/auto-accept (auto-join) is deliberately untouched (that's manage-flow,
  #2680).
- **A flag that opens an existing fetch to a second surface — without a new
  pageview cost.** `useShareModal` gated its settings fetch on the legacy modal's
  `isOpen`. Adding `shareViewActive` lets the in-card view load the same settings
  on demand, while the eager mount fetch (which only ever called `getAppByFsId`,
  never settings) stays unchanged — so anonymous pageviews pay nothing; settings
  load only when a Share surface is actually shown. A test asserts the
  no-load-when-inactive contract so it can't silently regress.
- **State sourcing is the real design, not the write.** The toggle needs an
  authoritative, updatable source. `shareAccess` now reads the persisted
  `publicAccessEnabled` once `settingsLoaded`, falling back to the `isWorldReadable`
  hint until then — so the value *sharpens* into place rather than flashing.
- **Optimistic + rollback, mirroring #2718's handle switch.** Flip immediately,
  revert + toast on `isErr()`. But unlike the handle switch, **no iframe `whoAmI`
  refresh**: changing public access affects *other* viewers, not the owner's own
  access, so there's nothing to re-resolve for the actor. Knowing when *not* to
  copy the previous pattern matters as much as reusing it.

Gotcha for the next slice: the displayed access is now authoritative from settings,
but the loader's `isWorldReadable` only updates on navigation — fine here because
the toggle's state is local, but anything that keys off the loader hint elsewhere
will lag a publish/visibility change until reload.
