# Reconciling a "living plan" before declaring an epic done

Source: `claude/agent-vibe-remaining-work-jjujx2` — housekeeping pass on the
agent-in-vibe epic (#2675), driven by the restated-remaining-work issue #2796

The agent-in-vibe epic shipped most of its surface as incremental merges off
`main` (unified card, in-place generation, seamless non-owner fork, handle
picker, verb collapse, share read-side). What was left was a mix of three very
different kinds of "not done," and the interesting part is that they want
different handling:

- **Landed-but-untracked-as-landed.** #2676 and #2678 were closed/merged, but
  their checkboxes in the parent epic #2675 were still empty and the source-of-
  truth note (`notes/2026-06-26-agent-in-vibe-ux-epic.md` §0) still listed the
  handle picker under "Deferred." Pure bookkeeping drift — safe to fix, and worth
  fixing because a stale status section quietly misrepresents what's real.
- **Genuinely deferred-and-tracked.** #2677 polish, #2679 publish-intent
  persistence, #2680 manage flow — partially shipped, remainder has an issue. Just
  needs the note to point at reality.
- **Needs a human decision / design pass — do NOT autonomously implement.** The
  headline "retire `/chat`" (#2518) is *unblocked* now (#2517 closed, #2714
  shipped) but its own plan doc is explicit: "Status: design-level… run
  `brainstorming` then `writing-plans`," with four open product decisions
  (URL strategy, 301/302 + analytics preservation, the img-gen heavy/light split
  whose spec isn't written, `vibesMsgEvento` retirement). And the cached-read chip
  lane had no issue at all and needs a build-vs-drop call.

Worth a note:

- **"Unblocked" ≠ "ready to implement."** A blocker closing makes a task
  *actionable*; it doesn't resolve the design decisions that were always going to
  be human-owned. Conflating the two is how an agent barrels into a behavior-
  changing redirect/route deletion that product hadn't signed off on. The repo's
  own scope guidance — small non-controversial fixes go straight to a PR; broad/
  behavior-changing work flags the human first — is exactly the right filter here.
- **A "living plan" note is only useful if its status section is true.** The
  cheapest high-value thing in a close-out pass is reconciling the delivery-status
  block to what actually merged, and re-pointing every "untracked" gap at the issue
  that now tracks it (here: the cached-read lane → #2796). Drift in the source of
  truth is more expensive than it looks — it's what makes the *next* person
  re-investigate from scratch.
- **Separate the three buckets explicitly.** Bundling "done but unticked,"
  "deferred-tracked," and "needs-a-decision" into one "remaining work" blob hides
  the one item that actually needs a human (the decision) behind a pile of items
  that just need a checkbox.
