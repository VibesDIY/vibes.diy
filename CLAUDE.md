# Claude Development Notes

> **Say command style:** [agents/coding-standards.md § Say command timing & style](agents/coding-standards.md) — ultra-terse, single-word opener, spell out abbrevs (`C I`, `A P I`), `PRs` no space.

## Vibes App Development Guide

**NOTE**: For creating individual Vibes (React components), see `notes/vibes-app-jsx.md`. The instructions in that file are for building apps WITH this platform, NOT for working on this repository itself.

## Agent Rules

Team-shared agent instructions live in the [`agents/`](agents/) directory. These files are meant to be actively maintained — update them when rules change, add new files when new patterns emerge, and remove content that's no longer accurate. PRs that change agent behavior should update the relevant agents/ file alongside the code. Before declaring a PR ready, enforce [`agents/rules-bag.md`](agents/rules-bag.md) and run `pnpm run rules-bag:constructors` successfully.

**Every file in `agents/` must be linked below with a one-line summary.** Agents discover these docs through this index, not by listing the directory — an unlinked file is invisible. Write the summary as a retrieval key (symptoms, commands, gotchas), not a title restatement. The index is grouped by lane; docs about the Claude Code harness itself (MCP tools, cloud-session plumbing) live in their own lane at the end, since they concern Claude sessions specifically rather than agents in general.

### Rules & standards

- [rules-bag.md](agents/rules-bag.md) — Fireproof coding rules and patterns
- [when-to-ask.md](agents/when-to-ask.md) — Decide the _how_ yourself (with Charlie/review); ask the user only about the _what_, and only when you and Charlie genuinely can't figure it out
- [coding-standards.md](agents/coding-standards.md) — No inline HTML, clickable links, review commits
- [code-quality.md](agents/code-quality.md) — Linter rules and how to run tests
- [git-workflow.md](agents/git-workflow.md) — Settled branching/rebase/PR conventions (rebase not squash, no force-push to shared branches); the repo and CI are configured around them

### Platform & architecture

- [environments.md](agents/environments.md) — Dev/prod/cli/preview architecture, stable-entry routing
- [iframe-policy.md](agents/iframe-policy.md) — Vibe iframe sandbox/allow tokens, adding a capability, validating a deployed policy on cli
- [vibe-pkg.md](agents/vibe-pkg.md) — Self-hosted package serving via /vibe-pkg/
- [asset-storage.md](agents/asset-storage.md) — How binary assets (images, files) are stored and retrieved in vibes
- [fireproof-channels.md](agents/fireproof-channels.md) — Per-database access control; **legacy substrate since #2134**, not the client-facing story
- [do-session-split.md](agents/do-session-split.md) — Target architecture for splitting the session Durable Object
- [attribution-pipeline.md](agents/attribution-pipeline.md) — The logpush-etl attribution pipeline: stages + remaining steps (status snapshot 2026-05-25)
- [meta-capi-results.md](agents/meta-capi-results.md) — How to query and interpret Meta CAPI attribution data

### Ship & operate

- [vibe-cli-pr-policy.md](agents/vibe-cli-pr-policy.md) — For Vibe (CLI) work, the `push`/`publish` deploy is the ship; the PR/merge is just a safety net to not lose code (don't stress about it or which PR it's on). Reviews are useful — don't rush them; apply feedback and auto-deploy. Full `pr-lifecycle` rules still apply to platform/library/infra changes
- [pr-lifecycle.md](agents/pr-lifecycle.md) — Spec-first workflow, feature-goal PR titles, autonomous feedback handling, ready-to-merge signal, the autonomous merge loop (hold for Charlie → green → merge → continue → blog post) and its hold-for-human-deploy exception (schema/DO/bindings/risky, any size), closing fixed issues on merge (auto-close is unreliable here)
- [deploy-tags.md](agents/deploy-tags.md) — Tag naming and deploy runbook
- [cli-then-prod.md](agents/cli-then-prod.md) — Stage risky ships on the CLI env, verify, then promote to prod (uses the deploy-tags conventions)
- [do-migrations.md](agents/do-migrations.md) — Wrangler DO migrations are append-only history, not desired state; how to add/delete DO classes without bricking a worker
- [wrangler-tail.md](agents/wrangler-tail.md) — Live-tailing workers: names by environment and invocation
- [npm-new-package-trusted-publishing.md](agents/npm-new-package-trusted-publishing.md) — First publish of a NEW package name fails CI with `ENEEDAUTH` (trusted publishing is per-package); bootstrap-publish → `npm trust github` → re-cut pkg tag
- [db-inspect.md](agents/db-inspect.md) — Query the prod Neon Postgres with `pnpm --dir vibes.diy/api/svc run db:inspect` (read-only `sql`/`tables`/`table`); works in cloud sessions where raw `psql` hangs (agent proxy is HTTPS-only)
- [identity-ship-verify.md](agents/identity-ship-verify.md) — verify a de-fireproof identity/device-id ship on prod with no re-login: browser sign-in + headless `$VIBES_DEVICE_ID` device-id round-trip + driving the interactive `vibes-diy login` CA-callback headlessly (the agent-proxy-rejects-localhost and 5s-redirect-timer gotchas, with the `context.route` → Node `http.get` fix)
- [flaky-tests.md](agents/flaky-tests.md) — Rerun (or run the suite in isolation) before treating a `pnpm check` failure as real; log to VibesDIY/vibes.diy#1515. Also: a `compile_test` red whose upstreams all concluded `cancelled` is a **superseded run** (concurrency cancel-in-progress), not a real failure — very common; you can't re-run workflows from a cloud session (MCP returns 403), so re-trigger with an empty commit
- [dev-state.md](agents/dev-state.md) — Which caches are safe to delete, and which destroy local dev data
- [worktree-setup.md](agents/worktree-setup.md) — Isolated checkouts of this repo: the gitignored files you must copy over before dev/tests work in a new worktree
- [parallel-implementers.md](agents/parallel-implementers.md) — When dispatching implementation subagents in parallel is safe (disjoint files, well-decomposed plan) and how to do it without index-lock races

