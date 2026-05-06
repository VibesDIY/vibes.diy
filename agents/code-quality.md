# Code Quality

The linter enforces no `any`, no unused vars, no unused imports, `import type` for type-only imports. Run `pnpm check` before submitting — it runs format, build, test, and lint.

## Dependencies

When updating any dependency version, always update it across **all** workspace packages — never bump a single package in isolation. CI runs `pnpm dedupe --check` and will fail on version splits.

```bash
pnpm update <pkg>@<version> -r   # update repo-wide
pnpm dedupe                       # clean up lockfile
pnpm dedupe --check               # verify (must exit 0)
```

## Tests

During development, use fast targeted commands:

- `pnpm build` — fast typecheck/compile
- `pnpm test <substring>` — run specific test files by pattern match (e.g. `pnpm test access.test`)

Save `pnpm check` for the final gate before committing — it takes a long time and has occasional flaky failures.

Run vibes.diy tests: `cd vibes.diy/tests && pnpm test`
Run vibes.diy tests (quiet): `cd vibes.diy/tests && pnpm test --reporter=dot`

### Slow test workflow

For slow tests (API tests take ~20s), capture output to a file and grep it instead of re-running:

```bash
pnpm --dir vibes.diy/api/tests test > /tmp/api-test-output.txt 2>&1
grep -E '×|✓|Tests' /tmp/api-test-output.txt          # summary
grep -A10 -E 'FAIL.*test-name' /tmp/api-test-output.txt   # specific failure
grep -E 'SQLITE_BUSY|Error' /tmp/api-test-output.txt     # root causes
```

### pnpm check workflow

`pnpm check` runs format + build + test + lint and can take 60–120s. Always tee output to a file so you can re-grep without re-running:

```bash
pnpm check > /tmp/check.log 2>&1
grep -E '^ FAIL|Failed Suites|Failed Tests|Tests  |ELIFECYCLE' /tmp/check.log   # summary
grep -B2 -A20 'specific-test-name' /tmp/check.log                                # drill in
```

### `pnpm check` vs `pnpm fast-check`

For low-risk changes (docs, copy tweaks, comment edits, isolated UI text), use `pnpm fast-check` before committing. It runs prettier on changed/untracked files plus `pnpm build` — fast and catches the formatting issues CI's `prettier --check` will fail on.

For higher-risk changes (logic, refactors, anything touching tests), run the full `pnpm check` (build + lint + test + hosting-tests) as the pre-commit gate.

Default to `pnpm fast-check` for trivial/text-only commits. Escalate to `pnpm check` when the change could plausibly break tests or lint — anything touching code paths that have test coverage.

## Pure refactors are welcome on their own commits

Pure refactors (renames, extractions, file splits, dead-code removal, type tightening) that are well supported by existing tests — green before and after with no behavior change — are encouraged. Land them as their own commits, separate from behavior changes:

- Suggest a refactor whenever the code shape gets in the way (e.g. a 1500-line file with four concerns).
- Confirm test coverage exists for the area first; if not, write the missing tests as a separate prior commit.
- Land the refactor as its own commit (or its own PR for larger ones) with a message that explicitly says "no behavior change."
- Never bundle a refactor with a bug fix or feature — split them.

Keeping refactors isolated makes diffs reviewable, makes regressions bisectable, and lets the test suite prove the refactor is actually behavior-preserving.

## Treat api/svc/public and api/tests as core code

Files under `vibes.diy/api/svc/public/` (e.g. `prompt-chat-section.ts`) and `vibes.diy/api/tests/` sit on the API boundary and are load-bearing for everything downstream. A "small fix" to a handler or a test helper can break invariants other code depends on, force days of integration cleanup, or invalidate assumptions in callers that aren't obvious from the diff.

- Write the test first (or extend an existing one) before changing behavior.
- Think architecturally: if the change feels structural (renaming, splitting, extracting), pause and lay out the shape before editing. Don't refactor and fix behavior in the same commit.
- Prefer additive changes (new field, new code path behind a guard) over modifying existing flows.
- When the change is non-trivial, flag it explicitly in the PR description and call out the architectural concern, not just the symptom.

## No raw SQL in deployed code

All database queries in `vibes.diy/api/` must use Drizzle ORM's query builder — `.select()`, `.insert()`, `.update()`, `.delete()` against schema table references. Even `db.execute(sql\`...\`)` counts as raw SQL and is unacceptable for deployed code. Raw SQL bypasses the type safety and schema validation Drizzle provides and creates ongoing maintenance burden.

For Postgres-specific features (generate_series, jsonb lateral joins) where Drizzle has no direct construct, find a Drizzle-compatible alternative or escalate before writing raw SQL. This rule applies with extra force in `vibes.diy/api/svc/`.

## Don't duplicate or undermine test infrastructure

Don't create alternative test setup patterns or modify the shared test context (`vibes.diy/api/tests/vibe-diy-test-ctx.ts`). The existing vitest setup is authoritative. When writing tests in `vibes.diy/api/tests/`, use the existing `createVibeDiyTestCtx` pattern. If the test infra genuinely needs changes, raise it as its own discussion before editing — duplicating setup or quietly changing the context undermines all existing tests.

## Run CI/deploy waits in the background

Foreground sleeps block the conversation while waiting on a deploy or CI run — the user can't do other work in the meantime. When waiting for a GitHub Actions run:

1. Check recent job durations with `gh run list` to estimate wait time.
2. Run the sleep + status check in the background (e.g. via `run_in_background: true` in the Bash tool).
3. Continue the conversation — the notification fires when the check completes.

See [deploy-tags.md](deploy-tags.md) for the canonical "wait for the deploy" `until` loop.
