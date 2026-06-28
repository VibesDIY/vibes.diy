# Save a tree, skip the tests: a leaner CI cycle for docs-only PRs

_(and how to do it without the "required check stuck pending" trap)_

Source: #2725 — `actions/changed-scope` (new), `actions/base`, `ci.yaml`,
`pg-concurrency-ci.yaml`

A README typo doesn't need a 7.5-minute Playwright suite and a Postgres cluster.
But that's exactly what it got: we do a lot of docs-only commits (notes, agents/,
blog seeds, READMEs), and every one was paying for the full `compile_test` suite
plus the Postgres + Neon-proxy concurrency lane — spinning up containers to prove
that prose didn't break the build. The preview deploy was already path-filtered, so
that part was fine — the waste was build + docker test + the pg lane. The goal:
docs-only PRs run install + format-check + lint only (formatting still matters for
prose), everything else runs the full cycle, and adding code mid-PR re-enables it
automatically.

Decisions worth a full post:

- **The real hazard isn't the filter, it's required-check semantics.** The naive
  fix — slap `on.paths-ignore` on the CI workflows — is a trap when those checks are
  *required* in branch protection: a workflow skipped at `on.paths` never posts a
  status, so the required check sits "Expected — waiting for status" forever and the
  PR can't merge. The fix that's safe **whether or not** a check is required: never
  filter at `on.paths`. Always trigger the workflow; gate the *work*, not the
  trigger. For `ci.yaml` that means the `compile_test` job always runs to completion
  (so its status always reports green) and only the build + docker-test *steps* are
  skipped. For the pg lane it means the job is skipped via job-level `if:` — a
  skipped job posts a "skipped" conclusion, which branch protection counts as
  passing. Step-gate where you must keep a check green; job-skip where the whole job
  is disposable (and would otherwise boot service containers a step-guard can't stop).

- **Allowlist docs, not file types — and default unknown → code.** The detection is
  "is *every* changed file under a docs top-level path?" with an allowlist
  (`docs/ notes/ agents/ .agents/ .claude/`, root `*.md`, `LICENSE`). It is
  deliberately NOT a `*.md` match: `prompts/**/*.md` is prompt *source*, and the app
  imports legal markdown (`vibes.diy/pkg/app/routes/legal/*-notes.md` via `?url`), so
  a file-type rule would skip CI on real changes. Anything outside the allowlist —
  including any newly-added top-level directory — is treated as code, so the failure
  mode is "ran too much CI," never "skipped a real change."

- **Fail open, every time.** Non-PR event, base fetch failure, `git diff` failure,
  empty diff → all return `docs_only=false` (full CI). A lean run can never be the
  result of a flaky fetch or a shallow-checkout edge case. Mirrors the two-arg
  `git diff A B` base-diff pattern already used by the schema-push step in
  `vibes-diy-pr-preview.yaml`.

Gotcha that shaped the design: the preview workflow was the tell. Its existing
`on.paths` already proves that PR path filters evaluate the cumulative base…head
diff, so a docs PR that later gets a code commit self-heals on the next push — that's
why "what if a docs PR grows real changes?" is a non-issue. But the same `on.paths`
mechanism is exactly what you must avoid on a *required* check. Same feature, opposite
verdict depending on whether the check gates merge.
