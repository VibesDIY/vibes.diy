---
name: qa-pr
description: Run an agent-driven QA pass against a PR preview URL using the kmikeym v0.01m SOP. Drives chrome-devtools MCP through cold sign-up, first prompt, in-app exploration, edit/theme change, publish, live URL test, and remix the way a first-time user would — and every run covers BOTH desktop (default viewport) and mobile (390×844, iPhone 14 Pro) so mobile-only regressions get caught in the same pass. Writes a P0/P1/P2 triage with cross-cutting patterns and posts it as a PR comment. Trigger this whenever the user wants to QA a PR, validate a preview deploy, walk a preview URL, do a pre-merge browser review, check responsive/mobile behavior, or asks for an SOP-style QA pass — even if they don't explicitly say "qa-pr".
---

# /qa-pr — agent-driven QA pass against a PR preview URL

This skill walks the [QA v0.01m SOP](references/sop-v0.01m.md) against a PR's preview URL using only the `mcp__chrome-devtools__*` toolkit. It captures friction the way a first-time user would, writes a [P0/P1/P2 triage](assets/triage-template.md), and posts it as a comment on the PR.

The skill is invoked as `/qa-pr <PR-number>` (for example, `/qa-pr 1714`).

**Every run tests two viewports in one pass:** a desktop functional walkthrough (Phase A, default viewport) followed by a mobile responsive re-walk (Phase B, 390×844 — iPhone 14 Pro CSS pixels) against the same generated app. Functional behavior is viewport-independent, so it's exercised once at desktop; layout/responsive behavior is checked at both. One triage comment reports both, with each finding tagged by the viewport it surfaced at. There is no separate mobile command — this is it.

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

## First-run setup (once per machine)

Before the skill can complete a run, the operator's machine needs a handful of tools and accounts in place. Most engineers working in this repo already have all of them; this checklist exists so the *first* run fails loudly with a fix instead of stalling halfway. The skill's Step 1 preflight verifies each of these automatically and tells you exactly what's missing — this section is the human-readable version of what it checks and how to satisfy each item.

1. **Google Chrome** — `chrome-devtools-mcp` drives a real Chrome (not Chromium). Install it from <https://www.google.com/chrome/> if `open -Ra "Google Chrome"` errors.
2. **Node.js** — needed to run the MCP server via `npx`. Any recent LTS is fine (`node --version`).
3. **GitHub CLI, authenticated** — `gh --version` and `gh auth status`. The skill reads PR metadata and posts the triage comment through `gh`. Run `gh auth login` if not authenticated.
4. **chrome-devtools MCP server** — provisioned for you by the repo's root [`.mcp.json`](../../../.mcp.json), which declares the `chrome-devtools` server (`npx -y chrome-devtools-mcp@latest`). When you open this repo in Claude Code, you'll be prompted to approve the project's MCP servers on repo-trust; approve it (or run `/mcp` and enable `chrome-devtools`), then the `mcp__chrome-devtools__*` tools appear in the tool list. If those tools are absent, the skill cannot drive a browser — Step 1 preflight catches this first.
5. **A clone of this repo** — the skill is project-scoped (auto-discovered under `.claude/skills/` when Claude Code runs inside a clone of `vibes.diy`). Nothing to install beyond cloning; see [`README.md` › Distribution & upgrade path](../README.md).
6. **git email set** — `git config user.email` must return a non-empty address; it labels the run in `qa-reports/runs.jsonl`. Ideally a `@vibes.diy` / `@fireproof.storage` Workspace address, but a personal address only triggers a warning, not an abort (see Step 1).
7. **A Vibes account** — the skill signs in as *your existing* Vibes identity via Google OAuth; it does **not** create accounts. If you've never signed into vibes.diy, do that once in a normal browser first.
8. **Google session seeded into the chrome-devtools profile** — the one genuinely non-obvious step. See *Per-engineer one-time setup* immediately below; without it the Step 4.1 OAuth sign-in stalls on a password prompt the agent can't complete.

## Per-engineer one-time setup (Google session in chrome-devtools profile)

`chrome-devtools-mcp` launches Chrome against a persistent user-data-dir at `~/.cache/chrome-devtools-mcp/chrome-profile/` by default (verified with `npx chrome-devtools-mcp@latest --help`). The profile persists cookies, including Google sessions, across runs.

