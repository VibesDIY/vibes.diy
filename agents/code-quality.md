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
