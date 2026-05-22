---
name: qa-pr
description: Run an agent-driven QA pass against a PR preview URL using the kmikeym v0.01m SOP. Drives chrome-devtools MCP through cold sign-up, first prompt, in-app exploration, edit/theme change, publish, live URL test, and remix the way a first-time user would. Writes a P0/P1/P2 triage with cross-cutting patterns and posts it as a PR comment. Trigger this whenever the user wants to QA a PR, validate a preview deploy, walk a preview URL, do a pre-merge browser review, or asks for an SOP-style QA pass — even if they don't explicitly say "qa-pr".
---

# /qa-pr — agent-driven QA pass against a PR preview URL

This skill walks the [QA v0.01m SOP](references/sop-v0.01m.md) against a PR's preview URL using only the `mcp__chrome-devtools__*` toolkit. It captures friction the way a first-time user would, writes a [P0/P1/P2 triage](assets/triage-template.md), and posts it as a comment on the PR.

The skill is invoked as `/qa-pr <PR-number>` (for example, `/qa-pr 1714`).

## Authorization

This skill is explicitly authorized to perform exactly **one** GitHub write operation: `gh pr comment <PR-number> --body-file <triage>` against the PR passed as the argument. No confirmation prompt is required for that single command.

The skill is **not** authorized to: open issues, edit PR titles or descriptions, request review, merge, push commits, comment on other PRs, or perform any other GitHub write. If any of those would help, surface the suggestion in the triage body — do not act on it.

## Sign-in model (v0.3 design note)

The original v0.01m SOP from @kmikeym uses **a fresh email address per pass** for cold-account discipline. That assumption was invalidated on 2026-05-21 when a dry-run discovered Vibes' Clerk configuration is OAuth-only — no email sign-up form is exposed.

This skill therefore signs in as **the operator's existing Vibes identity via Google OAuth**, not as a fresh email account. To keep as much of the SOP's "fresh state per run" discipline as possible:

- **The browser profile is still cold every run** (chrome-devtools MCP launches a clean Chrome with no Vibes/Clerk session cookies — verified in preflight).
- **A fresh project is started every run** (after sign-in, the agent clicks "New Vibe" before doing anything else, so prior projects in the operator's account don't pollute the test).

What's **lost** vs the original SOP: the sign-up flow itself is no longer QA'd by this skill (since we sign in as an existing user). That surface needs separate manual QA passes whenever the auth flow changes.

What's **preserved**: steps 2–7 of the spine (first-prompt generation, in-app exploration, edit/theme, publish, live URL, remix) — the operator runs them against a freshly-generated app in a fresh browser profile.

**Operator identity (v0.3):** the operator's email comes from `git config user.email`, not a Gmail OAuth credential. The v0.1/v0.2 Gmail-API scaffolding (a Cloud project per engineer, `setup-gmail.mjs`, `gmail-otp.mjs`) was orphaned by the OAuth-only sign-in pivot and removed in v0.3 to drop ~30 minutes of per-engineer onboarding for a capability nothing currently uses. If a future Vibes flow needs the agent to read inbox messages (publish confirmations, share invites, password reset, etc.), the Gmail-API implementation can be revived from commits `7040276b`, `c1f15cab`, `bb29c0f1`, `26a591a7` on the original `popmechanic/qa-pr-skill-design` branch — substantially faster than reimplementing.

## Read these first

1. [`references/sop-v0.01m.md`](references/sop-v0.01m.md) — the spine, the disciplines, the output structure. Source of truth.
2. [`references/chrome-mcp-rules.md`](references/chrome-mcp-rules.md) — read-only tools first, `vibes.diy/...` URLs only, clean-profile check, link safety.
3. [`references/demo-prompts.md`](references/demo-prompts.md) — pick one row for this run.

After reading those, follow the steps below in order.

## Step 1 — Preflight

Verify the operator's environment can complete a run before starting one. Each check below must pass; if any fail, stop and tell the operator what to do.