For the OAuth sign-in in Step 4.1 to be a **one-click "Continue as &lt;you&gt;"** instead of a full email + password + 2FA round-trip, each engineer signs into Google **once** against that profile:

1. Quit any Claude Code session whose tool list includes `mcp__chrome-devtools__*` (Chrome refuses to launch against a locked user-data-dir).
2. From a terminal, launch Chrome against the profile:
   ```bash
   open -a "Google Chrome" --args \
     --user-data-dir="$HOME/.cache/chrome-devtools-mcp/chrome-profile" \
     --no-first-run --no-default-browser-check
   ```
3. In the launched Chrome window, sign in to Google as your `@vibes.diy` (or `@fireproof.storage`) Workspace account. Optionally visit <https://accounts.google.com> to confirm.
4. **Do not** visit `vibes.diy` or any `*.workers.dev` Vibes preview in this Chrome window — that would seed Vibes/Clerk cookies the skill expects to be absent at preflight.
5. Cmd-Q to fully quit Chrome.
6. Done. Next chrome-devtools MCP launch reuses this profile with the Google session intact.

If you ever need to redo the setup (e.g. you accidentally signed into the wrong Google account, or the profile got polluted), wipe it first:

```bash
rm -rf "$HOME/.cache/chrome-devtools-mcp/chrome-profile"
```

Then repeat steps 1–6.

## Read these first

1. [`references/sop-v0.01m.md`](references/sop-v0.01m.md) — the spine, the disciplines, the output structure. Source of truth.
2. [`references/chrome-mcp-rules.md`](references/chrome-mcp-rules.md) — read-only tools first, `vibes.diy/...` URLs only, clean-profile check, link safety.
3. [`references/demo-prompts.md`](references/demo-prompts.md) — pick one row for this run.

After reading those, follow the steps below in order.

## Step 1 — Preflight

Verify the operator's environment can complete a run before starting one. Each check below must pass; if any fail, stop and tell the operator what to do (the *First-run setup* section above is the fix-it reference for the environment checks). Run the environment checks in the order listed — the MCP-availability check comes first because nothing else matters if the agent can't drive a browser.

- **chrome-devtools MCP available** — confirm `mcp__chrome-devtools__*` tools are present in the current tool list. If they're absent, the repo's root `.mcp.json` declares the server but it hasn't been approved/enabled in this session: stop and tell the operator to approve the project's MCP servers on repo-trust (or run `/mcp` and enable `chrome-devtools`), then restart the session. Without these tools the rest of the run is impossible — check this first.
- **Google Chrome installed** — `open -Ra "Google Chrome"` (macOS) returns success. `chrome-devtools-mcp` drives Chrome specifically; if it errors, point the operator at <https://www.google.com/chrome/>.
- `gh --version` **and** `gh auth status` — `gh` is installed *and* authenticated. A bare `--version` passing while auth is missing is a silent gap that only surfaces when the triage post fails at the very end; check both up front. If unauthenticated, instruct the operator to run `gh auth login`.
- `node --version` — Node is available (needed for the `npx`-launched MCP server).
- `git config user.email` — must return a non-empty address; used to identify the operator in the run log. If empty, instruct the operator to set it (`git config --global user.email "<your-address>"`) and stop. The address's domain *should* be `vibes.diy` or `fireproof.storage` (the team Workspace's domains). If it's something else, warn but do not abort — git identity and Vibes OAuth identity can legitimately differ (e.g. personal Gmail used for git but Workspace account used for Vibes); the run still completes, the warning surfaces in the triage's `notable_conditions`.
- `gh pr view <N> --json url,headRefOid,state` — confirm the PR exists, is `OPEN` (abort if `MERGED` or `CLOSED` — previews are torn down on close by `hosting-pr-cleanup.yaml`), and capture the head commit SHA.
- Locate the preview URL by fetching the PR's comments with `gh api repos/VibesDIY/vibes.diy/issues/<N>/comments` and finding the most recent comment by `github-actions[bot]` containing the marker `<!-- vibes-diy-preview -->`. Extract the `**Preview URL:**` line — the URL will be on `*.workers.dev` (Cloudflare Workers per-PR deployment), e.g. `https://pr-1795-vibes-diy-v2.jchris.workers.dev`. That `workers.dev` host is the correct target for PR-preview QA; **do not** rewrite it to `vibes.diy`.
- If no preview-URL comment exists, the deploy workflow probably hasn't finished. Poll the same `gh api ... /comments` endpoint every 30 seconds for up to 10 minutes. If still missing, abort with a clear message pointing the operator at `gh run list --branch <head-ref>` to investigate the deploy workflow — do not post anything.
- Read [`references/chrome-mcp-rules.md`](references/chrome-mcp-rules.md) and confirm via `evaluate_script` of `document.cookie` on the preview URL that the browser profile is clean of Vibes session state (no `__session` cookie, no signed-in `__client_uat` value, no `vibes.diy`-scoped cookies). If the profile is dirty, abort and instruct the operator to either complete Step 7's sign-out cleanup from the previous run, or wipe the profile per the *Per-engineer one-time setup* section and resign-in to Google.
- Verify the operator's Google session is persisted in the chrome-devtools profile: `new_page` to <https://accounts.google.com>, take a snapshot, and confirm a signed-in identity appears (look for the operator's address in the account chooser, or the heading "Welcome, &lt;name&gt;"). If no Google account is signed in, abort and point the operator at the *Per-engineer one-time setup* section above. The Step 4.1 OAuth sign-in will fail or stall without this.

