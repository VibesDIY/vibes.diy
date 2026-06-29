# The Bot Shepherd: 270 PRs in 17 Days, and Why Going Fast Was the Safe Choice

*A founder's-eye view of what high-velocity shipping actually looks like up close — and why
the speed was the safety mechanism, not the thing we traded against it.*

---

## The number that started this

I pulled the git stats for our last sprint — June 12 to June 29, seventeen days — expecting a
churn total and a vague sense of "we did a lot." Here's what came back:

- **270 pull requests merged**
- **~223,000 lines of churn** (+168,886 / −54,086) across 2,650 file-changes
- **median PR: 196 lines, 5 files**
- **median time-to-merge: 0.8 hours** — 80% merged in under six hours, 95% within a day
- **95% of PRs were agent-authored**; I personally merged 261 of them
- a steady ~16 PRs/day, peaking at **47 merged on June 28**

If you're an indie builder, the instinct when you see "270 PRs, one reviewer" is to flinch.
That's the rubber-stamp zone. That's where quality goes to die and prod goes down on a Friday.

Except it didn't. And when I went looking for *why*, the answer flipped my mental model:
**we weren't fast despite being careful. We were careful by being fast.**

## High velocity is a slicing problem

Look again at that median: **196 lines.** The *mean* PR was 826 lines — more than four times
bigger — which tells you the average is a lie. A handful of giant PRs drag it up: the top 10 PRs
account for **53% of all churn**, the top 20 for **63%**. And those giants aren't features —
they're a CI prettier-format split (59k lines, mechanical), a vendored-skills import (18k), a
dead-code prune (5.9k). Obvious, low-judgment sweeps you can review by skimming the *shape* of
the diff.

Strip those out and the real texture appears:

| PR size (churn) | share |
|---|---|
| ≤50 lines | 19% |
| 51–200 | 32% |
| 201–500 | 20% |
| 501–1,000 | 13% |
| >1,000 | 16% |

**Half of every PR was 200 lines or fewer. Seventy percent were under 500.** A 200-line diff is
something one person can hold in their head, reason about completely, and *revert without
ceremony* if it misbehaves. That's the whole game.

And the speed tracks the size, cleanly:

| PR size | median time-to-merge | merged same-day |
|---|---|---|
| ≤50 lines | 0.4h | 82% |
| 51–200 | 0.7h | 83% |
| 201–500 | 0.7h | 80% |
| 501–1,000 | 1.2h | 89% |
| >1,000 | 2.8h | **64%** |

The big PRs are the *only* bucket where same-day merge rate falls off a cliff. Size is where
latency lives, and latency is where risk lives. Small isn't just faster — small is the thing
that *keeps review real* instead of theater.

The decomposition shows up in the titles, too: **18% literally say *slice*, *phase*, *step*, or
*bucket*; 29% reference a parent issue or PR.** Big work didn't arrive as a big-bang. It arrived
as a chain.

## The human element isn't gatekeeping. It's shepherding.

Here's the part I want indie builders to sit with, because it reframes what your job becomes
when agents write 95% of the code.

I'm not the gatekeeper. A gatekeeper stands at a door saying yes or no, line by line, trying to
out-read the machine. That doesn't scale to 47 merges a day and it's not where a human adds
value anyway.

I'm the **shepherd**. I choose *where we go* — which migration is worth starting, which corner
of the product to push on next. And, just as much, I choose **how carefully we tread** — and
that caution dial gets *set per-PR, by risk and reward.* The agents are extraordinary at
producing correct, tested, well-scoped slices. What they can't do is decide how much it would
hurt if this particular slice were wrong in prod. That judgment is mine, and it's almost the
entire job.

The best illustration is four PRs from the same migration, same week, with the dial set to four
different places:

- **#2827 — sidebar links point at the `/vibe` route.** Blast radius: a URL string prefix
  (`/chat/...` → `/vibe/...`). Reward: every "My Apps" tap now opens the running app instead of
  the editor. I shipped it **hot, no flag, merged 25 minutes after it opened.** Dial: wide open.
