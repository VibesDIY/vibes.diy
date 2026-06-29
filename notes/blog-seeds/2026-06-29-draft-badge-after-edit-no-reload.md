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
  the badge state was correct on mount and then frozen for the rest of the session.

- **Not every "done" signal is durable — pick the post-persist one.** The obvious trigger was the
  generation hook's `isGenerating` flipping `true→false`. But that flag is driven by
  `prompt.block-end`, which `prompt-state.ts` documents as emitted *early* — before the server's
  R2/DB persist — so the overlay drops and chips render the instant generation finishes. Re-running
  `ownerLatest` on *that* edge races the persist and can read production or the previous draft, and
  then nothing re-fires when the durable signal lands → still stale until reload (caught in review).
  The fix keys off `block.end` (the canonical `BlockEndMsg` that carries `fsRef`), surfaced from the
  hook as `persistedFsId`. Two events named almost the same thing — `prompt.block-end` (early UI
  release) vs `block.end` (post-persist convergence) — and only one is safe to resolve against.

- **Gate the re-resolve on a real edit, not history replay.** Opening the codegen chat replays past
  `block.end`s, so `persistedFsId` takes a baseline value with no edit involved. The recheck is
  gated on `hasLocalEdit` (`isFreshPersistedEdit(prev, next, hasLocalEdit)`) so that baseline
  doesn't trip a recheck — which matters because a recheck deliberately *skips* the iframe re-pin.

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