## Step 2 — Run setup

- Derive `run_id = pr-{N}-{YYYYMMDD-HHmm}` from the current UTC time.
- Read the operator's email via `git config user.email` (e.g. `marcus@vibes.diy`). Used to label the run and identify who triggered it in the run log.
- Create `qa-reports/{run_id}/` (mkdir -p; do not commit).
- Copy [`assets/triage-template.md`](assets/triage-template.md) to `qa-reports/{run_id}/triage.md`. This is the working file. Edit it incrementally as the run proceeds, filling in placeholders.
- Append a line to `qa-reports/runs.jsonl` (create if needed) of the form `{"run_id":"...","operator_email":"...","pr":N,"started_at":"..."}`.

## Step 3 — Capture environment

Open the preview URL via `mcp__chrome-devtools__navigate_page` (new page). Without signing in, navigate to whatever route exposes the Settings page model defaults (typically `/settings` after sign-in, but model identifiers may also be visible on the homepage build form pre-auth). Record the **default Chat Model** and **default App Model** identifiers into the triage's `models_in_play` section.

If a degraded-upstream banner is visible, record it under `notable_conditions`.

## Step 4 — Phase A: Desktop spine

Phase A runs at the **default (desktop) viewport** and is the functional walkthrough — it produces the functional findings and the desktop-layout findings. Do not resize during Phase A. Walk the seven steps from [`references/sop-v0.01m.md`](references/sop-v0.01m.md), in order. The summary below is operational orchestration only — the SOP file is source of truth for *what to watch for* at each step.

1. **Sign in from cold cache.** Type a prompt into the homepage form *before* signing in (note whether it gets eaten). Click submit; the page should redirect to the auth screen with the prompt preserved (`prompt64=` URL param). Note whether a brand-new visitor lands on a "Sign in" or "Sign up" tab by default — same observation as the kmikeym SOP. Click **"Sign in with Google"** — because the chrome-devtools profile has a persisted Google session (verified in preflight), this should be a one-click "Continue as &lt;you&gt;" with no password prompt. If Google asks for a password, the preflight check missed something — abort and rerun preflight. **Clerk bot protection (Cloudflare Turnstile) was disabled for the QA flow on 2026-05-28**, so the OAuth callback should complete with no human-verification challenge — the sign-in is now fully hands-off. If a Turnstile / CAPTCHA / "verify you're human" challenge *does* appear, treat it as a Clerk config regression: the agent must **not** attempt to solve it (bot-detection challenges are never solved by the agent) — abort per the sign-in failure mode and flag it. After landing back in the chat shell, **click "New Vibe"** to ensure you're starting from a fresh project, not landing on a prior session's app. See the *Sign-in model* section at the top of this file for why the skill no longer uses email + OTP.
2. **First prompt → app generation.** Use the **Build** row from [`references/demo-prompts.md`](references/demo-prompts.md). Watch the build-in-progress feedback. Watch where the user lands when generation completes.
3. **In-app exploration.** Click the generated app's core CTA. If the outcome is ambiguous (does it work or hang?), click it and wait at least 10 seconds before forming a conclusion — do not rely on the surrounding chat copy ("fully wired" claims are a known failure mode; see [#1704](https://github.com/VibesDIY/vibes.diy/issues/1704)).
4. **Follow-up edit / theme change.** Use the **Edit** row from the prompt library. Watch the chrome, watch text repaint behavior on theme switches.
5. **Publish.** Push the app live. Watch the publish state machine — does it know it's dirty? Does the Update / "Up to date" button reflect reality?
6. **Live URL test.** Open the published URL in a new tab (cold load — this matters most for font/loading PRs). Walk the published-app action bar.
7. **Remix.** Remix the published app. Use the **Remix** row from the prompt library. Try to publish the remix; confirm the live remix URL reflects the changes.

