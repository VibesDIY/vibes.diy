# Agent-driven QA pass via `/qa-pr` skill

**Issue:** [VibesDIY/vibes.diy#1694](https://github.com/VibesDIY/vibes.diy/issues/1694)
**Date:** 2026-05-18

## Goal

Automate the manual QA v0.01m SOP ([proposed by @kmikeym in
#1694](https://github.com/VibesDIY/vibes.diy/issues/1694#issuecomment-4434611054))
as a Claude Code skill a developer invokes against a PR's preview URL. The
skill walks the seven-step spine using only the user's existing
`mcp__chrome-devtools__*` toolkit, captures friction in the kmikeym P0/P1/P2
format, and posts the triage as a PR comment.

This is **phase 1 only**. A standalone CLI / CI integration is out of scope
and tracked separately.

## Decisions captured during brainstorm

| Decision | Choice |
|---|---|
| Trigger | Manual: dev runs `/qa-pr <PR#>` in a Claude Code session |
| SOP coverage | Full spine, steps 1–7 (sign-up → in-app → edit → publish → live URL → remix) |
| Cold-account strategy | Gmail plus-aliasing against a dedicated mailbox, OTP polled via Gmail API |
| Browser driver | `mcp__chrome-devtools__*` only — no Playwright, no `claude-in-chrome` |
| Output | Triage report file + auto-posted PR comment (no confirmation prompt) |
| Issue filing | Stays manual; the skill never opens GH issues |

## Canonical location for team-shared Claude Code skills

`.claude/` is currently fully gitignored. The skill ships inside that
directory using Claude Code's native discovery path, with a narrow gitignore
carve-out so per-developer settings (`settings.local.json`, `worktrees/`)
stay ignored while team-shared skills are checked in.

### Directory convention

```
.claude/
├── settings.local.json    # gitignored (per-dev permissions)
├── worktrees/             # gitignored (per-dev)
└── skills/                # CHECKED IN — team-shared skills
    ├── README.md          # convention doc
    └── <skill-name>/
        ├── SKILL.md       # required (YAML frontmatter + body)
        ├── references/    # optional, loaded on demand
        ├── scripts/       # optional, executable helpers
        └── assets/        # optional, templates / output scaffolds
```

### `.gitignore` change

```diff
- .claude/
+ .claude/*
+ !.claude/skills/
```

The `.claude/*` form ignores the *contents* of `.claude/` while keeping the
directory tracked, which is the only pattern that allows un-ignoring
subdirectories.

### Boundary with the existing `agents/` directory

`agents/*.md` continues to hold team rules and conventions (loaded into
context by reference from [`CLAUDE.md`](../../../CLAUDE.md)). `.claude/skills/`
is for invokable, Claude-Code-discovered skills with frontmatter and
optional bundled resources. The two are deliberately distinct: `agents/`
documents *how we work*; `.claude/skills/` provides *things we invoke*.

### Onboarding

- [`.claude/skills/README.md`](../../../.claude/skills/README.md) documents
  the convention, the anatomy, naming, and how to add a new skill.
- A pointer is added to the "Agent Rules" section of
  [`CLAUDE.md`](../../../CLAUDE.md) so newcomers find it.

## `qa-pr` skill design

### Layout

```
.claude/skills/qa-pr/
├── SKILL.md
├── references/
│   ├── sop-v0.01m.md         # full SOP prose, lifted verbatim from #1694
│   ├── demo-prompts.md       # the demo prompt library
│   └── chrome-mcp-rules.md   # excerpts of agents/chrome-mcp-debug.md
├── assets/
│   └── triage-template.md    # kmikeym-format markdown the agent fills in
└── scripts/
    ├── gmail-otp.mjs         # plus-alias OTP poller (Gmail API)
    └── setup-gmail.mjs       # one-time OAuth setup
```

### Frontmatter

```yaml
---
name: qa-pr
description: Run an agent-driven QA pass against a PR preview URL using the kmikeym v0.01m SOP. Drives chrome-devtools MCP through cold sign-up, first prompt, in-app exploration, edit/theme change, publish, live URL test, and remix the way a first-time user would. Writes a P0/P1/P2 triage with cross-cutting patterns and posts it as a PR comment. Trigger this whenever the user wants to QA a PR, validate a preview deploy, walk a preview URL, do a pre-merge browser review, or asks for an SOP-style QA pass — even if they don't explicitly say "qa-pr".
---
```

The description is intentionally pushy on the *when-to-trigger* side. After
the skill is validated on a real PR, the skill-creator description
optimizer (see [skill-creator description optimization](https://github.com/anthropics/skills))
is run against eval queries to refine it.

### SKILL.md body — sections, in order

1. **Preflight.** Verify `gh`, `node`, and Gmail credentials exist. Confirm
   chrome-devtools MCP is reachable. Fetch the preview URL with
   `gh pr view <N> --json url,statusCheckRollup` and locate the
   preview-deploy URL in the status checks. Capture the PR's head commit
   SHA. Verify chrome-devtools MCP launches Chrome with a clean profile
   per session (cold-account discipline).
2. **Run setup.** `run_id = pr-{N}-{YYYYMMDD-HHmm}`; plus-alias is
   `vibes-qa+{run_id}@gmail.com`. Create `qa-reports/{run_id}/` and copy
   [`assets/triage-template.md`](.claude/skills/qa-pr/assets/triage-template.md)
   into it as the working file.
3. **Capture environment.** Open Settings on the preview, record default
   Chat Model and App Model IDs into the working file's "Test scope"
   section. Note any visible model-degradation banners.
4. **Read the SOP.** Instruct the agent to Read
   [`references/sop-v0.01m.md`](.claude/skills/qa-pr/references/sop-v0.01m.md)
   first and treat it as source-of-truth for the spine and disciplines.
5. **Spine.** Restate each of the 7 steps as one-paragraph imperative
   orchestration, pointing the agent back at the SOP for full context.
   Each step ends: *before moving on, capture screenshot, console
   messages, failed network requests, one-line state note.*
6. **Agent-specific discipline rules** — each rule includes its *why*:
   - *Use read-only chrome-devtools tools to inspect before interacting.*
     Reading state before clicking surfaces errors a click would mask.
   - *Reproduce before recording a finding.* LLMs hallucinate transient
     errors; one reload before filing kills the majority of those.
   - *If a CTA's outcome is ambiguous, click it and wait — don't trust
     surrounding copy.* This is literally
     [#1704](https://github.com/VibesDIY/vibes.diy/issues/1704); the skill
     must not commit the exact failure the SOP is designed to catch.
   - *After 3+ findings on a single panel, write one cross-cutting pattern
     finding instead.* Matches kmikeym discipline #4.
   - *Use `vibes.diy/...` URLs, never `cli-v2.vibesdiy.net/...` directly.*
     Stable-entry routing relies on `vibes.diy`-host cookies
     ([`agents/chrome-mcp-debug.md`](../../../agents/chrome-mcp-debug.md),
     [`agents/environments.md`](../../../agents/environments.md)).
   - *Pick a fresh prompt every run* from `references/demo-prompts.md` —
     reusing prompts narrows coverage to the happy path the product has
     been tuned against (kmikeym's note in the SOP).
7. **Output schema.** The agent populates a TypeScript-shaped object by
   editing the working triage file as it goes. Fields:
   ```ts
   type QAResult = {
     pr_number: number
     preview_url: string
     pr_verdict: "pass" | "fail" | "pass-with-caveats"
     pr_verdict_reasoning: string
     test_scope: {
       account_alias: string
       browser_profile: "clean-chrome-devtools-mcp"
       build_commit_sha: string
       path_tested: string[]
       path_not_tested: string[]
       models_in_play: { chat: string; app: string }
       notable_conditions: string[]
     }
     findings: Array<{
       severity: "P0" | "P1" | "P2"
       title: string
       description: string
       why_it_matters: string
       repro_steps: string[]
       screenshots: string[]   // file paths inside qa-reports/{run_id}/
       related_existing_issues?: string[]
     }>
     cross_cutting_patterns: Array<{
       theme: string
       findings: string[]
       suggested_root_cause: string
     }>
     recommended_fix_order: string[]
     methodology_notes: { session_length_min: number; notable_conditions: string[] }
   }
   ```
8. **Render & post.** Agent finalizes `qa-reports/{run_id}/triage.md` from
   the schema, then runs
   `gh pr comment {N} --body-file qa-reports/{run_id}/triage.md` directly.
   No confirmation prompt — see "Authorization" below.
9. **Failure-mode handling.** One paragraph each:
   - *Preview URL not ready:* poll `gh pr view` for up to 10 minutes.
   - *Sign-up OTP times out:* abort the run, post a triage with
     `pr_verdict = "fail"` and the abort reason as the single P0 finding.
   - *Generation never completes (>5 min):* file as P0 and continue with
     a partial run, marking remaining steps unreached.
   - *Model degraded mid-run:* record under `notable_conditions` and
     continue (matches the SOP's stated discipline).
   - *chrome-devtools MCP crashes:* surface the tool error, abort the
     run, do not post a partial triage.
10. **Cleanup.** Append the alias used to
    `qa-reports/aliases.jsonl`. v1 does not auto-wipe accounts on the
    Vibes backend — clutter is accepted; cleanup is deferred (see Open
    follow-ups).

### Authorization for autonomous PR-comment posting

The base system prompt requires explicit confirmation before "creating PRs
or issues, sending messages." This skill explicitly authorizes one narrow
exception:

- **What:** running `gh pr comment <N> --body-file <triage>` against the
  PR the dev passed as the argument.
- **What this does NOT authorize:** opening issues, editing PR titles or
  descriptions, merging, approving, requesting review, commenting on
  other PRs, pushing commits, or anything else.

The authorization is documented in `SKILL.md` body and again in
[`.claude/skills/qa-pr/SKILL.md`](.claude/skills/qa-pr/SKILL.md)'s
*Authorization* section, so it is durably visible to anyone reviewing the
skill.

### Gmail OTP helper

A dedicated Gmail mailbox (`vibes-qa@gmail.com` or team-chosen equivalent)
holds the verification emails for all QA runs.

- **One-time setup:** `node .claude/skills/qa-pr/scripts/setup-gmail.mjs`
  walks the operator through Google Cloud project creation, Gmail API
  enablement, an OAuth Desktop client, and writes a refresh token to
  `~/.config/vibes-qa/gmail-credentials.json` (per-user, never committed).
- **Per-run:** `node .claude/skills/qa-pr/scripts/gmail-otp.mjs <alias>`
  polls for messages addressed to `<alias>` from Clerk / Vibes for up to
  60 seconds and prints the OTP (or the magic-link URL) on stdout.
  Exponential backoff. Exits non-zero with a clear message on timeout.
- The skill body invokes the helper via Bash; the agent never touches
  Gmail credentials directly.

### Why no Playwright, no `claude-in-chrome`

- The team already operates Chrome through `mcp__chrome-devtools__*`
  (see [`agents/chrome-mcp-debug.md`](../../../agents/chrome-mcp-debug.md)).
  Reusing it keeps the dependency surface flat.
- The SOP author explicitly designed the manual SOP around "the
  walkthrough drives the findings, not the other way around" — a
  Playwright spine would invert that and miss the friction the SOP is
  meant to catch.
- `claude-in-chrome` runs inside the user's everyday Chrome with their
  cookies and extensions; that breaks the cold-account discipline.
- The chrome-devtools MCP server launches its own clean Chrome instance
  per session, which matches the SOP's "incognito, no extensions"
  requirement.

## Validation

Before the skill is considered ready, it must be run end-to-end against
[PR #1714](https://github.com/VibesDIY/vibes.diy/pull/1714) (the
`font-display:block` PR @kmikeym already QA'd manually) and the resulting
triage compared to the manual writeup he produced:

- The agent's `pr_verdict` should match kmikeym's verdict.
- P0 findings should overlap with kmikeym's P0 findings; new P0s from the
  agent that kmikeym did not file are a flag for review (could be real,
  could be hallucination).
- Cross-cutting patterns should identify at least one of the same themes
  kmikeym surfaced.

If the dry-run is acceptable, the skill ships. If it is not, the SOP
prose, discipline rules, or both are revised; no infrastructure changes
required.

## Out of scope

- Standalone CLI / `workflow_dispatch` / CI auto-run (deferred to a
  separate phase-2 design).
- Playwright deterministic spine (Approach C, considered and rejected
  during brainstorm).
- Auto-filing of P0/P1 findings as GitHub issues.
- Account/project/published-app cleanup on the Vibes backend.
- Coverage of: Data tab, accessibility, mobile, multi-user concurrent
  edit, low-bandwidth, BYO API key flow, paid features. (Matches the SOP's
  own "Not yet in scope" list.)

## Open follow-ups

- **Backend cleanup tooling.** Each run creates Clerk identities, Vibes
  projects, published apps, and remixes. v1 accepts the clutter. Once the
  cadence justifies it, add a `qa-reports/aliases.jsonl`-driven cleanup
  script (likely needs a Vibes admin API endpoint or DO-migration helper
  that doesn't exist today).
- **Description optimization.** Per the skill-creator skill, after the
  skill is debugged on a real PR, run the description optimizer with
  realistic eval queries to maximize triggering accuracy.
- **Regression mode.** SOP v0.02 calls for re-verifying prior passes'
  findings. The skill could grow a `--regress <issue#>` mode that
  re-walks the steps where a prior finding lived. Not in v1.
- **Phase-2 lift.** When CI / autonomous coverage is wanted, the system
  prompt + output schema + discipline rules port to a standalone
  Anthropic SDK agent loop. Most of the design above is reusable; only
  the orchestration shell changes.
