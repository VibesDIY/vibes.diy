---
name: qa-pr-mobile
description: Same SOP as /qa-pr against a PR preview URL, but with chrome-devtools viewport pinned to a mobile-responsive size (iPhone 14 Pro class, 390×844) before the spine starts. Use to catch mobile-only regressions — touch targets, layout overflow, viewport scaling, font sizing at small widths — that the default desktop /qa-pr will not see. Trigger this whenever the user wants to QA a PR specifically against mobile dimensions, validate responsive behavior on a PR, asks for a mobile QA pass, or mentions mobile / responsive / small-screen QA — even if they don't explicitly type "qa-pr-mobile".
---

# /qa-pr-mobile — same SOP, mobile viewport

A **mobile-viewport variant** of [`qa-pr`](../qa-pr/SKILL.md). Everything is identical except an added viewport-resize step inserted right after preflight, and a couple of small bookkeeping deltas in the run-id and triage so a mobile pass doesn't get confused with a desktop pass of the same PR.

The original v0.01m SOP explicitly lists mobile as ["Not yet in scope"](../qa-pr/references/sop-v0.01m.md) — this skill is the smallest addition that fills that gap without rewriting the SOP.

## Invocation

```
/qa-pr-mobile <PR-number>
```

For example: `/qa-pr-mobile 1821`.

## Procedure

**Read [`../qa-pr/SKILL.md`](../qa-pr/SKILL.md) in full first.** That file is the source of truth for the SOP, the spine, the disciplines, the failure modes, the output schema, and the authorization scope. This skill *inherits* every rule from there. The only deltas are the three numbered items below.

### Delta 1 — Insert "Step 1.5 — Mobile viewport" after preflight

Immediately after Step 1 (Preflight) passes and *before* Step 2 (Run setup), call `mcp__chrome-devtools__resize_page` with these dimensions:

- **width: 390**
- **height: 844**

These are iPhone 14 / 13 / 12 Pro CSS pixel dimensions — the most common modern iOS viewport target. The viewport stays at 390×844 for the remainder of the run; **every snapshot, screenshot, click, and `evaluate_script` happens against the mobile layout**. Do not resize back to desktop mid-run; that would invalidate the discipline of "what the user sees is what gets QA'd."

If `resize_page` fails or chrome-devtools won't honor the dimensions, abort cleanly. **Do not run the spine at the default desktop viewport and silently call it a mobile pass** — that produces a misleading triage and is worse than no run.

### Delta 2 — Use a mobile-flagged `run_id`

In Step 2, derive `run_id = pr-{N}-mobile-{YYYYMMDD-HHmm}` (note the `-mobile-` infix). This keeps mobile and desktop passes of the same PR distinguishable on disk and in `qa-reports/runs.jsonl`.

### Delta 3 — Triage Summary + Test scope must flag the viewport

In the Summary section of the triage, lead with: *"Mobile QA pass at 390×844 (iPhone 14 Pro CSS pixels). Desktop coverage is out of scope; run `/qa-pr <N>` separately for desktop verdict."*

In Test scope, extend the `models_in_play` block or `notable_conditions` with: `viewport: 390×844 (iphone-14-pro)`.

The `pr_verdict` is scoped to **what mobile testing exposed about the PR's change**. If the PR's change is invisible at mobile size (e.g., a desktop-only nav tweak), say so plainly: "PR's change not exercised at mobile dimensions — verdict deferred to desktop pass."

## Why this exists

The original SOP from @kmikeym deliberately leaves mobile out of v0.01m. Real Vibes users live on mobile too. PRs that touch layout / sizing / typography frequently look fine at 1280+ wide and break at 390 — overflow, touch targets too small, fonts wrapping awkwardly, modals that don't fit. A separate skill (rather than a flag on `/qa-pr`) means engineers can run *both* the desktop and mobile pass against the same PR and get two clearly-distinguished triage comments instead of one ambiguous one.

## What's inherited unchanged from `/qa-pr`

- Preflight rules (gh, node, git config user.email, PR state, preview URL extraction, clean profile, persistent Google session) — all apply identically.
- The seven-step spine (sign in → build → in-app → edit → publish → live URL → remix) — same, just at mobile dimensions.
- The five discipline rules in Step 5 — same.
- Output schema in Step 6 — same.
- Render-and-post in Step 7, including the autonomous `gh pr comment` authorization scope — same. (The skill posts to whatever PR was passed as the argument, no other PR.)
- Step 7's Vibes sign-out cleanup — same.
- All failure modes documented in `qa-pr` apply unchanged.

## Authorization

Identical to `/qa-pr`'s authorization: **one** `gh pr comment <PR-number> --body-file <triage>` against the PR passed as the argument; nothing else. See `qa-pr` SKILL.md's *Authorization* section for the full scope and what it explicitly excludes.

## Failure modes

Inherits everything from `qa-pr` SKILL.md, plus one additional:

- **`resize_page` fails or chrome-devtools doesn't honor the dimensions.** Abort. Do not run the spine at the default viewport and call it a mobile pass.
