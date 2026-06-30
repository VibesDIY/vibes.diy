# The on-ramp was already built — it just didn't know it

Source: `claude/cached-suggestion-read-lane-0o0nf8` (#2941, design spec) — how the
touch-first Instant Starter Stack (#1896) gets built on the cached-suggestion infra
that just went live in prod (#2928). The surprising conclusion of the brainstorm:
almost none of it is new code.

- **Two product threads, designed years apart, turn out to be the same thing.** The
  on-ramp ("land in a live app, tap a curated chip, *boom* it changed") was specced
  against a bespoke "`<500ms` cached-swap mechanism" that nobody ever built. The
  cached-suggestion read lane was specced as infra with no product attached. Held
  next to each other, the swap *is* the read lane plus one cross-slug navigation.
  The whole spec is mostly deleting an imagined mechanism and pointing at a real one.

- **"We need both" = two lanes that already differ in the code.** A curated *spine*
  jump (`bloom-root → bloom-machine`) is cross-slug navigation to another hand-tuned
  public vibe; the *emergent* lane is the same-slug #2928 stay that warms naturally
  as owners run and bless chips. The hand-tuned skeleton is authored; the in-app
  instant transforms fall out of usage. Neither replaces the other.

- **The decisive constraint came from one code fact.** Chips come from
  `getVibeChips`, which peels trailing `▸` lines off the latest chat turn. A
  `vibes-diy push`-ed hand-tuned vibe has a turn but no `▸` lines — so the existing
  Blooms render *zero* chips. That single fact is why the design needs **synthetic
  seed chats**: fabricate the chat turn whose narration carries the curated chips,
  and they flow through the unmodified pipeline. The chip text is generated *from*
  the curated graph so it can't drift.

- **"New namespace is appropriate" reframed the shield.** The #2928 shield promised
  "stay here — same namespace, no fork." A curated jump lands in a *different* slug,
  so strictly it's not a stay. Rather than invent a second-class affordance, jchris's
  call was that a new namespace is *fine* here (the destination is a curated public
  app; an on-ramp visitor has no data to carry yet) — so the shield's *meaning*
  broadens to "instant · curated · no codegen · no login," and both lanes share it.

- **Don't gate on the handle.** The starters live under a handle literally named
  `system`, but it's an ordinary handle, illustrative only — some starters may come
  from elsewhere. The curated graph stores whatever owner/slug each vibe has; nothing
  branches on "is the owner `system`." The temptation to make `system` special is the
  thing to resist.

The net new surface: a checked-in curated graph (the `FeaturedVibes` pattern), seed
chats generated from it, one pre-check branch in `handleEditPrompt`, and the `/start`
route. Everything else — read lane, bless, shield, fork — is untouched.