At every step, before moving on, capture: a screenshot to `qa-reports/{run_id}/` (name it `{step}-desktop.png`), the current console messages (filtered to `["log","warn","error"]`), any failed network requests, and a one-line state note appended to the triage's working notes. Tag every Phase A finding `viewport: desktop`.

## Step 4.5 — Phase B: Mobile re-walk

After Phase A completes, resize the page to the mobile target and re-walk the surfaces Phase A produced, looking specifically for **responsive regressions**. Functional behavior was already exercised at desktop and is viewport-independent — Phase B is about layout, not re-testing logic.

1. **Resize to 390×844.** Call `mcp__chrome-devtools__resize_page` with **width: 390, height: 844** (iPhone 14 / 13 / 12 Pro CSS pixels — the most common modern iOS viewport). `resize_page` applies to the currently selected page only, so **re-apply it to any new tab** you open during Phase B (e.g. the live published URL) — a freshly opened page starts at the default viewport. The viewport stays at 390×844 for the rest of the run. If `resize_page` fails or chrome-devtools won't honor the dimensions, **do not silently report desktop screenshots as a mobile pass** — finish and post the desktop verdict, mark mobile under `path_not_tested` as "mobile re-walk skipped: resize_page failed", and note it in the summary. (See the failure mode below.)

2. **Re-visit each spine surface at 390×844**, reusing the app/publish/remix already created in Phase A — do **not** sign in again or regenerate. Walk, in order:
   - **Auth / homepage** — reload the preview URL and look at the homepage build form / chat shell at narrow width.
   - **Editor + generated app** — the app from Phase A step 2–3, viewed in the editor at mobile.
   - **Edit / theme controls** — can you reach the chat input, send a message, and operate the theme switcher at mobile?
   - **Publish controls** — is the Publish / Update / "Up to date" control reachable and legible?
   - **Live published URL** — **mandatory and highest-value:** open the Phase A published URL in a fresh tab at 390×844 (true cold mobile load — this is what real mobile users hit). Walk the published-app action bar.
   - **Remix** — the Phase A remix, viewed at mobile, plus its live remix URL at mobile.

3. **At each surface, check the mobile failure categories:** horizontal overflow / unexpected sideways scroll; touch targets smaller than ~44×44 px; text that wraps awkwardly, clips, or overlaps; modals / menus / toasts that don't fit the viewport or can't be dismissed; fixed headers or footers that cover content. Capture a screenshot named `{surface}-mobile.png` at each surface and append a one-line note. Tag every Phase B finding `viewport: mobile`. A regression that is present at *both* viewports is tagged `viewport: both` and filed once.

