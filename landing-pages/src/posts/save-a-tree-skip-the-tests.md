---
title: "Save a tree, skip the tests: leaner CI for docs-only PRs"
date: 2026-06-28T06:30:00Z
author: "Vibes DIY"
summary: "A README typo doesn't need a Playwright suite and a Postgres cluster. Teaching docs-only PRs to skip the heavy CI work — without falling into the 'required check stuck pending' trap."
thumb: "/images/blog/save-a-tree-skip-the-tests/card.jpg"
---

A README typo doesn't need a 7.5-minute Playwright suite and a Postgres cluster. But for a long time that's exactly what it got. We make a _lot_ of docs-only commits — notes, `agents/`, blog seeds, READMEs — and every one was paying for the full `compile_test` suite plus the Postgres + Neon-proxy concurrency lane. We were booting service containers to prove that prose didn't break the build.

The preview deploy was already path-filtered, so that part was fine. The waste was the build, the docker test suite, and the pg lane. The goal was narrow: docs-only PRs run install + format-check + lint only (formatting still matters for prose), everything else runs the full cycle, and adding a code commit mid-PR re-enables the full cycle automatically.

What made it interesting wasn't the filter. It was everything that goes wrong if you write the filter the obvious way.

<figure>
    <img src="/images/blog/save-a-tree-skip-the-tests/card.jpg" alt="Illustration card: “docs? skip the suite” set over a redwood forest, in the Vibes DIY teal-and-goldenrod style." loading="lazy">
    <figcaption>A README typo doesn't need a Playwright suite — gate the work, never the trigger.</figcaption>
</figure>

## The hazard isn't the filter — it's required-check semantics

The naive fix is to slap `on.paths-ignore` on the CI workflows and call it a day. That's a trap the moment those checks are _required_ in branch protection: a workflow skipped at `on.paths` never posts a status at all, so the required check sits at "Expected — waiting for status" forever and the PR can never merge. You didn't skip the work; you wedged the merge.

The rule that's safe **whether or not** a check is required: never filter at the trigger — always run the workflow, and gate the _work_ instead.

That cashes out two different ways depending on the job:

- **Step-gate where you must keep a check green.** The `compile_test` job always runs to completion, so its status always reports. Only the expensive _steps_ inside it — the build and the docker test suite — are skipped on a docs-only PR. The check goes green because the job genuinely ran; it just did less.
- **Job-skip where the whole job is disposable.** The Postgres concurrency lane is skipped via a job-level `if:`. A skipped job posts a `skipped` conclusion, and branch protection counts that as passing. Job-skip is the right tool here precisely because the lane boots service containers a step-guard couldn't stop anyway.

Step-gate to keep a required check reporting; job-skip when the entire job is throwaway. Same goal, two mechanisms, picked by what branch protection needs to see.

<div class="table-scroll">
<table>
    <thead><tr><th>Job</th><th>Why</th><th>Mechanism</th><th>Required-check effect</th></tr></thead>
    <tbody>
        <tr><td><code>compile_test</code></td><td>Must keep a required check green</td><td>Step-gate: skip the build + docker-test steps; the job still runs to completion</td><td>Status reports green because the job genuinely ran — it just did less</td></tr>
        <tr><td>pg-concurrency lane</td><td>Whole job is disposable, and it boots service containers a step-guard can't stop</td><td>Job-skip via job-level <code>if:</code></td><td>A skipped job posts a <code>skipped</code> conclusion, which branch protection counts as passing</td></tr>
    </tbody>
</table>
</div>

## Allowlist docs — and treat everything unknown as code

Detection is one question: is _every_ changed file under a docs path? The allowlist is explicit — `docs/`, `notes/`, `agents/`, `.agents/`, `.claude/`, root `*.md`, and `LICENSE`.

It is deliberately **not** a `*.md` match. `prompts/**/*.md` is prompt _source_ — changing it changes the product — and the app imports legal markdown (`vibes.diy/pkg/app/routes/legal/*-notes.md` via `?url`), so a file-type rule would skip CI on real changes. Anything outside the allowlist — including any newly-added top-level directory — is treated as code. The failure mode is always "ran too much CI," never "skipped a real change." When in doubt, it runs everything.

## Fail open, every time

A lean run must never be the accidental result of a flaky checkout. So every uncertain path returns `docs_only=false` and runs the full cycle: a non-PR event, a base-fetch failure, a `git diff` failure, an empty diff. The base-diff itself mirrors the two-argument `git diff A B` pattern the schema-push step already uses in `vibes-diy-pr-preview.yaml` — proven plumbing, not a new invention.

## The same feature, opposite verdicts

The tell that shaped the whole design was the preview workflow. Its existing `on.paths` filter already proves that PR path filters evaluate the cumulative `base…head` diff — which is why "what if a docs PR later grows a code commit?" is a non-issue: it self-heals on the next push. That's `on.paths` being _exactly right_ for a non-required, path-scoped deploy.

And it's the same `on.paths` mechanism you must avoid on a _required_ check, where a no-status skip wedges the merge. One feature, opposite verdicts, decided entirely by whether the check gates merge. Most of the work here was noticing that the answer flips — and gating the work, not the trigger, so it never has to.

<div class="post-cta">
  <h3>Spend the cycles that matter.</h3>
  <p>We skip the tests that can't fail and run the ones that can — the same taste for "only the work that counts" that keeps Vibes apps small.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
