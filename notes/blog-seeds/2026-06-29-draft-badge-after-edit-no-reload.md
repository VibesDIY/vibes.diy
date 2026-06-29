# The draft badge that only showed up after a reload

Source: branch `claude/vibe-unpublished-changes-message-lpuzso`. Follow-up to #2772 D1/D2
(owner draft read + the "Unpublished changes" badge/banner on `/vibe`).

Bug: after the owner makes an **in-place edit** on `/vibe` and it completes, the "Draft ·
unpublished" badge and the "Unpublished changes. Only you can see this draft." publish banner
didn't appear — until you reloaded the page. A reload obviously re-ran the resolver on mount and
showed them, which is exactly the tell.

Findings worth a full post:

- **An effect that resolves server truth is only as fresh as its dependency array.** The draft
  resolver (`getAppByFsId({ selectMode: "ownerLatest" })`) ran on `[isOwner, fsId, ownerHandle,
  appSlug, publishBump]`. A follow-up edit changes *none* of those — the URL stays unversioned,
  the route params are identical, and publishing is the only thing that bumps `publishBump`. So
  the badge state was correct on mount and then frozen for the rest of the session. The completion
  signal we *did* have was the generation hook's `isGenerating` flipping `true→false` at block-end.

- **Re-resolving naively would have traded the bug for a worse one: an iframe reload after every
  edit.** The badge is driven by `setDraftFsId`, and `draftFsId` is also the iframe's pinned
  `fsId` (`pinnedIframeFsId = fsId ?? draftFsId`). Flipping it from `undefined` to the new draft
  fsId changes the iframe `src` → full reload. But the in-place edit already **hot-swapped** that
  exact source into the running iframe (`pushSource`). So a re-pin would tear down a live runtime
  and reload identical code — a visible flash on every edit. The fix splits the two concerns: on a
  post-edit recheck, update the badge (`isDraft`) but **skip the re-pin**; mount/publish runs still
  pin (no hot-swap has happened there, so the iframe genuinely needs the draft URL).

- **The "is this a recheck?" bit is a render-time ref compare, not new state.** A
  `draftRecheckBump` counter is incremented on the `isGenerating` falling edge; the resolver
  compares it against a `useRef` of the last value it handled to know whether *this* run came from
  a completed edit (skip re-pin) vs. mount/publish (pin). One counter, one ref, no extra render.

- **Pure functions over the route, again.** Following the `pinnedIframeFsId` precedent, the two
  new decisions are extracted into `generationSettled(prev, now)` (the `true→false` edge) and
  `resolveOwnerDraft(res, isRecheck)` (→ `{ isDraft, pinFsId, repin }`). The heavy `/vibe` route
  isn't mounted in a unit test; the decision logic is, with a table of cases (settle edges,
  recheck-skips-repin, non-owner/error/no-fsId rejection).
