# "Wired but not triggered" — the cheapest way to de-risk a big deletion

Source: `claude/agent-vibe-remaining-work-jjujx2` — spike toward retiring `/chat`
(#2518): route the new-vibe-from-prompt entry to `/vibe` instead of `/chat`

Retiring `/chat` (#2518) is the headline of the agent-in-vibe epic and reads like
a big scary route deletion. Before designing the whole thing, the highest-value
move was a one-question spike: **is first-build-from-a-prompt already functional
on `/vibe`, just not reachable?** If yes, you can flip the entry, watch it run on
a preview, and let the live behavior inform every remaining decision instead of
arguing about them on paper.

The trace said: yes, wired-but-not-triggered. `useInVibeGeneration` already
initializes from `hasCode: false` and drives stream → hot-swap → de-blur in place;
`/vibe` already has a `?prompt64` auto-fire. The *only* gap was sequencing — the
auto-fire is gated on `isOwner`, which needs the vibe/slug to exist in the DB, and
today only `/chat/prompt`'s `openChat()` mints that slug before handing off to
`/chat`. So the spike is tiny: keep the slug-minting in the existing auth-gated
prompt entry, but navigate to `/vibe/$o/$s?prompt64=…` and let `/vibe` own the
first generation (don't fire on the chat plane, or you double-generate).

Worth a note:

- **A spike is a question, not a feature.** The point isn't to ship the new entry
  flow — it's to make the already-built first-gen path *observable* so the human
  can decide the rest of #2518 (URL strategy, what happens to the IDE-grade
  surface, redirects) against something real. Hold the merge; the preview is the
  deliverable.
- **Know who fires the generation.** Two plausible handoffs look identical on a
  diagram but differ sharply: mint-and-fire-on-`/chat`-then-show-`/vibe` leaves the
  stream on the wrong session; mint-then-let-`/vibe`-fire renders the first-gen
  stream on the destination. The second is the one that demos the thing you're
  actually trying to see.
- **Most of the backend scare was already paid down.** #2714 (3→1 DO collapse) +
  lazy `chatApi` mean "retire `/chat`" is now a frontend/product question, not a
  connection-architecture one — which is exactly why a frontend spike, not a
  backend design doc, is the right next step.