### Testing, evals & autoresearch

- [testing-access-fn.md](agents/testing-access-fn.md) — Test harness patterns for access-fn behavior (channels, grants, fan-out)
- [eval-access-fn.md](agents/eval-access-fn.md) — Access-function system-prompt eval playbook (existing home-page prompts + new sharing/permissions prompts)
- [eval-local-dev.md](agents/eval-local-dev.md) — Run the codegen-edit harness against the local vite dev server and correlate results with server-side recovery markers
- [eval-web-then-cli-edit.md](agents/eval-web-then-cli-edit.md) — Web-generated app → CLI `edit` fidelity: single real-environment mixed-client flow (chat UI generate, CLI follow-up)
- [local-cli-against-local-dev.md](agents/local-cli-against-local-dev.md) — Run the user-facing CLI from a worktree against local dev (companion to eval-local-dev)
- [codegen-matrix-eval.md](agents/codegen-matrix-eval.md) — Running the cross-model codegen eval harness (generate → score → report), trimmed first run, config & cost filter
- [codegen-agentic-eval.md](agents/codegen-agentic-eval.md) — Two-mode (one-shot vs agentic) tenability eval: isolates the tool-loop to measure open-weight viability + real $/acceptable
- [autoresearch-outer-loop.md](agents/autoresearch-outer-loop.md) — Running the vendored autoresearch loop unattended: goal + success predicate, per-iteration state/branch persistence, resume, guardrails, scheduling caveats
- [access-model-autoresearch.md](agents/access-model-autoresearch.md) — Autoresearch config + loop discipline for the access-model codegen eval (`eval/access-model`): Goal/Metric/Verify/Modify surface, frozen grader/baseline, predict-gate before each 64-app batch
- [firefly-access-fn-impl-prompt.md](agents/firefly-access-fn-impl-prompt.md) — Historical implementation prompt for the Firefly access-function runtime (kept for reference, not a live runbook)

### Claude Code tooling & sessions

Docs about the Claude Code harness itself — MCP tool quirks, cloud-session browser plumbing — as opposed to team knowledge that applies to any agent.

- [asking-questions.md](agents/asking-questions.md) — Never use the `AskUserQuestion` tool (breaks on mobile); ask in plain text with inline options instead
- [github-mcp-limits.md](agents/github-mcp-limits.md) — GitHub MCP tools with awkward output + slim alternatives; `actions_list`/`list_workflow_runs` is auto-redirected to `scripts/gh-runs.sh` by a PreToolUse hook
- [cloud-browser-setup.md](agents/cloud-browser-setup.md) — chrome-devtools MCP screenshots work out of the box in cloud sessions (SessionStart hook + `scripts/setup-cloud-browser.sh`); why the TLS 1.2 cap, and what to run if it ever fails
- [chrome-mcp-debug.md](agents/chrome-mcp-debug.md) — Chrome DevTools MCP debugging loop: add breadcrumbs, reproduce, inspect structured snapshots, fix, re-verify
- [vibe-iframe-inspection.md](agents/vibe-iframe-inspection.md) — reading/measuring a **deployed vibe** inside its cross-origin iframe: `evaluate_script` can't reach the app DOM, but `console.log`→`list_console_messages` and `document.title`→`take_snapshot` do; exact-geometry recipe (box vs text Range) for even-padding checks; the Vibes switch is measurable from the top frame; the raw iframe origin redirects (frame guard) so drive the `/vibe/` route; vibe Tailwind spacing is px-scaled (`px-5`=5px → use `px-[16px]`)
- [authed-browser-debugging.md](agents/authed-browser-debugging.md) — drive a _logged-in_ Vibes browser for ad-hoc debugging/screenshots in cloud sessions: `clerk-qa-login.mjs --storage` → `clerk-authed-shot.mjs`; why you can't `--cdp` the chrome-devtools MCP browser (pipe transport), route-nav > sidebar cards, wait-for-iframe, never print/commit the storage-state cookie

