---
title: "Shard the runners: a leaner CI cycle that costs $0"
date: 2026-06-28T07:00:00Z
author: "Vibes DIY"
summary: "We almost bought a bigger CI machine. Instead we fanned the suite across free runners, taught docs-only PRs to skip the heavy work, and put the failed-test names where triage actually looks."
glyph: "shard the runners"
---

The ticket started simple: CI feels slow, give it a bigger machine. The obvious move is a GitHub-hosted larger runner — more cores, faster suite, done. We almost did it. Then we pulled the Actions log first, and the answer changed.

## The log changed the plan

The slow thing wasn't "CI." It was one job. The single `compile_test` job runs about 6 minutes, almost all of it the `./actions/base` composite, and almost all of *that* is a ~4-minute Docker Playwright/vitest suite. Everything else is already cheap: the pg-concurrency lane is ~2 min, the PR preview ~90s. So a bigger machine would have spent money speeding up the parts that weren't the problem.

Then the twist that killed the larger-runner plan: **`vibes.diy` is a public repo.** Standard runners are free, unlimited, and concurrent on public repos — CI costs us $0 today. Larger runners are *not* free even on public repos; they bill per-minute and require upgrading the org to a paid Team plan. The "bigger machine" route flips CI from $0 to paying on two axes. The free path was sitting right there: don't buy one fast runner, fan the suite out across several free standard ones.

`vitest --shard` made that nearly free to wire up. The root `test` is one `vitest --run` over a 17-project, 353-file workspace; `--shard=i/N` splits the sorted file list with no per-project plumbing. The only duplicated cost is the `api/tests` libsql `globalSetup` — a few-second `drizzle-kit push` — re-running per shard, which is trivial against a 4-minute suite. The heavy Postgres setup stays in its own lane, untouched.

Two things made the split safe rather than scary:

- **`build` is a typecheck, not a test prerequisite.** `pnpm run build` is `core-cli tsc`. The pg-concurrency lane and `test:all` already run the suite with no build step, which proves vitest resolves workspace deps straight from source. So the shards skip format/lint/build entirely (`run-checks: 'false'`) and those run once in a dedicated `checks` job instead of redundantly across every shard.
- **Keep the required-check name on a gate job.** Splitting `compile_test` into `checks` plus a `test` matrix would have renamed the required branch-protection check — and broken the deploy-time "is this SHA `compile_test`-green?" lookup in `actions/base`. The fix is a tiny final job still *named* `compile_test` that `needs` the others and fails if any concluded non-success/non-skipped. It's `always()`-guarded so it can still report red, and it treats a skipped upstream as a pass.

## A README typo doesn't need Postgres

While we were in there, the second leak: we do a *lot* of docs-only commits — notes, `agents/`, blog seeds, READMEs — and every one was paying for the full `compile_test` suite plus the Postgres + Neon-proxy concurrency lane. We were booting containers to prove that prose didn't break the build.

The naive fix is to slap `on.paths-ignore` on the CI workflows. That's a trap when those checks are *required* in branch protection: a workflow skipped at `on.paths` never posts a status, so the required check sits "Expected — waiting for status" forever and the PR can't merge. The rule that's safe whether or not a check is required: **never filter at the trigger; gate the work.** `compile_test` always runs to completion so its status always reports green — only the build and docker-test *steps* are skipped. The disposable pg lane is skipped via a job-level `if:`, and a skipped job posts a "skipped" conclusion, which branch protection counts as passing.

Detection is an allowlist, not a file-type match: is *every* changed file under a docs path (`docs/ notes/ agents/ .agents/ .claude/`, root `*.md`, `LICENSE`)? It's deliberately not a `*.md` rule — `prompts/**/*.md` is prompt source, and the app imports legal markdown via `?url`. Anything outside the allowlist, including any newly-added top-level directory, is treated as code. The failure mode is always "ran too much CI," never "skipped a real change." And it fails open: a non-PR event, a base-fetch failure, an empty diff — all return `docs_only=false` and run the full cycle.

## Diagnostics in a pipe nobody reads

The last fix is the smallest and the most quietly important. `compile_test` already wrote a beautiful failure breakdown — per-test FAIL lines, suite import errors, unhandled rejections — into the step summary and an uploaded `test-timing.json` artifact. What it did *not* do was put any of that in the raw job log. The only thing printed there was the aggregate: `parse-test-timing: 342 files, 2874 tests, 4 failed`.

So anyone diagnosing a red PR through the logs API — or an agent that only has log access — could see *that* four tests failed but had to download and JSON-parse an artifact to learn *which*. The fast path degraded to "just re-run and hope," which is exactly the flaky-vs-real call our gating is supposed to make cheap. The fix was one additive block: before the aggregate line, also echo each failing identity to stderr — `FAILED: <file> > <test>` per assertion, a `FAILED (suite):` line for import failures, `UNHANDLED:` for the rejections. The summary and artifact are untouched; the names just *also* land in the stream now.

Rich diagnostics in a channel the consumer can't read is the same as no diagnostics. The cheapest place to surface a fact is the stream people are already tailing.

<div class="post-cta">
  <h3>Ship faster, not pricier.</h3>
  <p>The same instinct that keeps our CI free keeps your apps simple: build the thing, skip the ceremony.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
