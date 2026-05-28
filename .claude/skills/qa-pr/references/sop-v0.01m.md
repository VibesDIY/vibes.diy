# QA v0.01m — SOP for QA'ing a preview-URL PR

> Source: [VibesDIY/vibes.diy#1694, comment by @kmikeym](https://github.com/VibesDIY/vibes.diy/issues/1694#issuecomment-4434611054). The "m" is for **manual** — this SOP was written for a human-driven walkthrough. The `qa-pr` skill applies the same spine and disciplines while driving the browser through `mcp__chrome-devtools__*`.

> **Step 1 divergence (skill v0.2, 2026-05-21):** The original SOP requires "Cold account. Fresh email, never used on Vibes before." A skill dry-run on 2026-05-21 discovered Vibes' Clerk configuration is OAuth-only — no email sign-up form is exposed. The skill therefore signs in as the **operator's existing Vibes identity via Google OAuth**, and replaces the fresh-email discipline with two weaker disciplines: clean browser profile per run, and "click New Vibe before doing anything" to ensure a fresh project. The sign-up flow itself is no longer QA'd by the skill — it needs separate manual passes when auth changes. Steps 2–7 below apply as written.

> **Mobile divergence (skill, 2026-05-28):** This SOP lists mobile under "Not yet in scope" (below). The `qa-pr` skill now closes that gap: every run walks the desktop spine (Phase A) and then re-walks the same surfaces at 390×844 / iPhone 14 Pro (Phase B), so mobile-only responsive regressions are caught in the same pass. See the skill's *Step 4.5 — Phase B* section. The standalone `qa-pr-mobile` command was retired and folded into `qa-pr` on 2026-05-28.

## When to run it

- A PR has a preview deploy and the first-time-user flow could plausibly be affected (or you just want eyes on it before approving).
- Quarterly minimum even with no trigger — a first-time-user flow that drifts unwatched is a product getting quietly harder to use.
- Opportunistically: if a session meant to be something else (a demo, a video shoot) starts hitting friction, rescope it into a QA pass. When you do, **keep both deliverables** — the QA notes stand on their own.

## Setup

- **Cold account.** Fresh email, never used on Vibes. No prior projects, no saved settings, no muscle memory. You are testing the experience of someone who's never seen the product.
- **Incognito / private window**, no extensions. (For font/perf-loading PRs this matters *more*, not less — the failure modes those PRs fix only show on a cold cache.)
- **Note what's in play** at the start: default Chat Model + App Model, and whether either upstream is degraded that day. (A transient outage mid-pass is itself a finding about error UX.)
- **Screenshot every friction point.** Minimum one per issue.

## The spine — the walkthrough

Run the whole chain on the preview URL. Don't skip ahead; bugs cluster at the seams between steps.

1. **Sign-up** from a cold link. Watch what happens to a prompt typed *before* login (it shouldn't get eaten). Watch which auth tab a brand-new user lands on.
2. **First prompt → app generation.** Use a real-feeling goal (see prompt library below). Watch the build-in-progress feedback, and where the user lands when it finishes.
3. **In-app exploration.** Actually use the generated app the way a user would. Does the core CTA work, or does the agent claim it's "fully wired" while something hangs?
4. **Follow-up edit / theme change.** Ask for a substantial change — a full reskin and/or pick 2-3 named themes. Watch the chrome hold up; watch text repaint behavior on each switch (relevant to any font/loading PR).
5. **Publish.** Push it live. Watch the publish state machine: does it know it's dirty? Does the Update / "Up to date" button reflect reality?
6. **Live URL test.** Open the published URL fresh in a new tab (cold load — strict test for any loading/font change). Does the deployed app behave like the editor preview? Walk the published-app action bar.
7. **Remix.** Remix your own published app. Add a seed-data / "fill in some examples" prompt; watch how the AI interprets an ambiguous request. Then try to publish the remix and confirm the live remix URL actually reflects your changes.

**Not yet in scope** (v0.01m gap): Data tab, accessibility, mobile, multi-user concurrent edit, low-bandwidth, BYO API key flow, paid features.

## The disciplines (not optional)

1. **The walkthrough drives the issues, not the other way around.** No pre-decided pass/fail boxes. Real user goals create the friction; you file what you hit.
2. **Reproduce before filing.** Every bug at least once, ideally more.
3. **Retest the other path before naming a bug.** If you scope something narrowly ("editors role fails"), retest the alternate case (readers, the unpublished case, the already-published case) before writing it up.
4. **Stop logging individual findings once they stop adding signal.** By the seventh broken button on one panel, the eighth isn't news — wrap the cluster with one summary finding and move on. Volume of duplicate-shaped findings is noise, not thoroughness.
5. **File / comment as you go**, not in a batch at the end. Triage each P0/P1/P2 in your head as you file it. And if the PR is narrow (e.g. a font change), keep the PR-thread verdict scoped to *that change* — route unrelated pre-existing bugs to their own issues rather than dumping them on the PR.

## The output

A short writeup, structured roughly:

- **Summary** — what flow, what was tested, headline verdict, which bug(s) block the most.
- **Test scope** — account, browser, build, path tested, path NOT tested, models used.
- **PR verdict** (if it's a PR-scoped pass) — pass/fail on *this PR's change*, plus any caveats for the author.
- **Findings, triaged P0 / P1 / P2** — issue link, one-line description, "why it matters."
- **Cross-cutting patterns** — group symptoms by shared root cause; engineering fixes themes cheaper than individual tickets.
- **Recommended action / fix order** — biggest unlock per dollar first.
- **Methodology notes** — session length, that the walkthrough drove the findings, repro discipline, anything odd about the day.

## Demo prompt library

Pick a fresh, real-feeling goal each pass (same prompts every time = testing the happy path the product's been tuned against). Known-good fallbacks live in [`demo-prompts.md`](demo-prompts.md).

## v0.02 roadmap

- **Regression checklist** — re-verify a prior pass's filed issues explicitly. v0.01m has no memory of "did #X actually get fixed".
- **Scope expansion** — Data tab, mobile, BYO API key flow, paid features, concurrent edit, accessibility, low-bandwidth.
- **First non-`m` version** — some automation. The [`qa-pr`](../SKILL.md) skill is the start of that work, scoped to "agent walks the spine and writes a triage."
- **Cadence** — put the quarterly pass on a shared calendar so it's a real milestone, not a "should."