- `gh --version` — `gh` is installed and authenticated.
- `node --version` — Node is available.
- `git config user.email` — must return a non-empty address; used to identify the operator in the run log. If empty, instruct the operator to set it (`git config --global user.email "<your-address>"`) and stop. The address's domain *should* be `vibes.diy` or `fireproof.storage` (the team Workspace's domains). If it's something else, warn but do not abort — git identity and Vibes OAuth identity can legitimately differ (e.g. personal Gmail used for git but Workspace account used for Vibes); the run still completes, the warning surfaces in the triage's `notable_conditions`.
- `gh pr view <N> --json url,headRefOid,state` — confirm the PR exists, is `OPEN` (abort if `MERGED` or `CLOSED` — previews are torn down on close by `hosting-pr-cleanup.yaml`), and capture the head commit SHA.
- Locate the preview URL by fetching the PR's comments with `gh api repos/VibesDIY/vibes.diy/issues/<N>/comments` and finding the most recent comment by `github-actions[bot]` containing the marker `<!-- vibes-diy-preview -->`. Extract the `**Preview URL:**` line — the URL will be on `*.workers.dev` (Cloudflare Workers per-PR deployment), e.g. `https://pr-1795-vibes-diy-v2.jchris.workers.dev`. That `workers.dev` host is the correct target for PR-preview QA; **do not** rewrite it to `vibes.diy`.
- If no preview-URL comment exists, the deploy workflow probably hasn't finished. Poll the same `gh api ... /comments` endpoint every 30 seconds for up to 10 minutes. If still missing, abort with a clear message pointing the operator at `gh run list --branch <head-ref>` to investigate the deploy workflow — do not post anything.
- Read [`references/chrome-mcp-rules.md`](references/chrome-mcp-rules.md) and confirm via `evaluate_script` of `document.cookie` on the preview URL that the browser profile is clean (no `__session` or `vibes.diy` cookies). If the profile is dirty, abort and ask the operator to restart chrome-devtools MCP.

## Step 2 — Run setup

- Derive `run_id = pr-{N}-{YYYYMMDD-HHmm}` from the current UTC time.
- Read the operator's email via `git config user.email` (e.g. `marcus@vibes.diy`). Used to label the run and identify who triggered it in the run log.
- Create `qa-reports/{run_id}/` (mkdir -p; do not commit).
- Copy [`assets/triage-template.md`](assets/triage-template.md) to `qa-reports/{run_id}/triage.md`. This is the working file. Edit it incrementally as the run proceeds, filling in placeholders.
- Append a line to `qa-reports/runs.jsonl` (create if needed) of the form `{"run_id":"...","operator_email":"...","pr":N,"started_at":"..."}`.

## Step 3 — Capture environment

Open the preview URL via `mcp__chrome-devtools__navigate_page` (new page). Without signing in, navigate to whatever route exposes the Settings page model defaults (typically `/settings` after sign-in, but model identifiers may also be visible on the homepage build form pre-auth). Record the **default Chat Model** and **default App Model** identifiers into the triage's `models_in_play` section.

If a degraded-upstream banner is visible, record it under `notable_conditions`.

## Step 4 — The spine

Walk the seven steps from [`references/sop-v0.01m.md`](references/sop-v0.01m.md), in order. The summary below is operational orchestration only — the SOP file is source of truth for *what to watch for* at each step.

