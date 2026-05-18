# /qa-pr Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `/qa-pr <PR#>` Claude Code skill described in [`docs/superpowers/specs/2026-05-18-qa-pr-skill-design.md`](../specs/2026-05-18-qa-pr-skill-design.md) — a skill that walks the kmikeym QA v0.01m SOP against a PR preview URL using only `mcp__chrome-devtools__*` and auto-posts a triage to the PR.

**Architecture:** One new top-level convention (`.claude/skills/` for team-shared, git-tracked Claude Code skills) plus one skill (`qa-pr`) with bundled SOP/prompt/rule references, a triage-template asset, and two Node helper scripts for Gmail-API plus-alias OTP polling. No new runtime dependencies in the main `package.json`; helper scripts use Node's built-in modules where possible.

**Tech Stack:** Markdown (SKILL.md + references + assets), Node.js ESM (`.mjs` helper scripts), Google Gmail API (REST + OAuth2 desktop client), `gh` CLI for GitHub interactions, the existing `mcp__chrome-devtools__*` MCP server already wired into this repo.

**Reference for engineers picking this up cold:**
- Spec: [`docs/superpowers/specs/2026-05-18-qa-pr-skill-design.md`](../specs/2026-05-18-qa-pr-skill-design.md)
- SOP source: [VibesDIY/vibes.diy#1694 comment IC_kwDON82qYM8AAAABCFLLbg](https://github.com/VibesDIY/vibes.diy/issues/1694#issuecomment-4434611054)
- Chrome MCP usage in this repo: [`agents/chrome-mcp-debug.md`](../../../agents/chrome-mcp-debug.md)
- Validation target: [VibesDIY/vibes.diy#1714](https://github.com/VibesDIY/vibes.diy/pull/1714)

---

## Task 1: Establish `.claude/skills/` as the team-shared skills location

**Files:**
- Modify: `.gitignore`
- Create: `.claude/skills/README.md`
- Modify: `CLAUDE.md` (Agent Rules section)

This task sets up the canonical location and the gitignore carve-out so subsequent tasks can add tracked files under `.claude/skills/`.

- [ ] **Step 1: Edit `.gitignore` to carve out `.claude/skills/` and ignore `qa-reports/`**

Open `.gitignore`. Replace the line `.claude/` (currently around line 4) with:

```
.claude/*
!.claude/skills/

# QA agent run artifacts (triage drafts, screenshots, alias log) — local-only.
qa-reports/
```

Leave the rest of `.gitignore` unchanged.

- [ ] **Step 2: Verify the gitignore behavior**

Run each of these and confirm the expected exit codes:

```bash
# Should print the .claude/* rule (file is ignored)
git check-ignore -v .claude/settings.local.json
# Expected: ".gitignore:4:.claude/*	.claude/settings.local.json"  (exits 0)

# Should print the !.claude/skills/ rule (the directory is un-ignored)
git check-ignore -v -n .claude/skills/
# Expected: ".gitignore:5:!.claude/skills/	.claude/skills/"  (exits 0, "-n" prints non-matching too)

# Should exit 1 (NOT ignored) — files in .claude/skills/ are tracked
git check-ignore .claude/skills/README.md ; echo "exit=$?"
# Expected: "exit=1"

# Should be ignored
git check-ignore -v qa-reports/anything.md
# Expected: ".gitignore:7:qa-reports/	qa-reports/anything.md"  (exits 0)
```

If any of these don't match, fix the gitignore before proceeding. The most common mistake is writing `.claude/` (with trailing slash) instead of `.claude/*` — the trailing-slash form cannot be un-ignored by the `!` rule.

- [ ] **Step 3: Create `.claude/skills/README.md` documenting the convention**

```markdown
# Team-shared Claude Code skills

This directory is the canonical location for **invokable** Claude Code skills shared across the team. It is one of the few subdirectories of `.claude/` that is **not** gitignored — the carve-out is in [`.gitignore`](../../.gitignore) (`.claude/*` + `!.claude/skills/`).

## Convention

Each skill lives in its own subdirectory:

```
.claude/skills/<skill-name>/
├── SKILL.md          # required: YAML frontmatter (name, description) + body
├── references/       # optional: markdown loaded on demand from SKILL.md
├── assets/           # optional: templates / output scaffolds the skill copies
└── scripts/          # optional: executable helpers the skill invokes via Bash
```

Claude Code auto-discovers skills under this path. Inside a session, the dev triggers a skill either by typing its slash-command form (`/<skill-name> ...`) or by describing the task in a way that matches the skill's `description` field.

## Boundary with `agents/`

- **`agents/*.md`** holds team rules and conventions (Fireproof patterns, code-quality, deploy tags, etc.). They are loaded into context by reference — from [`CLAUDE.md`](../../CLAUDE.md), from inside an agent's working session, or from another skill.
- **`.claude/skills/<name>/SKILL.md`** holds invokable, discovered skills with YAML frontmatter and optional bundled resources.

`agents/` documents *how we work*. `.claude/skills/` provides *things we invoke*.

## Adding a new skill

1. Create `.claude/skills/<your-skill>/SKILL.md`.
2. Add YAML frontmatter with `name` (kebab-case, matches the directory) and `description` (one or two sentences — what it does plus when to trigger).
3. Write the body as imperative instructions. Reference bundled resources by relative path.
4. Optionally add `references/`, `assets/`, `scripts/` for content that loads on demand.
5. Test in a fresh Claude Code session before merging.

## Existing skills

- [`qa-pr/`](qa-pr/SKILL.md) — Agent-driven QA pass against a PR preview URL using the kmikeym v0.01m SOP.
```

- [ ] **Step 4: Update `CLAUDE.md` to point at the new skills location**

Open `CLAUDE.md`. After the `## Agent Rules` paragraph (currently ending with the `flaky-tests.md` bullet at line 18), add a new section before `## Quick Reference`:

```markdown
## Team-shared skills

Invokable Claude Code skills live in [`.claude/skills/`](.claude/skills/README.md). Each skill is a directory with `SKILL.md` plus optional `references/`, `assets/`, and `scripts/`. Claude Code auto-discovers them.

- [qa-pr](.claude/skills/qa-pr/SKILL.md) — agent-driven QA pass against a PR preview URL

`agents/*.md` (above) documents *how we work*; `.claude/skills/` provides *things we invoke*. See [`.claude/skills/README.md`](.claude/skills/README.md) for the boundary.
```

- [ ] **Step 5: Verify the README is trackable**

```bash
git status -s .claude/skills/
# Expected: "?? .claude/skills/" or similar — the directory shows as untracked

git add -n .claude/skills/README.md
# Expected: "add '.claude/skills/README.md'" with no errors
```

- [ ] **Step 6: Stage and commit**

```bash
git add .gitignore .claude/skills/README.md CLAUDE.md
git commit -m "docs(skills): add team-shared .claude/skills/ convention"
```

---

## Task 2: Lift the QA v0.01m SOP into `references/sop-v0.01m.md`

**Files:**
- Create: `.claude/skills/qa-pr/references/sop-v0.01m.md`

The SOP is the agent's source-of-truth. Subsequent tasks reference it; getting it right is foundational.

- [ ] **Step 1: Write `.claude/skills/qa-pr/references/sop-v0.01m.md`**

The content below is the SOP as proposed by @kmikeym in [#1694 comment IC_kwDON82qYM8AAAABCFLLbg](https://github.com/VibesDIY/vibes.diy/issues/1694#issuecomment-4434611054), lifted verbatim except for the leading framing paragraph (which is replaced by a one-line provenance note).

```markdown
# QA v0.01m — SOP for QA'ing a preview-URL PR

> Source: [VibesDIY/vibes.diy#1694, comment by @kmikeym](https://github.com/VibesDIY/vibes.diy/issues/1694#issuecomment-4434611054). The "m" is for **manual** — this SOP was written for a human-driven walkthrough. The `qa-pr` skill applies the same spine and disciplines while driving the browser through `mcp__chrome-devtools__*`.

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
```

- [ ] **Step 2: Verify the file is non-empty and contains the spine headings**

```bash
# Confirm the file exists and is the expected size
wc -l .claude/skills/qa-pr/references/sop-v0.01m.md
# Expected: ~60–80 lines

# Confirm the seven spine steps are all present
grep -c '^[0-9]\. \*\*' .claude/skills/qa-pr/references/sop-v0.01m.md
# Expected: 7
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-pr/references/sop-v0.01m.md
git commit -m "docs(qa-pr): import v0.01m SOP from #1694"
```

---

## Task 3: Seed the demo prompt library

**Files:**
- Create: `.claude/skills/qa-pr/references/demo-prompts.md`

- [ ] **Step 1: Write `.claude/skills/qa-pr/references/demo-prompts.md`**

```markdown
# Demo prompt library for /qa-pr

Pick **one fresh prompt set per run**. Reusing prompts narrows coverage to the happy path the product has been tuned against (kmikeym, SOP v0.01m).

The agent picks a row by index `floor(run_minute % N)` so consecutive runs cycle through. Add new rows as you discover prompts that stress new surfaces; never remove a row — it's still a valid choice for older PRs.

| Stage | Prompt | Stress-tests |
|---|---|---|
| Build | *"a protein picker to help me mix up my boring eating habits"* | generic-utility-app generation |
| Edit  | *"let's change the look, can we make this have a more Windows 95 look?"* | chrome fidelity (Vibes nails Win95 incl. taskbar/Start button — good reskin canary) |
| Remix | *"make this a vegan protein picking app with lots of options already filled out for the library"* | AI interpretation of an ambiguous seed-data ask |

## Adding new prompts

A good prompt is:

- **Real-feeling.** Something a human would actually type to a tool they just found. No "test app 1." No "Lorem ipsum."
- **Tied to a stress target.** The third column is not decoration — it answers *why this prompt and not another*. If you can't fill it in, the prompt isn't pulling its weight.
- **Stable in difficulty.** Don't add prompts so demanding that the App Model can't reasonably succeed — the QA pass is for surfacing Vibes-level issues, not eval-style model capability tests.
```

- [ ] **Step 2: Verify**

```bash
grep -c '^| ' .claude/skills/qa-pr/references/demo-prompts.md
# Expected: 4  (header row + 3 data rows)
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-pr/references/demo-prompts.md
git commit -m "docs(qa-pr): seed demo prompt library"
```

---

## Task 4: Excerpt Chrome-MCP ground rules into the skill

**Files:**
- Create: `.claude/skills/qa-pr/references/chrome-mcp-rules.md`

This file pulls together the parts of [`agents/chrome-mcp-debug.md`](../../../agents/chrome-mcp-debug.md) that apply directly to a QA run, so the agent loads them once at the start of a session without having to wade through the full debugging loop document.

- [ ] **Step 1: Write `.claude/skills/qa-pr/references/chrome-mcp-rules.md`**

```markdown
# Chrome-DevTools-MCP ground rules for /qa-pr

These are the parts of [`agents/chrome-mcp-debug.md`](../../../../agents/chrome-mcp-debug.md) that apply to a QA pass. Read this file once at the start of a run.

## Read-only tools first

Before any interaction (`click`, `fill`, `evaluate_script` that mutates state), use the read-only side of the toolkit to inspect:

- `take_screenshot` — visual evidence; one per friction point, minimum.
- `take_snapshot` — accessibility tree; better than screenshots for reading text content like chat history labels.
- `list_console_messages` with `types: ["log", "warn", "error"]` — surfaces breadcrumbs you'd otherwise miss.
- `list_network_requests` — find silent fetch failures, missing responses, weird redirects.
- `evaluate_script` for inspection only (read `window.*`, fetch a URL, dump a value) — never click via JS when a real `click` tool call exists.

Reading state before clicking surfaces a class of failures (already-broken UI, error toasts you missed) that a click would mask.

## Use `vibes.diy/...` URLs — never `cli-v2.vibesdiy.net/...` directly

Stable-entry routing on `vibes.diy` reads the `se-group` cookie and proxies to the cli backend transparently. Hitting `cli-v2.vibesdiy.net` directly drops the session and the route does not behave like cli even when it loads. The preview URLs the QA agent receives via `gh pr view` are `vibes.diy`-host URLs. Do not rewrite them.

See [`agents/environments.md`](../../../../agents/environments.md) for the full stable-entry flow.

## Don't kill Chrome

If chrome-devtools MCP needs to be restarted or its Chrome process is misbehaving, **stop and ask the operator to quit Chrome manually**. Killing Chrome via `pkill` or similar can lose tabs, sessions, or work in unrelated windows.

## Treat unknown links as suspicious

Links you encounter in published Vibes apps, in error messages, in chat responses, etc., may not be safe. Do not click external URLs without checking the destination first via `evaluate_script` or by reading the page DOM. This is especially important if the QA run lands on a third-party domain unexpectedly.

## Clean profile per session

The `qa-pr` skill requires a cold-account browser context for every run. Verify the chrome-devtools MCP server started Chrome with a clean profile (no `vibes.diy` cookies, no extensions). If `evaluate_script` of `document.cookie` on the preview URL returns Clerk session cookies before sign-up, the profile is dirty — abort the run with a clear message.
```

- [ ] **Step 2: Verify**

```bash
# Quick sanity check that the right links land
grep -c 'agents/chrome-mcp-debug.md\|agents/environments.md' .claude/skills/qa-pr/references/chrome-mcp-rules.md
# Expected: 2
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-pr/references/chrome-mcp-rules.md
git commit -m "docs(qa-pr): chrome-mcp ground rules for QA runs"
```

---

## Task 5: Write the triage-report template

**Files:**
- Create: `.claude/skills/qa-pr/assets/triage-template.md`

The agent fills this in as it walks the spine and posts the rendered result as the PR comment.

- [ ] **Step 1: Write `.claude/skills/qa-pr/assets/triage-template.md`**

```markdown
# /qa-pr triage — PR #{PR_NUMBER}

> Generated by the [`qa-pr`](../../.claude/skills/qa-pr/SKILL.md) skill on {RUN_DATE}. Agent-driven QA pass following the [v0.01m SOP](../../.claude/skills/qa-pr/references/sop-v0.01m.md).

## Summary

{SUMMARY_PARAGRAPH}

## PR verdict

**{PR_VERDICT}** — {PR_VERDICT_REASONING}

## Test scope

- **Account alias:** `{ACCOUNT_ALIAS}`
- **Browser profile:** clean chrome-devtools MCP session, no extensions
- **Build commit:** `{BUILD_COMMIT_SHA}`
- **Models in play:** Chat = `{CHAT_MODEL}`, App = `{APP_MODEL}`
- **Path tested:** {PATH_TESTED_BULLETS}
- **Path NOT tested:** {PATH_NOT_TESTED_BULLETS}
- **Notable conditions:** {NOTABLE_CONDITIONS_BULLETS}

## Critical (P0)

| # | Issue | Why it matters |
|---|---|---|
{P0_ROWS}

## High-impact (P1)

| # | Issue | Why it matters |
|---|---|---|
{P1_ROWS}

## Polish (P2)

| # | Issue |
|---|---|
{P2_ROWS}

## Cross-cutting patterns

{CROSS_CUTTING_PATTERNS}

## Recommended fix order

{RECOMMENDED_FIX_ORDER}

## Methodology notes

- Session length: ~{SESSION_LENGTH_MIN} minutes.
- The walkthrough drove the findings — no pre-decided pass/fail boxes.
- All findings reproduced at least once before being recorded.
- Generated by `/qa-pr` skill version 0.1 (Claude Code, phase 1).

---

*Raw run artifacts (screenshots, network logs, console messages) live in `qa-reports/{RUN_ID}/` on the developer's machine and are not attached to this comment.*
```

- [ ] **Step 2: Verify the template has every placeholder needed for the schema**

```bash
grep -o '{[A-Z_]*}' .claude/skills/qa-pr/assets/triage-template.md | sort -u
# Expected (alphabetical):
# {ACCOUNT_ALIAS}
# {APP_MODEL}
# {BUILD_COMMIT_SHA}
# {CHAT_MODEL}
# {CROSS_CUTTING_PATTERNS}
# {NOTABLE_CONDITIONS_BULLETS}
# {P0_ROWS}
# {P1_ROWS}
# {P2_ROWS}
# {PATH_NOT_TESTED_BULLETS}
# {PATH_TESTED_BULLETS}
# {PR_NUMBER}
# {PR_VERDICT}
# {PR_VERDICT_REASONING}
# {RECOMMENDED_FIX_ORDER}
# {RUN_DATE}
# {RUN_ID}
# {SESSION_LENGTH_MIN}
# {SUMMARY_PARAGRAPH}
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-pr/assets/triage-template.md
git commit -m "docs(qa-pr): triage report template"
```

---

## Task 6: Gmail OAuth setup helper

**Files:**
- Create: `.claude/skills/qa-pr/scripts/setup-gmail.mjs`
- Test (smoke): inline via `node` invocation

The helper walks the operator through a one-time OAuth flow against a Google Cloud Desktop client and stashes the refresh token in `~/.config/vibes-qa/gmail-credentials.json`. It is run interactively before the first `/qa-pr` invocation on a given machine.

- [ ] **Step 1: Write the failing smoke test**

This is a shell-level smoke test. Save the command to run; the implementation in Step 3 must make it pass.

Smoke test command:
```bash
node .claude/skills/qa-pr/scripts/setup-gmail.mjs --help
```

- [ ] **Step 2: Run the smoke test to verify it fails**

```bash
node .claude/skills/qa-pr/scripts/setup-gmail.mjs --help ; echo "exit=$?"
```
Expected output: `Error: Cannot find module ...` and `exit=1`.

- [ ] **Step 3: Write `.claude/skills/qa-pr/scripts/setup-gmail.mjs`**

```javascript
#!/usr/bin/env node
/**
 * /qa-pr — Gmail OAuth setup
 *
 * One-time interactive flow that obtains a refresh token for a dedicated
 * Gmail mailbox and writes it to ~/.config/vibes-qa/gmail-credentials.json.
 *
 * Prerequisites the operator must complete in Google Cloud Console first:
 *  1. Create or select a project.
 *  2. Enable the Gmail API for that project.
 *  3. Configure the OAuth consent screen (External, Testing) and add the
 *     dedicated Gmail address to the test users list.
 *  4. Create OAuth credentials → Application type "Desktop". Download the
 *     JSON; locate the client_id and client_secret.
 *
 * Then run this script and follow the prompts.
 */

import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, exit, argv, env } from "node:process";

const HELP = `Usage: node setup-gmail.mjs [--help]

One-time interactive flow that obtains a Gmail API refresh token and writes
it to ~/.config/vibes-qa/gmail-credentials.json. Prompts for client_id and
client_secret on stdin, opens an OAuth authorization URL in the browser via
\`open\` (macOS) or \`xdg-open\` (Linux), then catches the redirect on
http://127.0.0.1:53682/oauth2callback.

Environment overrides:
  QA_GMAIL_CREDENTIALS  Override the credentials file path.
  QA_GMAIL_PORT         Override the local redirect port (default 53682).
`;

if (argv.includes("--help") || argv.includes("-h")) {
  stdout.write(HELP);
  exit(0);
}

const CRED_PATH =
  env.QA_GMAIL_CREDENTIALS ??
  join(homedir(), ".config", "vibes-qa", "gmail-credentials.json");
const PORT = Number(env.QA_GMAIL_PORT ?? 53682);
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const rl = createInterface({ input: stdin, output: stdout });
const clientId = (await rl.question("Google OAuth client_id: ")).trim();
const clientSecret = (await rl.question("Google OAuth client_secret: ")).trim();
rl.close();

if (!clientId || !clientSecret) {
  stdout.write("client_id and client_secret are both required.\n");
  exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    if (url.pathname !== "/oauth2callback") {
      res.writeHead(404).end();
      return;
    }
    const c = url.searchParams.get("code");
    res.writeHead(200, { "content-type": "text/plain" }).end(
      c
        ? "OK — you can close this tab and return to the terminal."
        : "Missing ?code in callback URL.",
    );
    server.close();
    if (c) resolve(c);
    else reject(new Error("OAuth callback arrived without ?code"));
  });
  server.listen(PORT, "127.0.0.1", () => {
    stdout.write(`\nOpen this URL in your browser to authorize:\n\n${authUrl.toString()}\n\n`);
  });
});

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});
const tokens = await tokenResponse.json();
if (!tokenResponse.ok || !tokens.refresh_token) {
  stdout.write(`Token exchange failed: ${JSON.stringify(tokens)}\n`);
  exit(1);
}

