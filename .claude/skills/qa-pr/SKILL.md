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

## Read these first

1. [`references/sop-v0.01m.md`](references/sop-v0.01m.md) — the spine, the disciplines, the output structure. Source of truth.
2. [`references/chrome-mcp-rules.md`](references/chrome-mcp-rules.md) — read-only tools first, `vibes.diy/...` URLs only, clean-profile check, link safety.
3. [`references/demo-prompts.md`](references/demo-prompts.md) — pick one row for this run.

After reading those, follow the steps below in order.

## Step 1 — Preflight

Verify the operator's environment can complete a run before starting one. Each check below must pass; if any fail, stop and tell the operator what to do.

- `gh --version` — `gh` is installed and authenticated.
- `node --version` — Node is available.
- `test -f "${QA_GMAIL_CREDENTIALS:-$HOME/.config/vibes-qa/gmail-credentials.json}"` — Gmail credentials exist. If missing, instruct the operator to run `node .claude/skills/qa-pr/scripts/setup-gmail.mjs` and stop.
- Parse the credentials JSON and confirm the `email` field is present. If missing, instruct the operator to re-run `setup-gmail.mjs` (older versions didn't capture it) and stop. The email's domain should be `vibes.diy` or `fireproof.storage` (the two domains on the team Workspace) — if it's anything else, abort: the wrong account is authorized.
- `gh pr view <N> --json url,headRefOid,statusCheckRollup` — PR exists; extract the head commit SHA and locate the preview-URL deployment check (look for entries in `statusCheckRollup` whose `name` matches `*pr-preview*` and whose `targetUrl` is a `vibes.diy` URL). If no preview URL is ready, poll every 30 seconds for up to 10 minutes; if still not ready, abort with a clear message — do not post anything.
- Read [`references/chrome-mcp-rules.md`](references/chrome-mcp-rules.md) and confirm via `evaluate_script` of `document.cookie` on the preview URL that the browser profile is clean (no `__session` or `vibes.diy` cookies). If the profile is dirty, abort and ask the operator to restart chrome-devtools MCP.

## Step 2 — Run setup

- Derive `run_id = pr-{N}-{YYYYMMDD-HHmm}` from the current UTC time.
- Extract the operator's handle as the local part of the `email` field in gmail-credentials.json. Example: `marcus@vibes.diy` → handle = `marcus`; `marcus@fireproof.storage` → handle = `marcus`.
- Derive the plus-alias on the `vibes.diy` domain regardless of which Workspace alias domain Google reports as canonical: `<handle>+test-{run_id}@vibes.diy`. Example: for the `marcus` handle on PR 1714, `marcus+test-pr-1714-20260518-1543@vibes.diy`. The mail lands in the operator's Workspace inbox via standard plus-aliasing.
- Create `qa-reports/{run_id}/` (mkdir -p; do not commit).
- Copy [`assets/triage-template.md`](assets/triage-template.md) to `qa-reports/{run_id}/triage.md`. This is the working file. Edit it incrementally as the run proceeds, filling in placeholders.
- Append a line to `qa-reports/aliases.jsonl` (create if needed) of the form `{"run_id":"...","alias":"...","pr":N,"started_at":"..."}`.

## Step 3 — Capture environment

Open the preview URL via `mcp__chrome-devtools__navigate_page` (new page). Without signing in, navigate to whatever route exposes the Settings page model defaults (typically `/settings` after sign-in, but model identifiers may also be visible on the homepage build form pre-auth). Record the **default Chat Model** and **default App Model** identifiers into the triage's `models_in_play` section.

If a degraded-upstream banner is visible, record it under `notable_conditions`.

## Step 4 — The spine

Walk the seven steps from [`references/sop-v0.01m.md`](references/sop-v0.01m.md), in order. The summary below is operational orchestration only — the SOP file is source of truth for *what to watch for* at each step.

1. **Sign-up from cold link.** Type a prompt into the homepage form *before* signing in (note whether it gets eaten). Click sign-up. When Clerk prompts for an OTP, call `node .claude/skills/qa-pr/scripts/gmail-otp.mjs <alias>` via Bash with a 60-second timeout, then enter the returned code. Note which auth tab a brand-new user lands on.
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
- **Use `vibes.diy/...` URLs, never `cli-v2.vibesdiy.net/...` directly.** Stable-entry routing depends on `vibes.diy`-host cookies; see [`references/chrome-mcp-rules.md`](references/chrome-mcp-rules.md).
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
- **Sign-up OTP times out.** `gmail-otp.mjs` exits 2 with `TIMEOUT`. Set `pr_verdict = "fail"`, file a single P0 finding ("Cold sign-up flow blocked: OTP did not arrive in 60s"), fill in the triage as far as it got, and post it. The signal that sign-up failed at all is itself a real QA finding.
- **Generation never completes (>5 min on step 2).** File a P0 finding, mark steps 3–7 as `unreached` in `path_not_tested`, post the partial triage.
- **Model degraded mid-run** (visible banner, 5xx response from model). Record under `notable_conditions` and continue (matches SOP discipline).
- **chrome-devtools MCP crashes or returns persistent tool errors.** Stop. Surface the error to the operator. Do *not* post a partial triage — the data is not trustworthy.

## Cleanup notes

- The `qa-reports/{run_id}/` directory stays on the operator's machine. It is gitignored.
- The Vibes account, projects, published apps, and remix created during the run are **not** auto-deleted. Accept the clutter for v1; cleanup tooling is tracked as a follow-up.
- The aliases log at `qa-reports/aliases.jsonl` is the single source of truth for which Clerk identities the QA skill has created. Future cleanup tooling will read from it.