Apply the same discipline rules (Step 5) during Phase B — especially "reproduce before recording" (resize can momentarily reflow; reload and re-check before filing) and "after 3+ findings on one surface, write one cross-cutting pattern instead."

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
  summary: string               // one paragraph; the lead of the triage (kmikeym's "Summary" section). MUST cover both desktop and mobile.
  pr_verdict: "pass" | "fail" | "pass-with-caveats"  // single verdict over BOTH phases; if mobile-only regressions block, that lowers the verdict
  pr_verdict_reasoning: string  // one paragraph; call out separately how the PR's change held up at desktop vs mobile
  test_scope: {
    account_alias: string
    browser_profile: "clean-chrome-devtools-mcp"
    build_commit_sha: string
    viewports_tested: string[]  // always ["desktop (default)", "mobile 390×844 (iphone-14-pro)"] unless Phase B was skipped
    path_tested: string[]       // bullet strings
    path_not_tested: string[]   // bullet strings; copy from the SOP "Not yet in scope" section. If Phase B was skipped, add the mobile re-walk here.
    models_in_play: { chat: string; app: string }
    notable_conditions: string[]
  }
  findings: Array<{
    severity: "P0" | "P1" | "P2"
    viewport: "desktop" | "mobile" | "both"   // which viewport surfaced it; "both" = present at desktop and mobile, filed once
    title: string
    description: string
    why_it_matters: string
    repro_steps: string[]
    screenshots: string[]   // file paths inside qa-reports/{run_id}/ (desktop shots end -desktop.png, mobile shots -mobile.png)
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

When both phases are complete (or aborted under a documented failure mode):

1. Finalize all placeholders in `qa-reports/{run_id}/triage.md`. Verify by running `grep -oE '\{[A-Z0-9_]+\}' qa-reports/{run_id}/triage.md` — the output must be empty.
2. Post the comment:

```bash
gh pr comment <PR-NUMBER> --body-file qa-reports/{run_id}/triage.md
```

This is the single authorized GitHub write operation for the skill. Run it directly, without a confirmation prompt — the authorization is documented in this skill's *Authorization* section above.

3. Print the comment URL (`gh` prints it on success) and a one-line summary of the verdict to the session.
4. **Sign out of Vibes** to leave the chrome-devtools profile in a "Google signed in, Vibes signed out" state for the next run. Navigate to the account / settings area in the Vibes UI and click Sign out — or if a `/sign-out` route exists, navigate to it directly. Verify via `evaluate_script` that the `__session` cookie is gone (or set to expired). Skipping this leaves Vibes session state in the profile and the next run's preflight will abort on a dirty profile.

## Failure modes

- **Preview URL never ready.** Polled `gh pr view` for 10 minutes without finding a `vibes.diy` URL in `statusCheckRollup`. Abort. Do not post anything. Tell the operator the deploy workflow may have failed; point them at `gh run list --branch <ref>`.
- **OAuth sign-in fails or stalls.** Google consent returns an error, or the redirect never lands back in the Vibes app within 60 s of clicking "Sign in with Google". Set `pr_verdict = "fail"`, file a single P0 finding ("Sign-in flow blocked"), fill in the triage as far as it got, and post it. The signal that sign-in failed at all is itself a real QA finding.
- **A bot-detection challenge appears at sign-in.** Clerk bot protection (Cloudflare Turnstile) was disabled for the QA flow on 2026-05-28, so a Turnstile / CAPTCHA / "verify you're human" challenge should never surface. If one does, the agent **cannot and must not solve it** — bot-detection challenges are out of scope by policy regardless of authorization. Treat it as a Clerk config regression: set `pr_verdict = "fail"`, file a P0 ("Sign-in blocked by re-enabled bot protection"), note it under `notable_conditions`, and post the partial triage. Tell the operator to re-disable bot protection in the Clerk dashboard before the skill can run hands-off again.
- **Generation never completes (>5 min on step 2).** File a P0 finding, mark steps 3–7 as `unreached` in `path_not_tested`, post the partial triage. (Phase B has nothing to re-walk — note mobile as not exercised.)
- **`resize_page` fails or chrome-devtools won't honor 390×844 (Phase B).** Desktop already passed, so do **not** abort the whole run. Finish and post the desktop verdict; mark the mobile re-walk under `path_not_tested` ("mobile re-walk skipped: resize_page failed") and say so in the summary. Never relabel desktop screenshots as a mobile pass — that produces a misleading triage and is worse than no mobile coverage.
- **Model degraded mid-run** (visible banner, 5xx response from model). Record under `notable_conditions` and continue (matches SOP discipline).
- **chrome-devtools MCP crashes or returns persistent tool errors.** Stop. Surface the error to the operator. Do *not* post a partial triage — the data is not trustworthy.

## Cleanup notes

- The `qa-reports/{run_id}/` directory stays on the operator's machine. It is gitignored.
- The Vibes account, projects, published apps, and remix created during the run are **not** auto-deleted. Accept the clutter for v1; cleanup tooling is tracked as a follow-up.
- The runs log at `qa-reports/runs.jsonl` records every run with its operator and PR. Future cleanup tooling reads it to delete the per-run projects created in the operator's Vibes account.