- **#2837 — a brand-new vibe builds *in place* on `/vibe`** instead of bouncing to `/chat`.
  Higher stakes (it's the first-run experience for every new app), so: shipped **on**, but only
  after an end-to-end run on the preview deploy and a fix for a P1 a reviewer caught (a
  brand-new vibe has no database row yet, so the route latched "App not available"). Dial:
  open, with a verification gate.
- **#2835 — server-side rendering for vibes.** Genuinely risky surface. It landed **dormant
  behind a flag, with production explicitly `off`** — fully built, fully tested, shipped *dark*.
  And the PR was *spec-first*: a design doc opened for review **before any code**. Dial: nearly
  closed.
- **#2494 — moving doc operations onto a new connection plane.** This one carried a hold I wrote
  by hand: *"⚠️ Do not merge until after the next prod deploy of `main`... land the current main
  to prod first (clean baseline), then merge this so the change deploys in isolation and any
  regression is unambiguously attributable."* Dial: closed, sequenced deliberately so that if
  something broke, there'd be exactly one suspect.

Same shepherd. Same migration. Four completely different levels of caution — each one a
deliberate read of "what does it cost if this is wrong?" *That's* the craft. Not typing the
code. Setting the dial.

## Three migrations that never existed as one scary PR

The thesis — *go fast to stay safe* — only earns its keep on the work that's genuinely
dangerous. Big migrations are where teams reach for the big-bang merge and a prayer. We didn't.
Here are three from the window, each delivered as a chain of revertible slices.

### 1. Retiring `/chat` for the `/vibe` route

We had two parallel route families for the same app: `/chat/...` (the editor) and `/vibe/...`
(the running app). The goal was to make `/vibe` the front door. A naive version of this is one
enormous PR that reroutes everything and holds its breath on deploy.

Instead it came as a staircase: point the sidebar links over (#2827), then route a brand-new
vibe to build in place (#2837), then the SSR groundwork behind a flag (#2835) — each step
keeping `/chat` fully alive as a fallback. The migration was *always shippable*, because no
single slice removed the old path until the new one was proven.

### 2. De-fireproofing identity

The deepest, scariest work of the sprint: untangling our identity and device-credential layer
from an embedded dependency. Auth migrations are the canonical "touch it wrong and everyone gets
logged out" nightmare.

It moved in *buckets and phases* — collapse three session services into one
(#2714), lift the device-id keybag in-repo and drop the external dependency (#2735), tighten
cert verification to check the signing authority and not just the name (#2671), route imports
through a clean seam one module at a time. One slice's whole job was *triage*: of ~90 call sites
that supposedly needed changing, ~80 turned out to be test harnesses and only **two** real ones
actually fit the narrower contract — so we narrowed those two and *wrote down why the rest
couldn't be*, turning "fix the other 88" from a risky barrel-ahead into a scoped follow-up.
That's velocity buying safety again: a thin, correct Phase 1 beats a heroic, fragile rewrite.

### 3. The eval harnesses

The least glamorous and quietly most important: we built the measurement infrastructure that
lets us change prompts and swap models on *evidence* instead of vibes. A cross-model codegen
eval (#2542), a two-mode harness that separates one-shot from agentic performance (#2638), an
autoresearch loop that iterates against a metric and keeps or discards changes automatically
(#2596), and a model-access eval (#2621).

Why does this belong in a *safety* story? Because the single highest-risk change you can make to
an AI product is to its prompts — and before this, that change was a guess. The eval harnesses
turn "I think this prompt is better" into a number. They're the dial's instrument panel.

## What this means if you're building solo (or nearly)

You don't need 270 PRs or a team of agents to use this. The mechanism is portable:

1. **Make slices independently shippable.** The `/vibe` migration kept `/chat` alive. Doc-plane
   changes shipped with a `vibeApi ?? chatApi` fallback. Risky features land flag-off. If a
   slice can't ship on its own without breaking prod, it's not a slice — it's a time bomb with
   extra steps.
2. **Set the caution dial per-change, not per-project.** A string-prefix change and an auth
   migration do not deserve the same process. Matching ceremony to blast radius is most of the
   skill. Ship the cheap-to-revert stuff hot; sequence and gate the expensive stuff.
3. **Prefer many small PRs to one big one — for safety, not just speed.** A 200-line diff is
   reviewable, reasoning-complete, and trivially revertible. A 2,000-line diff is hope.
4. **Build the instruments before you need the readings.** Evals, preview deploys, and
   spec-first design PRs are what let you turn the dial *down* with confidence instead of fear.

The headline number — 270 PRs in 17 days — looks like a story about speed. It isn't. It's a
story about how a stack of small, revertible, well-instrumented changes, with a human turning a
caution dial over each one, is *both* faster and safer than the careful-looking alternative of
big, rare, heavily-guarded merges. Velocity wasn't the risk. Velocity was the control.

---

*Numbers from a PR-level analysis of all 270 PRs merged into `vibesdiy/vibes.diy` between
2026-06-12 and 2026-06-29. Seed: `notes/blog-seeds/2026-06-29-low-risk-high-velocity-270-prs.md`.*
