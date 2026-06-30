# The checklist that stopped one step short of merging

Source: branch `claude/issue-2707-szt9dq` (follow-up) — `agents/pr-lifecycle.md` +
`CLAUDE.md`. Docs-only, prompted by a real agent miss on PR #2954.

An agent finished a garden-variety PR (pure `call-ai/v2` library hardening + a test),
got Charlie's approval, watched CI go green, labeled it `ready-to-merge` … and then
**stopped and scheduled an hour-out check-in** waiting for a human to merge. The repo's
own guidance says the opposite: garden-variety + approved + green → the agent
rebase-merges it itself and moves on. So why did the agent stop?

The trade-off / gotcha worth a post:

- **Two documents described the same workflow with different endpoints, and the agent
  anchored on the nearer one.** The operative numbered checklist (steps 1–5 of "after
  opening the PR") and the "Ready-to-merge signal" section both *terminated* at "label
  `ready-to-merge` — the signal to the human to consider merging." The "Autonomous merge
  loop" section that says "merge it yourself for garden-variety" sat further down and
  read as a separate topic. Following the checklist top-to-bottom, you stop at the label.
  The fix wasn't new policy — it was making the checklist **carry through to the merge**:
  a step 6 ("`ready-to-merge` is a waypoint, not the finish line"), and reframing the
  signal section so the label is a true human hand-off *only* for the risky bucket.

- **A reflexive "I'll check back in an hour" is a smell that you skipped an action you
  were cleared to take.** The hour-out poll exists for transitions webhooks don't deliver
  (CI success, new pushes, merge-conflict). It is *not* a substitute for a merge you can
  do now. The docs now say that explicitly. General lesson for agent guidance: when a
  procedure has a "default action" and an "exception that holds," put the default action
  *inside the step-by-step*, not in a sibling section — agents execute the list they're
  standing in, and an endpoint that reads as "hand off to a human" will be taken at face
  value even when the very next paragraph says "actually, do it yourself."
