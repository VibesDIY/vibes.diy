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

- **Re-resolving naively would have traded the bug for a worse one: an iframe reload after every
  edit.** The badge is driven by `setDraftFsId`, and `draftFsId` is also the iframe's pinned
  `fsId` (`pinnedIframeFsId = fsId ?? draftFsId`). Flipping it from `undefined` to the new draft
  fsId changes the iframe `src` → full reload. But the in-place edit already **hot-swapped** that
  exact source into the running iframe (`pushSource`). So a re-pin would tear down a live runtime
  and reload identical code — a visible flash on every edit. We want the badge to update *without*
  the pin.

- **The biggest lesson: don't infer state from event *timing* when you can compare *identity*.**
  The first cut decided "skip the re-pin" from a heuristic — a `draftRecheckBump` counter bumped on
  a transition, with a `useRef` tracking whether *this* resolve came from a fresh edit. Two reviewers
  (Codex, then Charlie) kept finding races in it: a cross-vibe navigation, with the generation hook's
  `[ownerHandle, appSlug]` reset effect running *after* render, could carry stale `persistedFsId`/
  `hasLocalEdit` for one render and synthesize a bogus "fresh edit" → skip the *new* vibe's first pin.
  Every patch (gate on `hasLocalEdit`, a render-phase vibe-key guard to reset the refs) narrowed the
  window but kept the fragility. The fix that ended it was to stop inferring: **skip the re-pin iff
  the resolved draft is the same one already hot-swapped into the live iframe** — comparing identity,
  not a timing signal. The whole bump/recheck-ref/vibe-key-guard apparatus deleted; the trigger is
  just `persistedFsRef` in the resolver's dep array. Timing-independent invariants beat
  timing-sensitive heuristics every time.

- **…but "identity" means the *whole* identity, because fsId isn't unique across vibes.** The first
  cut of the identity check compared `res.fsId === persistedFsId` — and a reviewer immediately found
  the hole: storage is content-addressed, and `forkApp` inserts the new vibe's row with
  `fsId: src.fsId` (the fork *shares* the source's fsId, no copy) and seeds its `block.end` fsRef
  with that same fsId. So a source and its fork are two different vibes with the *same* fsId, and
  fsId-equality would suppress the destination's first pin when you navigate between them. The fix is
  to carry the **full vibe identity** on the hot-swap signal — `persistedFsRef` is
  `{ ownerHandle, appSlug, fsId }`, lifted straight off the `block.end` fsRef — and skip the re-pin
  only when all three match the current vibe. Lesson within the lesson: "compare identity not timing"
  is right, but make sure your identity key is actually unique for the thing you're identifying.

- **Pure functions over the route, again.** Following the `pinnedIframeFsId` precedent,
  `resolveOwnerDraft(res, hotSwapped, current)` (→ `{ isDraft, pinFsId, repin }`) holds the decision
  so the heavy `/vibe` route needn't be mounted to test it: mount pins (hotSwapped undefined), an
  in-place edit skips (same vibe + fsId), a cross-vibe nav pins even when the two vibes **share an
  fsId** (fork reuse — the regression case), publish clears (not-a-draft), and
  non-owner/error/no-fsId reject.
