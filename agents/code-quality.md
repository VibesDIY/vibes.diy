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