await mkdir(dirname(CRED_PATH), { recursive: true });
await writeFile(
  CRED_PATH,
  JSON.stringify(
    {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      scope: SCOPE,
      saved_at: new Date().toISOString(),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
stdout.write(`\nSaved credentials to ${CRED_PATH} (mode 0600).\n`);
```

- [ ] **Step 4: Run the smoke test and verify it passes**

```bash
node .claude/skills/qa-pr/scripts/setup-gmail.mjs --help ; echo "exit=$?"
```
Expected output: the `Usage: ...` block followed by `exit=0`.

- [ ] **Step 5: Confirm script is executable-as-a-module (no top-level syntax errors)**

```bash
node --check .claude/skills/qa-pr/scripts/setup-gmail.mjs
# Expected: no output, exit 0
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/qa-pr/scripts/setup-gmail.mjs
git commit -m "feat(qa-pr): gmail OAuth setup helper"
```

---

## Task 7: Gmail OTP poller

**Files:**
- Create: `.claude/skills/qa-pr/scripts/gmail-otp.mjs`
- Test (smoke): inline via `node` invocation

The skill invokes this with the plus-alias for the run. The script polls the dedicated mailbox for a recent message addressed to that alias from Clerk / Vibes, extracts the 6-digit code (or the magic-link URL), and prints it on stdout. Times out cleanly after 60 seconds.

- [ ] **Step 1: Write the failing smoke tests**

The script must support two smoke modes that work without real Gmail credentials:

Smoke test commands:
```bash
node .claude/skills/qa-pr/scripts/gmail-otp.mjs --help
node .claude/skills/qa-pr/scripts/gmail-otp.mjs vibes-qa+demo@gmail.com --dry-run
```

- [ ] **Step 2: Run the smoke tests to verify they fail**

```bash
node .claude/skills/qa-pr/scripts/gmail-otp.mjs --help ; echo "exit=$?"
# Expected: "Cannot find module ..." and exit=1
```

- [ ] **Step 3: Write `.claude/skills/qa-pr/scripts/gmail-otp.mjs`**

```javascript
#!/usr/bin/env node
/**
 * /qa-pr — Gmail OTP poller
 *
 * Usage: node gmail-otp.mjs <plus-alias> [--dry-run] [--timeout-ms=60000]
 *
 * Polls the dedicated Gmail mailbox for a recent message addressed to
 * <plus-alias> from Clerk / Vibes. Prints the first 6-digit code or
 * magic-link URL found, or "TIMEOUT" on stderr after the timeout.
 *
 * Requires credentials written by setup-gmail.mjs at
 * ~/.config/vibes-qa/gmail-credentials.json (override with
 * QA_GMAIL_CREDENTIALS).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { argv, env, exit, stdout, stderr } from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const HELP = `Usage: node gmail-otp.mjs <plus-alias> [--dry-run] [--timeout-ms=60000]

Polls the Gmail mailbox configured by setup-gmail.mjs for a recent message
addressed to <plus-alias> and prints the first 6-digit code or magic-link
URL found on stdout. Exits non-zero with "TIMEOUT" on stderr if no match
arrives within the timeout window.

Options:
  --dry-run         Print the Gmail search query and exit without contacting
                    the API. Useful for offline checks.
  --timeout-ms=N    Override the default 60000 ms poll budget.
  --help            Show this message.

Environment overrides:
  QA_GMAIL_CREDENTIALS  Override the credentials file path.
`;

const args = argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  stdout.write(HELP);
  exit(args.length === 0 ? 1 : 0);
}

const alias = args.find((a) => !a.startsWith("--"));
if (!alias || !alias.includes("@")) {
  stderr.write("First positional argument must be a full email alias.\n");
  exit(1);
}
const dryRun = args.includes("--dry-run");
const timeoutMs = (() => {
  const flag = args.find((a) => a.startsWith("--timeout-ms="));
  if (!flag) return 60_000;
  const n = Number(flag.slice("--timeout-ms=".length));
  if (!Number.isFinite(n) || n <= 0) {
    stderr.write(`Invalid --timeout-ms: ${flag}\n`);
    exit(1);
  }
  return n;
})();

// Gmail's search syntax: "to:" matches the alias as it appears in the To
// header. The 5-minute "newer_than" window keeps us from picking up
// stale OTPs from earlier runs on the same alias.
const query = `to:${alias} newer_than:5m (subject:verification OR subject:verify OR subject:code OR subject:sign)`;

if (dryRun) {
  stdout.write(`Gmail search query: ${query}\n`);
  exit(0);
}

const credPath =
  env.QA_GMAIL_CREDENTIALS ??
  join(homedir(), ".config", "vibes-qa", "gmail-credentials.json");
const creds = JSON.parse(await readFile(credPath, "utf8"));

async function getAccessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) {
    throw new Error(`Refresh failed: ${r.status} ${await r.text()}`);
  }
  const j = await r.json();
  return j.access_token;
}

async function searchMessages(token) {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "5");
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Search failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.messages ?? [];
}

async function fetchMessageBody(token, id) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${await r.text()}`);
  return r.json();
}

function extractOtp(message) {
  // Walk all text/plain and text/html parts and concatenate their decoded
  // bodies. Then look for a 6-digit run (the Clerk OTP shape) or a
  // magic-link URL.
  const parts = [];
  const walk = (p) => {
    if (!p) return;
    if (p.body?.data) parts.push(Buffer.from(p.body.data, "base64url").toString("utf8"));
    (p.parts ?? []).forEach(walk);
  };
  walk(message.payload);
  const body = parts.join("\n");
  const code = body.match(/\b(\d{6})\b/);
  if (code) return code[1];
  const link = body.match(/https:\/\/[^\s"<>]+(?:verify|magic|sign[-_]in|auth)[^\s"<>]*/i);
  if (link) return link[0];
  return null;
}

const accessToken = await getAccessToken();
const start = Date.now();
let attempt = 0;
while (Date.now() - start < timeoutMs) {
  attempt++;
  const messages = await searchMessages(accessToken);
  for (const m of messages) {
    const full = await fetchMessageBody(accessToken, m.id);
    const otp = extractOtp(full);
    if (otp) {
      stdout.write(`${otp}\n`);
      exit(0);
    }
  }
  const remaining = timeoutMs - (Date.now() - start);
  if (remaining <= 0) break;
  const backoff = Math.min(2_000 * Math.pow(1.4, attempt - 1), 8_000, remaining);
  await delay(backoff);
}
stderr.write(`TIMEOUT after ${timeoutMs}ms polling for ${alias}\n`);
exit(2);
```

- [ ] **Step 4: Run the smoke tests and verify they pass**

```bash
node .claude/skills/qa-pr/scripts/gmail-otp.mjs --help ; echo "exit=$?"
# Expected: Usage block + "exit=0"

node .claude/skills/qa-pr/scripts/gmail-otp.mjs vibes-qa+demo@gmail.com --dry-run ; echo "exit=$?"
# Expected: "Gmail search query: to:vibes-qa+demo@gmail.com newer_than:5m ..." + "exit=0"

node .claude/skills/qa-pr/scripts/gmail-otp.mjs ; echo "exit=$?"
# Expected: Usage block + "exit=1"  (no alias provided)
```

- [ ] **Step 5: Syntax-check**

```bash
node --check .claude/skills/qa-pr/scripts/gmail-otp.mjs
# Expected: no output, exit 0
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/qa-pr/scripts/gmail-otp.mjs
git commit -m "feat(qa-pr): gmail OTP poller"
```

---

## Task 8: Write the `SKILL.md` orchestration body

**Files:**
- Create: `.claude/skills/qa-pr/SKILL.md`

This is the agent's playbook. It must be complete on its own — references load on demand, but SKILL.md is what Claude Code reads when the skill triggers.

- [ ] **Step 1: Write `.claude/skills/qa-pr/SKILL.md`**

```markdown
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
- `gh pr view <N> --json url,headRefOid,statusCheckRollup` — PR exists; extract the head commit SHA and locate the preview-URL deployment check (look for entries in `statusCheckRollup` whose `name` matches `*pr-preview*` and whose `targetUrl` is a `vibes.diy` URL). If no preview URL is ready, poll every 30 seconds for up to 10 minutes; if still not ready, abort with a clear message — do not post anything.
- Read [`references/chrome-mcp-rules.md`](references/chrome-mcp-rules.md) and confirm via `evaluate_script` of `document.cookie` on the preview URL that the browser profile is clean (no `__session` or `vibes.diy` cookies). If the profile is dirty, abort and ask the operator to restart chrome-devtools MCP.

## Step 2 — Run setup

- Derive `run_id = pr-{N}-{YYYYMMDD-HHmm}` from the current UTC time.
- Derive the plus-alias: `vibes-qa+{run_id}@gmail.com`. (Adjust the local part if the team's dedicated mailbox is not `vibes-qa@gmail.com`; the alias is whatever the operator's Gmail account is, plus `+{run_id}`.)
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

1. Finalize all placeholders in `qa-reports/{run_id}/triage.md`. Verify by running `grep -o '{[A-Z_]*}' qa-reports/{run_id}/triage.md` — the output must be empty.
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
```

- [ ] **Step 2: Verify SKILL.md has valid frontmatter**

```bash
head -4 .claude/skills/qa-pr/SKILL.md
# Expected: starts with ---, has `name:` and `description:` keys, closes with ---
```

- [ ] **Step 3: Verify every referenced file exists**

```bash
for f in references/sop-v0.01m.md references/chrome-mcp-rules.md references/demo-prompts.md assets/triage-template.md scripts/gmail-otp.mjs scripts/setup-gmail.mjs; do
  test -f ".claude/skills/qa-pr/$f" && echo "OK   $f" || echo "MISS $f"
done
# Expected: all OK
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/qa-pr/SKILL.md
git commit -m "feat(qa-pr): SKILL.md orchestration body"
```

---

## Task 9: Validation — dry-run against PR #1714

**Files:** none modified (this task produces artifacts only; gitignored)

This is the spec's stated success criterion. Treat it as a real test of whether the skill ships or needs another iteration on prompts.

- [ ] **Step 1: Confirm Gmail credentials exist**

```bash
test -f "${QA_GMAIL_CREDENTIALS:-$HOME/.config/vibes-qa/gmail-credentials.json}" && echo "creds OK" || echo "RUN setup-gmail.mjs first"
```

If creds are missing, run:

```bash
node .claude/skills/qa-pr/scripts/setup-gmail.mjs
```

Follow the interactive prompts. See the script's `--help` text for the Google Cloud prerequisites.

- [ ] **Step 2: Confirm chrome-devtools MCP is reachable**

In the Claude Code session that will run the skill, verify that `mcp__chrome-devtools__*` tools are available (they should appear in the tool list). If they aren't, point the operator at [`agents/chrome-mcp-debug.md`](../../../agents/chrome-mcp-debug.md) for setup.

- [ ] **Step 3: Run the skill against PR #1714**

In a fresh Claude Code session in the repo:

```
/qa-pr 1714
```

The skill will walk the spine. Expect ~15–30 minutes of agent activity.

- [ ] **Step 4: Compare the agent's triage to @kmikeym's manual writeup**

The agent's posted comment is the comparator. The reference is the first comment on [#1694 (IC_kwDON82qYM8AAAABCDCvRw)](https://github.com/VibesDIY/vibes.diy/issues/1694#issuecomment-4432375623), which contains kmikeym's manual writeup for the same broad first-time-user pass (PR #1714 was the first SOP run target — see [#1694 comment IC_kwDON82qYM8AAAABCFLLbg](https://github.com/VibesDIY/vibes.diy/issues/1694#issuecomment-4434611054)).

Check each of:

- The agent's `pr_verdict` is a defensible match for kmikeym's "clean PR verdict" on the font-display change itself.
- The agent's P0 findings overlap with the SOP-run P0s ([#1713](https://github.com/VibesDIY/vibes.diy/issues/1713), [#1707](https://github.com/VibesDIY/vibes.diy/issues/1707), [#1712](https://github.com/VibesDIY/vibes.diy/issues/1712)) where the spine would plausibly catch them.
- The agent's cross-cutting patterns identify at least one of: "errors and progress states are under-treated," "Share is overloaded," "sibling controls without explanation," or "save handling is unreliable."

Score honestly. If overlap is poor *and* the failures look like prompt issues (the agent misread an obvious failure, hallucinated a finding, or skipped a step), iterate on the relevant SOP / SKILL.md text. If overlap is poor *and* the failures look like infrastructure issues (Chrome MCP flaked, OTP polling timed out spuriously), file those as follow-up issues and re-run before judging the skill.

- [ ] **Step 5: Decide ship-or-iterate**

If the dry-run produces a triage that a reasonable reviewer would post on PR #1714 without redaction, the skill ships and this plan is complete.

If the dry-run produces a triage with prompt-level problems, iterate on `SKILL.md` and/or `references/sop-v0.01m.md` (the actual content is the lever — there is no scaffold to change), commit the prompt changes with a `docs(qa-pr): refine ...` message, and re-run Step 3. Repeat until acceptable.

No commit for a successful dry-run unless prompt-level changes were required.

---

## Out of scope for this plan

- Standalone CLI / `workflow_dispatch` / CI auto-run (phase 2, separate spec when wanted).
- Playwright deterministic spine (Approach C, rejected during brainstorm).
- Auto-filing of P0/P1 findings as GitHub issues.
- Account/project/published-app cleanup on the Vibes backend.
- Description-optimization eval (per skill-creator) — runs after the first real PR run, not before.

## Self-review notes (engineer reading this plan)

- All tasks above include the actual content (markdown, code, commands) the engineer needs. No "TODO: implement" placeholders.
- Tasks 2–5 (the reference files and template asset) are independent; an engineer running this plan in parallel via subagents can dispatch them concurrently. Tasks 6 and 7 are also independent of each other. Task 8 requires Tasks 1–7 to be merged first (its verification step lists the files).
- The validation in Task 9 cannot be parallelized — it is a real interactive run against a real PR.