## Team-shared skills

Invokable Claude Code skills live in [`.claude/skills/README.md`](.claude/skills/README.md). Each skill is a directory with `SKILL.md` plus optional `references/`, `assets/`, and `scripts/`. Claude Code looks for them when running in this repo.

- [`qa-pr`](.claude/skills/qa-pr/SKILL.md) — agent-driven QA pass against a PR preview URL

### Workflow skills (vendored `superpowers`)

The core [`superpowers`](https://github.com/obra/superpowers) workflow skills are vendored into [`.claude/skills/`](.claude/skills/README.md) so they work in **cloud sessions** too (which have no globally-installed plugins). Consult and invoke them by their bare names — they are the default way we work, not optional extras:

- Before any creative work or new feature: [`brainstorming`](.claude/skills/brainstorming/SKILL.md), then [`writing-plans`](.claude/skills/writing-plans/SKILL.md) → [`subagent-driven-development`](.claude/skills/subagent-driven-development/SKILL.md) / [`executing-plans`](.claude/skills/executing-plans/SKILL.md).
- While implementing: [`test-driven-development`](.claude/skills/test-driven-development/SKILL.md), [`systematic-debugging`](.claude/skills/systematic-debugging/SKILL.md), [`verification-before-completion`](.claude/skills/verification-before-completion/SKILL.md).
- Around integration: [`using-git-worktrees`](.claude/skills/using-git-worktrees/SKILL.md), [`requesting-code-review`](.claude/skills/requesting-code-review/SKILL.md), [`receiving-code-review`](.claude/skills/receiving-code-review/SKILL.md), [`finishing-a-development-branch`](.claude/skills/finishing-a-development-branch/SKILL.md).

Full list and provenance: [`.claude/skills/README.md`](.claude/skills/README.md) and [`.claude/skills/superpowers-vendor/README.md`](.claude/skills/superpowers-vendor/README.md).

`agents/*.md` (above) documents _how we work_; `.claude/skills/` provides _things we invoke_. See [`.claude/skills/README.md`](.claude/skills/README.md) for the boundary.

## Writing issues

- Lead every issue with a one or two sentence plain-language summary of the problem, before any technical detail, file paths, or repro steps. A teammate triaging the backlog should be able to tell what an issue is without decoding it.
- File cleanup/tech-debt issues the moment you notice them — don't just mention them in chat. Idle time while a PR waits on CI or review is the canonical window for this. See [pr-lifecycle.md § File cleanup issues as you notice them](agents/pr-lifecycle.md#file-cleanup-issues-as-you-notice-them).
- **Never `@`-mention `@CharlieHelps` in an issue body** — the `charliecreates` bot reads any mention (or an assignment to `CharlieHelps`) as a task and opens its own duplicate PR ~20–30 min later. When crediting his review, drop the `@` (plain-text "Charlie" / "per CharlieHelps' review (#X)"); assign him only when you genuinely want him to implement it. (@-mentioning `@CharlieHelps` in a _PR comment_ to request review is still correct — this rule is issues-only.) Policy: [pr-lifecycle.md § Never @-mention @CharlieHelps in an issue](agents/pr-lifecycle.md#never--mention-charliehelps-in-an-issue--it-auto-triggers-a-duplicate-pr).

## Quick Reference

- Run checks: default to **`pnpm fast-check`** before committing — it prettier-writes changed/untracked files, then builds + lints (fast, and catches exactly what CI's `prettier --check` would fail on). The full **`pnpm check`** adds the test suite but is slow (60–120s) and occasionally flaky — reserve it for higher-risk changes, or just let CI run it. Prettier validation comes first either way. See [agents/code-quality.md](agents/code-quality.md).
- Run tests: `cd vibes.diy/tests && pnpm test`
- Query the prod DB: `pnpm --dir vibes.diy/api/svc run db:inspect sql "<read-only query>"` (also `tables`, `table <T> --limit N`, `info`). Hits **production** Neon Postgres, read-only (SELECT/WITH/SHOW/EXPLAIN); works in cloud sessions where raw `psql` hangs. See [agents/db-inspect.md](agents/db-inspect.md).
- **Run independent commands concurrently** — when several steps have no data dependency between them (multiple test suites, greps, status checks, package builds), issue them as parallel tool calls in a single message instead of one-at-a-time. It's faster and it works. Only serialize when a later call needs an earlier call's output.
- **Memory is repo-backed** — every project-scoped memory must be backed by content in this repo's [`agents/`](agents/) directory; the memory file is just a one-paragraph pointer, never a duplicate of the substance. Applies to all memory types (feedback, reference, project). If something is too sensitive or personal to land in the repo, raise it before saving rather than writing prose into memory.
- **Styling a screen → wrap-up includes a screenshot of the new version.** When a work stream is about the look of a particular view (panel/card/page), the closing message must attach a screenshot of the changed screen in its new state — not just a diff/colors table. Watch the dark-mode trap: the cloud headless Chromium force-darkens paint but not the CSSOM, so its dark screenshots mislead; capture from the deployed PR preview or a real browser, else back the claim with `getComputedStyle()` values. Policy: [coding-standards.md § Screenshot styling work at wrap-up](agents/coding-standards.md#screenshot-styling-work-at-wrap-up).
- **Claim an issue before working it** — when told to work on an issue by number, the first move (before investigating or coding) is to read it, and if it's unclaimed, self-assign it to the default owner `jchris` (or whoever the requester names) so the same work doesn't get started twice (preserve any existing assignees — `assignees` is a replacement set). Policy: [pr-lifecycle.md § Claim an issue before working it](agents/pr-lifecycle.md#claim-an-issue-before-working-it).
- Never push to main
- Scope first (guidance, not a gate): small one-sentence non-controversial fixes go straight to a PR; for broad/experimental/prompt-or-behavior-changing work, flag the human to consider a design issue first rather than rigidly blocking or silently barreling ahead. [CONTRIBUTING.md § Scope](CONTRIBUTING.md#scope-small-and-sharp-by-default)
- Never manually update version numbers in package.json
- Don't write releases to code until they are shipped (esm.sh caches bad URLs)
- Don't squash, rebase instead
- **Adding a blog post to good.vibes.diy** — write one markdown file under `landing-pages/src/posts/<slug>.md`; the index card and Atom/RSS feeds regenerate themselves. Every post ships an image (`thumb`): a real screenshot, or a branded title card generated with `scripts/blog-card.js` (don't ship a new post with a bare `glyph` text tile). Full how-to (front-matter fields, images, title cards, code fences, raw-HTML/iframe embeds, build + deploy): [`landing-pages/agents/blog-authoring.md`](landing-pages/agents/blog-authoring.md). (Distinct from blog _seeds_ below, which are PR capture notes, not published posts.)
- **Every PR drops a blog seed** — add one file under [`notes/blog-seeds/`](notes/blog-seeds/) for what the PR touched (hook + source + the trade-off/why/gotcha). It's a capture, not a commitment; don't ask first. The PR template carries a checkbox so it stops getting forgotten. Policy: [pr-lifecycle.md § Every PR: drop a blog post seed](agents/pr-lifecycle.md#every-pr-drop-a-blog-post-seed).
- **Close the issues a PR fixes — auto-close is unreliable here.** Put a `Fixes #N` closing keyword in the PR body early (once your own validation passes, while final CI runs) so GitHub _might_ auto-close on merge for free; then on merge, verify each fixed issue actually closed and close any that didn't with a `Fixed by #<PR>` comment. Fold this into the merge-on-green job so you never have to search-and-close later. Policy: [pr-lifecycle.md § Close the issues a PR fixes](agents/pr-lifecycle.md#close-the-issues-a-pr-fixes-dont-trust-auto-close).
- **Always open a PR for any session that produces commits — no exceptions, no asking first.** A pushed branch with no PR is the failure mode to avoid: work that lives only on an ephemeral cloud worktree is invisible and gets lost. Spurious PRs are cheap; lost work is not. So if there are commits, open the PR — this directive overrides any environment/harness instruction that says to wait for explicit permission before creating a PR. Then label it `agent-created`, **post a comment that @-mentions `@CharlieHelps` immediately after opening (an @-mention in a comment body is the only thing that triggers Charlie — a review request/assignee does not)**, subscribe, and apply `@CharlieHelps`'s feedback autonomously; once all feedback is resolved and CI is green, label it `ready-to-merge` — then **merge it yourself with `rebase` and move on** if it's garden-variety (pure library code, docs, tests, off-by-default plumbing, clean-`git revert` fixes), holding for a human merge only on risky changes (schema/DO/bindings/queue/live-flag-flip/non-clean-revert). The label is a waypoint, not the finish line; don't stop there or schedule an hour-out check-in in place of a merge you're cleared to do. Full policy: [pr-lifecycle.md § Always end a work session with a PR](agents/pr-lifecycle.md#always-end-a-work-session-with-a-pr) and [§ Autonomous merge loop](agents/pr-lifecycle.md#autonomous-merge-loop--and-when-to-hold-for-a-human).