1. **Sign in from cold cache.** Type a prompt into the homepage form *before* signing in (note whether it gets eaten). Click submit; the page should redirect to the auth screen with the prompt preserved (`prompt64=` URL param). Note whether a brand-new visitor lands on a "Sign in" or "Sign up" tab by default — same observation as the kmikeym SOP. Click **"Sign in with Google"** and approve the OAuth consent if prompted (typically a one-click affirmation since the chrome-devtools MCP profile is on the operator's Google session). After landing back in the chat shell, **click "New Vibe"** to ensure you're starting from a fresh project, not landing on a prior session's app. See the *Sign-in model* section at the top of this file for why the skill no longer uses email + OTP.
2. **First prompt → app generation.** Use the **Build** row from [`references/demo-prompts.md`](references/demo-prompts.md). Watch the build-in-progress feedback. Watch where the user lands when generation completes.
3. **In-app exploration.** Click the generated app's core CTA. If the outcome is ambiguous (does it work or hang?), click it and wait at least 10 seconds before forming a conclusion — do not rely on the surrounding chat copy ("fully wired" claims are a known failure mode; see [#1704](https://github.com/VibesDIY/vibes.diy/issues/1704)).
4. **Follow-up edit / theme change.** Use the **Edit** row from the prompt library. Watch the chrome, watch text repaint behavior on theme switches.
5. **Publish.** Push the app live. Watch the publish state machine — does it know it's dirty? Does the Update / "Up to date" button reflect reality?
6. **Live URL test.** Open the published URL in a new tab (cold load — this matters most for font/loading PRs). Walk the published-app action bar.
7. **Remix.** Remix the published app. Use the **Remix** row from the prompt library. Try to publish the remix; confirm the live remix URL reflects the changes.

At every step, before moving on, capture: a screenshot to `qa-reports/{run_id}/`, the current console messages (filtered to `["log","warn","error"]`), any failed network requests, and a one-line state note appended to the triage's working notes.

## Step 5 — Discipline rules

These are non-negotiable. Each one names *why* — read it, then apply it.

- **Use read-only chrome-devtools tools to inspect before interacting.** Reading state before clicking surfaces errors a click would mask.
- **Reproduce before recording a finding.** LLMs hallucinate transient errors. One reload before filing kills the majority of those.
- **If a CTA's outcome is ambiguous, click it and wait.** Trust the actual behavior, not the surrounding copy. This is literally [#1704](https://github.com/VibesDIY/vibes.diy/issues/1704); the skill must not commit the exact failure the SOP is designed to catch.
- **After 3+ findings on one panel, write one cross-cutting pattern finding instead.** Volume of duplicate-shaped findings is noise, not thoroughness (kmikeym discipline #4).
- **Use whichever host the preview URL is on — do not rewrite it.** PR previews live on `*.workers.dev` (Cloudflare Workers per-PR deployments); the production stable-entry routing rule from [`agents/chrome-mcp-debug.md`](../../../agents/chrome-mcp-debug.md) (use `vibes.diy/...`, never `cli-v2.vibesdiy.net/...`) applies only when QA-ing the prod or cli envs, not PR previews. The preview URL captured in preflight is the single source of truth for this run; navigate everywhere relative to it.
- **Pick a fresh row from the prompt library every run.** Same prompt every time = testing only the happy path the product's been tuned against.

## Step 6 — Output schema

The triage's working file at `qa-reports/{run_id}/triage.md` is the agent's note-taking surface. Maintain the following structure mentally as you edit it:

```ts
type QAResult = {
  pr_number: number
  preview_url: string
  summary: string               // one paragraph; the lead of the triage (kmikeym's "Summary" section)
  pr_verdict: "pass" | "fail" | "pass-with-caveats"
  pr_verdict_reasoning: string  // one paragraph
  test_scope: {
    account_alias: string
    browser_profile: "clean-chrome-devtools-mcp"
    build_commit_sha: string
    path_tested: string[]       // bullet strings
    path_not_tested: string[]   // bullet strings; copy from the SOP "Not yet in scope" section
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
    related_existing_issues?: string[]   // gh issue numbers
  }>
  cross_cutting_patterns: Array<{
    theme: string
    findings: string[]   // titles of findings included in the theme
    suggested_root_cause: string
  }>
  recommended_fix_order: string[]  // ordered bullet list
  methodology_notes: { session_length_min: number; notable_conditions: string[] }
}
```

Keep the working file editable as you go — append findings into the relevant table as each is reproduced; revise `pr_verdict_reasoning` at the end.

## Step 7 — Render and post

When the spine is complete (or aborted under a documented failure mode):

1. Finalize all placeholders in `qa-reports/{run_id}/triage.md`. Verify by running `grep -oE '\{[A-Z0-9_]+\}' qa-reports/{run_id}/triage.md` — the output must be empty.
2. Post the comment:

```bash
gh pr comment <PR-NUMBER> --body-file qa-reports/{run_id}/triage.md
```

This is the single authorized GitHub write operation for the skill. Run it directly, without a confirmation prompt — the authorization is documented in this skill's *Authorization* section above.

3. Print the comment URL (`gh` prints it on success) and a one-line summary of the verdict to the session.

## Failure modes

- **Preview URL never ready.** Polled `gh pr view` for 10 minutes without finding a `vibes.diy` URL in `statusCheckRollup`. Abort. Do not post anything. Tell the operator the deploy workflow may have failed; point them at `gh run list --branch <ref>`.
- **OAuth sign-in fails or stalls.** Google consent returns an error, or the redirect never lands back in the Vibes app within 60 s of clicking "Sign in with Google". Set `pr_verdict = "fail"`, file a single P0 finding ("Sign-in flow blocked"), fill in the triage as far as it got, and post it. The signal that sign-in failed at all is itself a real QA finding.
- **Generation never completes (>5 min on step 2).** File a P0 finding, mark steps 3–7 as `unreached` in `path_not_tested`, post the partial triage.
- **Model degraded mid-run** (visible banner, 5xx response from model). Record under `notable_conditions` and continue (matches SOP discipline).
- **chrome-devtools MCP crashes or returns persistent tool errors.** Stop. Surface the error to the operator. Do *not* post a partial triage — the data is not trustworthy.

## Cleanup notes

- The `qa-reports/{run_id}/` directory stays on the operator's machine. It is gitignored.
- The Vibes account, projects, published apps, and remix created during the run are **not** auto-deleted. Accept the clutter for v1; cleanup tooling is tracked as a follow-up.
- The runs log at `qa-reports/runs.jsonl` records every run with its operator and PR. Future cleanup tooling reads it to delete the per-run projects created in the operator's Vibes account.
